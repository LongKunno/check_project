from types import SimpleNamespace


def test_build_and_save_audit_result_includes_member_recent_months(monkeypatch):
    import src.api.routers.audit as audit_router_module

    observed = {}

    monkeypatch.setattr(audit_router_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(
        audit_router_module.AuditDatabase,
        "save_audit",
        staticmethod(lambda **kwargs: observed.update(kwargs)),
    )

    auditor = SimpleNamespace(
        discovery_data={"total_loc": 120, "total_files": 3},
        feature_results={},
        project_pillars={},
        member_results={},
        violations=[],
    )

    result = audit_router_module._build_and_save_audit_result(
        auditor,
        "https://example.com/repo.git",
        "repo",
    )

    assert result["metadata"]["member_recent_months"] == 6
    assert observed["full_json"]["metadata"]["member_recent_months"] == 6
