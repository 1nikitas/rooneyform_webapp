import asyncio
import hashlib

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import AdminAccount


NEW_ADMIN_USERNAME = "rooney_masteradmin"
NEW_ADMIN_PASSWORD = "Rf!2026_Ma$ter#Admin"


def _hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def reset_admin() -> None:
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        # Remove all existing admin accounts
        await session.execute(delete(AdminAccount))

        # Create new admin account
        admin = AdminAccount(
            username=NEW_ADMIN_USERNAME,
            password_hash=_hash_password(NEW_ADMIN_PASSWORD),
            is_active=True,
        )
        session.add(admin)
        await session.commit()

    print("Admin reset completed.")
    print(f"Username: {NEW_ADMIN_USERNAME}")
    print(f"Password: {NEW_ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(reset_admin())

