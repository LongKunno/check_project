from pathlib import Path

from src.engine.dependency_health import DependencyHealthService, evaluate_dependency_health


def test_dependency_health_service_flags_advisory_lifecycle_and_mutable_image(
    tmp_path, monkeypatch
):
    project = Path(tmp_path)
    (project / "requirements.txt").write_text(
        "requests==2.31.0\nflask>=2.0\n", encoding="utf-8"
    )
    (project / "package-lock.json").write_text(
        """
        {
          "name": "demo",
          "lockfileVersion": 3,
          "packages": {
            "": {
              "dependencies": {
                "react": "^18.2.0"
              }
            },
            "node_modules/react": {
              "version": "18.2.0"
            }
          }
        }
        """,
        encoding="utf-8",
    )
    (project / "Dockerfile").write_text("FROM python:3.12-slim\n", encoding="utf-8")

    service = DependencyHealthService(eol_warning_days=180)

    monkeypatch.setattr(
        service,
        "_fetch_pypi_package",
        lambda package_name, _payload: {
            "latest_version": "2.32.4" if package_name == "requests" else "3.0.0",
            "releases": {"2.31.0": [{"upload_time_iso_8601": "2024-01-01T00:00:00Z"}]},
            "lifecycle": {
                "lifecycle_status": "unknown",
                "eol_date": None,
                "eol_source": f"pypi:{package_name}",
                "lifecycle_detail": None,
            },
        },
    )
    monkeypatch.setattr(
        service,
        "_fetch_osv_counts",
        lambda **kwargs: {"critical": 0, "high": 1}
        if kwargs["package_name"] == "requests"
        else {"critical": 0, "high": 0},
    )
    monkeypatch.setattr(
        service,
        "_fetch_npm_package",
        lambda package_name, _payload: {
            "latest_version": "19.2.5",
            "versions": {
                "18.2.0": {
                    "lifecycle": {
                        "status": "near_eol",
                        "source": f"npm:{package_name}",
                    }
                }
            },
        },
    )

    result = service.assess(str(project))

    assert result["status"] == "warning"
    assert result["summary"]["dependencies_total"] == 4
    assert result["summary"]["high_advisories"] == 1
    assert result["summary"]["near_eol_count"] == 1
    assert result["summary"]["mutable_base_image_count"] == 1
    assert result["summary"]["hygiene_warning_count"] == 1
    assert result["summary"]["major_lag_count"] == 0
    assert result["summary"]["release_age_warning_count"] == 0
    assert result["summary"]["unknown_eol_count"] == 2
    assert set(result["summary"]["triggered_signals"]) >= {
        "high_advisory",
        "near_eol",
        "mutable_base_image",
    }


def test_dependency_health_ignores_version_lag_without_real_issue(tmp_path, monkeypatch):
    project = Path(tmp_path)
    (project / "requirements.txt").write_text("requests==2.31.0\n", encoding="utf-8")
    (project / "package-lock.json").write_text(
        """
        {
          "name": "demo",
          "lockfileVersion": 3,
          "packages": {
            "": {
              "dependencies": {
                "react": "^18.2.0"
              }
            },
            "node_modules/react": {
              "version": "18.2.0"
            }
          }
        }
        """,
        encoding="utf-8",
    )

    service = DependencyHealthService(eol_warning_days=180)

    monkeypatch.setattr(
        service,
        "_fetch_pypi_package",
        lambda _package_name, _payload: {
            "latest_version": "2.32.4",
            "releases": {"2.31.0": [{"upload_time_iso_8601": "2024-01-01T00:00:00Z"}]},
            "lifecycle": {
                "lifecycle_status": "unknown",
                "eol_date": None,
                "eol_source": "pypi:requests",
                "lifecycle_detail": None,
            },
        },
    )
    monkeypatch.setattr(
        service,
        "_fetch_npm_package",
        lambda _package_name, _payload: {
            "latest_version": "19.2.5",
            "versions": {},
        },
    )
    monkeypatch.setattr(
        service,
        "_fetch_osv_counts",
        lambda **_kwargs: {"critical": 0, "high": 0},
    )

    result = service.assess(str(project))

    assert result["status"] == "pass"
    assert result["summary"]["critical_advisories"] == 0
    assert result["summary"]["high_advisories"] == 0
    assert result["summary"]["near_eol_count"] == 0
    assert result["summary"]["eol_count"] == 0
    assert result["summary"]["deprecated_count"] == 0
    assert result["summary"]["major_lag_count"] == 0
    assert result["summary"]["release_age_warning_count"] == 0
    assert result["summary"]["triggered_signals"] == []


def test_dependency_health_returns_unavailable_for_manifest_hygiene_only(tmp_path):
    project = Path(tmp_path)
    (project / "package.json").write_text(
        """
        {
          "dependencies": {
            "react": "^19.0.0"
          }
        }
        """,
        encoding="utf-8",
    )

    result = evaluate_dependency_health(str(project), enabled=True)

    assert result["status"] == "unavailable"
    assert result["summary"]["dependencies_total"] == 1
    assert result["summary"]["hygiene_warning_count"] == 1
    assert result["items"][0]["status"] == "hygiene"


def test_dependency_health_can_be_disabled(tmp_path):
    result = evaluate_dependency_health(str(tmp_path), enabled=False)

    assert result["enabled"] is False
    assert result["status"] == "unavailable"
    assert "bị tắt" in result["note"]
