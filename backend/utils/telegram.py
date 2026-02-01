import asyncio
import json
import logging
import os
import urllib.request
from typing import List


logger = logging.getLogger(__name__)


def _get_admin_chat_ids() -> List[str]:
    raw = os.getenv("TELEGRAM_ADMIN_CHAT_IDS") or os.getenv("TELEGRAM_ADMIN_CHAT_ID")
    if not raw:
        return []
    return [value.strip() for value in raw.split(",") if value.strip()]


async def send_admin_message(text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_ids = _get_admin_chat_ids()
    if not token or not chat_ids:
        logger.warning(
            "Telegram admin notification skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID(S)."
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    async def send_to_chat(chat_id: str) -> None:
        payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )

        def post() -> None:
            with urllib.request.urlopen(request, timeout=10) as response:
                response.read()

        await asyncio.to_thread(post)

    success = False
    for chat_id in chat_ids:
        try:
            await send_to_chat(chat_id)
            success = True
        except Exception:
            logger.exception("Failed to send Telegram admin message to chat_id=%s", chat_id)
    return success
