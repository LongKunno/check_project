import src.config
from src.engine import ai_service as ai_service_module
from src.engine.auditor import CodeAuditor
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
