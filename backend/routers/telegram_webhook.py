from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from database import get_db
from models import SizeSubscription, User
from utils.telegram import send_message


router = APIRouter()


SIZE_BUTTONS = ["XS", "S", "M", "L", "XL"]

START_TEXT = (
    "1. Запустите бота и нажмите на его иконку.\n"
    "2. Откройте приложение.\n"
    "3. Добавьте понравившиеся товары в «Избранное» на будущее — или сразу положите в корзину и оформите заказ.\n\n"
    "Если вы оформляете с компьютера или Android: бот автоматически перенаправит вас в чат с админом Rooneyform "
    "и сам вставит список выбранных товаров.\n\n"
    "Если вы оформляете с iPhone: потребуется дополнительный шаг — скопируйте сформированный ботом текст "
    "и отправьте его админу (чат откроется автоматически).\n\n"
    "Дополнительно:\n"
    "— нажмите кнопку с размером ниже, чтобы включить уведомления,\n"
    "— или кнопку «Отключить уведомления» чтобы их выключить."
)


async def _ensure_user(db: AsyncSession, telegram_id: int, username: str | None) -> None:
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(telegram_id=telegram_id, username=username)
        db.add(user)
        await db.commit()


async def _handle_size_command(
    *,
    db: AsyncSession,
    chat_id: int,
    text: str,
    username: str | None,
) -> str:
    """
    Обработка команды /size:
      - /size M  → подписка на размер M
      - /size off → удаление всех подписок
    """
    parts = text.split(maxsplit=1)
    if len(parts) == 1:
        return (
            "Использование:\n"
            "/size M — присылать уведомления о новых товарах размера M\n"
            "/size off — отключить уведомления по размеру"
        )

    arg = parts[1].strip()
    await _ensure_user(db, chat_id, username)

    if arg.lower() in {"off", "stop", "cancel"}:
        await db.execute(delete(SizeSubscription).where(SizeSubscription.user_id == chat_id))
        await db.commit()
        return "Уведомления по размерам отключены."

    size_value = arg.upper()

    # Очищаем старые подписки и создаём одну актуальную
    await db.execute(delete(SizeSubscription).where(SizeSubscription.user_id == chat_id))
    db.add(SizeSubscription(user_id=chat_id, size=size_value))
    await db.commit()

    return f"Готово! Буду присылать новые товары с размером {size_value}."


@router.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Webhook-обработчик обновлений Telegram.
    Сейчас:
      - отвечает на /start текстом из START_TEXT + кнопки выбора размера
      - позволяет управлять подпиской по размеру через команды и кнопки.
    """
    try:
        update = await request.json()
    except Exception as exc:  # pragma: no cover - защитный код
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    # Обработка нажатий на инлайн‑кнопки
    callback_query = update.get("callback_query")
    if callback_query:
        data = (callback_query.get("data") or "").strip()
        from_user = callback_query.get("from") or {}
        user_id = from_user.get("id")
        username = from_user.get("username")

        if not user_id:
            return {"ok": False, "detail": "No user_id in callback_query"}

        if data.startswith("size:"):
            value = data.split(":", 1)[1]
            cmd_text = "/size off" if value.upper() == "OFF" else f"/size {value}"
            reply = await _handle_size_command(
                db=db,
                chat_id=user_id,
                text=cmd_text,
                username=username,
            )
            await send_message(user_id, reply)

        # Телеграму достаточно HTTP 200, отдельный answerCallbackQuery можно не слать
        return {"ok": True}

    message = update.get("message") or update.get("edited_message")
    if not message:
        # Ничего отвечать не нужно (service events и т.п.)
        return {"ok": True}

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()
    from_user = message.get("from") or {}
    username = from_user.get("username")

    if not chat_id:
        return {"ok": False, "detail": "No chat_id in update"}

    if text.startswith("/start"):
        # При старте сразу показываем инлайн‑клавиатуру с размерами
        keyboard = {
            "inline_keyboard": [
                [{"text": size, "callback_data": f"size:{size}"} for size in SIZE_BUTTONS],
                [
                    {
                        "text": "Отключить уведомления",
                        "callback_data": "size:OFF",
                    }
                ],
            ]
        }
        await send_message(chat_id, START_TEXT, reply_markup=keyboard)
        return {"ok": True}

    if text.startswith("/size"):
        reply = await _handle_size_command(
            db=db,
            chat_id=chat_id,
            text=text,
            username=username,
        )
    else:
        reply = (
            "Напишите /start, чтобы получить инструкцию по оформлению заказа.\n"
            "Или просто нажмите кнопку с размером внизу."
        )

    await send_message(chat_id, reply)
    return {"ok": True}

