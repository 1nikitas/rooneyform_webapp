from datetime import datetime, timedelta, timezone
from typing import Optional

import hashlib
import os

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AdminAccount


JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "43200"))  # 30 days

DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUser(BaseModel):
    username: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


router = APIRouter(prefix="/auth", tags=["auth"])
security_scheme = HTTPBearer(auto_error=False)


def _hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _ensure_default_admin(db: AsyncSession) -> None:
    stmt = select(AdminAccount).where(AdminAccount.username == DEFAULT_ADMIN_USERNAME)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if admin:
        return
    admin = AdminAccount(
        username=DEFAULT_ADMIN_USERNAME,
        password_hash=_hash_password(DEFAULT_ADMIN_PASSWORD),
        is_active=True,
    )
    db.add(admin)
    await db.commit()


async def _authenticate_admin(db: AsyncSession, username: str, password: str) -> bool:
    stmt = select(AdminAccount).where(AdminAccount.username == username)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin or not admin.is_active:
        return False
    return admin.password_hash == _hash_password(password)


def _create_access_token(sub: str, *, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=JWT_EXPIRES_MINUTES))
    to_encode = {"sub": sub, "scope": "admin", "iat": now, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


@router.post("/login", response_model=Token)
async def admin_login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required",
        )

    await _ensure_default_admin(db)

    ok = await _authenticate_admin(db, username, password)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = _create_access_token(username)
    return Token(access_token=token)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> AdminUser:
    if credentials is None or not credentials.scheme or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("scope") != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return AdminUser(username=username)

