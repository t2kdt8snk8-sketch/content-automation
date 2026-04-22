from __future__ import annotations

import json
from typing import Any

from core.llm_client import call_haiku
from core.models import ConversationState

_EXTRACT_SYSTEM = """\
You are a parameter extractor. Given a conversation message, extract any content task \
parameters the user has mentioned. Return ONLY valid JSON with these optional keys:
- topic (string): main subject or theme
- platform (string): target platform (instagram, youtube, tiktok, podcast, etc.)
- content_type (string): type of content (carousel, caption, script, ad_copy, etc.)
- tone (string): desired tone (casual, professional, hype, emotional)
- language (string): output language (korean, english, both)
- target_audience (string): intended audience

Only include keys that are clearly mentioned. Return {} if nothing is extractable.\
"""

async def extract_params(message: str) -> dict[str, Any]:
    """메시지에서 콘텐츠 작업 파라미터를 추출한다. 실패하면 빈 dict 반환."""
    try:
        raw = await call_haiku(
            system=_EXTRACT_SYSTEM,
            messages=[{"role": "user", "content": message}],
        )
        text = raw.strip()
        # JSON 블록 파싱
        if "```" in text:
            text = text.split("```")[-2].removeprefix("json").strip()
        return json.loads(text)
    except Exception:
        return {}


def build_enriched_message(state: ConversationState, original_message: str) -> str:
    """수집된 파라미터와 대화 맥락을 원본 메시지에 합쳐서 반환한다.

    워크플로우/에이전트에 넘길 때 중복 질문 없이 맥락을 전달하기 위해 사용.
    """
    if not state.collected_params:
        return original_message

    params_text = "\n".join(f"- {k}: {v}" for k, v in state.collected_params.items())
    recent = [m for m in state.history[-6:] if m.role == "user"]
    context_text = "\n".join(m.content for m in recent)

    return (
        f"{original_message}\n\n"
        f"[대화에서 확정된 파라미터]\n{params_text}\n\n"
        f"[이전 대화 맥락]\n{context_text}"
    )


async def should_trigger(state: ConversationState, message: str) -> bool:
    """간단한 작업 트리거 감지.

    수집된 파라미터가 어느 정도 있고, 사용자가 실행 의도를 보이면 True.
    """
    if not state.collected_params:
        return False

    msg = message.strip().lower()
    go_words = {
        "go",
        "ㄱㄱ",
        "시작",
        "진행",
        "만들어줘",
        "해줘",
        "해보자",
        "run",
        "let's go",
    }
    if any(word in msg for word in go_words):
        return True

    return len(state.collected_params) >= 2 and len(msg) <= 12
