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

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import StreamingResponse
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
from src.api.audit_state import AuditState
import logging
import asyncio
import sys
import io

# Thiết lập logging chi tiết
logging.basicConfig(level=logging.INFO)

class AuditLogHandler(logging.Handler):
    """Custom logging handler to intercept all logger outputs and send them to the SSE UI stream."""
    def emit(self, record):
        try:
            msg = self.format(record)
            if msg.strip():
                AuditState.log(msg.strip())
        except Exception:
            self.handleError(record)

# Cài đặt handler vào root logger để tóm được cả logs của uvicorn và thư viện third-party (như openai)
audit_log_handler = AuditLogHandler()
audit_log_handler.setFormatter(logging.Formatter('%(levelname)s:%(name)s:%(message)s'))
logging.getLogger().addHandler(audit_log_handler)
logging.getLogger("uvicorn.access").addHandler(audit_log_handler)

def run_auditor_with_capture(target_path, target_id=None):
    """Wrapper function to capture all sys.stdout during an audit run and send to Frontend."""
    class AuditLogStream(io.StringIO):
        def write(self, s):
            sys.__stdout__.write(s)
            sys.__stdout__.flush()
            if s.strip('\n'):
                AuditState.log(s.strip('\n'))
        def flush(self):
            sys.__stdout__.flush()
            
    old_stdout = sys.stdout
    sys.stdout = AuditLogStream()
    AuditState.is_running = True
    try:
        from src.engine.auditor import CodeAuditor
        from src.engine.database import AuditDatabase
        
        custom_rules = None
        if target_id:
            db_rules = AuditDatabase.get_project_rules(target_id)
            if db_rules:
                custom_rules = db_rules
                
        auditor = CodeAuditor(target_path, custom_rules=custom_rules)
        auditor.run()
        return auditor
    finally:
        AuditState.is_running = False
        sys.stdout = old_stdout
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

@app.get("/audit/logs")
async def stream_audit_logs(request: Request):
    """Event-Stream để đẩy log thời gian thực về Frontend."""
    async def log_generator():
        last_idx = 0
        while True:
            # Nếu người dùng tắt tab hoặc hủy kết nối
            if await request.is_disconnected():
                break
                
            current_len = len(AuditState.logs)
            if current_len > last_idx:
                new_logs = AuditState.logs[last_idx:current_len]
                last_idx = current_len
                for line in new_logs:
                    # Giao thức SSE
                    yield f"data: {line}\n\n"
            
            await asyncio.sleep(0.5)

    return StreamingResponse(log_generator(), media_type="text/event-stream")

@app.get("/audit/status")
async def get_audit_status():
    """Kiểm tra trạng thái hệ thống đang chạy hay nghỉ."""
    return {"is_running": AuditState.is_running}

@app.post("/audit/cancel")
async def cancel_audit():
    """Hủy một phiên kiểm toán đang chạy."""
    AuditState.cancel()
    return {"status": "success", "message": "Đã gửi tín hiệu hủy quét mã nguồn."}

@app.post("/audit/process")
async def upload_and_audit(files: List[UploadFile] = File(...)):
    """
    Nhận các file được upload từ trình duyệt (webkitdirectory),
    lưu vào thư mục tạm, chạy kiểm toán, rồi dọn dẹp.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Không có file nào được upload.")

    if AuditState.is_running:
        raise HTTPException(status_code=409, detail="Một phiên kiểm toán đang chạy. Vui lòng thử lại sau.")

    # Đặt lại trạng thái hủy quét
    AuditState.reset()

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

        # Chạy kiểm toán bằng thread nền để không block async event loop
        auditor = await asyncio.to_thread(run_auditor_with_capture, target_path, project_name)

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
        rating = ScoringEngine.get_rating(final_score)

        # Chuẩn bị kết quả trả về
        result = {
            "status": "success",
            "target": project_name, # Trả về project_name để UI gọi lấy history theo name
            "project_name": project_name,
            "metrics": {
                "total_loc": total_loc,
                "total_files": auditor.discovery_data['total_files']
            },
            "scores": {
                "final": final_score,
                "rating": rating,
                "project_pillars": auditor.project_pillars,
                "features": auditor.feature_results,
                "members": getattr(auditor, 'member_results', {})
            },
            "violations": auditor.violations
        }

        # Lưu lịch sử Audit - Sử dụng project_name thay vì đường dẫn tạm để history trùng khớp
        # Lưu kèm full_json để có thể xem lại chi tiết
        AuditDatabase.save_audit(
            target=project_name,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(auditor.violations),
            pillar_scores=auditor.project_pillars,
            full_json=result
        )

        return result

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

    if AuditState.is_running:
        raise HTTPException(status_code=409, detail="Một phiên kiểm toán đang chạy. Vui lòng thử lại sau.")

    try:
        # Đặt lại trạng thái hủy quét
        AuditState.reset()

        # Chạy kiểm toán
        auditor = await asyncio.to_thread(run_auditor_with_capture, target_path, target_path)

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
        rating = ScoringEngine.get_rating(final_score)

        # Chuẩn bị kết quả trả về
        result = {
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
                "features": auditor.feature_results,
                "members": getattr(auditor, 'member_results', {})
            },
            "violations": auditor.violations
        }

        # Lưu lịch sử Audit
        AuditDatabase.save_audit(
            target=target_path,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(auditor.violations),
            pillar_scores=auditor.project_pillars,
            full_json=result
        )

        return result
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

    if AuditState.is_running:
        raise HTTPException(status_code=409, detail="Một phiên kiểm toán đang chạy. Vui lòng thử lại sau.")

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
        AuditState.reset()
        auditor = await asyncio.to_thread(run_auditor_with_capture, target_path, repo_url)

        total_loc = auditor.discovery_data['total_loc']
        final_score = ScoringEngine.calculate_final_score_from_features(auditor.feature_results)
        rating = ScoringEngine.get_rating(final_score)

        # Chuẩn bị kết quả trả về
        result = {
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
                "features": auditor.feature_results,
                "members": getattr(auditor, 'member_results', {})
            },
            "violations": auditor.violations
        }

        # Lưu lịch sử Audit
        AuditDatabase.save_audit(
            target=repo_url,
            score=final_score,
            rating=rating,
            loc=total_loc,
            violations_count=len(auditor.violations),
            pillar_scores=auditor.project_pillars,
            full_json=result
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")
    finally:
        # Luôn dọn dẹp thư mục tạm
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

class SaveRulesRequest(BaseModel):
    target: str
    natural_text: str = ""
    compiled_json: Optional[dict] = None
    custom_weights: dict = {}

@app.get("/rules")
async def get_rules(target: str = Query(..., description="Target ID (project name or repo URL)")):
    from src.config import RULES_METADATA
    import json
    
    # Đọc cấu hình weight mặc định từ file rules.json
    default_rules_with_weight = {}
    for k, v in RULES_METADATA.items():
        default_rules_with_weight[k] = v.copy()
        default_rules_with_weight[k]['weight'] = -2.0 # Fallback
        
    try:
        rules_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'engine', 'rules.json')
        with open(rules_path, 'r', encoding='utf-8') as f:
            engine_rules = json.load(f)
            for r in engine_rules.get('regex_rules', []):
                if r['id'] in default_rules_with_weight:
                    default_rules_with_weight[r['id']]['weight'] = r.get('weight', -2.0)
            ast_r = engine_rules.get('ast_rules', {})
            for r in ast_r.get('dangerous_functions', []):
                if r['id'] in default_rules_with_weight:
                    default_rules_with_weight[r['id']]['weight'] = r.get('weight', -2.0)
            for k, v in ast_r.items():
                if k != 'dangerous_functions' and isinstance(v, dict):
                    if v['id'] in default_rules_with_weight:
                        default_rules_with_weight[v['id']]['weight'] = v.get('weight', -2.0)
    except Exception:
        pass

    rules = AuditDatabase.get_project_rules(target)
    
    response_data = {
        "default_rules": default_rules_with_weight
    }
    
    if rules:
        response_data.update(rules)
        
    return {"status": "success", "data": response_data}

@app.post("/rules/save")
async def save_rules(request: SaveRulesRequest):
    try:
        AuditDatabase.save_project_rules(
            target_id=request.target, 
            natural_text=request.natural_text, 
            compiled_json=request.compiled_json
        )
        AuditDatabase.save_custom_weights(
            target_id=request.target,
            custom_weights=request.custom_weights
        )
        return {"status": "success", "message": "Rules saved successfully."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/rules")
async def delete_rules(target: str = Query(..., description="Target ID to delete rules for")):
    try:
        AuditDatabase.delete_project_rules(target)
        return {"status": "success", "message": "Rules deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ToggleRuleRequest(BaseModel):
    target: str
    rule_id: str
    is_disabled: bool

@app.post("/rules/toggle")
async def toggle_rule(request: ToggleRuleRequest):
    try:
        AuditDatabase.toggle_core_rule(request.target, request.rule_id, request.is_disabled)
        return {"status": "success", "message": f"Rule {request.rule_id} toggled successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CompileRulesRequest(BaseModel):
    natural_text: str

@app.post("/rules/compile")
async def compile_rules(request: CompileRulesRequest):
    from src.engine.natural_rules_compiler import NaturalRulesCompiler
    compiler = NaturalRulesCompiler()
    
    async def log_generator():
        try:
            async for chunk in compiler.compile_rules_stream(request.natural_text):
                yield chunk
        except Exception as e:
            yield f"\\n\\n[LỖI]: {str(e)}"

    return StreamingResponse(log_generator(), media_type="text/plain")

class TestRuleRequest(BaseModel):
    code_snippet: str
    compiled_json: dict

def _run_scanners_sync(content, rules):
    from src.engine.verification import RegexScanner, PythonASTScanner
    import ast
    file_path = "sandbox.py"
    lines = content.splitlines()
    tree = None
    try:
        tree = ast.parse(content)
    except Exception:
        pass
        
    violations = []
    scanners = [RegexScanner(), PythonASTScanner()]
    for scanner in scanners:
        try:
            results = scanner.scan(file_path, content, lines, tree, rules)
            violations.extend(results)
        except Exception:
            pass
    return violations

@app.post("/rules/test")
async def test_rule(request: TestRuleRequest):
    """API để chạy thử nghiệm Luật trên Sandbox của Dashboard."""
    try:
        # Chạy scanner trong ThreadPool để không block Event Loop, ngắt Timeout sau 5s nếu Regex dính ReDoS
        violations = await asyncio.wait_for(
            asyncio.to_thread(_run_scanners_sync, request.code_snippet, request.compiled_json),
            timeout=5.0
        )
        return {"status": "success", "violations": violations}
    except asyncio.TimeoutError:
        return {"status": "error", "message": "Quá thời gian (Timeout). Luật Regex quá phức tạp hoặc gây vòng lặp vô hạn (ReDoS)!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health/ai")
async def health_ai():
    """Kiểm tra kết nối và tính sẵn sàng của AI Service."""
    from src.engine.ai_service import ai_service
    try:
        # Thử một test đơn giản
        test_prompt = "Say 'OK'"
        messages = [{"role": "user", "content": test_prompt}]
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model,
            messages=messages,
            max_tokens=5
        )
        if response.choices[0].message.content:
            return {"status": "healthy", "model": ai_service.model}
        return {"status": "unhealthy", "reason": "Empty response"}
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}

class FixSuggestionRequest(BaseModel):
    file_path: str
    snippet: str
    reason: str

@app.post("/audit/fix-suggestion")
async def get_fix_suggestion(request: FixSuggestionRequest):
    """Yêu cầu AI đưa ra gợi ý sửa lỗi cho một vi phạm cụ thể."""
    from src.engine.ai_service import ai_service
    
    prompt = f"""
Bạn là một chuyên gia sửa lỗi code. Hãy đưa ra gợi ý sửa lỗi cho vi phạm sau:
File: {request.file_path}
Lỗi: {request.reason}
Đoạn mã hiện tại:
```python
{request.snippet}
```

Hãy trả về mã nguồn đã sửa đổi (chỉ mã nguồn, trong block markdown) và một giải thích cực kỳ ngắn gọn.
"""
    try:
        messages = [
            {"role": "system", "content": "You are a helpful code fixer. Provide concise code fixes."},
            {"role": "user", "content": prompt}
        ]
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model,
            messages=messages
        )
        return {"suggestion": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
