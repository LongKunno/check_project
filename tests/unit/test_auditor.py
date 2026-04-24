import asyncio

import pytest
import src.config
from src.engine import ai_service as ai_service_module
from src.api.audit_state import AuditState, JobManager
from src.engine.ai_cache import ai_audit_cache
from src.engine.auditor import AuditCancelledError, CodeAuditor
from src.engine.database import AuditDatabase
from src.engine.scoring import ScoringEngine


def _reset_ai_cache_state():
    ai_audit_cache._memory_entries.clear()
    ai_audit_cache._memory_runs.clear()
    ai_audit_cache._pending_runs.clear()
    ai_audit_cache._memory_policy = dict(ai_audit_cache.DEFAULT_POLICY)
    AuditDatabase._pool = None


def setup_function():
    _reset_ai_cache_state()


def teardown_function():
    _reset_ai_cache_state()


def test_step_ai_processing_reads_concurrency_once_and_reuses_it(monkeypatch):
    auditor = CodeAuditor(".")
    concurrency_calls = {"count": 0}
    captured = {}
    ai_service = object()

    def fake_get_ai_max_concurrency():
        concurrency_calls["count"] += 1
        return 7

    def fake_validation(automated_violations, service, asyncio_module, ai_concurrency):
        captured["validation"] = {
            "violations": automated_violations,
            "service": service,
            "asyncio": asyncio_module,
            "ai_concurrency": ai_concurrency,
        }

    def fake_reasoning(service, asyncio_module, ai_concurrency):
        captured["reasoning"] = {
            "service": service,
            "asyncio": asyncio_module,
            "ai_concurrency": ai_concurrency,
        }

    monkeypatch.setattr(src.config, "get_ai_max_concurrency", fake_get_ai_max_concurrency)
    monkeypatch.setattr(ai_service_module, "ai_service", ai_service)
    monkeypatch.setattr(auditor, "_step_ai_validation", fake_validation)
    monkeypatch.setattr(auditor, "_step_ai_reasoning", fake_reasoning)

    violations = [{"file": "sample.py", "reason": "Example"}]
    auditor._step_ai_processing(violations)

    assert concurrency_calls["count"] == 1
    assert captured["validation"]["violations"] == violations
    assert captured["validation"]["service"] is ai_service
    assert captured["validation"]["ai_concurrency"] == 7
    assert captured["reasoning"]["service"] is ai_service
    assert captured["reasoning"]["ai_concurrency"] == 7


def test_step_ai_validation_uses_cache_hits_before_calling_ai(monkeypatch, tmp_path):
    _reset_ai_cache_state()

    class FakeAIService:
        def _get_realtime_model(self):
            return "cached-model"

        async def verify_violations_batch(self, chunk):
            raise AssertionError("Không được gọi AI khi đã có cache hit.")

    file_path = tmp_path / "service.py"
    file_path.write_text("print('cached')\n", encoding="utf-8")

    auditor = CodeAuditor(str(tmp_path))
    auditor.discovery_data = {
        "files": [{"path": str(file_path)}],
        "total_files": 1,
        "total_loc": 1,
    }
    auditor.merged_rules = {"rules": []}

    violation = {
        "file": "service.py",
        "reason": "Cached issue",
        "type": "Reliability",
        "snippet": "print('cached')",
        "rule_id": "RULE_CACHE",
        "line": 1,
    }
    identity = auditor._realtime_cache_identity(FakeAIService(), "validation")
    ai_audit_cache.store_entry(
        entry_type="validation",
        payload=auditor._validation_cache_payload(violation, identity),
        result_json={
            "index": 0,
            "is_false_positive": False,
            "explanation": "Từ cache",
            "confidence": 0.94,
        },
        source_input_tokens=15,
        source_output_tokens=6,
        source_estimated_cost=0.0012,
    )

    logged = []
    monkeypatch.setattr(auditor, "log_violation", lambda item: logged.append(item))

    auditor._step_ai_validation([violation], FakeAIService(), asyncio, 1)

    assert len(logged) == 1
    assert "AI Note: Từ cache" in logged[0]["reason"]
    assert ai_audit_cache.summarize_run(auditor.ai_scope_id)["hits"] == 1


def test_step_ai_validation_skips_cache_reads_but_still_writes_when_disabled_for_run(
    monkeypatch, tmp_path
):
    _reset_ai_cache_state()

    class FakeAIService:
        def _get_realtime_model(self):
            return "fresh-model"

        async def verify_violations_batch(self, chunk):
            return {
                idx: {
                    "is_false_positive": False,
                    "explanation": "Fresh validation",
                    "confidence": 0.97,
                }
                for idx, _ in enumerate(chunk)
            }

    file_path = tmp_path / "service.py"
    file_path.write_text("print('fresh')\n", encoding="utf-8")

    auditor = CodeAuditor(str(tmp_path), use_cache=False)
    auditor.discovery_data = {
        "files": [{"path": str(file_path)}],
        "total_files": 1,
        "total_loc": 1,
    }
    auditor.merged_rules = {"rules": []}

    violation = {
        "file": "service.py",
        "reason": "Fresh issue",
        "type": "Reliability",
        "snippet": "print('fresh')",
        "rule_id": "RULE_CACHE",
        "line": 1,
    }
    identity = auditor._realtime_cache_identity(FakeAIService(), "validation")
    payload = auditor._validation_cache_payload(violation, identity)
    ai_audit_cache.store_entry(
        entry_type="validation",
        payload=payload,
        result_json={
            "index": 0,
            "is_false_positive": False,
            "explanation": "Stale cache",
            "confidence": 0.91,
        },
        source_input_tokens=11,
        source_output_tokens=4,
        source_estimated_cost=0.0008,
    )

    logged = []
    monkeypatch.setattr(auditor, "log_violation", lambda item: logged.append(item))

    auditor._step_ai_validation([violation], FakeAIService(), asyncio, 1)

    lookup = ai_audit_cache.lookup_entry(entry_type="validation", payload=payload)
    summary = ai_audit_cache.summarize_run(auditor.ai_scope_id)

    assert len(logged) == 1
    assert "Stale cache" not in logged[0]["reason"]
    assert "Fresh validation" in logged[0]["reason"]
    assert lookup["result_json"]["explanation"] == "Fresh validation"
    assert summary["hits"] == 0
    assert summary["misses"] == 0
    assert summary["writes"] == 1


def test_code_auditor_marks_write_only_mode_when_cache_reads_are_disabled(tmp_path):
    auditor = CodeAuditor(str(tmp_path), use_cache=False)

    assert auditor.cache_runtime["requested"] is False
    assert auditor.cache_runtime["effective_mode"] == "write_only"
    assert auditor.cache_runtime["stages"]["validation"]["read_enabled"] is False
    assert auditor.cache_runtime["stages"]["validation"]["write_enabled"] is True


def test_code_auditor_marks_cache_disabled_when_policy_is_off(tmp_path):
    ai_audit_cache.save_policy({"enabled": False})

    auditor = CodeAuditor(str(tmp_path))

    assert auditor.cache_runtime["requested"] is True
    assert auditor.cache_runtime["effective_mode"] == "disabled_by_policy"
    assert auditor.cache_runtime["stages"]["validation"]["write_enabled"] is False


def test_step_ai_reasoning_uses_cached_file_results(monkeypatch, tmp_path):
    _reset_ai_cache_state()

    class FakeAIService:
        def _get_realtime_model(self):
            return "cached-model"

        async def deep_audit_batch(self, chunk_data, custom_rules):
            raise AssertionError("Không được gọi deep audit khi đã có cache hit.")

        async def verify_flagged_issues(self, flagged, context_cache):
            raise AssertionError("Không được gọi cross-check khi không có flagged miss.")

    file_path = tmp_path / "logic.py"
    file_path.write_text("def total(a, b):\n    return a + b\n", encoding="utf-8")

    auditor = CodeAuditor(str(tmp_path))
    auditor.discovery_data = {
        "files": [{"path": str(file_path)}],
        "total_files": 1,
        "total_loc": 2,
    }
    auditor.merged_rules = {"rules": []}

    record = auditor._ensure_cache_index().get_record(str(file_path))
    identity = auditor._realtime_cache_identity(FakeAIService(), "deep_audit")
    ai_audit_cache.store_entry(
        entry_type="deep_audit",
        payload=auditor._deep_cache_payload(record, identity),
        result_json=[
            {
                "file": "logic.py",
                "type": "Reliability",
                "reason": "Cached deep issue",
                "weight": -1.0,
                "confidence": 0.91,
                "line": 1,
                "rule_id": "AI_REASONING",
                "is_custom": False,
                "needs_verification": False,
                "verify_target": "",
            }
        ],
        source_input_tokens=42,
        source_output_tokens=12,
        source_estimated_cost=0.0031,
    )

    confirmed = []
    monkeypatch.setattr(auditor, "_log_ai_violations", lambda items: confirmed.extend(items))

    auditor._step_ai_reasoning(FakeAIService(), asyncio, 1)

    assert len(confirmed) == 1
    assert confirmed[0]["reason"] == "Cached deep issue"
    assert ai_audit_cache.summarize_run(auditor.ai_scope_id)["hits"] == 1


def test_step_ai_validation_updates_structured_job_progress(monkeypatch, tmp_path):
    class FakeAIService:
        async def verify_violations_batch(self, chunk):
            await asyncio.sleep(0.01)
            return {
                idx: {
                    "is_false_positive": False,
                    "explanation": f"Validated {idx}",
                    "confidence": 0.95,
                }
                for idx, _ in enumerate(chunk)
            }

    auditor = CodeAuditor(str(tmp_path))
    monkeypatch.setattr(auditor, "log_violation", lambda violation: None)

    violations = [
        {
            "file": f"module_{idx}.py",
            "reason": "Issue",
            "type": "Maintainability",
            "rule_id": "RULE_TEST",
        }
        for idx in range(6)
    ]

    AuditState.is_cancelled = False
    JobManager.jobs.clear()
    JobManager.job_logs.clear()
    job_id = JobManager.create_job("validation-progress")
    JobManager.set_active_job(job_id)

    try:
        auditor._step_ai_validation(violations, FakeAIService(), asyncio, 2)
    finally:
        JobManager.clear_active_job()

    progress = JobManager.get_job(job_id).progress
    assert progress is not None
    assert progress.phase == "validation"
    assert progress.phase_label == "Validation"
    assert progress.total_batches == 2
    assert progress.batch_size == 5
    assert progress.last_started_batch == 2
    assert progress.completed_batches == 2
    assert progress.active_batches == 0
    assert progress.pending_batches == 0


def test_step_ai_reasoning_keeps_progress_consistent_with_out_of_order_batches(tmp_path):
    class FakeAIService:
        async def deep_audit_batch(self, chunk_data, custom_rules):
            first_file = chunk_data[0]["path"]
            delay = 0.03 if first_file.endswith("file_0.py") else 0.01
            await asyncio.sleep(delay)
            return []

        async def verify_flagged_issues(self, flagged, context_cache):
            return []

    for idx in range(6):
        (tmp_path / f"file_{idx}.py").write_text(
            f"print('file {idx}')\n", encoding="utf-8"
        )

    auditor = CodeAuditor(str(tmp_path))
    auditor.discovery_data = {
        "files": [{"path": str(tmp_path / f"file_{idx}.py")} for idx in range(6)]
    }

    AuditState.is_cancelled = False
    JobManager.jobs.clear()
    JobManager.job_logs.clear()
    job_id = JobManager.create_job("deep-audit-progress")
    JobManager.set_active_job(job_id)

    try:
        auditor._step_ai_reasoning(FakeAIService(), asyncio, 3)
    finally:
        JobManager.clear_active_job()

    progress = JobManager.get_job(job_id).progress
    assert progress is not None
    assert progress.phase == "deep_audit"
    assert progress.phase_label == "Deep Audit"
    assert progress.total_batches == 2
    assert progress.batch_size == 5
    assert progress.last_started_batch == 2
    assert progress.completed_batches == 2
    assert progress.active_batches == 0
    assert progress.pending_batches == 0


def test_apply_included_paths_scope_keeps_only_selected_files(tmp_path):
    src_dir = tmp_path / "src"
    tests_dir = tmp_path / "tests"
    src_dir.mkdir()
    tests_dir.mkdir()

    main_file = src_dir / "main.py"
    helper_file = tests_dir / "test_main.py"
    main_file.write_text("print('main')\n", encoding="utf-8")
    helper_file.write_text("print('test')\n", encoding="utf-8")

    auditor = CodeAuditor(
        str(tmp_path),
        included_paths=["src/main.py"],
    )
    auditor.discovery_data = {
        "files": [
            {
                "path": str(main_file),
                "feature": "src",
                "loc": 1,
            },
            {
                "path": str(helper_file),
                "feature": "tests",
                "loc": 1,
            },
        ],
        "features": {
            "src": {"loc": 1, "files_count": 1},
            "tests": {"loc": 1, "files_count": 1},
        },
        "total_files": 2,
        "total_loc": 2,
    }

    auditor._apply_included_paths_scope()

    assert auditor.discovery_data["total_files"] == 1
    assert auditor.discovery_data["total_loc"] == 1
    assert auditor.discovery_data["files"] == [
        {
            "path": str(main_file),
            "feature": "src",
            "loc": 1,
        }
    ]
    assert auditor.discovery_data["features"] == {
        "src": {"loc": 1, "files_count": 1}
    }


def test_run_stops_before_aggregation_when_cancel_requested_after_scanning(monkeypatch):
    cancel_state = {"requested": False}
    auditor = CodeAuditor(".", cancel_check=lambda: cancel_state["requested"])

    monkeypatch.setattr(src.config, "get_ai_enabled", lambda: False)
    monkeypatch.setattr(auditor, "_step_discovery", lambda: None)

    def fake_scanning():
        cancel_state["requested"] = True
        return []

    aggregation_called = {"called": False}
    reporting_called = {"called": False}

    def fake_aggregation():
        aggregation_called["called"] = True
        return 100.0, "Excellent"

    def fake_reporting(*args, **kwargs):
        reporting_called["called"] = True

    monkeypatch.setattr(auditor, "_step_scanning", fake_scanning)
    monkeypatch.setattr(auditor, "_step_aggregation", fake_aggregation)
    monkeypatch.setattr(auditor, "_step_reporting", fake_reporting)

    with pytest.raises(AuditCancelledError):
        auditor.run()

    assert aggregation_called["called"] is False
    assert reporting_called["called"] is False


def test_log_violation_deduplicates_same_finding_with_different_ai_notes(tmp_path):
    auditor = CodeAuditor(str(tmp_path))

    auditor.log_violation(
        {
            "file": str(tmp_path / "service.py"),
            "pillar": "Performance",
            "reason": "N+1 Query Pattern Detected. AI Note: First explanation",
            "weight": -5.0,
            "rule_id": "N_PLUS_ONE",
            "line": 12,
        }
    )
    auditor.log_violation(
        {
            "file": str(tmp_path / "service.py"),
            "pillar": "Performance",
            "reason": "N+1 Query Pattern Detected. AI Note: Second explanation",
            "weight": -5.0,
            "rule_id": "N_PLUS_ONE",
            "line": 12,
        }
    )

    assert len(auditor.violations) == 1
    assert auditor.violations[0]["rule_id"] == "N_PLUS_ONE"


def test_step_ai_validation_stops_scheduling_new_batches_after_cancel_request(
    monkeypatch, tmp_path
):
    cancel_state = {"requested": False}
    started_batches = []

    class FakeAIService:
        async def verify_violations_batch(self, chunk):
            started_batches.append(len(chunk))
            cancel_state["requested"] = True
            await asyncio.sleep(0.01)
            return {
                idx: {
                    "is_false_positive": False,
                    "explanation": f"Validated {idx}",
                    "confidence": 0.95,
                }
                for idx, _ in enumerate(chunk)
            }

    auditor = CodeAuditor(str(tmp_path), cancel_check=lambda: cancel_state["requested"])
    monkeypatch.setattr(auditor, "log_violation", lambda violation: None)

    violations = [
        {
            "file": f"module_{idx}.py",
            "reason": "Issue",
            "type": "Maintainability",
            "rule_id": "RULE_TEST",
        }
        for idx in range(15)
    ]

    AuditState.is_cancelled = False
    JobManager.jobs.clear()
    JobManager.job_logs.clear()
    job_id = JobManager.create_job("validation-cancel")
    JobManager.set_active_job(job_id)

    try:
        auditor._step_ai_validation(violations, FakeAIService(), asyncio, 1)
    finally:
        JobManager.clear_active_job()

    progress = JobManager.get_job(job_id).progress
    assert started_batches == [5]
    assert progress is not None
    assert progress.total_batches == 3
    assert progress.completed_batches == 1
    assert progress.pending_batches == 2


def test_step_ai_reasoning_skips_cross_check_after_cancel_request(tmp_path):
    cancel_state = {"requested": False}
    cross_check_called = {"called": False}

    class FakeAIService:
        async def deep_audit_batch(self, chunk_data, custom_rules):
            cancel_state["requested"] = True
            await asyncio.sleep(0.01)
            return [
                {
                    "needs_verification": True,
                    "verify_target": "symbol",
                    "reason": "needs follow-up",
                }
            ]

        async def verify_flagged_issues(self, flagged, context_cache):
            cross_check_called["called"] = True
            return []

    auditor = CodeAuditor(str(tmp_path), cancel_check=lambda: cancel_state["requested"])
    file_path = tmp_path / "api.py"
    file_path.write_text("def run():\n    return True\n", encoding="utf-8")
    auditor.discovery_data = {
        "files": [{"path": str(file_path)}],
        "total_files": 1,
        "total_loc": 2,
    }
    auditor.custom_rules = None
    auditor._log_ai_violations = lambda confirmed: None

    with pytest.raises(AuditCancelledError):
        auditor._step_ai_reasoning(FakeAIService(), asyncio, 1)

    assert cross_check_called["called"] is False


def test_step_ai_validation_batch_api_surfaces_openai_batch_error_message(monkeypatch):
    auditor = CodeAuditor(".")
    violations = [
        {
            "file": "src/config.py",
            "reason": "Issue",
            "type": "Reliability",
            "rule_id": "RULE_TEST",
        }
    ]

    monkeypatch.setattr(
        auditor,
        "_get_orchestration_state",
        lambda: {
            "stage": "validation_submitted",
            "validation_batch_id": "batch-1",
        },
    )
    monkeypatch.setattr(auditor, "_start_active_job_progress", lambda *args, **kwargs: None)
    monkeypatch.setattr(auditor, "_update_orchestration_state", lambda *args, **kwargs: None)
    monkeypatch.setattr(auditor, "_ai_telemetry_context", lambda source: {})
    monkeypatch.setattr(
        auditor,
        "_resolve_remote_batch_results",
        lambda *args, **kwargs: {
            "outputs": {},
            "errors": {
                "validation-0": {
                    "status_code": 400,
                    "message": "Unsupported value: 'temperature' does not support 0 with this model.",
                }
            },
        },
    )

    with pytest.raises(RuntimeError) as exc:
        auditor._step_ai_validation_batch_api(violations, object())

    assert "validation-0" in str(exc.value)
    assert "Unsupported value: 'temperature' does not support 0 with this model." in str(
        exc.value
    )


def test_step_ai_validation_batch_api_only_submits_cache_misses(monkeypatch, tmp_path):
    _reset_ai_cache_state()

    class FakeAIService:
        def _get_batch_model(self):
            return "gpt-4.1-nano"

        def build_validation_batch_requests(self, chunks, telemetry=None):
            captured["chunks"] = chunks
            return [
                {
                    "custom_id": "validation-0",
                    "messages": [{"role": "user", "content": "demo"}],
                }
            ]

        async def submit_chat_completion_batch(self, requests, metadata=None, telemetry=None):
            return {"id": "batch-1"}

        def parse_validation_content(self, content):
            return ai_service_module.ValidationResponse.model_validate(
                {
                    "results": [
                        {
                            "index": 0,
                            "is_false_positive": False,
                            "explanation": "fresh",
                            "confidence": 0.9,
                        }
                    ]
                }
            )

    file_path = tmp_path / "demo.py"
    file_path.write_text("print('demo')\n", encoding="utf-8")

    auditor = CodeAuditor(str(tmp_path))
    auditor.discovery_data = {
        "files": [{"path": str(file_path)}],
        "total_files": 1,
        "total_loc": 1,
    }
    auditor.merged_rules = {"rules": []}

    violations = [
        {
            "file": "demo.py",
            "reason": "Cached issue",
            "type": "Reliability",
            "snippet": "print('demo')",
            "rule_id": "RULE_CACHE",
            "line": 1,
        },
        {
            "file": "demo.py",
            "reason": "Fresh issue",
            "type": "Reliability",
            "snippet": "print('fresh')",
            "rule_id": "RULE_FRESH",
            "line": 2,
        },
    ]
    service = FakeAIService()
    identity = auditor._batch_cache_identity(service, "validation")
    ai_audit_cache.store_entry(
        entry_type="validation",
        payload=auditor._validation_cache_payload(violations[0], identity),
        result_json={
            "index": 0,
            "is_false_positive": False,
            "explanation": "cached",
            "confidence": 0.95,
        },
        source_input_tokens=10,
        source_output_tokens=4,
        source_estimated_cost=0.001,
    )

    captured = {}
    logged = []
    monkeypatch.setattr(auditor, "_get_orchestration_state", lambda: {"stage": "scanned"})
    monkeypatch.setattr(auditor, "_start_active_job_progress", lambda *args, **kwargs: None)
    monkeypatch.setattr(auditor, "_update_orchestration_state", lambda *args, **kwargs: None)
    monkeypatch.setattr(auditor, "_ai_telemetry_context", lambda source: {})
    monkeypatch.setattr(
        auditor,
        "_resolve_remote_batch_results",
        lambda *args, **kwargs: {
            "outputs": {"validation-0": {"content": '{"results":[{"index":0,"is_false_positive":false,"explanation":"fresh","confidence":0.9}]}' }},
            "errors": {},
        },
    )
    monkeypatch.setattr(auditor, "log_violation", lambda item: logged.append(item))

    auditor._step_ai_validation_batch_api(violations, service)

    assert len(captured["chunks"]) == 1
    assert captured["chunks"][0] == [violations[1]]
    assert len(logged) == 2


def test_step_aggregation_matches_project_score_for_single_owner_repo(monkeypatch):
    import src.engine.authorship as authorship_module

    class FakeAuthorshipTracker:
        def __init__(self, target_dir):
            self.target_dir = target_dir

        def parse_blame(self, file_path):
            return {}

        def get_file_member_loc(self, file_path):
            return {
                "api.py": {"owner@example.com": 500},
                "engine.py": {"owner@example.com": 500},
                "clean.py": {"owner@example.com": 200},
            }.get(file_path, {})

        def get_author_info(self, file_path, line_no):
            return {
                "author": "Owner",
                "email": "owner@example.com",
                "boundary": False,
            }

        def get_all_member_loc(self):
            return {"owner@example.com": 1200}

        def get_all_member_names(self):
            return {"owner@example.com": "Owner"}

    monkeypatch.setattr(authorship_module, "AuthorshipTracker", FakeAuthorshipTracker)

    auditor = CodeAuditor("/repo")
    auditor.discovery_data = {
        "total_loc": 1200,
        "files": [
            {"path": "/repo/api.py", "loc": 500, "feature": "api"},
            {"path": "/repo/engine.py", "loc": 500, "feature": "engine"},
            {"path": "/repo/clean.py", "loc": 200, "feature": "clean"},
        ],
        "features": {
            "api": {"loc": 500, "files_count": 1},
            "engine": {"loc": 500, "files_count": 1},
            "clean": {"loc": 200, "files_count": 1},
        },
    }
    auditor.violations = [
        {
            "pillar": "Maintainability",
            "file": "api.py",
            "weight": -10.0,
            "rule_id": "RULE_MAINT",
            "line": 10,
        },
        {
            "pillar": "Reliability",
            "file": "engine.py",
            "weight": -20.0,
            "rule_id": "RULE_REL",
            "line": 5,
        },
    ]
    auditor.merged_rules = {
        "rules": [
            {"id": "RULE_MAINT", "severity": "Minor", "debt": 10},
            {"id": "RULE_REL", "severity": "Major", "debt": 30},
        ]
    }

    project_final, _ = auditor._step_aggregation()
    member = auditor.member_results["owner@example.com"]

    assert project_final == member["final"]
    assert auditor.project_pillars == member["pillars"]
    assert member["loc"] == 1200
    assert set(member["violations"][0].keys()) >= {"file", "line", "rule_id"}


def test_step_aggregation_assigns_boundary_violation_to_single_feature_owner(monkeypatch):
    import src.engine.authorship as authorship_module

    class FakeAuthorshipTracker:
        def __init__(self, target_dir):
            self.target_dir = target_dir

        def parse_blame(self, file_path):
            return {}

        def get_file_member_loc(self, file_path):
            return {"api.py": {"owner@example.com": 1200}}.get(file_path, {})

        def get_author_info(self, file_path, line_no):
            return {
                "author": "Unknown",
                "email": "unknown@unknown",
                "boundary": True,
            }

        def get_all_member_loc(self):
            return {"owner@example.com": 1200}

        def get_all_member_names(self):
            return {"owner@example.com": "Owner"}

    monkeypatch.setattr(authorship_module, "AuthorshipTracker", FakeAuthorshipTracker)

    auditor = CodeAuditor("/repo")
    auditor.discovery_data = {
        "total_loc": 1200,
        "files": [{"path": "/repo/api.py", "loc": 1200, "feature": "api"}],
        "features": {"api": {"loc": 1200, "files_count": 1}},
    }
    auditor.violations = [
        {
            "pillar": "Security",
            "file": "api.py",
            "weight": -10.0,
            "rule_id": "RULE_SEC",
            "line": 77,
        }
    ]
    auditor.merged_rules = {
        "rules": [{"id": "RULE_SEC", "severity": "Critical", "debt": 45}]
    }

    project_final, _ = auditor._step_aggregation()
    member = auditor.member_results["owner@example.com"]

    assert member["punishments"]["Security"] == -10.0
    assert len(member["violations"]) == 1
    assert project_final == member["final"]


def test_step_aggregation_keeps_boundary_violation_project_only_for_shared_feature(monkeypatch):
    import src.engine.authorship as authorship_module

    class FakeAuthorshipTracker:
        def __init__(self, target_dir):
            self.target_dir = target_dir

        def parse_blame(self, file_path):
            return {}

        def get_file_member_loc(self, file_path):
            return {
                "api.py": {
                    "owner-one@example.com": 800,
                    "owner-two@example.com": 400,
                }
            }.get(file_path, {})

        def get_author_info(self, file_path, line_no):
            return {
                "author": "Unknown",
                "email": "unknown@unknown",
                "boundary": True,
            }

        def get_all_member_loc(self):
            return {
                "owner-one@example.com": 800,
                "owner-two@example.com": 400,
            }

        def get_all_member_names(self):
            return {
                "owner-one@example.com": "Owner One",
                "owner-two@example.com": "Owner Two",
            }

    monkeypatch.setattr(authorship_module, "AuthorshipTracker", FakeAuthorshipTracker)

    auditor = CodeAuditor("/repo")
    auditor.discovery_data = {
        "total_loc": 1200,
        "files": [{"path": "/repo/api.py", "loc": 1200, "feature": "api"}],
        "features": {"api": {"loc": 1200, "files_count": 1}},
    }
    auditor.violations = [
        {
            "pillar": "Security",
            "file": "api.py",
            "weight": -10.0,
            "rule_id": "RULE_SEC",
            "line": 77,
        }
    ]
    auditor.merged_rules = {
        "rules": [{"id": "RULE_SEC", "severity": "Critical", "debt": 45}]
    }

    project_final, _ = auditor._step_aggregation()

    assert project_final == ScoringEngine.calculate_final_score_from_features(
        auditor.feature_results
    )
    assert auditor.member_results == {}
