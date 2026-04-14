"""
Authentication Router — Google OAuth 2.0 + JWT Token.
Xác thực người dùng qua Google Sign-In, phát hành JWT cho Frontend.
"""

import os
import logging
from datetime import datetime, timedelta, timezone

import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── Config ────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ALLOWED_EMAILS = [
    e.strip().lower()
    for e in os.environ.get("ALLOWED_EMAILS", "").split(",")
    if e.strip()
]
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7


# ── Models ────────────────────────────────────────────────────────────────────
class GoogleLoginRequest(BaseModel):
    credential: str


class UserInfo(BaseModel):
    email: str
    name: str
    picture: str


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


# ── Helpers ───────────────────────────────────────────────────────────────────
def create_jwt_token(email: str, name: str, picture: str) -> str:
    """Tạo JWT token với thông tin user, hết hạn sau JWT_EXPIRY_DAYS ngày."""
    payload = {
        "email": email,
        "name": name,
        "picture": picture,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> dict:
    """Verify JWT token, trả về payload hoặc raise Exception."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/google", response_model=LoginResponse)
async def google_login(body: GoogleLoginRequest):
    """
    Nhận Google ID token từ frontend, verify với Google,
    kiểm tra whitelist email, trả về JWT.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID chưa được cấu hình trên server.",
        )

    # Step 1: Verify Google ID token
    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Google token không hợp lệ.")

    # Step 2: Extract user info
    email = idinfo.get("email", "").lower()
    name = idinfo.get("name", email.split("@")[0])
    picture = idinfo.get("picture", "")

    if not email:
        raise HTTPException(status_code=401, detail="Không lấy được email từ Google.")

    # Step 3: Check whitelist
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        logger.warning(f"Unauthorized login attempt: {email}")
        raise HTTPException(
            status_code=403,
            detail=f"Email {email} không được phép truy cập hệ thống.",
        )

    # Step 4: Issue JWT
    token = create_jwt_token(email, name, picture)
    logger.info(f"User logged in: {email}")

    return LoginResponse(
        token=token,
        user=UserInfo(email=email, name=name, picture=picture),
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user(authorization: str = Header(default="")):
    """
    Verify JWT từ header Authorization: Bearer <token>.
    Trả về thông tin user nếu hợp lệ.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header."
        )

    token = authorization[7:]  # Remove "Bearer " prefix

    try:
        payload = verify_jwt_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401, detail="Token đã hết hạn. Vui lòng đăng nhập lại."
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT: {e}")
        raise HTTPException(status_code=401, detail="Token không hợp lệ.")

    return UserInfo(
        email=payload.get("email", ""),
        name=payload.get("name", ""),
        picture=payload.get("picture", ""),
    )


@router.get("/config")
async def get_auth_config():
    """
    Public endpoint (không cần token): trả về trạng thái auth_required.
    Frontend dùng để quyết định hiển thị trang login hay bypass xác thực.
    """
    from src.config import get_auth_required

    return {"auth_required": get_auth_required()}
