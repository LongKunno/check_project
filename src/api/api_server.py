"""
API Server for AI Static Analysis Engine (V1.0.0).
Entry point: khởi tạo FastAPI app, cấu hình Middleware, đăng ký Routers.
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Monkey-patch: Tăng giới hạn multipart upload cho Starlette
# Mặc định 1000 file → 10,000 (đủ cho dự án lớn, hạn chế DoS)
import starlette.formparsers

_original_multipart_init = starlette.formparsers.MultiPartParser.__init__


def _patched_multipart_init(self, *args, **kwargs):
    kwargs["max_files"] = 10000
    kwargs["max_fields"] = 10000
    _original_multipart_init(self, *args, **kwargs)


starlette.formparsers.MultiPartParser.__init__ = _patched_multipart_init

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.engine.database import AuditDatabase
from src.api.audit_state import AuditState, JobManager

# ── Logging Setup ──────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)


class AuditLogHandler(logging.Handler):
    """
    Chuyển tiếp log từ Engine vào SSE stream của Frontend.
    - Chỉ forward log từ 'src.engine.*' để tránh nhiễu (uvicorn access, DB connect, ...)
    - Tự động route vào Job-specific logs nếu có Job đang active trên thread hiện tại.
    """

    def emit(self, record):
        try:
            msg = self.format(record)
            if not msg.strip():
                return
            clean_msg = msg.strip()

            # Route vào Job-specific SSE nếu có Job đang active
            active_job = JobManager.get_active_job_id()
            if active_job:
                JobManager.log(active_job, clean_msg)
            else:
                # Fallback: chỉ ghi legacy SSE
                AuditState.log(clean_msg)
        except Exception:
            self.handleError(record)


class EngineLogFilter(logging.Filter):
    """Chỉ cho phép log từ namespace 'src.engine.*' đi qua."""

    def filter(self, record):
        return record.name.startswith("src.engine")


audit_log_handler = AuditLogHandler()
audit_log_handler.setFormatter(logging.Formatter("%(message)s"))
audit_log_handler.addFilter(EngineLogFilter())
logging.getLogger().addHandler(audit_log_handler)

logger = logging.getLogger(__name__)

# ── App Factory ───────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    logger.info("Initializing PostgreSQL Database in background thread...")
    try:
        await asyncio.to_thread(AuditDatabase.initialize)
        logger.info(
            "Database initialized successfully without blocking the event loop."
        )
        from src.api.routers.audit import recover_persisted_batch_jobs

        await recover_persisted_batch_jobs()
        logger.info("Persisted batch jobs restored.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    yield


app = FastAPI(
    title="AI Static Analysis API (V1)",
    description=f"Hệ thống kiểm toán mã nguồn tự động dựa trên AI Framework V{os.environ.get('APP_VERSION', '1.0.0')}.",
    version=os.environ.get("APP_VERSION", "1.0.0"),
    lifespan=lifespan,
)


_PUBLIC_PATHS = {
    "/",
    "/auth/config",
    "/auth/google",
    "/docs",
    "/docs/oauth2-redirect",
    "/openapi.json",
    "/redoc",
}
_PUBLIC_PATH_PREFIXES = ("/docs/", "/redoc/")


def _is_public_path(path: str) -> bool:
    return path in _PUBLIC_PATHS or any(
        path.startswith(prefix) for prefix in _PUBLIC_PATH_PREFIXES
    )


def _apply_browser_headers(response, method: str):
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    if method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# ── Middleware ────────────────────────────────────────────────────────────────


@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    """Private Network Access header và backend auth enforcement."""
    if request.method != "OPTIONS" and not _is_public_path(request.url.path):
        from src.config import get_auth_required
        from src.api.routers.auth import decode_authorization_header

        if get_auth_required():
            try:
                request.state.user = decode_authorization_header(
                    request.headers.get("Authorization", "")
                )
            except HTTPException as exc:
                response = JSONResponse(
                    status_code=exc.status_code,
                    content={"detail": exc.detail},
                )
                return _apply_browser_headers(response, request.method)

    response = await call_next(request)
    return _apply_browser_headers(response, request.method)


# CORS origins: Đọc từ env hoặc mặc định cho local development
_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


# ── Root ──────────────────────────────────────────────────────────────────────


@app.get("/")
async def root():
    return {
        "status": "ready",
        "engine": f"AI Static Analysis V{os.environ.get('APP_VERSION', '1.0.0')}",
        "message": "API đang hoạt động.",
    }


# ── Register Routers ─────────────────────────────────────────────────────────

from src.api.routers.audit import router as audit_router
from src.api.routers.rules import router as rules_router
from src.api.routers.history import router as history_router
from src.api.routers.repositories import router as repositories_router
from src.api.routers.members import router as members_router
from src.api.routers.auth import router as auth_router
from src.api.routers.ai import router as ai_router

app.include_router(audit_router)
app.include_router(rules_router)
app.include_router(history_router)
app.include_router(repositories_router)
app.include_router(members_router)
app.include_router(auth_router)
app.include_router(ai_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
