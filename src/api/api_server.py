"""
API Server for AI Static Analysis Engine (V1.0.0).
Entry point: khởi tạo FastAPI app, cấu hình Middleware, đăng ký Routers.
"""

import os
import sys
import logging
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# HACK: Tăng giới hạn multipart upload cho Starlette (mặc định 1000 file → 100,000)
import starlette.formparsers
_original_multipart_init = starlette.formparsers.MultiPartParser.__init__

def _patched_multipart_init(self, *args, **kwargs):
    kwargs['max_files'] = 100000
    kwargs['max_fields'] = 100000
    _original_multipart_init(self, *args, **kwargs)

starlette.formparsers.MultiPartParser.__init__ = _patched_multipart_init

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from src.engine.database import AuditDatabase
from src.api.audit_state import AuditState

# ── Logging Setup ──────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)

class AuditLogHandler(logging.Handler):
    """Chuyển tiếp toàn bộ log vào SSE stream của Frontend."""
    def emit(self, record):
        try:
            msg = self.format(record)
            if msg.strip():
                AuditState.log(msg.strip())
        except Exception:
            self.handleError(record)

audit_log_handler = AuditLogHandler()
audit_log_handler.setFormatter(logging.Formatter('%(levelname)s:%(name)s:%(message)s'))
logging.getLogger().addHandler(audit_log_handler)
logging.getLogger("uvicorn.access").addHandler(audit_log_handler)

logger = logging.getLogger(__name__)

# ── App Factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Static Analysis API (V1)",
    description="Hệ thống kiểm toán mã nguồn tự động dựa trên AI Framework V1.0.0.",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing PostgreSQL Database...")
    try:
        AuditDatabase.initialize()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

# ── Middleware ────────────────────────────────────────────────────────────────

@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    """Private Network Access header (yêu cầu bởi Brave/Chromium)."""
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc):
    logger.error(f"Validation Error: {exc.errors()}")
    return {"detail": exc.errors(), "body": exc.body}

# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ready", "engine": "AI Static Analysis V1.0.0", "message": "API đang hoạt động."}

# ── Register Routers ─────────────────────────────────────────────────────────

from src.api.routers.audit import router as audit_router
from src.api.routers.rules import router as rules_router
from src.api.routers.history import router as history_router
from src.api.routers.repositories import router as repositories_router

app.include_router(audit_router)
app.include_router(rules_router)
app.include_router(history_router)
app.include_router(repositories_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
