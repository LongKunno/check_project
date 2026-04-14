"""
Router: Audit routes — Stream logs, scan, repository, jobs, fix suggestions.
"""

import os
import shutil
import tempfile
import asyncio
import sys

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    UploadFile,
    File,
    Request,
    BackgroundTasks,
)
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel

from src.engine.auditor import CodeAuditor
from src.engine.scoring import ScoringEngine
from src.engine.database import AuditDatabase
from src.api.git_helper import GitHelper
from src.api.audit_state import AuditState, JobManager
from src.config import CONFIGURED_REPOSITORIES, AI_ENABLED

router = APIRouter()


def run_auditor_with_capture(target_path, target_id=None, job_id=None):
    """
    Wrapper: chạy audit và route log vào SSE stream.

    Kiến trúc Logging (V2):
    - Engine modules (auditor, ai_service, ...) dùng logging.getLogger(__name__).info()
    - AuditLogHandler (đăng ký ở api_server.py) tự động bắt log từ 'src.engine.*'
      và chuyển tiếp vào JobManager/AuditState SSE stream.
    - Thread-local tracking (JobManager.set_active_job) cho biết Job nào đang active.
    - Stdout capture chỉ là fallback cho output từ subprocess/thư viện bên ngoài.
    """
    # Đăng ký Job active trên thread này để AuditLogHandler biết route log đi đâu
    if job_id:
        JobManager.set_active_job(job_id)

    try:
        custom_rules = None
        if target_id:
            db_rules = AuditDatabase.get_effective_rules(target_id)
            if db_rules:
                custom_rules = db_rules
        auditor = CodeAuditor(target_path, custom_rules=custom_rules)
        auditor.run()
        return auditor
    finally:
        AuditState.is_running = False
        if job_id:
            JobManager.clear_active_job()


def _build_and_save_audit_result(auditor, target_str, project_name):
    total_loc = auditor.discovery_data["total_loc"]
    final_score = ScoringEngine.calculate_final_score_from_features(
        auditor.feature_results
    )
    rating = ScoringEngine.get_rating(final_score)
    result = {
        "status": "success",
        "target": target_str,
        "project_name": project_name,
        "metrics": {
            "total_loc": total_loc,
            "total_files": auditor.discovery_data["total_files"],
        },
        "scores": {
            "final": final_score,
            "rating": rating,
            "project_pillars": auditor.project_pillars,
            "features": auditor.feature_results,
            "members": getattr(auditor, "member_results", {}),
        },
        "violations": auditor.violations,
    }
    scan_mode = "full_ai" if AI_ENABLED else "static_only"
    AuditDatabase.save_audit(
        target=target_str,
        score=final_score,
        rating=rating,
        loc=total_loc,
        violations_count=len(auditor.violations),
        pillar_scores=auditor.project_pillars,
        full_json=result,
        scan_mode=scan_mode,
    )
    return result


# ── SSE Streams ──────────────────────────────────────────────────────────────


@router.get("/audit/logs")
async def stream_audit_logs(request: Request):
    """Event-Stream để đẩy log thời gian thực về Frontend."""

    async def log_generator():
        last_idx = 0
        while True:
            if await request.is_disconnected():
                break
            current_len = len(AuditState.logs)
            if current_len > last_idx:
                for line in AuditState.logs[last_idx:current_len]:
                    yield f"data: {line}\n\n"
                last_idx = current_len
            await asyncio.sleep(0.5)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


@router.get("/audit/status")
async def get_audit_status():
    """Kiểm tra trạng thái hệ thống."""
    return {"is_running": AuditState.is_running}


@router.post("/audit/cancel")
async def cancel_audit():
    """Hủy phiên kiểm toán đang chạy."""
    AuditState.cancel()

    # Huỷ cả các Job đang chạy trong JobManager (Batch Scanning)
    for jid, job in JobManager.jobs.items():
        if job.status in ["PENDING", "RUNNING"]:
            JobManager.update_job(jid, "FAILED", "Đã bị huỷ bởi người dùng.")
            JobManager.log(jid, "[SYSTEM] Đã nhận lệnh huỷ từ người dùng.")

    return {"status": "success", "message": "Đã gửi tín hiệu hủy quét mã nguồn."}


# ── Upload & Process ──────────────────────────────────────────────────────────


@router.post("/audit/process")
async def upload_and_audit(
    background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)
):
    """Nhận file upload, lưu vào thư mục tạm, giao Job cho Background."""
    if not files:
        raise HTTPException(status_code=400, detail="Không có file nào được upload.")

    AuditState.reset()
    temp_dir = tempfile.mkdtemp(prefix="audit_upload_")
    project_name = "uploaded_project"

    try:
        for upload_file in files:
            raw_path = upload_file.filename
            if not raw_path:
                continue
            parts = raw_path.replace("\\", "/").split("/")
            safe_parts = [p for p in parts if p not in ("..", ".", "")]
            if not safe_parts:
                continue
            # Lưu ý giữ lại project_name tĩnh thay vì đè lên bằng tên thư mục (bug: ghi đè folder)
            relative_path = os.path.join(*safe_parts)
            dest_path = os.path.join(temp_dir, relative_path)
            if not os.path.abspath(dest_path).startswith(os.path.abspath(temp_dir)):
                continue
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            content = await upload_file.read()
            with open(dest_path, "wb") as f:
                f.write(content)

        # Trỏ thẳng mục tiêu quét tới gốc temp_dir chứa trọn vẹn toàn bộ các folder
        target_path = temp_dir

        job_id = JobManager.create_job(project_name)

        def background_audit(job_id, target_path, project_name, temp_dir):
            JobManager.update_job(job_id, "RUNNING", "Bắt đầu kiểm toán mã nguồn...")
            try:
                auditor = run_auditor_with_capture(target_path, project_name, job_id)
                result = _build_and_save_audit_result(
                    auditor, project_name, project_name
                )
                JobManager.update_job(job_id, "COMPLETED", result=result)
            except Exception as e:
                JobManager.update_job(job_id, "FAILED", message=str(e))
            finally:
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)

        background_tasks.add_task(
            background_audit, job_id, target_path, project_name, temp_dir
        )
        return {
            "status": "started",
            "job_id": job_id,
            "message": "Tiến trình kiểm toán đã được khởi tạo.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")
    finally:
        # Dọn dẹp nếu background task chưa chạy (lỗi trước khi add_task)
        if not JobManager.get_job(project_name) and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


# ── Legacy CLI endpoint ───────────────────────────────────────────────────────


@router.get("/audit")
async def run_audit(target: str = Query(".", description="Path to directory")):
    """Legacy endpoint: kiểm toán qua đường dẫn (CLI / nội bộ)."""

    # SECURITY FIX: Directory Traversal Prevention
    if ".." in target or target.startswith("/"):
        raise HTTPException(
            status_code=403,
            detail="Lệnh duyệt tệp trái phép. Chỉ được phép quét trong không gian làm việc hiện tại.",
        )

    base_dir = os.path.abspath(".")
    target_path = os.path.abspath(target)

    if not target_path.startswith(base_dir):
        raise HTTPException(
            status_code=403,
            detail="Đường dẫn quét bị giới hạn trong không gian ứng dụng.",
        )

    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy: {target}")
    try:
        AuditState.reset()
        auditor = await asyncio.to_thread(
            run_auditor_with_capture, target_path, target_path
        )
        result = _build_and_save_audit_result(
            auditor, target_path, os.path.basename(target_path)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")


# ── Repository (Git) ──────────────────────────────────────────────────────────


class RepositoryAuditRequest(BaseModel):
    id: Optional[str] = None
    repo_url: Optional[str] = None
    username: Optional[str] = None
    token: Optional[str] = None
    branch: Optional[str] = None


@router.post("/audit/repository")
async def audit_repository(
    request: RepositoryAuditRequest, background_tasks: BackgroundTasks
):
    """Clone Repository và chạy kiểm toán ở Background."""
    repo_url = request.repo_url
    username = request.username
    token = request.token
    branch = request.branch

    if request.id:
        config_repo = next(
            (r for r in CONFIGURED_REPOSITORIES if r["id"] == request.id), None
        )
        if not config_repo:
            raise HTTPException(status_code=400, detail="Không tìm thấy ID dự án.")
        repo_url = config_repo["url"]
        username = config_repo["username"]
        token = config_repo["token"]
        branch = request.branch or config_repo.get("branch")

    if not repo_url:
        raise HTTPException(status_code=400, detail="Thiếu URL Repository.")

    AuditState.reset()
    temp_dir = tempfile.mkdtemp(prefix="git_audit_")
    job_id = JobManager.create_job(repo_url)

    def background_git_audit(
        job_id, repo_url, username, token, branch, temp_dir, target_id
    ):
        JobManager.update_job(job_id, "RUNNING", "Đang tải mã nguồn từ Git...")
        try:
            target_path = os.path.join(temp_dir, "repo")
            GitHelper.clone_repository(
                repo_url=repo_url,
                dest_dir=target_path,
                username=username,
                token=token,
                branch=branch,
            )
            JobManager.update_job(
                job_id, "RUNNING", "Đang phân tích tĩnh và áp dụng AI..."
            )
            auditor = run_auditor_with_capture(target_path, target_id, job_id)
            project_name = repo_url.split("/")[-1].replace(".git", "")
            result = _build_and_save_audit_result(auditor, repo_url, project_name)
            JobManager.update_job(job_id, "COMPLETED", result=result)
        except Exception as e:
            JobManager.update_job(job_id, "FAILED", message=str(e))
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    background_tasks.add_task(
        background_git_audit,
        job_id,
        repo_url,
        username,
        token,
        branch,
        temp_dir,
        request.id or repo_url,
    )
    return {
        "status": "started",
        "job_id": job_id,
        "message": "Đã bắt đầu clone và kiểm toán.",
    }


# ── Batch Audit ───────────────────────────────────────────────────────────────


class BatchAuditRequest(BaseModel):
    project_ids: List[str]


@router.post("/audit/batch")
async def audit_batch(request: BatchAuditRequest, background_tasks: BackgroundTasks):
    """Quét hàng loạt các dự án trong cấu hình."""
    if not request.project_ids:
        raise HTTPException(status_code=400, detail="Không có dự án nào được chọn.")

    # Tìm một active batch (nếu có)
    for jid, job in JobManager.jobs.items():
        if job.job_type == "batch" and job.status in ["PENDING", "RUNNING"]:
            return {
                "status": "started",
                "job_id": jid,
                "message": "Batch hiện tại đang chạy.",
            }

    AuditState.reset()
    job_id = JobManager.create_job("batch_scan", job_type="batch")

    # Khởi tạo trạng thái cho từng dự án
    initial_result = {"projects": {}}
    for pid in request.project_ids:
        initial_result["projects"][pid] = {"status": "PENDING"}
    JobManager.update_job(
        job_id, "RUNNING", "Đang khởi tạo Batch...", result=initial_result
    )

    def background_batch(job_id, project_ids):
        JobManager.log(
            job_id, f"[BATCH] Bắt đầu quét hàng loạt {len(project_ids)} dự án."
        )

        for idx, pid in enumerate(project_ids):
            # Kiểm tra tín hiệu huỷ giữa các project
            if AuditState.is_cancelled:
                JobManager.log(job_id, "[BATCH] Đã dừng quét loạt dự án do lệnh huỷ.")
                break

            temp_dir = None
            try:
                config_repo = next(
                    (r for r in CONFIGURED_REPOSITORIES if r["id"] == pid), None
                )

                job = JobManager.get_job(job_id)
                # Dừng nếu job bị huỷ từ API /audit/cancel
                if not job or job.status == "FAILED":
                    JobManager.log(job_id, "[BATCH] Job đã kết thúc hoặc bị huỷ.")
                    break

                batch_result = job.result or {"projects": {}}

                if not config_repo:
                    batch_result["projects"][pid] = {
                        "status": "FAILED",
                        "message": "Không tìm thấy cấu hình.",
                    }
                    JobManager.update_job(job_id, "RUNNING", result=batch_result)
                    continue

                batch_result["projects"][pid] = {"status": "RUNNING"}
                JobManager.update_job(job_id, "RUNNING", result=batch_result)

                repo_url = config_repo["url"]
                username = config_repo["username"]
                token = config_repo["token"]
                branch = config_repo.get("branch")

                JobManager.log(
                    job_id, f"[BATCH] Đang xử lý: {pid} ({idx+1}/{len(project_ids)})"
                )

                # Sanitize pid cho tempdir prefix: thay / thành _ để tránh lỗi đường dẫn
                safe_pid = pid.replace("/", "_").replace("\\", "_")
                temp_dir = tempfile.mkdtemp(prefix=f"batch_{safe_pid}_")
                target_path = os.path.join(temp_dir, "repo")

                # 1. Clone
                JobManager.log(job_id, f"[BATCH] Đang tải mã nguồn: {repo_url}")
                GitHelper.clone_repository(
                    repo_url=repo_url,
                    dest_dir=target_path,
                    username=username,
                    token=token,
                    branch=branch,
                )

                # 2. Audit
                JobManager.log(job_id, f"[BATCH] Thực thi kiểm toán: {pid}")
                auditor = run_auditor_with_capture(target_path, pid, job_id)
                project_name = repo_url.split("/")[-1].replace(".git", "")
                res = _build_and_save_audit_result(auditor, repo_url, project_name)

                batch_result["projects"][pid] = {
                    "status": "COMPLETED",
                    "score": res["scores"]["final"],
                }
                JobManager.update_job(job_id, "RUNNING", result=batch_result)
            except Exception as e:
                job = JobManager.get_job(job_id)
                batch_result = (job.result if job else None) or {"projects": {}}
                batch_result["projects"][pid] = {"status": "FAILED", "message": str(e)}
                JobManager.update_job(job_id, "RUNNING", result=batch_result)
                JobManager.log(job_id, f"[BATCH] LỖI tại {pid}: {str(e)}")
            finally:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)

        JobManager.log(job_id, "[BATCH] Hoàn tất toàn bộ !")
        JobManager.update_job(job_id, "COMPLETED", "Hoàn tất Batch.")

    background_tasks.add_task(background_batch, job_id, request.project_ids)
    return {"status": "started", "job_id": job_id, "message": "Bắt đầu quét hàng loạt."}


@router.get("/audit/batch/active")
async def get_active_batch():
    for jid, job in JobManager.jobs.items():
        if job.job_type == "batch" and job.status in ["PENDING", "RUNNING"]:
            return {"has_active": True, "job_id": jid, "job": job}
    return {"has_active": False}


# ── Job Management ────────────────────────────────────────────────────────────


@router.get("/audit/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Lấy trạng thái tiến trình (Dùng cho Long-Polling)."""
    job = JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job ID.")
    return job


@router.get("/audit/jobs/{job_id}/logs")
async def stream_job_logs(job_id: str, request: Request):
    """SSE stream log riêng cho từng Job."""
    if not JobManager.get_job(job_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Job ID.")

    async def log_generator():
        last_idx = 0
        while True:
            if await request.is_disconnected():
                break
            job_status = JobManager.get_job(job_id)
            if not job_status:
                break
            logs = JobManager.get_logs(job_id)
            current_len = len(logs)
            if current_len > last_idx:
                for line in logs[last_idx:current_len]:
                    yield f"data: {line}\n\n"
                last_idx = current_len
            if job_status.status in ["COMPLETED", "FAILED"]:
                await asyncio.sleep(1)
                yield f"data: [END_OF_STREAM]\n\n"
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


# ── AI Fix Suggestion ─────────────────────────────────────────────────────────


class FixSuggestionRequest(BaseModel):
    file_path: str
    snippet: str
    reason: str


@router.post("/audit/fix-suggestion")
async def get_fix_suggestion(request: FixSuggestionRequest):
    """Yêu cầu AI gợi ý sửa lỗi cho một vi phạm cụ thể."""
    from src.engine.ai_service import ai_service

    prompt = f"""Bạn là chuyên gia sửa lỗi code. Hãy đưa ra gợi ý cho:
File: {request.file_path}
Lỗi: {request.reason}
Đoạn mã hiện tại:
```python
{request.snippet}
```
Trả về mã đã sửa (trong block markdown) và giải thích ngắn gọn."""
    try:
        messages = [
            {
                "role": "system",
                "content": "You are a helpful code fixer. Provide concise code fixes.",
            },
            {"role": "user", "content": prompt},
        ]
        response = await ai_service.client.chat.completions.create(
            model=ai_service.model, messages=messages
        )
        return {"suggestion": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
