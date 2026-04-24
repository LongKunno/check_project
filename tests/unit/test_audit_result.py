from types import SimpleNamespace


def test_build_and_save_audit_result_includes_member_recent_months(monkeypatch):
    import src.api.routers.audit as audit_router_module

    observed = {}
    dependency_health_payload = {
        "status": "warning",
        "summary": {
            "manifests_scanned": ["requirements.txt"],
            "dependencies_total": 2,
            "critical_advisories": 0,
            "high_advisories": 1,
            "deprecated_count": 0,
            "near_eol_count": 1,
            "eol_count": 0,
            "unknown_eol_count": 1,
            "mutable_base_image_count": 0,
            "hygiene_warning_count": 0,
            "triggered_signals": ["high_advisory", "near_eol"],
        },
        "items": [],
        "manifests": [],
    }

    monkeypatch.setattr(audit_router_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(audit_router_module, "get_dependency_health_enabled", lambda: True)
    monkeypatch.setattr(
        audit_router_module,
        "get_dependency_eol_warning_days",
        lambda: 180,
    )
    monkeypatch.setattr(
        audit_router_module,
        "evaluate_dependency_health",
        lambda *_args, **_kwargs: dependency_health_payload,
    )
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
        target_dir="/tmp/project",
    )

    result = audit_router_module._build_and_save_audit_result(
        auditor,
        "https://example.com/repo.git",
        "repo",
    )

    assert result["metadata"]["member_recent_months"] == 6
    assert result["metadata"]["dependency_health"] == dependency_health_payload
    assert result["dependency_health_status"] == "warning"
    assert result["dependency_health_summary"]["near_eol_count"] == 1
    assert observed["full_json"]["metadata"]["member_recent_months"] == 6
    assert observed["full_json"]["metadata"]["dependency_health"]["status"] == "warning"
