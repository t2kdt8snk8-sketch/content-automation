from __future__ import annotations

import asyncio
import uuid

from loguru import logger
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from bot.message_formatter import format_for_telegram, split_long_message
from core.bridge import build_enriched_message, extract_params
from core.models import ResearchGoal, ResearchRequest, TaskRequest
from core.orchestrator import run_agent, run_chat, run_workflow
from core.router import route
from research.orchestrator import run_research
from storage.conversation_store import append_message, load, set_mode, update_params
from storage.output_store import save_result
from storage.research_store import save_research_result

_HELP_TEXT = (
    "*Content Automation Bot*\n\n"
    "Send me any content request and I'll generate it using multiple AI agents.\n\n"
    "*Examples:*\n"
    "- make a trending Instagram carousel about neo-soul music\n"
    "- write a YouTube script about K-hip-hop history\n"
    "- write Instagram captions in Korean about summer fashion\n"
    "- generate Midjourney prompts for a jazz album cover\n\n"
    "*Commands:*\n"
    "/start — show this message\n"
    "/help — show this message"
)


class ContentAutomationBot:
    def __init__(self, token: str, allowed_user_id: str | None = None) -> None:
        self.token = token
        self.allowed_user_id = allowed_user_id
        self.app = Application.builder().token(token).build()
        self._register_handlers()

    def _register_handlers(self) -> None:
        self.app.add_handler(CommandHandler("start", self._on_start))
        self.app.add_handler(CommandHandler("help", self._on_help))
        self.app.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self._on_message)
        )

    async def _on_start(
        self, update: Update, ctx: ContextTypes.DEFAULT_TYPE
    ) -> None:
        if update.message:
            await update.message.reply_text(_HELP_TEXT, parse_mode=ParseMode.MARKDOWN)

    async def _on_help(
        self, update: Update, ctx: ContextTypes.DEFAULT_TYPE
    ) -> None:
        if update.message:
            await update.message.reply_text(_HELP_TEXT, parse_mode=ParseMode.MARKDOWN)

    async def _on_message(
        self, update: Update, ctx: ContextTypes.DEFAULT_TYPE
    ) -> None:
        if not update.message or not update.effective_user:
            return

        user_id = str(update.effective_user.id)
        chat_id = str(update.effective_chat.id) if update.effective_chat else user_id

        # Authorization check
        if self.allowed_user_id and user_id != self.allowed_user_id:
            logger.warning(f"Unauthorized access attempt from user_id={user_id}")
            return

        user_text = update.message.text or ""
        if not user_text.strip():
            return

        task_id = str(uuid.uuid4())
        request = TaskRequest(
            task_id=task_id,
            user_message=user_text,
            chat_id=chat_id,
        )

        # 라우팅 결정
        route_result = await route(user_text)
        logger.info(
            f"[{task_id}] route={route_result.path} "
            f"source={route_result.source} user={user_id}: {user_text[:80]}"
        )

        # 모드별 대기 메시지
        if route_result.path == "chat":
            status_msg = await update.message.reply_text("🤖 채팅 중...")
        else:
            status_msg = await update.message.reply_text("⚙️ 작업 중... (30-90초)")

        try:
            state = await load(chat_id)

            if route_result.path == "chat":
                await set_mode(chat_id, "chat")

                # 파라미터 추출 — 대화 맥락 누적
                params = await extract_params(user_text)
                if params:
                    state = await update_params(chat_id, params)
                    logger.info(f"[{task_id}] extracted params: {params}")

                reply = await run_chat(request, state)
                await append_message(chat_id, "user", user_text)
                await append_message(chat_id, "assistant", reply)

                await status_msg.delete()
                chunks = split_long_message(reply, max_length=4000)
                for chunk in chunks:
                    await update.message.reply_text(chunk)

            elif route_result.path == "research":
                await set_mode(chat_id, "work")
                goal = route_result.research_goal or ResearchGoal.DEEP_DIVE
                research_request = ResearchRequest(
                    chat_id=chat_id,
                    goal=goal,
                    query=user_text,
                    seed_topics=[user_text] if goal == ResearchGoal.DEEP_DIVE else [],
                )
                result = await run_research(research_request)
                await save_research_result(result)
                await append_message(chat_id, "user", user_text)
                await append_message(chat_id, "assistant", result.summary)

                await status_msg.delete()
                chunks = split_long_message(
                    format_for_telegram(result.summary), max_length=4000
                )
                for chunk in chunks:
                    await update.message.reply_text(chunk)

            elif route_result.path == "agent" and route_result.agent_name:
                await set_mode(chat_id, "work")
                result = await run_agent(request, route_result.agent_name, state=state)
                await append_message(chat_id, "user", user_text)

                await status_msg.delete()
                if result.success:
                    await append_message(chat_id, "assistant", result.content)
                    chunks = split_long_message(
                        format_for_telegram(result.content), max_length=4000
                    )
                    for chunk in chunks:
                        try:
                            await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
                        except Exception:
                            await update.message.reply_text(chunk)
                else:
                    await update.message.reply_text(f"에이전트 실행 실패: {result.error}")

            else:  # workflow
                await set_mode(chat_id, "work")
                enriched_message = build_enriched_message(state, user_text)
                enriched_request = TaskRequest(
                    task_id=task_id,
                    user_message=enriched_message,
                    chat_id=chat_id,
                )
                workflow_run = await run_workflow(enriched_request)
                await save_result(workflow_run)
                await append_message(chat_id, "user", user_text)

                await status_msg.delete()
                if workflow_run.final_output:
                    await append_message(chat_id, "assistant", workflow_run.final_output)
                    response_text = format_for_telegram(workflow_run.final_output)
                    chunks = split_long_message(response_text, max_length=4000)
                    for chunk in chunks:
                        try:
                            await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
                        except Exception:
                            await update.message.reply_text(chunk)
                else:
                    await update.message.reply_text(
                        "콘텐츠 생성에 실패했어요. 다르게 요청해보세요."
                    )

        except Exception as e:
            logger.error(f"[{task_id}] Unhandled error: {e}", exc_info=True)
            try:
                await status_msg.edit_text(f"오류가 발생했어요: {str(e)[:200]}\n\n다시 시도해주세요.")
            except Exception:
                pass

    async def run(self) -> None:
        """Initialize and start polling for Telegram messages."""
        await self.app.initialize()
        await self.app.start()
        assert self.app.updater is not None
        await self.app.updater.start_polling(drop_pending_updates=True)
        logger.info("Telegram bot started, polling for messages...")
        try:
            # asyncio.gather와 함께 돌 때 — 취소될 때까지 대기
            await asyncio.Event().wait()
        finally:
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()
