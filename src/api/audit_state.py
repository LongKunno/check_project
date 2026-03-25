import uuid
import time
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

class JobManager:
    """
    Global state container to track the status of multiple ongoing code audits.
    """
    jobs: Dict[str, JobStatus] = {}
    job_logs: Dict[str, List[str]] = {}
    
    # Backward compatibility cho SSE cũ nếu chưa update kịp
    legacy_logs: List[str] = []
    
    @classmethod
    def create_job(cls, target: str = "unknown") -> str:
        job_id = str(uuid.uuid4())
        cls.jobs[job_id] = JobStatus(
            job_id=job_id,
            status="PENDING",
            started_at=time.time(),
            target=target
        )
        cls.job_logs[job_id] = []
        # Xoá legacy logs cho phiên mới để không bị rác màn hình
        cls.legacy_logs.clear()
        return job_id
        
    @classmethod
    def update_job(cls, job_id: str, status: str, message: str = "", result: dict = None):
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
        cls.legacy_logs.append(message)
        
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
    logs = JobManager.legacy_logs
    
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
