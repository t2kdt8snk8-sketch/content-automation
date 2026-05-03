from __future__ import annotations

import json

import httpx

from app.config import get_settings
from app.models import InvestmentMemo


def memo_message(memo: InvestmentMemo) -> str:
    key_reasons = json.loads(memo.key_reasons_json or "[]")
    counter_reasons = json.loads(memo.counter_reasons_json or "[]")
    risk_messages = json.loads(memo.risk_messages_json or "[]")
    approval_text = "승인 가능" if memo.risk_status != "blocked" else "승인 불가"
    return "\n".join(
        [
            "[AI 투자 후보]",
            f"{memo.ticker} / {memo.recommendation} / {memo.total_score:.0f}점",
            "",
            "근거:",
            *[f"{idx + 1}. {reason}" for idx, reason in enumerate(key_reasons[:3])],
            "",
            "반대:",
            *[f"{idx + 1}. {reason}" for idx, reason in enumerate(counter_reasons[:3])],
            "",
            f"진입: {memo.entry_price:.2f}",
            f"손절: {memo.stop_price:.2f}",
            f"재평가: {memo.review_price:.2f}",
            f"최대비중: {memo.max_weight * 100:.1f}%",
            f"상태: {approval_text}",
            f"위험: {', '.join(risk_messages[:2]) if risk_messages else '없음'}",
        ]
    )


async def send_memo(memo: InvestmentMemo) -> bool:
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_allowed_chat_id:
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "승인 기록", "callback_data": f"approve:{memo.id}"},
                {"text": "거절 기록", "callback_data": f"reject:{memo.id}"},
            ],
            [{"text": "웹에서 보기", "url": f"{settings.public_base_url}/memos/{memo.id}"}],
        ]
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            url,
            json={
                "chat_id": settings.telegram_allowed_chat_id,
                "text": memo_message(memo),
                "reply_markup": keyboard,
            },
        )
    return response.status_code == 200

