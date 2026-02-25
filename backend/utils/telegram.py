import asyncio
import json
import logging
import os
import urllib.request
from typing import Any, Dict, List, Optional, Union


logger = logging.getLogger(__name__)


def _get_token() -> Optional[str]:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("Telegram: missing TELEGRAM_BOT_TOKEN.")
        return None
    return token


def _get_admin_chat_ids() -> List[str]:
    raw = os.getenv("TELEGRAM_ADMIN_CHAT_IDS") or os.getenv("TELEGRAM_ADMIN_CHAT_ID")
    if not raw:
        return []
    return [value.strip() for value in raw.split(",") if value.strip()]


async def _post_json(url: str, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
    )

    def post() -> None:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()

    await asyncio.to_thread(post)


async def send_message(
    chat_id: Union[int, str],
    text: str,
    *,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Отправить обычное сообщение пользователю или чату.
    Используется и для ответов ботом, и для служебных уведомлений.
    """
    token = _get_token()
    if not token:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    payload: Dict[str, Any] = {"chat_id": chat_id, "text": text}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    try:
        await _post_json(url, payload)
        return True
    except Exception:
        logger.exception("Failed to send Telegram message to chat_id=%s", chat_id)
        return False


async def send_admin_message(text: str) -> bool:
    token = _get_token()
    chat_ids = _get_admin_chat_ids()
    if not token or not chat_ids:
        logger.warning(
            "Telegram admin notification skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID(S)."
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    success = False
    for chat_id in chat_ids:
        try:
            await _post_json(url, {"chat_id": chat_id, "text": text})
            success = True
        except Exception:
            logger.exception("Failed to send Telegram admin message to chat_id=%s", chat_id)
    return success


async def send_user_message_to_admin(user_id: int, message_text: str) -> bool:
    """Send a message from user to admin via bot (appears as bot message with user info)."""
    token = _get_token()
    chat_ids = _get_admin_chat_ids()
    if not token or not chat_ids:
        logger.warning(
            "Telegram user message skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID(S)."
        )
        return False

    formatted_message = f"💬 Сообщение от пользователя (ID: {user_id}):\n\n{message_text}"
    url = f"https://api.telegram.org/bot{token}/sendMessage"

    success = False
    for chat_id in chat_ids:
        try:
            await _post_json(url, {"chat_id": chat_id, "text": formatted_message})
            success = True
        except Exception:
            logger.exception("Failed to send user message to admin chat_id=%s", chat_id)
    return success


if __name__ == "__main__":
    """
    Небольшой CLI для быстрой проверки настроек Telegram.
    Пример:
      TELEGRAM_BOT_TOKEN=... TELEGRAM_ADMIN_CHAT_ID=... python -m utils.telegram
    """

    async def _main() -> None:
        text = "✅ Тестовое сообщение от RooneyForm backend (utils.telegram)."
        ok = await send_admin_message(text)
        print("Sent:", ok)

    asyncio.run(_main())
