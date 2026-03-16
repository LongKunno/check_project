"""
API Server for AI Static Analysis Engine (V3).
Provides a RESTful interface to trigger code audits and retrieve results.
"""

import os
import sys

# HACK: Tăng giới hạn upload file cho Starlette/FastAPI (Deep Monkeypatch)
# Mặc định Starlette giới hạn 1000 file, chúng ta nâng lên 100,000 để hỗ trợ project lớn.
import starlette.formparsers
_original_multipart_init = starlette.formparsers.MultiPartParser.__init__

def _patched_multipart_init(self, *args, **kwargs):
    kwargs['max_files'] = 100000
    kwargs['max_fields'] = 100000
    _original_multipart_init(self, *args, **kwargs)

starlette.formparsers.MultiPartParser.__init__ = _patched_multipart_init

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
import tempfile
from typing import List
# Đảm bảo import được các module từ thư mục 'src'
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.engine.auditor import CodeAuditor
from src.config import WEIGHTS
from src.engine.scoring import ScoringEngine
from src.engine.database import AuditDatabase
from fastapi.exceptions import RequestValidationError
import logging

# Thiết lập logging chi tiết
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURATION & BRAVE COMPATIBILITY ---
app = FastAPI(
    title="AI Static Analysis API (V1)",
    description="Hệ thống cung cấp API cho việc kiểm toán mã nguồn tự động dựa trên Framework V3.",
    version="1.0.0"
)

# Xử lý Private Network Access (PNA) - Cần thiết cho trình duyệt Brave/Chromium
@app.middleware("http")
async def add_private_network_header(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    # Đảm bảo hỗ trợ CORS cho Preflight nếu cần
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Cấu hình CORS (Phải đăng ký SAU middleware PNA để wrapping đúng cách)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation Error: {exc.errors()}")
    return {"detail": exc.errors(), "body": exc.body}

@app.get("/")
async def root():
    """Kiểm tra trạng thái hoạt động của API."""
    return {
        "status": "ready",
        "engine": "AI Static Analysis V3",
        "message": "API đang hoạt động ổn định."
    }

@app.post("/audit/process")
async def upload_and_audit(files: List[UploadFile] = File(...)):
    """
    Nhận các file được upload từ trình duyệt (webkitdirectory),
    lưu vào thư mục tạm, chạy kiểm toán, rồi dọn dẹp.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Không có file nào được upload.")

    # Tạo thư mục tạm để lưu code được upload
    temp_dir = tempfile.mkdtemp(prefix="audit_upload_")
    project_name = "uploaded_project"

    try:
        # Lưu từng file, giữ nguyên cấu trúc thư mục tương đối
        for upload_file in files:
            # filename từ browser là đường dẫn tương đối: "project/src/main.py"
            relative_path = upload_file.filename
            if not relative_path:
                continue

            # Lấy tên project từ file đầu tiên (thư mục gốc)
            parts = relative_path.replace("\\", "/").split("/")
            if len(parts) > 1:
                project_name = parts[0]

            dest_path = os.path.join(temp_dir, relative_path)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)

            content = await upload_file.read()
            with open(dest_path, "wb") as f:
                f.write(content)

        # Đường dẫn thư mục gốc của project trong temp
        target_path = os.path.join(temp_dir, project_name)
        if not os.path.isdir(target_path):
            target_path = temp_dir  # fallback nếu không có thư mục gốc

        # Chạy kiểm toán
        auditor = CodeAuditor(target_path)
        auditor.run()

        # Tổng hợp kết quả
        pillar_punishments = {p: 0 for p in WEIGHTS.keys()}
        for v in auditor.violations:
            pillar_punishments[v['pillar']] += v['weight']

        total_loc = auditor.discovery_data['total_loc']

        pillar_scores = {}
        for pillar in WEIGHTS.keys():
            pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                pillar_punishments[pillar],
                total_loc
            )

        final_score = ScoringEngine.calculate_final_score(pillar_scores)
        rating = ScoringEngine.get_rating(final_score)

        return {
            "status": "success",
            "target": target_path,
            "project_name": project_name,
            "metrics": {
                "total_loc": total_loc,
                "total_files": auditor.discovery_data['total_files']
            },
            "scores": {
                "final": final_score,
                "rating": rating,
                "pillars": pillar_scores
            },
            "violations": auditor.violations
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")
    finally:
        # Luôn dọn dẹp thư mục tạm
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/audit")
async def run_audit(target: str = Query(".", description="Path to the directory to be audited")):
    """
    Endpoint legacy để kiểm toán qua đường dẫn (dùng nội bộ hoặc CLI).
    """
    target_path = os.path.abspath(target)
    if not os.path.exists(target_path):
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy thư mục: {target}"
        )

    try:
        auditor = CodeAuditor(target_path)
        auditor.run()

        pillar_punishments = {p: 0 for p in WEIGHTS.keys()}
        for v in auditor.violations:
            pillar_punishments[v['pillar']] += v['weight']

        total_loc = auditor.discovery_data['total_loc']

        pillar_scores = {}
        for pillar in WEIGHTS.keys():
            pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                pillar_punishments[pillar],
                total_loc
            )

        final_score = ScoringEngine.calculate_final_score(pillar_scores)
        rating = ScoringEngine.get_rating(final_score)

        return {
            "status": "success",
            "target": target_path,
            "project_name": os.path.basename(target_path),
            "metrics": {
                "total_loc": total_loc,
                "total_files": auditor.discovery_data['total_files']
            },
            "scores": {
                "final": final_score,
                "rating": rating,
                "pillars": pillar_scores
            },
            "violations": auditor.violations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@app.get("/history")
async def get_audit_history(target: str = None):
    """Lấy danh sách lịch sử các lần kiểm toán."""
    try:
        history = AuditDatabase.get_history(target)
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
