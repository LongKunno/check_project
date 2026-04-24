import pytest

import src.config as config_module
from src.engine.database import AuditDatabase


class DummyCursor:
    def __init__(self, count):
        self.count = count
        self.closed = False

    def execute(self, query, params=None):
        self.last_query = query
        self.last_params = params

    def fetchone(self):
        return (self.count,)

    def close(self):
        self.closed = True


class DummyConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commit_called = False
        self.rollback_called = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commit_called = True

    def rollback(self):
        self.rollback_called = True


@pytest.fixture(autouse=True)
def reset_database_memory_state():
    original_pool = AuditDatabase._pool
    original_memory = AuditDatabase._memory_repositories
    original_logged = AuditDatabase._memory_repo_mode_logged
    try:
        AuditDatabase._pool = None
        AuditDatabase._memory_repositories = None
        AuditDatabase._memory_repo_mode_logged = False
        yield
    finally:
        AuditDatabase._pool = original_pool
        AuditDatabase._memory_repositories = original_memory
        AuditDatabase._memory_repo_mode_logged = original_logged


def test_seed_default_repositories_releases_connection_once_when_rows_exist(monkeypatch):
    cursor = DummyCursor(count=3)
    conn = DummyConnection(cursor)
    released = []

    monkeypatch.setattr(AuditDatabase, "get_connection", staticmethod(lambda: conn))
    monkeypatch.setattr(
        AuditDatabase,
        "release_connection",
        staticmethod(lambda connection: released.append(connection)),
    )

    AuditDatabase.seed_default_repositories()

    assert cursor.closed is True
    assert conn.commit_called is False
    assert conn.rollback_called is False
    assert released == [conn]


def test_repository_management_falls_back_to_in_memory_config(monkeypatch):
    monkeypatch.setattr(
        config_module,
        "CONFIGURED_REPOSITORIES",
        [
            {
                "id": "repo-b",
                "name": "Beta Repo",
                "url": "https://example.com/beta.git",
                "username": "beta-user",
                "token": "beta-token",
                "branch": "develop",
            },
            {
                "id": "repo-a",
                "name": "Alpha Repo",
                "url": "https://example.com/alpha.git",
                "username": "alpha-user",
                "token": "alpha-token",
                "branch": "main",
            },
        ],
    )

    repos = AuditDatabase.get_all_repositories(include_credentials=False)

    assert [repo["id"] for repo in repos] == ["repo-a", "repo-b"]
    assert "token" not in repos[0]
    assert "username" not in repos[0]

    repo = AuditDatabase.get_repository("repo-a")
    assert repo["token"] == "alpha-token"
    assert repo["username"] == "alpha-user"

    AuditDatabase.save_repository(
        "repo-c",
        "Gamma Repo",
        "https://example.com/gamma.git",
        username="gamma-user",
        token="gamma-token",
        branch="release",
    )
    created = AuditDatabase.get_repository("repo-c")
    assert created["branch"] == "release"
    assert created["token"] == "gamma-token"

    AuditDatabase.delete_repository("repo-c")
    assert AuditDatabase.get_repository("repo-c") is None


def test_non_persistent_reads_return_safe_empty_values_without_db():
    assert AuditDatabase.get_history() == []
    assert AuditDatabase.get_latest_audits_for_targets(["demo"]) == {}
    assert AuditDatabase.get_audit_by_id(1) is None
    overview = AuditDatabase.get_dependency_health_overview()
    assert overview["summary"]["configured_repos"] >= 0
    assert all(
        repo["dependency_health_status"] == "unavailable"
        for repo in overview["repositories"]
    )
    assert (
        AuditDatabase.get_repository_dependency_health("repo://demo")[
            "dependency_health"
        ]["status"]
        == "unavailable"
    )
    assert AuditDatabase.get_project_rules("repo-1") is None
    assert AuditDatabase.get_effective_rules("repo-1") == {
        "disabled_core_rules": [],
        "custom_weights": {},
        "compiled_json": {},
        "natural_text": "",
    }


def test_save_audit_returns_none_when_db_persistence_is_unavailable(caplog):
    audit_id = AuditDatabase.save_audit(
        target="https://example.com/repo.git",
        score=92.1,
        rating="A",
        loc=120,
        violations_count=3,
        pillar_scores={"Security": 9.0},
        full_json={"metadata": {}},
    )

    assert audit_id is None
    assert "Skipping audit persistence" in caplog.text


def test_compute_regression_snapshot_warns_on_multi_signal():
    baseline = {
        "id": 101,
        "timestamp": "2026-04-22T10:00:00",
        "score": 91.0,
        "violations_count": 1,
        "pillar_scores": {
            "Performance": 9.0,
            "Maintainability": 8.8,
            "Reliability": 9.1,
            "Security": 9.4,
        },
        "full_json": {
            "violations": [
                {
                    "file": "src/app.py",
                    "rule_id": "RULE_MINOR",
                    "line": 12,
                    "reason": "Existing issue",
                    "weight": -1.0,
                    "severity": "Minor",
                }
            ]
        },
    }
    current = {
        "score": 87.8,
        "violations_count": 2,
        "pillar_scores": {
            "Performance": 9.0,
            "Maintainability": 8.1,
            "Reliability": 9.1,
            "Security": 8.7,
        },
        "full_json": {
            "violations": [
                {
                    "file": "src/app.py",
                    "rule_id": "RULE_MINOR",
                    "line": 12,
                    "reason": "Existing issue",
                    "weight": -1.0,
                    "severity": "Minor",
                },
                {
                    "file": "src/security.py",
                    "rule_id": "RULE_CRIT",
                    "line": 77,
                    "reason": "New critical issue",
                    "weight": -8.0,
                    "severity": "Critical",
                },
            ]
        },
    }

    snapshot = AuditDatabase.compute_regression_snapshot(
        current,
        baseline_audit=baseline,
        settings={
            "gate_enabled": True,
            "score_drop_threshold": 2.0,
            "violations_increase_threshold": 1,
            "pillar_drop_threshold": 0.5,
            "new_critical_threshold": 1,
        },
    )

    assert snapshot["regression_status"] == "warning"
    assert snapshot["baseline_audit_id"] == 101
    assert snapshot["regression_summary"]["score_delta"] == -3.2
    assert snapshot["regression_summary"]["violations_delta"] == 1
    assert snapshot["regression_summary"]["new_violation_count"] == 1
    assert snapshot["regression_summary"]["new_high_severity_count"] == 1
    assert set(snapshot["regression_summary"]["triggered_signals"]) == {
        "score_drop",
        "violations_increase",
        "pillar_drop",
        "new_high_severity",
    }


def test_get_trends_return_safe_empty_payloads_without_db():
    assert AuditDatabase.get_repository_trends("repo://demo", 30)["audit_points"] == []
    assert AuditDatabase.get_portfolio_trends(30)["score_series"] == []
