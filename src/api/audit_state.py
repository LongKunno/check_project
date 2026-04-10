import uuid
import time
import threading
from typing import Dict, List, Optional
from pydantic import BaseModel


class JobStatus(BaseModel):
    job_id: str
    status: str  # "PENDING", "RUNNING", "COMPLETED", "FAILED"
    message: str = ""
    result: Optional[dict] = None
    started_at: float
    ended_at: Optional[float] = None
    target: str = ""
    job_type: str = "single"  # "single" hoac "batch"


class JobManager:
    """
    Global state container to track the status of multiple ongoing code audits.
    """

    jobs: Dict[str, JobStatus] = {}
    job_logs: Dict[str, List[str]] = {}

    # Thread-local storage để track Job đang chạy trên thread nào
    _thread_local = threading.local()

    # Thời gian giữ lại job đã hoàn thành (giây) — dọn sau 1 giờ
    JOB_RETENTION_SECONDS = 3600

    @classmethod
    def create_job(cls, target: str = "unknown", job_type: str = "single") -> str:
        # Dọn dẹp jobs cũ trước khi tạo mới để ngăn memory leak
        cls.cleanup_old_jobs()

        job_id = str(uuid.uuid4())
        cls.jobs[job_id] = JobStatus(
            job_id=job_id,
            status="PENDING",
            started_at=time.time(),
            target=target,
            job_type=job_type,
        )
        cls.job_logs[job_id] = []
        return job_id

    @classmethod
    def cleanup_old_jobs(cls):
        """Dọn dẹp jobs đã COMPLETED/FAILED quá JOB_RETENTION_SECONDS (memory leak prevention)."""
        now = time.time()
        # Snapshot keys để tránh RuntimeError khi dict thay đổi trong quá trình iterate
        stale_ids = [
            jid
            for jid, job in list(cls.jobs.items())
            if job.status in ("COMPLETED", "FAILED")
            and job.ended_at
            and (now - job.ended_at) > cls.JOB_RETENTION_SECONDS
        ]
        for jid in stale_ids:
            cls.jobs.pop(jid, None)
            cls.job_logs.pop(jid, None)

    @classmethod
    def update_job(
        cls, job_id: str, status: str, message: str = "", result: dict = None
    ):
        if job_id in cls.jobs:
            job = cls.jobs[job_id]
            job.status = status
            if message:
                job.message = message
            if result:
                job.result = result
            if status in ["COMPLETED", "FAILED"]:
                job.ended_at = time.time()

    @classmethod
    def log(cls, job_id: str, message: str):
        if job_id and job_id in cls.job_logs:
            cls.job_logs[job_id].append(message)

    @classmethod
    def set_active_job(cls, job_id: str):
        """Đánh dấu job_id đang active trên thread hiện tại."""
        cls._thread_local.active_job_id = job_id

    @classmethod
    def clear_active_job(cls):
        """Xoá đánh dấu job active trên thread hiện tại."""
        cls._thread_local.active_job_id = None

    @classmethod
    def get_active_job_id(cls) -> Optional[str]:
        """Lấy job_id (str) đang active trên thread hiện tại (hoặc None)."""
        return getattr(cls._thread_local, "active_job_id", None)

    @classmethod
    def get_job(cls, job_id: str) -> Optional[JobStatus]:
        return cls.jobs.get(job_id)

    @classmethod
    def get_logs(cls, job_id: str) -> List[str]:
        return cls.job_logs.get(job_id, [])


# Giữ lại AuditState interface cho các chỗ legacy chưa refactor, trỏ về job "default"
class AuditState:
    is_cancelled = False
    is_running = False
    logs = []

    @classmethod
    def reset(cls):
        cls.is_cancelled = False
        cls.is_running = False
        cls.logs.clear()

    @classmethod
    def cancel(cls):
        cls.is_cancelled = True

    @classmethod
    def log(cls, message: str):
        cls.logs.append(message)
