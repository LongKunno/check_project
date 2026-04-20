import asyncio

import pytest
import src.config
from src.engine import ai_service as ai_service_module
from src.api.audit_state import AuditState, JobManager
from src.engine.auditor import AuditCancelledError, CodeAuditor
from src.engine.scoring import ScoringEngine


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
    auditor.discovery_data = {"files": []}
    auditor.custom_rules = None
    auditor._build_deep_audit_batches = lambda: [[{"path": "api.py", "content": "x"}]]
    auditor._log_ai_violations = lambda confirmed: None

    with pytest.raises(AuditCancelledError):
        auditor._step_ai_reasoning(FakeAIService(), asyncio, 1)

    assert cross_check_called["called"] is False


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
