"""
API Server for AI Static Analysis Engine (V3).
Provides a RESTful interface to trigger code audits and retrieve results.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
from typing import List, Optional
from pydantic import BaseModel
# Đảm bảo import được các module từ thư mục 'src'
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.engine.auditor import CodeAuditor
from src.config import WEIGHTS, CONFIGURED_REPOSITORIES
from src.engine.scoring import ScoringEngine
from src.engine.database import AuditDatabase
from fastapi.exceptions import RequestValidationError
from src.api.git_helper import GitHelper
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
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
        # Lưu từng file, giữ nguyên cấu trúc thư mục tương đối (đã sanitize)
        for upload_file in files:
            # filename từ browser: "project/src/main.py"
            raw_path = upload_file.filename
            if not raw_path:
                continue

            # Xử lý an toàn: chuẩn hóa path và ngăn chặn quay ngược thư mục (../)
            # Chúng ta giữ cấu trúc folder nhưng đảm bảo nó không thoát khỏi temp_dir
            parts = raw_path.replace("\\", "/").split("/")
            # Lọc bỏ các part nguy hiểm như ".." hoặc "."
            safe_parts = [p for p in parts if p not in ("..", ".", "")]
            
            if not safe_parts:
                continue
                
            relative_path = os.path.join(*safe_parts)
            
            # Lấy tên project từ phần tử đầu tiên
            project_name = safe_parts[0]

            dest_path = os.path.join(temp_dir, relative_path)
            # Đảm bảo dest_path vẫn nằm trong temp_dir
            if not os.path.abspath(dest_path).startswith(os.path.abspath(temp_dir)):
                continue

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

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
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
                "project_pillars": auditor.project_pillars,
                "features": auditor.feature_results # Cấu trúc mới: feature -> pillars
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
        # Chạy kiểm toán
        auditor = CodeAuditor(target_path)
        auditor.run()

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
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
                "project_pillars": auditor.project_pillars,
                "features": auditor.feature_results
            },
            "violations": auditor.violations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@app.get("/repositories")
async def get_configured_repositories():
    """Lấy danh sách các repository đã được cấu hình sẵn (ẩn token/username)."""
    public_repos = []
    for repo in CONFIGURED_REPOSITORIES:
        public_repos.append({
            "id": repo["id"],
            "name": repo["name"],
            "url": repo["url"]
        })
    return {"status": "success", "data": public_repos}

class RepositoryAuditRequest(BaseModel):
    id: Optional[str] = None
    repo_url: Optional[str] = None
    username: Optional[str] = None
    token: Optional[str] = None

@app.post("/audit/repository")
async def audit_repository(request: RepositoryAuditRequest):
    """
    Nhận id (repo cấu hình sẵn) hoặc URL Repository, clone về thư mục tạm, chạy kiểm toán rồi dọn dẹp.
    """
    repo_url = request.repo_url
    username = request.username
    token = request.token

    if request.id:
        # Nếu có gửi ID, lấy thông tin từ cấu hình
        config_repo = next((r for r in CONFIGURED_REPOSITORIES if r["id"] == request.id), None)
        if not config_repo:
            raise HTTPException(status_code=400, detail="Không tìm thấy ID dự án được cấu hình.")
        repo_url = config_repo["url"]
        username = config_repo["username"]
        token = config_repo["token"]
        
    if not repo_url:
        raise HTTPException(status_code=400, detail="Thiếu cấu hình ID dự án hoặc URL Repository.")

    temp_dir = tempfile.mkdtemp(prefix="git_audit_")
    
    try:
        # Clone repo
        target_path = os.path.join(temp_dir, "repo")
        GitHelper.clone_repository(
            repo_url=repo_url, 
            dest_dir=target_path, 
            username=username, 
            token=token
        )
        
        # Chạy kiểm toán
        auditor = CodeAuditor(target_path)
        auditor.run()

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
        rating = ScoringEngine.get_rating(final_score)

        return {
            "status": "success",
            "target": repo_url,
            "project_name": repo_url.split('/')[-1].replace('.git', ''),
            "metrics": {
                "total_loc": total_loc,
                "total_files": auditor.discovery_data['total_files']
            },
            "scores": {
                "final": final_score,
                "rating": rating,
                "project_pillars": auditor.project_pillars,
                "features": auditor.feature_results
            },
            "violations": auditor.violations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")
    finally:
        # Luôn dọn dẹp thư mục tạm
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

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
