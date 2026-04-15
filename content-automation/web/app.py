from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel

from core.bridge import build_enriched_message, extract_params
from core.models import ResearchGoal, ResearchRequest, TaskRequest
from core.orchestrator import run_agent, run_chat, run_workflow
from research.orchestrator import run_research
from core.router import route
from storage.conversation_store import append_message, load, set_mode, update_params
from storage.output_store import list_results, save_result
from storage.research_store import (
    delete_all_research_results,
    delete_research_result,
    list_research_results,
    save_research_result,
)
from storage.trend_store import load_latest_scan
from storage.opportunity_store import (
    append_card_message,
    get_card,
    list_cards,
    update_card,
)
from core.models import OpportunityStatus
from scheduler import set_broadcast_callback, start_scheduler
from web.auth import create_token, revoke_token, verify_password, verify_token


# ── ConnectionManager: WebSocket 다중 연결 관리 ────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections = [c for c in self._connections if c is not ws]

    async def broadcast(self, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_text(json.dumps(data, ensure_ascii=False))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 스케줄러에 브로드캐스트 콜백 주입
    set_broadcast_callback(_manager.broadcast)
    scheduler_tasks = start_scheduler()
    app.state.scheduler_tasks = scheduler_tasks
    app.state.workspace_jobs = {}
    try:
        yield
    finally:
        for task in scheduler_tasks:
            task.cancel()
        for task in scheduler_tasks:
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Content Automation", lifespan=lifespan)

_STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


# ── 인증 ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    password: str


class WorkspaceRequest(BaseModel):
    message: str


class WorkspaceJobCreateResponse(BaseModel):
    job_id: str


def _jobs_store() -> dict[str, dict[str, Any]]:
    return app.state.workspace_jobs


def _set_job(job_id: str, **updates: Any) -> None:
    jobs = _jobs_store()
    current = jobs.get(job_id, {})
    current.update(updates)
    jobs[job_id] = current


@app.post("/api/login")
async def login(body: LoginRequest, response: Response) -> JSONResponse:
    if not verify_password(body.password):
        return JSONResponse({"error": "비밀번호가 틀렸어요"}, status_code=401)
    token = create_token()
    response.set_cookie("token", token, httponly=True, samesite="lax", max_age=86400 * 7)
    return JSONResponse({"token": token})


@app.post("/api/logout")
async def logout(request: Request, response: Response) -> JSONResponse:
    token = request.cookies.get("token")
    if token:
        revoke_token(token)
    response.delete_cookie("token")
    return JSONResponse({"ok": True})


@app.get("/api/me")
async def me(request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"authenticated": False}, status_code=401)
    return JSONResponse({"authenticated": True})


@app.get("/api/trends")
async def trends(request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    latest = await load_latest_scan()
    if not latest:
        return JSONResponse(
            {
                "generated_at": None,
                "opportunities": [],
                "status": "empty",
            }
        )
    return JSONResponse(
        {
            "generated_at": latest.generated_at.isoformat(),
            "opportunities": [item.model_dump() for item in latest.opportunities],
            "status": "ok",
        }
    )


@app.get("/api/research/archive")
async def research_archive(request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return JSONResponse({"items": await list_research_results()})


@app.delete("/api/research/archive")
async def delete_research_archive(request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "요청 본문 파싱 실패"}, status_code=400)

    ids = body.get("ids")  # None → 전체 삭제, list → 선택 삭제

    if ids is None:
        count = await delete_all_research_results()
        return JSONResponse({"deleted": count})

    deleted = 0
    for file_id in ids:
        if isinstance(file_id, str) and await delete_research_result(file_id):
            deleted += 1
    return JSONResponse({"deleted": deleted})


@app.get("/api/outputs")
async def outputs(request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return JSONResponse({"items": await list_results()})


@app.post("/api/workspace/submit")
async def workspace_submit(request: Request, body: WorkspaceRequest) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user_message = body.message.strip()
    if not user_message:
        return JSONResponse({"error": "메시지가 비어 있어요."}, status_code=400)

    client_host = request.client.host if request.client else "unknown"
    job_id = str(uuid.uuid4())
    _set_job(
        job_id,
        status="queued",
        stage="요청 분석 대기 중",
        result_type=None,
        mode=None,
        source=None,
        error=None,
        summary=None,
        opportunities=[],
        final_output=None,
        total_ms=None,
    )
    asyncio.create_task(_run_workspace_job(job_id, user_message, client_host))
    return JSONResponse({"job_id": job_id})


@app.get("/api/workspace/status/{job_id}")
async def workspace_status(request: Request, job_id: str) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    job = _jobs_store().get(job_id)
    if not job:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    return JSONResponse(job)


@app.post("/api/workspace")
async def workspace(request: Request, body: WorkspaceRequest) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    user_message = body.message.strip()
    if not user_message:
        return JSONResponse({"error": "메시지가 비어 있어요."}, status_code=400)
    client_host = request.client.host if request.client else "unknown"
    return JSONResponse(await _run_workspace_once(user_message, client_host))


async def _run_workspace_job(job_id: str, user_message: str, client_host: str) -> None:
    try:
        result = await _run_workspace_once(
            user_message,
            client_host,
            progress=lambda stage: _set_job(job_id, stage=stage, status="running"),
        )
        _set_job(job_id, status="completed", stage="완료", **result)
    except Exception as e:
        logger.error(f"Workspace job error: {e}", exc_info=True)
        _set_job(job_id, status="failed", stage="오류", error=str(e))


async def _run_workspace_once(
    user_message: str,
    client_host: str,
    progress: Any | None = None,
) -> dict[str, Any]:
    task_id = str(uuid.uuid4())
    chat_id = f"web_http_{client_host}"
    request_obj = TaskRequest(
        task_id=task_id,
        user_message=user_message,
        chat_id=chat_id,
    )

    if progress:
        progress("요청 분석 중")
    route_result = await route(user_message)
    state = await load(chat_id)

    if route_result.path == "chat":
        await set_mode(chat_id, "chat")
        if progress:
            progress("대화 맥락 정리 중")
        try:
            params = await asyncio.wait_for(extract_params(user_message), timeout=1.5)
        except Exception:
            params = {}
        if params:
            state = await update_params(chat_id, params)
        if progress:
            progress("답변 작성 중")
        reply = await run_chat(request_obj, state)
        await append_message(chat_id, "user", user_message)
        await append_message(chat_id, "assistant", reply)
        return {
            "ok": True,
            "mode": route_result.path,
            "source": route_result.source,
            "result_type": "chat",
            "final_output": reply,
        }

    if route_result.path == "research":
        await set_mode(chat_id, "work")
        goal = route_result.research_goal or ResearchGoal.DEEP_DIVE
        seed_topics = [user_message] if goal == ResearchGoal.DEEP_DIVE else []
        research_request = ResearchRequest(
            chat_id=chat_id,
            goal=goal,
            query=user_message,
            seed_topics=seed_topics,
        )
        result = await run_research(research_request, on_progress=progress)
        await save_research_result(result)
        await append_message(chat_id, "user", user_message)
        await append_message(chat_id, "assistant", result.summary)
        return {
            "ok": True,
            "mode": route_result.path,
            "source": route_result.source,
            "result_type": "research",
            "goal": goal,
            "summary": result.summary,
            "opportunities": [item.model_dump() for item in result.opportunities],
        }

    if route_result.path == "agent" and route_result.agent_name:
        await set_mode(chat_id, "work")
        if progress:
            progress(f"{route_result.agent_name} 실행 중")
        result = await run_agent(request_obj, route_result.agent_name, state=state)
        await append_message(chat_id, "user", user_message)
        if result.success:
            await append_message(chat_id, "assistant", result.content)
        return {
            "ok": True,
            "mode": route_result.path,
            "source": route_result.source,
            "result_type": "content",
            "final_output": result.content if result.success else f"오류: {result.error}",
        }

    await set_mode(chat_id, "work")
    if progress:
        progress("워크플로우 준비 중")
    enriched_message = build_enriched_message(state, user_message)
    enriched_req = TaskRequest(
        task_id=request_obj.task_id,
        user_message=enriched_message,
        chat_id=chat_id,
    )
    if progress:
        progress("콘텐츠 초안 생성 중")
    run = await run_workflow(enriched_req, on_event=None, approval_queue=asyncio.Queue())
    await save_result(run)
    await append_message(chat_id, "user", user_message)
    if run.final_output:
        await append_message(chat_id, "assistant", run.final_output)
    return {
        "ok": True,
        "mode": route_result.path,
        "source": route_result.source,
        "result_type": "content",
        "final_output": run.final_output,
        "total_ms": round(
            ((run.completed_at - run.started_at).total_seconds() * 1000)
        ) if run.completed_at and run.started_at else None,
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token") or websocket.cookies.get("token")
    if not verify_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await _manager.connect(websocket)
    logger.info(f"WebSocket connected: {websocket.client}")

    approval_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    workflow_task: asyncio.Task[Any] | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            data: dict[str, Any] = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "run_workspace":
                # 이미 실행 중이면 무시
                if workflow_task and not workflow_task.done():
                    await _send(websocket, {
                        "type": "error",
                        "error": "이미 실행 중이에요. 완료 후 새 요청을 보내주세요.",
                    })
                    continue

                user_message = data.get("message", "").strip()
                if not user_message:
                    continue

                # approval_queue 초기화 (이전 잔여 메시지 제거)
                while not approval_queue.empty():
                    approval_queue.get_nowait()

                task_id = str(uuid.uuid4())
                chat_id = f"web_{websocket.client}"
                request_obj = TaskRequest(
                    task_id=task_id,
                    user_message=user_message,
                    chat_id=chat_id,
                )

                route_result = await route(user_message)
                await _send(websocket, {
                    "type": "mode",
                    "mode": route_result.path,
                    "source": route_result.source,
                })

                async def on_event(event: dict[str, Any]) -> None:
                    await _send(websocket, event)

                async def run_and_save(
                    _req: TaskRequest = request_obj,
                    _cid: str = chat_id,
                    _msg: str = user_message,
                ) -> None:
                    try:
                        state = await load(_cid)

                        if route_result.path == "chat":
                            await set_mode(_cid, "chat")

                            # 파라미터 추출
                            try:
                                params = await asyncio.wait_for(extract_params(_msg), timeout=1.5)
                            except Exception:
                                params = {}
                            if params:
                                state = await update_params(_cid, params)

                            reply = await run_chat(_req, state)
                            await append_message(_cid, "user", _msg)
                            await append_message(_cid, "assistant", reply)
                            await _send(websocket, {
                                "type": "chat_completed",
                                "final_output": reply,
                            })

                        elif route_result.path == "research":
                            await set_mode(_cid, "work")
                            goal = route_result.research_goal or ResearchGoal.DEEP_DIVE
                            seed_topics = [_msg] if goal == ResearchGoal.DEEP_DIVE else []
                            research_request = ResearchRequest(
                                chat_id=_cid,
                                goal=goal,
                                query=_msg,
                                seed_topics=seed_topics,
                            )
                            await _send(
                                websocket,
                                {
                                    "type": "research_started",
                                    "goal": goal,
                                    "query": _msg,
                                },
                            )
                            result = await run_research(research_request)
                            await save_research_result(result)
                            await append_message(_cid, "user", _msg)
                            await append_message(_cid, "assistant", result.summary)
                            await _send(
                                websocket,
                                {
                                    "type": "research_completed",
                                    "goal": goal,
                                    "summary": result.summary,
                                    "opportunities": [
                                        item.model_dump() for item in result.opportunities
                                    ],
                                },
                            )

                        elif route_result.path == "agent" and route_result.agent_name:
                            await set_mode(_cid, "work")
                            result = await run_agent(
                                _req, route_result.agent_name,
                                state=state, on_event=on_event,
                            )
                            await append_message(_cid, "user", _msg)
                            if result.success:
                                await append_message(_cid, "assistant", result.content)
                            await _send(websocket, {
                                "type": "content_completed",
                                "final_output": result.content if result.success else f"오류: {result.error}",
                            })

                        else:  # workflow
                            await set_mode(_cid, "work")
                            enriched_message = build_enriched_message(state, _msg)
                            enriched_req = TaskRequest(
                                task_id=_req.task_id,
                                user_message=enriched_message,
                                chat_id=_cid,
                            )
                            run = await run_workflow(
                                enriched_req,
                                on_event=on_event,
                                approval_queue=approval_queue,
                            )
                            await save_result(run)
                            await append_message(_cid, "user", _msg)
                            if run.final_output:
                                await append_message(_cid, "assistant", run.final_output)
                            if run.status == "failed" and not run.final_output:
                                await _send(websocket, {
                                    "type": "workflow_failed",
                                    "error": run.error or "알 수 없는 오류",
                                })
                            else:
                                await _send(
                                    websocket,
                                    {
                                        "type": "content_completed",
                                        "final_output": run.final_output,
                                        "total_ms": round(
                                            ((run.completed_at - run.started_at).total_seconds() * 1000)
                                        ) if run.completed_at and run.started_at else None,
                                    },
                                )

                    except Exception as e:
                        from core.orchestrator import _fmt_error
                        err_msg = _fmt_error(e)
                        logger.error(f"Workflow error: {err_msg}", exc_info=True)
                        await _send(websocket, {"type": "workflow_failed", "error": err_msg})

                workflow_task = asyncio.create_task(run_and_save())

            elif msg_type in ("approve", "feedback"):
                # 실행 중인 워크플로우에 사용자 액션 전달
                await approval_queue.put(data)

            elif msg_type == "cancel":
                if workflow_task and not workflow_task.done():
                    workflow_task.cancel()
                    await _send(websocket, {"type": "workflow_cancelled"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {websocket.client}")
        if workflow_task and not workflow_task.done():
            workflow_task.cancel()
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        _manager.disconnect(websocket)


# ── Opportunities API ─────────────────────────────────────────────────────────

class OpportunityStatusUpdate(BaseModel):
    status: OpportunityStatus


class CardChatRequest(BaseModel):
    message: str


@app.get("/api/opportunities")
async def get_opportunities(
    request: Request,
    status: str | None = None,
) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    filter_status = OpportunityStatus(status) if status else None
    cards = await list_cards(status=filter_status, limit=50)
    return JSONResponse([card.model_dump(mode="json") for card in cards])


@app.get("/api/opportunities/{card_id}")
async def get_opportunity(card_id: str, request: Request) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    card = await get_card(card_id)
    if card is None:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse(card.model_dump(mode="json"))


@app.patch("/api/opportunities/{card_id}")
async def update_opportunity(
    card_id: str, body: OpportunityStatusUpdate, request: Request
) -> JSONResponse:
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    card = await update_card(card_id, status=body.status)
    if card is None:
        return JSONResponse({"error": "Not found"}, status_code=404)

    await _manager.broadcast({
        "type": "opportunity_updated",
        "card": card.model_dump(mode="json"),
    })
    return JSONResponse(card.model_dump(mode="json"))


@app.post("/api/opportunities/{card_id}/chat")
async def opportunity_chat(
    card_id: str, body: CardChatRequest, request: Request
) -> JSONResponse:
    """특정 기회 카드에 대해 strategy_agent와 대화한다."""
    token = _extract_token(request)
    if not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    card = await get_card(card_id)
    if card is None:
        return JSONResponse({"error": "Not found"}, status_code=404)

    # 사용자 메시지 저장
    await append_card_message(card_id, "user", body.message)

    # strategy_agent 컨텍스트로 LLM 직접 응답
    from core.orchestrator import run_chat
    from core.models import TaskRequest, ConversationState, ConversationMode, ConversationMessage

    state = ConversationState(
        chat_id=f"card_{card_id}",
        mode=ConversationMode.CHAT,
        history=[ConversationMessage(role=m.role, content=m.content) for m in card.conversation[:-1]],
    )
    task = TaskRequest(
        user_message=f"[기회 카드: {card.title}]\n{card.summary}\n\n질문: {body.message}",
        chat_id=f"card_{card_id}",
    )
    reply = await run_chat(task, state)

    updated = await append_card_message(card_id, "assistant", reply)
    return JSONResponse({
        "reply": reply,
        "conversation": [m.model_dump(mode="json") for m in (updated.conversation if updated else [])],
    })


# ── SPA 진입점 ────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    html_path = _STATIC_DIR / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

async def _send(ws: WebSocket, data: dict[str, Any]) -> None:
    try:
        await ws.send_text(json.dumps(data, ensure_ascii=False))
    except Exception:
        pass


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("token")
