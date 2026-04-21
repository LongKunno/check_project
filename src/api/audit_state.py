import uuid
import time
import threading
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field

from src.engine.database import AuditDatabase


class JobProgress(BaseModel):
    phase: Optional[Literal["validation", "deep_audit"]] = None
    phase_label: Optional[str] = None
    total_batches: int = 0
    batch_size: int = 0
    last_started_batch: int = 0
    completed_batches: int = 0
    active_batches: int = 0
    pending_batches: int = 0
    last_detail: str = ""
    updated_at: float = Field(default_factory=time.time)


class JobStatus(BaseModel):
    job_id: str
    status: str  # "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"
    message: str = ""
    result: Optional[dict] = None
    started_at: float
    ended_at: Optional[float] = None
    target: str = ""
    job_type: str = "single"  # "single" hoac "batch"
    progress: Optional[JobProgress] = None
    cancel_requested: bool = False
    ai_mode: str = "realtime"
    workspace_path: str = ""
    orchestration_state: dict = Field(default_factory=dict)


class JobManager:
    """
    Global state container to track the status of multiple ongoing code audits.
    """

    jobs: Dict[str, JobStatus] = {}
    job_logs: Dict[str, List[str]] = {}
    TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}
    ACTIVE_STATUSES = {"PENDING", "RUNNING"}

    # Thread-local storage để track Job đang chạy trên thread nào
    _thread_local = threading.local()

    # Thời gian giữ lại job đã hoàn thành (giây) — dọn sau 1 giờ
    JOB_RETENTION_SECONDS = 3600

    @classmethod
    def _persist_job(cls, job_id: str):
        job = cls.jobs.get(job_id)
        if not job:
            return
        AuditDatabase.upsert_runtime_job(job.model_dump())

    @classmethod
    def create_job(
        cls,
        target: str = "unknown",
        job_type: str = "single",
        ai_mode: str = "realtime",
        workspace_path: str = "",
        orchestration_state: Optional[dict] = None,
    ) -> str:
        # Dọn dẹp jobs cũ trước khi tạo mới để ngăn memory leak
        cls.cleanup_old_jobs()

        job_id = str(uuid.uuid4())
        cls.jobs[job_id] = JobStatus(
            job_id=job_id,
            status="PENDING",
            started_at=time.time(),
            target=target,
            job_type=job_type,
            ai_mode=ai_mode,
            workspace_path=workspace_path,
            orchestration_state=orchestration_state or {},
        )
        cls.job_logs[job_id] = []
        cls._persist_job(job_id)
        return job_id

    @classmethod
    def cleanup_old_jobs(cls):
        """Dọn dẹp jobs đã COMPLETED/FAILED quá JOB_RETENTION_SECONDS (memory leak prevention)."""
        now = time.time()
        # Snapshot keys để tránh RuntimeError khi dict thay đổi trong quá trình iterate
        stale_ids = [
            jid
            for jid, job in list(cls.jobs.items())
            if job.status in cls.TERMINAL_STATUSES
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
        job = cls.jobs.get(job_id)
        if not job or job.status in cls.TERMINAL_STATUSES:
            return False

        if status == "COMPLETED" and job.cancel_requested:
            status = "CANCELLED"
            message = message or "Đã hủy theo yêu cầu người dùng."
            result = None

        job.status = status
        if message:
            job.message = message
        if result is not None:
            job.result = result
        if status in cls.TERMINAL_STATUSES:
            cls.finalize_progress(job_id, last_detail=message or None)
            job.ended_at = time.time()
        cls._persist_job(job_id)
        return True

    @classmethod
    def request_cancel(
        cls,
        job_id: str,
        message: str = "Đã nhận yêu cầu dừng. Sẽ chờ request AI đang chạy hoàn tất và không mở request mới.",
    ) -> bool:
        job = cls.jobs.get(job_id)
        if not job or job.status in cls.TERMINAL_STATUSES:
            return False

        job.cancel_requested = True
        if message:
            job.message = message
        if job.progress:
            job.progress.last_detail = message
            job.progress.updated_at = time.time()
        cls._persist_job(job_id)
        return True

    @classmethod
    def is_cancel_requested(cls, job_id: Optional[str]) -> bool:
        if not job_id:
            return False
        job = cls.jobs.get(job_id)
        return bool(job and job.cancel_requested)

    @classmethod
    def get_active_job_ids(cls) -> List[str]:
        return [
            jid
            for jid, job in cls.jobs.items()
            if job.status in cls.ACTIVE_STATUSES
        ]

    @classmethod
    def start_progress_phase(
        cls,
        job_id: str,
        phase: Literal["validation", "deep_audit"],
        phase_label: str,
        total_batches: int,
        batch_size: int,
        last_detail: str = "",
    ):
        job = cls.jobs.get(job_id)
        if not job:
            return
        job.progress = JobProgress(
            phase=phase,
            phase_label=phase_label,
            total_batches=total_batches,
            batch_size=batch_size,
            pending_batches=total_batches,
            last_detail=last_detail,
            updated_at=time.time(),
        )
        cls._persist_job(job_id)

    @classmethod
    def record_batch_started(
        cls, job_id: str, batch_number: int, last_detail: str = ""
    ):
        job = cls.jobs.get(job_id)
        if not job or not job.progress:
            return

        progress = job.progress
        progress.last_started_batch = max(progress.last_started_batch, batch_number)
        progress.active_batches += 1
        progress.pending_batches = max(
            progress.total_batches
            - progress.completed_batches
            - progress.active_batches,
            0,
        )
        if last_detail:
            progress.last_detail = last_detail
        progress.updated_at = time.time()
        cls._persist_job(job_id)

    @classmethod
    def record_batch_finished(
        cls,
        job_id: str,
        batch_number: int,
        last_detail: str = "",
        completed: bool = True,
    ):
        job = cls.jobs.get(job_id)
        if not job or not job.progress:
            return

        progress = job.progress
        progress.active_batches = max(progress.active_batches - 1, 0)
        progress.last_started_batch = max(progress.last_started_batch, batch_number)
        if completed:
            progress.completed_batches = min(
                progress.completed_batches + 1,
                progress.total_batches,
            )
        progress.pending_batches = max(
            progress.total_batches
            - progress.completed_batches
            - progress.active_batches,
            0,
        )
        if last_detail:
            progress.last_detail = last_detail
        progress.updated_at = time.time()
        cls._persist_job(job_id)

    @classmethod
    def finalize_progress(cls, job_id: str, last_detail: str = None):
        job = cls.jobs.get(job_id)
        if not job or not job.progress:
            return

        progress = job.progress
        progress.active_batches = 0
        progress.pending_batches = max(
            progress.total_batches - progress.completed_batches,
            0,
        )
        if last_detail:
            progress.last_detail = last_detail
        progress.updated_at = time.time()
        cls._persist_job(job_id)

    @classmethod
    def update_progress_detail(
        cls,
        job_id: str,
        last_detail: str,
        *,
        last_started_batch: Optional[int] = None,
        completed_batches: Optional[int] = None,
        active_batches: Optional[int] = None,
        pending_batches: Optional[int] = None,
    ):
        job = cls.jobs.get(job_id)
        if not job or not job.progress:
            return

        progress = job.progress
        progress.last_detail = last_detail
        if last_started_batch is not None:
            progress.last_started_batch = last_started_batch
        if completed_batches is not None:
            progress.completed_batches = completed_batches
        if active_batches is not None:
            progress.active_batches = active_batches
        if pending_batches is not None:
            progress.pending_batches = pending_batches
        progress.updated_at = time.time()
        cls._persist_job(job_id)

    @classmethod
    def clear_progress(cls, job_id: str):
        job = cls.jobs.get(job_id)
        if not job:
            return
        job.progress = None
        cls._persist_job(job_id)

    @classmethod
    def log(cls, job_id: str, message: str):
        if job_id and job_id in cls.job_logs:
            cls.job_logs[job_id].append(message)
            AuditDatabase.append_runtime_job_log(
                job_id, len(cls.job_logs[job_id]), message
            )

    @classmethod
    def update_orchestration_state(cls, job_id: str, **updates):
        job = cls.jobs.get(job_id)
        if not job:
            db_job = AuditDatabase.get_runtime_job(job_id)
            if not db_job:
                return
            job = JobStatus.model_validate(db_job)
            cls.jobs[job_id] = job
            cls.job_logs.setdefault(job_id, AuditDatabase.get_runtime_job_logs(job_id))

        state = dict(job.orchestration_state or {})
        state.update(updates)
        job.orchestration_state = state
        cls._persist_job(job_id)

    @classmethod
    def get_orchestration_state(cls, job_id: str) -> dict:
        job = cls.get_job(job_id)
        if not job:
            return {}
        return dict(job.orchestration_state or {})

    @classmethod
    def restore_persisted_jobs(cls):
        cls.jobs.clear()
        cls.job_logs.clear()
        for raw_job in AuditDatabase.get_active_runtime_jobs():
            job = JobStatus.model_validate(raw_job)
            cls.jobs[job.job_id] = job
            cls.job_logs[job.job_id] = AuditDatabase.get_runtime_job_logs(job.job_id)

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
        job = cls.jobs.get(job_id)
        if job:
            return job

        raw_job = AuditDatabase.get_runtime_job(job_id)
        if not raw_job:
            return None

        job = JobStatus.model_validate(raw_job)
        cls.jobs[job_id] = job
        cls.job_logs[job_id] = AuditDatabase.get_runtime_job_logs(job_id)
        return job

    @classmethod
    def get_logs(cls, job_id: str) -> List[str]:
        if job_id in cls.job_logs:
            return cls.job_logs[job_id]
        logs = AuditDatabase.get_runtime_job_logs(job_id)
        if logs:
            cls.job_logs[job_id] = logs
        return logs


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
