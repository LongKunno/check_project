"""
Bộ máy kiểm toán mã nguồn (Core Auditor Engine).
Quản lý luồng thực thi 5 bước: Discovery, Scanning, Verification, Aggregation, Reporting.
"""

import os
import json
import sys
import logging
import uuid
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

from src.config import WEIGHTS, get_ai_mode, has_openai_batch_api_key
from src.engine.discovery import DiscoveryStep
from src.engine.verification import VerificationStep
from src.engine.scoring import ScoringEngine
from src.engine.ai_telemetry import ai_telemetry

try:
    from src.api.audit_state import AuditState, JobManager
except ImportError:

    class AuditState:
        is_cancelled = False

    class JobManager:
        @staticmethod
        def get_active_job_id():
            return None

        @staticmethod
        def is_cancel_requested(job_id):
            return False

        @staticmethod
        def start_progress_phase(*args, **kwargs):
            return None

        @staticmethod
        def record_batch_started(*args, **kwargs):
            return None

        @staticmethod
        def record_batch_finished(*args, **kwargs):
            return None

        @staticmethod
        def clear_progress(*args, **kwargs):
            return None

        @staticmethod
        def update_progress_detail(*args, **kwargs):
            return None

        @staticmethod
        def update_orchestration_state(*args, **kwargs):
            return None

        @staticmethod
        def get_orchestration_state(*args, **kwargs):
            return {}


class AuditCancelledError(Exception):
    """Raised when an audit job stops at a safe cancellation checkpoint."""


class CodeAuditor:
    BATCH_STAGE_ORDER = [
        "init",
        "discovered",
        "scanned",
        "validation_submitted",
        "validation_completed",
        "deep_submitted",
        "deep_completed",
        "cross_check_submitted",
        "ai_completed",
    ]

    def __init__(
        self,
        target_dir=".",
        custom_rules=None,
        cancel_check=None,
        job_id=None,
        workspace_path=None,
        target_id=None,
    ):
        """
        Khởi tạo Auditor cho một thư mục cụ thể.
        """
        self.target_dir = os.path.abspath(target_dir)
        self.target_id = target_id or os.path.basename(self.target_dir) or self.target_dir
        self.custom_rules = custom_rules
        self.cancel_check = cancel_check
        self.job_id = job_id
        self.ai_scope_id = self.job_id or f"adhoc-audit-{uuid.uuid4()}"
        self.workspace_path = (
            os.path.abspath(workspace_path) if workspace_path else None
        )
        self.discovery_data = None

        report_dir = (
            os.path.join(self.workspace_path, "reports")
            if self.workspace_path
            else os.path.abspath("reports")
        )
        if not os.path.exists(report_dir):
            os.makedirs(report_dir)

        self.ledger_path = os.path.join(report_dir, "ai_violation_ledger.md")
        self.report_path = os.path.join(report_dir, "Final_Audit_Report.md")
        self.violations = []
        self.violation_counter = 0
        self._violation_signatures = set()
        self.ai_summary = {
            "total_requests": 0,
            "blocked_requests": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "cost_usd": 0.0,
            "reported_requests": 0,
            "estimated_requests": 0,
            "by_source": {},
        }
        self.ai_mode = get_ai_mode()
        if self.ai_mode == "openai_batch" and not has_openai_batch_api_key():
            logger.warning(
                "OpenAI Batch mode requested but no batch API key is configured. Falling back to realtime."
            )
            self.ai_mode = "realtime"
        if self.job_id:
            try:
                job = JobManager.get_job(self.job_id)
                if job and getattr(job, "ai_mode", None):
                    self.ai_mode = job.ai_mode
            except Exception:
                logger.debug("Không thể đọc ai_mode từ job state.", exc_info=True)
        self._state_dir = None
        if self.workspace_path:
            self._state_dir = os.path.join(self.workspace_path, ".audit_state")
            os.makedirs(self._state_dir, exist_ok=True)

    def _get_active_job_id(self):
        """Lấy job đang active để cập nhật progress batch cho API polling."""
        if self.job_id:
            return self.job_id
        try:
            return JobManager.get_active_job_id()
        except Exception:
            return None

    def _is_cancel_requested(self):
        try:
            if self.cancel_check and self.cancel_check():
                return True
        except Exception:
            logger.debug("Cancel checker failed unexpectedly.", exc_info=True)
        try:
            job_id = self._get_active_job_id()
            if job_id and JobManager.is_cancel_requested(job_id):
                return True
        except Exception:
            logger.debug("JobManager cancellation lookup failed.", exc_info=True)
        return AuditState.is_cancelled

    def _raise_if_cancelled(self, message="Đã hủy theo yêu cầu người dùng."):
        if self._is_cancel_requested():
            raise AuditCancelledError(message)

    def _ai_telemetry_context(self, source: str) -> Dict[str, Any]:
        return {
            "source": source,
            "job_id": self.ai_scope_id,
            "target": self.target_dir,
            "project": self.target_id,
        }

    async def _call_ai_with_optional_telemetry(
        self, method, *args, source: str, **kwargs
    ):
        try:
            return await method(
                *args,
                **kwargs,
                telemetry=self._ai_telemetry_context(source),
            )
        except TypeError as exc:
            if "telemetry" not in str(exc):
                raise
            return await method(*args, **kwargs)

    def _start_active_job_progress(
        self,
        phase,
        phase_label,
        total_batches,
        batch_size,
        last_detail="",
    ):
        job_id = self._get_active_job_id()
        if not job_id:
            return
        JobManager.start_progress_phase(
            job_id,
            phase,
            phase_label,
            total_batches,
            batch_size,
            last_detail=last_detail,
        )

    def _record_active_job_batch_started(self, batch_number, last_detail=""):
        job_id = self._get_active_job_id()
        if not job_id:
            return
        JobManager.record_batch_started(job_id, batch_number, last_detail=last_detail)

    def _record_active_job_batch_finished(
        self,
        batch_number,
        last_detail="",
        completed=True,
    ):
        job_id = self._get_active_job_id()
        if not job_id:
            return
        JobManager.record_batch_finished(
            job_id,
            batch_number,
            last_detail=last_detail,
            completed=completed,
        )

    def _clear_active_job_progress(self):
        job_id = self._get_active_job_id()
        if not job_id:
            return
        JobManager.clear_progress(job_id)

    def _get_orchestration_state(self) -> dict:
        if not self.job_id:
            return {}
        try:
            return JobManager.get_orchestration_state(self.job_id) or {}
        except Exception:
            return {}

    def _update_orchestration_state(self, **updates):
        if not self.job_id:
            return
        JobManager.update_orchestration_state(self.job_id, **updates)

    def _stage_index(self, stage: str) -> int:
        try:
            return self.BATCH_STAGE_ORDER.index(stage)
        except ValueError:
            return 0

    def _stage_at_least(self, stage: str, expected: str) -> bool:
        return self._stage_index(stage) >= self._stage_index(expected)

    def _checkpoint_path(self, name: str) -> str | None:
        if not self._state_dir:
            return None
        return os.path.join(self._state_dir, name)

    def _save_checkpoint(self, name: str, data: Any):
        path = self._checkpoint_path(name)
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_checkpoint(self, name: str, default=None):
        path = self._checkpoint_path(name)
        if not path or not os.path.exists(path):
            return default
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_logged_violations_checkpoint(self):
        self._save_checkpoint(
            "logged_violations.json",
            {
                "violations": self.violations,
                "counter": self.violation_counter,
            },
        )

    def _restore_logged_violations_checkpoint(self):
        payload = self._load_checkpoint("logged_violations.json")
        if not payload:
            return
        self.violations = payload.get("violations", [])
        self.violation_counter = payload.get("counter", len(self.violations))
        self._violation_signatures = {
            self._build_violation_signature(
                violation.get("file", ""),
                violation.get("rule_id", ""),
                violation.get("line", 0),
                violation.get("reason", ""),
            )
            for violation in self.violations
        }

    def _normalize_violation_reason_for_signature(self, reason: str) -> str:
        normalized = str(reason or "").strip()
        if ". AI Note:" in normalized:
            normalized = normalized.split(". AI Note:", 1)[0].strip()
        return normalized

    def _build_violation_signature(
        self,
        file_path: str,
        rule_id: str,
        line: int,
        reason: str,
    ) -> tuple:
        return (
            str(file_path or ""),
            str(rule_id or ""),
            int(line or 0),
            self._normalize_violation_reason_for_signature(reason),
        )

    def log_violation(self, violation_data: dict):
        """Ghi nhận một vi phạm mới và lưu vào danh sách.
        Args:
            violation_data: Dict chứa keys: pillar, file, reason, weight, snippet, rule_id, line, is_custom
        """
        file = violation_data.get("file", "")
        # Chuyển đổi thành đường dẫn tương đối (bỏ /tmp/...)
        if file.startswith(self.target_dir):
            file = os.path.relpath(file, self.target_dir)
        elif self.target_dir in file:
            file = file.split(self.target_dir, 1)[-1].lstrip("/\\")

        pillar = violation_data.get(
            "pillar", violation_data.get("type", "Maintainability")
        )
        reason = violation_data.get("reason", "")
        weight = violation_data.get("weight", -1.0)
        rule_id = violation_data.get("rule_id", "")
        line = violation_data.get("line", 0)
        signature = self._build_violation_signature(file, rule_id, line, reason)

        if signature in self._violation_signatures:
            logger.debug(
                "Bỏ qua violation trùng lặp: %s %s:%s",
                rule_id or "UNKNOWN_RULE",
                file,
                line,
            )
            return

        self._violation_signatures.add(signature)

        violation = {
            "id": f"v_{self.violation_counter}",
            "pillar": pillar,
            "file": file,
            "reason": reason,
            "weight": weight,
            "snippet": violation_data.get("snippet", ""),
            "rule_id": rule_id,
            "line": line,
            "is_custom": violation_data.get("is_custom", False),
        }
        self.violation_counter += 1
        self.violations.append(violation)

        # Ghi nối vào file Ledger (Sổ cái bằng chứng)
        with open(self.ledger_path, "a") as f:
            f.write(
                f"- [{pillar}] | [{file}:{line}] | Lý do: {reason} | Trình bày: {rule_id} | Điểm phạt: {weight}\n"
            )

    def run(self):
        """Thực thi toàn bộ quy trình kiểm toán."""
        self._raise_if_cancelled("Job đã bị hủy trước khi bắt đầu kiểm toán.")
        self._restore_logged_violations_checkpoint()
        stage = self._get_orchestration_state().get("stage", "init")
        with open(self.ledger_path, "w") as f:
            f.write("# SỔ CÁI VI PHẠM (AI VIOLATION LEDGER)\n\n")
        logger.info(f"🚀 Bắt đầu kiểm toán: {self.target_dir}")

        if self.ai_mode == "openai_batch" and self._stage_at_least(stage, "discovered"):
            self.discovery_data = self._load_checkpoint("discovery_data.json")
            if self.discovery_data:
                logger.info("[1/5] Resume từ checkpoint Discovery.")
        if not self.discovery_data:
            self._raise_if_cancelled("Đã hủy trước bước Discovery.")
            self._step_discovery()
            self._save_checkpoint("discovery_data.json", self.discovery_data)
            self._update_orchestration_state(stage="discovered")

        self._raise_if_cancelled("Đã hủy sau bước Discovery.")
        automated_violations = None
        if self.ai_mode == "openai_batch" and self._stage_at_least(stage, "scanned"):
            automated_violations = self._load_checkpoint(
                "automated_violations.json", []
            )
            self.merged_rules = self._load_checkpoint("merged_rules.json", {})
            logger.info("[2/5] Resume từ checkpoint Static Scanning.")
        if automated_violations is None:
            automated_violations = self._step_scanning()
            self._save_checkpoint("automated_violations.json", automated_violations)
            self._save_checkpoint(
                "merged_rules.json", getattr(self, "merged_rules", {})
            )
            self._update_orchestration_state(stage="scanned")

        self._raise_if_cancelled("Đã hủy sau bước quét tĩnh.")

        from src.config import get_ai_enabled

        if get_ai_enabled():
            self._step_ai_processing(automated_violations)
        else:
            logger.info("[3/5] AI bị tắt (AI_ENABLED=false) — bỏ qua toàn bộ bước AI.")
            for v in automated_violations:
                is_custom = v.get("rule_id", "").startswith("CUSTOM_") or v.get(
                    "rule_id", ""
                ).startswith("FORBIDDEN")
                self.log_violation({**v, "is_custom": is_custom})
            self._raise_if_cancelled("Đã hủy sau bước quét tĩnh.")

        self._raise_if_cancelled("Đã hủy trước bước tổng hợp.")
        final_score, rating = self._step_aggregation()
        self._raise_if_cancelled("Đã hủy trước bước xuất báo cáo.")
        self._step_reporting(final_score, rating)
        self.ai_summary = ai_telemetry.summarize_scope(
            job_id=self.ai_scope_id,
            source_prefix="audit.",
        )

    def _step_discovery(self):
        """BƯỜC 1: Khám phá tài nguyên."""
        self._raise_if_cancelled("Đã hủy trước khi chạy Discovery.")
        logger.info("[1/5] Khám phá cấu trúc dự án (Discovery)...")
        discovery = DiscoveryStep(self.target_dir)
        self.discovery_data = discovery.run_discovery()

        try:
            from src.config import get_test_mode_limit

            limit = get_test_mode_limit()
            if limit and limit > 0:
                original_count = len(self.discovery_data["files"])
                if original_count > limit:
                    self.discovery_data["files"] = self.discovery_data["files"][
                        :limit
                    ]
                    logger.warning(
                        f"[TEST MODE] Giới hạn: {limit}/{original_count} files"
                    )
        except ImportError:
            pass

        logger.info(
            f"   {self.discovery_data['total_files']} files — {self.discovery_data['total_loc']:,} LOC"
        )

    def _step_scanning(self):
        """BƯỜC 2: Quét tĩnh (Regex + AST)."""
        self._raise_if_cancelled("Đã hủy trước khi chạy Static Verification.")
        logger.info("[2/5] Quét tĩnh mã nguồn (Regex + Python AST)...")

        files = self.discovery_data.get("files", [])
        logger.info(f"   {len(files)} files sẽ được phân tích")
        for f_info in files:
            rel_path = os.path.relpath(f_info["path"], self.target_dir)
            logger.info(f"[PROGRESS] Scanning: {rel_path}")

        verifier = VerificationStep(
            self.target_dir,
            self.discovery_data["files"],
            custom_rules=self.custom_rules,
        )
        automated_violations = verifier.run_verification()
        self.merged_rules = verifier.load_rules()
        logger.info(f"   Phát hiện {len(automated_violations)} vi phạm tiềm năng")
        return automated_violations

    def _step_ai_processing(self, automated_violations):
        """BƯỜC 3: Xử lý AI (Validation + Deep Audit + Cross-Check)."""
        import asyncio
        from src.config import get_ai_max_concurrency
        from src.engine.ai_service import ai_service

        if self.ai_mode == "openai_batch":
            try:
                self._step_ai_batch_processing(automated_violations, ai_service, asyncio)
            finally:
                self._clear_active_job_progress()
            return

        # Snapshot concurrency một lần cho cả job hiện tại; save setting mới chỉ áp dụng job sau.
        ai_concurrency = get_ai_max_concurrency()

        try:
            self._raise_if_cancelled("Đã hủy trước bước AI Validation.")
            self._step_ai_validation(
                automated_violations, ai_service, asyncio, ai_concurrency
            )

            self._raise_if_cancelled("Đã hủy sau bước AI Validation.")
            self._step_ai_reasoning(ai_service, asyncio, ai_concurrency)
            self._raise_if_cancelled("Đã hủy sau bước AI Reasoning.")
        finally:
            self._clear_active_job_progress()

    def _step_ai_validation(
        self, automated_violations, ai_service, asyncio, ai_concurrency
    ):
        """BƯỜC 3.1: Xác thực vi phạm bằng AI (lọc False Positive)."""
        logger.info("[3.1/5] Xác thực vi phạm (AI False-Positive Filter)...")

        batch_size = 5
        chunks = [
            automated_violations[i : i + batch_size]
            for i in range(0, len(automated_violations), batch_size)
        ]

        if not chunks:
            logger.info("   Không có vi phạm nào cần xác thực.")
            return

        logger.info(
            f"   {len(automated_violations)} vi phạm → {len(chunks)} batch (mỗi batch {batch_size})"
        )
        self._start_active_job_progress(
            "validation",
            "Validation",
            len(chunks),
            batch_size,
            last_detail="Preparing validation batches...",
        )

        async def process_chunk(idx, chunk):
            batch_number = idx + 1
            self._record_active_job_batch_started(
                batch_number,
                last_detail=f"Starting Validation batch {batch_number}/{len(chunks)}",
            )
            logger.info(
                f"[PROGRESS] Đang xác thực (Validation) batch {batch_number}/{len(chunks)}..."
            )
            try:
                batch_results = await self._call_ai_with_optional_telemetry(
                    ai_service.verify_violations_batch,
                    chunk,
                    source="audit.validation",
                )
                self._record_active_job_batch_finished(
                    batch_number,
                    last_detail=(
                        f"Completed Validation batch {batch_number}/{len(chunks)}"
                    ),
                )
                return idx, chunk, batch_results
            except Exception:
                self._record_active_job_batch_finished(
                    batch_number,
                    last_detail=f"Validation batch {batch_number}/{len(chunks)} failed",
                    completed=False,
                )
                raise

        async def run_all():
            completed = []
            pending = set()
            next_idx = 0

            def schedule_next():
                nonlocal next_idx
                if self._is_cancel_requested() or next_idx >= len(chunks):
                    return False
                pending.add(asyncio.create_task(process_chunk(next_idx, chunks[next_idx])))
                next_idx += 1
                return True

            for _ in range(min(ai_concurrency, len(chunks))):
                if not schedule_next():
                    break

            while pending:
                done, pending = await asyncio.wait(
                    pending,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in done:
                    completed.append(await task)
                while len(pending) < ai_concurrency and schedule_next():
                    pass
            return completed

        loop = asyncio.new_event_loop()
        try:
            completed = loop.run_until_complete(run_all())
        finally:
            loop.close()

        for idx, chunk, batch_results in completed:
            for i, v in enumerate(chunk):
                res = batch_results.get(i, {})
                is_fp = res.get("is_false_positive", False)
                ai_reason = res.get("explanation", "")
                conf = res.get("confidence", 1.0)
                is_custom = v.get("rule_id", "").startswith("CUSTOM_") or v.get(
                    "rule_id", ""
                ).startswith("FORBIDDEN")

                if is_fp and conf > 0.7:
                    lbl = "Tùy chỉnh" if is_custom else "Core"
                    logger.info(
                        f"   ✨ AI loại bỏ FP [{lbl}]: {v['reason']} tại {v['file']}"
                    )
                    continue

                final_reason = (
                    f"{v['reason']}. AI Note: {ai_reason}" if ai_reason else v["reason"]
                )
                self.log_violation(
                    {
                        **v,
                        "pillar": v["type"],
                        "reason": final_reason,
                        "is_custom": is_custom,
                    }
                )

    def _step_ai_reasoning(self, ai_service, asyncio, ai_concurrency):
        """BƯỚC 3.2: AI Deep Audit + [3.3] Cross-Check flagged issues."""
        logger.info("[3.2/5] Phân tích sâu bằng AI (Deep Reasoning Audit)...")

        deep_chunks = self._build_deep_audit_batches()
        if not deep_chunks:
            logger.info("   Không có file nào cần AI phân tích.")
            return

        logger.info(
            f"   {sum(len(c) for c in deep_chunks)} files → {len(deep_chunks)} batches"
        )
        self._start_active_job_progress(
            "deep_audit",
            "Deep Audit",
            len(deep_chunks),
            5,
            last_detail="Preparing deep audit batches...",
        )

        async def process_deep(idx, chunk_data):
            batch_number = idx + 1
            self._record_active_job_batch_started(
                batch_number,
                last_detail=f"Starting Deep Audit batch {batch_number}/{len(deep_chunks)}",
            )
            logger.info(
                f"[PROGRESS] Đang phân tích sâu (Deep Audit) batch {batch_number}/{len(deep_chunks)}..."
            )
            for f in chunk_data:
                rel = (
                    os.path.relpath(f["path"], self.target_dir)
                    if self.target_dir in f["path"]
                    else f["path"]
                )
                logger.info(f"[PROGRESS] AI Audit: {rel}")
            try:
                batch_results = await self._call_ai_with_optional_telemetry(
                    ai_service.deep_audit_batch,
                    chunk_data,
                    self.custom_rules,
                    source="audit.deep_audit",
                )
                self._record_active_job_batch_finished(
                    batch_number,
                    last_detail=(
                        f"Completed Deep Audit batch {batch_number}/{len(deep_chunks)}"
                    ),
                )
                return batch_results
            except Exception:
                self._record_active_job_batch_finished(
                    batch_number,
                    last_detail=f"Deep Audit batch {batch_number}/{len(deep_chunks)} failed",
                    completed=False,
                )
                raise

        async def run_all():
            completed = []
            pending = set()
            next_idx = 0

            def schedule_next():
                nonlocal next_idx
                if self._is_cancel_requested() or next_idx >= len(deep_chunks):
                    return False
                pending.add(
                    asyncio.create_task(process_deep(next_idx, deep_chunks[next_idx]))
                )
                next_idx += 1
                return True

            for _ in range(min(ai_concurrency, len(deep_chunks))):
                if not schedule_next():
                    break

            while pending:
                done, pending = await asyncio.wait(
                    pending,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in done:
                    completed.append(await task)
                while len(pending) < ai_concurrency and schedule_next():
                    pass
            return completed

        loop = asyncio.new_event_loop()
        try:
            all_results = loop.run_until_complete(run_all())

            confirmed, flagged = [], []
            for batch in all_results:
                for rv in batch:
                    (flagged if rv.get("needs_verification") else confirmed).append(rv)

            self._raise_if_cancelled("Đã hủy sau khi hoàn tất các batch Deep Audit đang chạy.")
            if flagged:
                logger.info(
                    f"[3.3/5] Xác minh chéo (Cross-Check) {len(flagged)} mục nghi vấn..."
                )
                from src.engine.symbol_indexer import AstContextExtractor

                indexer = AstContextExtractor(self.target_dir)
                indexer.index_project()
                context_cache = {}
                for fv in flagged:
                    target = fv.get("verify_target")
                    if target and target not in context_cache:
                        context_cache[target] = indexer.get_symbol_snippet(target)
                verified = loop.run_until_complete(
                    self._call_ai_with_optional_telemetry(
                        ai_service.verify_flagged_issues,
                        flagged,
                        context_cache,
                        source="audit.cross_check",
                    )
                )
                confirmed.extend(verified)
        finally:
            loop.close()

        self._raise_if_cancelled("Đã hủy trước khi ghi nhận kết quả AI.")
        self._log_ai_violations(confirmed)

    def _run_async(self, coroutine):
        import asyncio

        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coroutine)
        finally:
            loop.close()

    def _chunk_list(self, items: List[Any], size: int) -> List[List[Any]]:
        if not items:
            return []
        return [items[i : i + size] for i in range(0, len(items), size)]

    def _handle_remote_batch_status(self, label: str, request_count: int, batch_info: dict):
        status = (batch_info.get("status") or "unknown").lower()
        detail = (
            f"OpenAI Batch {label}: {status} "
            f"({request_count} requests, batch_id={batch_info.get('id', 'n/a')})"
        )
        logger.info(f"[PROGRESS] {detail}")
        job_id = self._get_active_job_id()
        if job_id:
            JobManager.update_progress_detail(
                job_id,
                detail,
                active_batches=0
                if status in {"completed", "failed", "expired", "cancelled", "canceled"}
                else 1,
            )

    def _resolve_remote_batch_results(self, ai_service, batch_id: str, label: str, request_count: int):
        result = self._run_async(
            ai_service.resolve_chat_completion_batch(
                batch_id,
                on_status=lambda batch: self._handle_remote_batch_status(
                    label,
                    request_count,
                    batch,
                ),
            )
        )
        if self._is_cancel_requested():
            raise AuditCancelledError("Đã hủy theo yêu cầu người dùng.")
        return result

    def _build_batch_request_error(
        self, label: str, request_id: str, error: Dict[str, Any]
    ) -> str:
        status_code = error.get("status_code") if isinstance(error, dict) else None
        message = ""
        if isinstance(error, dict):
            message = str(error.get("message") or "").strip()
            if not message:
                raw_payload = error.get("raw") or error
                message = json.dumps(raw_payload, ensure_ascii=False)
        prefix = f"OpenAI Batch {label} thất bại cho request {request_id}"
        if status_code:
            prefix += f" (HTTP {status_code})"
        return f"{prefix}: {message}"

    def _step_ai_batch_processing(self, automated_violations, ai_service, asyncio):
        logger.info("[3/5] Chạy AI bằng OpenAI Batch API...")

        self._raise_if_cancelled("Đã hủy trước bước OpenAI Batch Validation.")
        self._step_ai_validation_batch_api(automated_violations, ai_service)
        self._raise_if_cancelled("Đã hủy sau bước OpenAI Batch Validation.")

        self._step_ai_reasoning_batch_api(ai_service)
        self._raise_if_cancelled("Đã hủy sau bước OpenAI Batch Deep Audit.")
        self._update_orchestration_state(stage="ai_completed")

    def _step_ai_validation_batch_api(self, automated_violations, ai_service):
        logger.info("[3.1/5] OpenAI Batch API — Validation...")
        state = self._get_orchestration_state()
        stage = state.get("stage", "init")
        if self._stage_at_least(stage, "validation_completed"):
            logger.info("   Resume: bỏ qua submit Validation batch vì đã có checkpoint.")
            self._restore_logged_violations_checkpoint()
            return

        batch_size = 5
        chunks = self._chunk_list(automated_violations, batch_size)
        if not chunks:
            logger.info("   Không có vi phạm nào cần xác thực.")
            self._update_orchestration_state(stage="validation_completed")
            return

        self._start_active_job_progress(
            "validation",
            "Validation (Batch API)",
            len(chunks),
            batch_size,
            last_detail="Preparing OpenAI Batch validation job...",
        )

        batch_id = state.get("validation_batch_id")
        if stage != "validation_submitted" or not batch_id:
            requests = ai_service.build_validation_batch_requests(
                chunks,
                telemetry=self._ai_telemetry_context("audit.validation"),
            )
            submitted = self._run_async(
                ai_service.submit_chat_completion_batch(
                    requests,
                    metadata={
                        "job_id": self.job_id or "unknown",
                        "phase": "validation",
                    },
                    telemetry=self._ai_telemetry_context("audit.validation"),
                )
            )
            batch_id = submitted["id"]
            logger.info(
                f"   OpenAI Batch Validation đã submit: {batch_id} ({len(chunks)} requests)"
            )
            self._update_orchestration_state(
                stage="validation_submitted",
                validation_batch_id=batch_id,
                validation_request_count=len(chunks),
            )

        result = self._resolve_remote_batch_results(
            ai_service,
            batch_id,
            "validation",
            len(chunks),
        )

        outputs = result.get("outputs", {})
        errors = result.get("errors", {})
        if errors:
            logger.warning(
                f"   OpenAI Batch Validation có {len(errors)} request lỗi: {', '.join(list(errors.keys())[:3])}"
            )

        for idx, chunk in enumerate(chunks):
            request_id = f"validation-{idx}"
            output = outputs.get(request_id)
            error = errors.get(request_id)
            if error:
                raise RuntimeError(
                    self._build_batch_request_error("Validation", request_id, error)
                )
            if not output:
                raise RuntimeError(
                    f"Thiếu kết quả OpenAI Batch Validation cho request {request_id}"
                )
            if not output.get("content"):
                raise RuntimeError(
                    f"Kết quả OpenAI Batch Validation rỗng cho request {request_id}"
                )
            batch_results = {
                item.index: item.model_dump()
                for item in ai_service.parse_validation_content(
                    output["content"]
                ).results
            }
            for item_idx, violation in enumerate(chunk):
                res = batch_results.get(item_idx, {})
                is_fp = res.get("is_false_positive", False)
                ai_reason = res.get("explanation", "")
                conf = res.get("confidence", 1.0)
                is_custom = violation.get("rule_id", "").startswith("CUSTOM_") or violation.get(
                    "rule_id", ""
                ).startswith("FORBIDDEN")

                if is_fp and conf > 0.7:
                    label = "Tùy chỉnh" if is_custom else "Core"
                    logger.info(
                        f"   ✨ OpenAI Batch loại bỏ FP [{label}]: {violation['reason']} tại {violation['file']}"
                    )
                    continue

                final_reason = (
                    f"{violation['reason']}. AI Note: {ai_reason}"
                    if ai_reason
                    else violation["reason"]
                )
                self.log_violation(
                    {
                        **violation,
                        "pillar": violation["type"],
                        "reason": final_reason,
                        "is_custom": is_custom,
                    }
                )

        self._save_logged_violations_checkpoint()
        job_id = self._get_active_job_id()
        if job_id:
            JobManager.update_progress_detail(
                job_id,
                f"Completed OpenAI Batch validation ({len(chunks)} requests).",
                last_started_batch=len(chunks),
                completed_batches=len(chunks),
                active_batches=0,
                pending_batches=0,
            )
        self._update_orchestration_state(
            stage="validation_completed",
            validation_batch_id="",
        )

    def _step_ai_reasoning_batch_api(self, ai_service):
        logger.info("[3.2/5] OpenAI Batch API — Deep Audit...")
        state = self._get_orchestration_state()
        stage = state.get("stage", "init")
        if self._stage_at_least(stage, "ai_completed"):
            logger.info("   Resume: bỏ qua AI reasoning vì đã hoàn tất ở checkpoint.")
            self._restore_logged_violations_checkpoint()
            return

        deep_chunks = self._build_deep_audit_batches()
        if not deep_chunks:
            logger.info("   Không có file nào cần AI phân tích.")
            self._update_orchestration_state(stage="ai_completed")
            return

        self._start_active_job_progress(
            "deep_audit",
            "Deep Audit (Batch API)",
            len(deep_chunks),
            5,
            last_detail="Preparing OpenAI Batch deep audit job...",
        )

        confirmed = self._load_checkpoint("deep_confirmed.json", [])
        flagged = self._load_checkpoint("deep_flagged.json", [])

        deep_batch_id = state.get("deep_batch_id")
        if not self._stage_at_least(stage, "deep_completed"):
            if stage != "deep_submitted" or not deep_batch_id:
                requests = ai_service.build_deep_audit_batch_requests(
                    deep_chunks,
                    self.custom_rules,
                    telemetry=self._ai_telemetry_context("audit.deep_audit"),
                )
                submitted = self._run_async(
                    ai_service.submit_chat_completion_batch(
                        requests,
                        metadata={
                            "job_id": self.job_id or "unknown",
                            "phase": "deep_audit",
                        },
                        telemetry=self._ai_telemetry_context("audit.deep_audit"),
                    )
                )
                deep_batch_id = submitted["id"]
                logger.info(
                    f"   OpenAI Batch Deep Audit đã submit: {deep_batch_id} ({len(deep_chunks)} requests)"
                )
                self._update_orchestration_state(
                    stage="deep_submitted",
                    deep_batch_id=deep_batch_id,
                    deep_request_count=len(deep_chunks),
                )

            result = self._resolve_remote_batch_results(
                ai_service,
                deep_batch_id,
                "deep_audit",
                len(deep_chunks),
            )
            outputs = result.get("outputs", {})
            confirmed = []
            flagged = []
            for idx in range(len(deep_chunks)):
                output = outputs.get(f"deep-audit-{idx}")
                if not output or not output.get("content"):
                    raise RuntimeError(
                        f"Thiếu kết quả OpenAI Batch Deep Audit cho request deep-audit-{idx}"
                    )
                parsed = ai_service.parse_deep_audit_content(output["content"])
                for violation in parsed.violations:
                    payload = violation.model_dump()
                    (flagged if payload.get("needs_verification") else confirmed).append(
                        payload
                    )
            self._save_checkpoint("deep_confirmed.json", confirmed)
            self._save_checkpoint("deep_flagged.json", flagged)
            self._update_orchestration_state(
                stage="deep_completed",
                deep_batch_id="",
            )

        verified = []
        if flagged:
            logger.info(
                f"[3.3/5] OpenAI Batch API — Cross-Check {len(flagged)} mục nghi vấn..."
            )
            state = self._get_orchestration_state()
            cross_chunks = self._chunk_list(flagged, 5)
            cross_batch_id = state.get("cross_check_batch_id")

            from src.engine.symbol_indexer import AstContextExtractor

            indexer = AstContextExtractor(self.target_dir)
            indexer.index_project()
            context_cache = {}
            for violation in flagged:
                target = violation.get("verify_target")
                if target and target not in context_cache:
                    context_cache[target] = indexer.get_symbol_snippet(target)

            if state.get("stage") != "cross_check_submitted" or not cross_batch_id:
                requests = ai_service.build_cross_check_batch_requests(
                    cross_chunks,
                    context_cache,
                    telemetry=self._ai_telemetry_context("audit.cross_check"),
                )
                submitted = self._run_async(
                    ai_service.submit_chat_completion_batch(
                        requests,
                        metadata={
                            "job_id": self.job_id or "unknown",
                            "phase": "cross_check",
                        },
                        telemetry=self._ai_telemetry_context("audit.cross_check"),
                    )
                )
                cross_batch_id = submitted["id"]
                logger.info(
                    f"   OpenAI Batch Cross-Check đã submit: {cross_batch_id} ({len(cross_chunks)} requests)"
                )
                self._update_orchestration_state(
                    stage="cross_check_submitted",
                    cross_check_batch_id=cross_batch_id,
                )

            result = self._resolve_remote_batch_results(
                ai_service,
                cross_batch_id,
                "cross_check",
                len(cross_chunks),
            )
            outputs = result.get("outputs", {})
            for idx, chunk in enumerate(cross_chunks):
                output = outputs.get(f"cross-check-{idx}")
                if not output or not output.get("content"):
                    raise RuntimeError(
                        f"Thiếu kết quả OpenAI Batch Cross-Check cho request cross-check-{idx}"
                    )
                parsed = ai_service.parse_validation_content(output["content"])
                for validation in parsed.results:
                    if 0 <= validation.index < len(chunk) and not validation.is_false_positive:
                        bug = chunk[validation.index]
                        bug["reason"] = (
                            f"{bug['reason']} [Cross-Checked: {validation.explanation}]"
                        )
                        verified.append(bug)
            self._update_orchestration_state(
                cross_check_batch_id="",
            )

        confirmed.extend(verified)
        self._save_checkpoint("deep_final_ai.json", confirmed)
        self._log_ai_violations(confirmed)
        self._save_logged_violations_checkpoint()
        job_id = self._get_active_job_id()
        if job_id:
            JobManager.update_progress_detail(
                job_id,
                f"Completed OpenAI Batch deep audit ({len(deep_chunks)} requests).",
                last_started_batch=len(deep_chunks),
                completed_batches=len(deep_chunks),
                active_batches=0,
                pending_batches=0,
            )
        self._update_orchestration_state(stage="ai_completed")

    def _build_deep_audit_batches(self):
        """Chia files thành các batch thông minh dựa trên kích thước."""
        MAX_FILES, MAX_CHARS = 5, 210000
        deep_chunks, current_batch, current_size = [], [], 0

        for f_info in self.discovery_data["files"]:
            try:
                with open(f_info["path"], "r", encoding="utf-8") as fobj:
                    content = fobj.read()
            except Exception:
                continue

            file_chars = len(content)
            file_data = {"path": f_info["path"], "content": content}

            if file_chars >= MAX_CHARS:
                if current_batch:
                    deep_chunks.append(current_batch)
                    current_batch, current_size = [], 0
                deep_chunks.append([file_data])
                continue

            if (current_size + file_chars > MAX_CHARS) or (
                len(current_batch) >= MAX_FILES
            ):
                if current_batch:
                    deep_chunks.append(current_batch)
                current_batch, current_size = [], 0

            current_batch.append(file_data)
            current_size += file_chars

        if current_batch:
            deep_chunks.append(current_batch)
        return deep_chunks

    def _log_ai_violations(self, confirmed_violations):
        """Ghi nhận violations từ AI reasoning."""
        from src.config import WEIGHTS

        for rv in confirmed_violations:
            try:
                weight = float(rv.get("weight", -3.0))
            except (ValueError, TypeError):
                weight = -3.0
            if weight > 0:
                weight = -weight

            pillar = rv.get("type", "Maintainability")
            if pillar not in WEIGHTS:
                pillar = "Maintainability"
            rule_id = rv.get("rule_id", "AI_REASONING")

            # Capping and Overriding AI hallucinated weights
            if rule_id == "AI_REASONING" and weight < -2.0:
                weight = -2.0  # Giới hạn tối đa mức phạt do AI tự biên tự diễn
            elif rule_id != "AI_REASONING":
                for r in getattr(self, "merged_rules", {}).get("rules", []):
                    if r.get("id") == rule_id and r.get("weight"):
                        weight = float(r.get("weight"))
                        break

            # Auto-extract snippet if missing
            snippet = rv.get("snippet", "")
            file_path = rv.get("file", "")
            line_no = rv.get("line", 0)

            if not snippet and file_path and isinstance(line_no, int) and line_no > 0:
                try:
                    import os

                    full_path = (
                        os.path.join(self.target_dir, file_path)
                        if self.target_dir not in file_path
                        else file_path
                    )
                    with open(full_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        start = max(0, line_no - 3)
                        end = min(len(lines), line_no + 2)
                        snippet = "".join(lines[start:end]).rstrip()
                except Exception:
                    pass

            self.log_violation(
                {
                    "pillar": pillar,
                    "file": file_path,
                    "reason": rv.get("reason", "AI Logic Audit"),
                    "weight": weight,
                    "rule_id": rule_id,
                    "snippet": snippet,
                    "line": line_no,
                    "is_custom": rv.get("is_custom", False),
                }
            )

    def _step_aggregation(self):
        """BƯỜC 4: Tổng hợp và tính điểm."""
        self._raise_if_cancelled("Đã hủy trước bước tổng hợp.")
        logger.info("[4/5] Tổng hợp kết quả và tính điểm (Aggregation)...")
        from src.config import WEIGHTS
        from src.engine.authorship import AuthorshipTracker

        auth_tracker = AuthorshipTracker(self.target_dir)
        total_loc = self.discovery_data["total_loc"]
        file_to_feature = {
            os.path.relpath(f["path"], self.target_dir): f.get("feature", "unknown")
            for f in self.discovery_data["files"]
        }

        feature_punishments = {}
        feature_meta = {}
        member_punishments = {}
        member_meta = {}
        member_violations = {}
        member_feature_punishments = {}
        member_feature_debt = {}
        member_feature_locs = {}

        def ensure_member(email):
            if email not in member_punishments:
                member_punishments[email] = {p: 0 for p in WEIGHTS.keys()}
                member_meta[email] = {
                    p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()
                }
                member_violations[email] = []
                member_feature_punishments[email] = {}
                member_feature_debt[email] = {}

        def ensure_member_feature(email, feature):
            ensure_member(email)
            if feature not in member_feature_punishments[email]:
                member_feature_punishments[email][feature] = {
                    p: 0 for p in WEIGHTS.keys()
                }
                member_feature_debt[email][feature] = {p: 0 for p in WEIGHTS.keys()}

        def calculate_weighted_pillar_scores(feature_results, total_loc, fallback_punishments):
            pillar_scores = {}
            for pillar in WEIGHTS.keys():
                if total_loc > 0 and feature_results:
                    w_score = sum(
                        res["pillars"][pillar] * res.get("loc", 0)
                        for res in feature_results.values()
                    )
                    pillar_scores[pillar] = round(w_score / total_loc, 2)
                else:
                    pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                        fallback_punishments[pillar], total_loc, pillar
                    )
            return pillar_scores

        logger.info(
            "   [AuthTracker] Pre-indexing member contributions from all scanned files..."
        )
        for f_info in self.discovery_data["files"]:
            rel_path = (
                os.path.relpath(f_info["path"], self.target_dir)
                if self.target_dir in f_info["path"]
                else f_info["path"]
            )
            auth_tracker.parse_blame(rel_path)
            feature = f_info.get("feature", "unknown")
            for email, loc in auth_tracker.get_file_member_loc(rel_path).items():
                if not email or email == "unknown@unknown" or loc <= 0:
                    continue
                member_feature_locs.setdefault(email, {})
                member_feature_locs[email][feature] = (
                    member_feature_locs[email].get(feature, 0) + loc
                )

        feature_single_owners = {}
        for feature, feature_data in self.discovery_data["features"].items():
            feature_loc = feature_data.get("loc", 0)
            owners = [
                email
                for email, feature_locs in member_feature_locs.items()
                if feature_locs.get(feature, 0) == feature_loc and feature_loc > 0
            ]
            if len(owners) == 1:
                feature_single_owners[feature] = owners[0]

        for feature in self.discovery_data["features"].keys():
            feature_punishments[feature] = {p: 0 for p in WEIGHTS.keys()}
            feature_meta[feature] = {
                p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()
            }

        sev_levels = ["Info", "Minor", "Major", "Critical", "Blocker"]

        for v in self.violations:
            feat = file_to_feature.get(v["file"], "root")
            if feat not in feature_punishments:
                feature_punishments[feat] = {p: 0 for p in WEIGHTS.keys()}
                feature_meta[feat] = {
                    p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()
                }

            pillar = v["pillar"]
            feature_punishments[feat][pillar] += v["weight"]

            flat_meta = {
                r.get("id"): r
                for r in getattr(self, "merged_rules", {}).get("rules", [])
            }
            rule_id = v.get("rule_id", "")
            meta_rule = flat_meta.get(rule_id, {})
            meta = {
                "severity": meta_rule.get("severity", "Minor"),
                "debt": meta_rule.get("debt", 10),
            }
            feature_meta[feat][pillar]["debt"] += meta["debt"]
            if sev_levels.index(meta["severity"]) > sev_levels.index(
                feature_meta[feat][pillar]["max_sev"]
            ):
                feature_meta[feat][pillar]["max_sev"] = meta["severity"]

            email = None
            author_info = auth_tracker.get_author_info(v["file"], v.get("line", 0))
            if not author_info["boundary"]:
                candidate_email = author_info.get("email", "unknown@unknown")
                if candidate_email and candidate_email != "unknown@unknown":
                    email = candidate_email
            if not email:
                email = feature_single_owners.get(feat)

            if email:
                ensure_member_feature(email, feat)
                member_punishments[email][pillar] += v["weight"]
                member_meta[email][pillar]["debt"] += meta["debt"]
                member_violations[email].append(v)
                member_feature_punishments[email][feat][pillar] += v["weight"]
                member_feature_debt[email][feat][pillar] += meta["debt"]

        self.feature_results = {}
        project_punishments = {p: 0 for p in WEIGHTS.keys()}
        project_meta = {p: {"debt": 0, "max_sev": "Info"} for p in WEIGHTS.keys()}

        for feature, punishments in feature_punishments.items():
            feat_loc = self.discovery_data["features"].get(feature, {}).get("loc", 0)
            if feat_loc == 0:
                continue

            p_scores = {}
            for pillar in WEIGHTS.keys():
                p_scores[pillar] = ScoringEngine.calculate_pillar_score(
                    punishments[pillar], feat_loc, pillar
                )
                project_punishments[pillar] += punishments[pillar]

                meta = feature_meta[feature][pillar]
                project_meta[pillar]["debt"] += meta["debt"]
                if sev_levels.index(meta["max_sev"]) > sev_levels.index(
                    project_meta[pillar]["max_sev"]
                ):
                    project_meta[pillar]["max_sev"] = meta["max_sev"]

            f_score = ScoringEngine.calculate_final_score(p_scores)
            self.feature_results[feature] = {
                "pillars": p_scores,
                "final": f_score,
                "punishments": punishments,
                "loc": feat_loc,
                "debt_mins": sum(m["debt"] for m in feature_meta[feature].values()),
            }

        self.project_pillars = calculate_weighted_pillar_scores(
            self.feature_results, total_loc, project_punishments
        )

        final_score = ScoringEngine.calculate_final_score_from_features(
            self.feature_results
        )
        rating = ScoringEngine.get_rating(final_score)

        self.member_results = {}
        member_name_map = auth_tracker.get_all_member_names()
        for email, punishments in member_punishments.items():
            author_loc = sum(member_feature_locs.get(email, {}).values())
            if author_loc == 0:
                continue

            member_feature_results = {}
            for feature, feat_loc in member_feature_locs.get(email, {}).items():
                if feat_loc <= 0:
                    continue
                feature_punishments_for_member = member_feature_punishments[email].get(
                    feature, {p: 0 for p in WEIGHTS.keys()}
                )
                feature_pillar_scores = {}
                for pillar in WEIGHTS.keys():
                    feature_pillar_scores[pillar] = ScoringEngine.calculate_pillar_score(
                        feature_punishments_for_member[pillar], feat_loc, pillar
                    )
                member_feature_results[feature] = {
                    "pillars": feature_pillar_scores,
                    "final": ScoringEngine.calculate_final_score(feature_pillar_scores),
                    "loc": feat_loc,
                    "debt_mins": sum(
                        member_feature_debt[email].get(feature, {}).values()
                    ),
                }

            p_scores = calculate_weighted_pillar_scores(
                member_feature_results, author_loc, punishments
            )
            f_score = ScoringEngine.calculate_final_score_from_features(
                member_feature_results
            )
            if not member_feature_results:
                f_score = ScoringEngine.calculate_final_score(p_scores)

            self.member_results[email] = {
                "author_name": member_name_map.get(email, email),
                "email": email,
                "pillars": p_scores,
                "final": f_score,
                "punishments": punishments,
                "loc": author_loc,
                "debt_mins": sum(m["debt"] for m in member_meta[email].values()),
                "violations": member_violations.get(email, []),
            }

        return final_score, rating

    def _step_reporting(self, final_score, rating):
        """BƯỜC 5: Xuất báo cáo."""
        self._raise_if_cancelled("Đã hủy trước bước xuất báo cáo.")
        logger.info("[5/5] Xuất báo cáo (Reporting)...")
        self.generate_report(
            self.feature_results, self.project_pillars, final_score, rating
        )
        logger.info(f"\n✅ Kiểm toán hoàn tất — Điểm: {final_score}/100 ({rating})")
        logger.info(f"   - Báo cáo chi tiết: {self.report_path}")

    def generate_report(self, feature_results, project_pillars, final_score, rating):
        """Tạo file báo cáo Markdown chuyên nghiệp phân cấp theo Tính năng."""
        rule_stats, severity_dist = self._build_report_stats()
        self._write_report_content(
            feature_results,
            project_pillars,
            final_score,
            rating,
            rule_stats,
            severity_dist,
        )

    def _build_report_stats(self):
        flat_meta = {
            r.get("id"): r for r in getattr(self, "merged_rules", {}).get("rules", [])
        }
        rule_stats = {}
        severity_dist = {"Blocker": 0, "Critical": 0, "Major": 0, "Minor": 0, "Info": 0}

        for v in self.violations:
            rule_id = v.get("rule_id", "UNKNOWN") or "UNKNOWN"

            if rule_id not in rule_stats:
                rule_stats[rule_id] = {"count": 0, "weight": 0.0, "pillars": set()}

            rule_stats[rule_id]["count"] += 1
            rule_stats[rule_id]["weight"] += v.get("weight", 0)
            rule_stats[rule_id]["pillars"].add(v.get("pillar", "Maintainability"))

            sev = flat_meta.get(rule_id, {}).get("severity", "Minor")
            severity_dist[sev] = severity_dist.get(sev, 0) + 1

        return rule_stats, severity_dist

    def _write_report_content(
        self,
        feature_results,
        project_pillars,
        final_score,
        rating,
        rule_stats,
        severity_dist,
    ):
        from datetime import datetime

        with open(self.report_path, "w") as f:
            f.write(f"# BÁO CÁO KIỂM TOÁN TỔNG THỂ (OVERALL AUDIT REPORT)\n\n")
            f.write(
                f"**Thời gian báo cáo:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            )
            f.write(f"## ĐIỂM TỔNG DỰ ÁN: {final_score} / 100 ({rating})\n\n")

            f.write("### 📊 Chỉ số dự án (Project Metrics)\n")
            f.write(f"- Tổng LOC: {self.discovery_data['total_loc']}\n")
            f.write(f"- Tổng số file: {self.discovery_data['total_files']}\n")
            f.write(f"- Tổng số tính năng: {len(feature_results)}\n\n")

            f.write("### 🚨 Phân bổ Mức độ Nghiêm trọng (Severity Distribution)\n")
            f.write("| Mức độ | Số lượng |\n|---|---|\n")
            for sev in ["Blocker", "Critical", "Major", "Minor", "Info"]:
                if severity_dist[sev] > 0 or sev in ["Critical", "Blocker"]:
                    icon = (
                        "🔥"
                        if sev in ["Blocker", "Critical"]
                        else "⚠️" if sev == "Major" else "ℹ️"
                    )
                    f.write(f"| {icon} {sev} | {severity_dist[sev]} |\n")

            f.write("\n### 🛡️ Đánh giá 4 Trụ cột Dự án\n")
            f.write("| Trụ cột | Điểm (Thang 10) | Trạng thái |\n|---|---|---|\n")
            for pillar, score in project_pillars.items():
                status = (
                    "✅ Tốt"
                    if score >= 8.5
                    else "⚠️ Cần cải thiện" if score >= 6 else "🚨 Nguy cơ"
                )
                f.write(f"| {pillar} | {score} | {status} |\n")

            f.write("\n### 🧩 Chi tiết theo Tính năng (Feature Breakdown)\n")
            for feature, res in feature_results.items():
                f.write(f"#### 🔹 Tính năng: `{feature}` (LOC: {res['loc']})\n")
                f.write(
                    f"**Điểm tính năng: {res['final']} / 100** (Nợ: {res['debt_mins']}m)\n\n"
                )
                f.write(
                    "| Trụ cột | Tổng điểm phạt | Điểm quy đổi (Thang 10) |\n|---|---|---|\n"
                )
                for pillar, p_score in res["pillars"].items():
                    f.write(
                        f"| {pillar} | {res['punishments'][pillar]} | {p_score} |\n"
                    )
                f.write("\n---\n")

            f.write("\n### 🚨 Top 10 Vi phạm tiêu biểu\n")
            for v in self.violations[:10]:
                rule_info = f" (Rule: {v['rule_id']})" if v.get("rule_id") else ""
                f.write(
                    f"- **[{v['pillar']}]** {v['file']}: {v['reason']}{rule_info} (Điểm phạt: {v['weight']})\n"
                )

            if not self.violations:
                f.write(
                    "Không tìm thấy vi phạm nào. Mã nguồn đạt chuẩn Gold Standard!\n"
                )

            if rule_stats:
                f.write("\n### 📈 Thống kê theo Luật (Rule Breakdown)\n")
                f.write(
                    "| Rule ID | Trụ cột | Số lượng | Tổng phạt |\n|---|---|---|---|\n"
                )
                for r_id, stats in sorted(
                    rule_stats.items(), key=lambda x: x[1]["count"], reverse=True
                ):
                    pillars_str = ", ".join(sorted(list(stats["pillars"])))
                    f.write(
                        f"| `{r_id}` | {pillars_str} | {stats['count']} | {round(stats['weight'], 2)} |\n"
                    )
                f.write("\n")

            if hasattr(self, "member_results") and self.member_results:
                f.write("\n### 👥 Đánh giá theo Thành viên (Last 6 Months)\n")
                f.write(
                    "| Thành viên | Tổng LOC | Điểm | Nợ kỹ thuật |\n|---|---|---|---|\n"
                )
                for author, res in sorted(
                    self.member_results.items(),
                    key=lambda x: x[1]["final"],
                    reverse=True,
                ):
                    f.write(
                        f"| **{author}** | {res['loc']} | {res['final']} | {res['debt_mins']}m |\n"
                    )

                f.write("\n#### 🔍 Chi tiết lỗi theo Thành viên\n")
                for author, res in sorted(
                    self.member_results.items(),
                    key=lambda x: x[1]["final"],
                    reverse=True,
                ):
                    if res["violations"]:
                        f.write(f"\n**{author}** (Top 5 vi phạm nặng nhất):\n")
                        for v in sorted(res["violations"], key=lambda x: x["weight"])[
                            :5
                        ]:
                            rule_info = (
                                f" (Rule: {v['rule_id']})" if v.get("rule_id") else ""
                            )
                            f.write(
                                f"- [{v['pillar']}] {v['file']}:{v.get('line', 0)} - {v['reason']}{rule_info}\n"
                            )


if __name__ == "__main__":
    # Điểm vào chính của script
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    auditor = CodeAuditor(target)
    auditor.run()
