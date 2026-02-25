from fastapi import APIRouter, HTTPException, Request

from utils.telegram import send_message


router = APIRouter()


START_TEXT = (
    "1. Запустите бота и нажмите на его иконку.\n"
    "2. Откройте приложение.\n"
    "3. Добавьте понравившиеся товары в «Избранное» на будущее — или сразу положите в корзину и оформите заказ.\n\n"
    "Если вы оформляете с компьютера или Android: бот автоматически перенаправит вас в чат с админом Rooneyform "
    "и сам вставит список выбранных товаров.\n\n"
    "Если вы оформляете с iPhone: потребуется дополнительный шаг — скопируйте сформированный ботом текст "
    "и отправьте его админу (чат откроется автоматически)."
)


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict:
    """
    Webhook-обработчик обновлений Telegram.
    Сейчас:
      - отвечает на /start текстом из START_TEXT
      - на любые другие сообщения даёт короткий хинт.
    """
    try:
        update = await request.json()
    except Exception as exc:  # pragma: no cover - защитный код
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    message = update.get("message") or update.get("edited_message")
    if not message:
        # Ничего отвечать не нужно (callback_query, service events и т.п.)
        return {"ok": True}

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()

    if not chat_id:
        return {"ok": False, "detail": "No chat_id in update"}

    if text.startswith("/start"):
        reply = START_TEXT
    else:
        reply = "Напишите /start, чтобы получить инструкцию по оформлению заказа."

    await send_message(chat_id, reply)
    return {"ok": True}

