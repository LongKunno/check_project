import os
import shutil
import json
import sys

# Thêm project root vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.engine.auditor import CodeAuditor


def setup_test_project():
    test_dir = "/tmp/test_project_pillars"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)

    # Feature 1: Auth (100 LOC, 1 major violation -5)
    os.makedirs(os.path.join(test_dir, "auth"))
    with open(os.path.join(test_dir, "auth/login.py"), "w") as f:
        f.write("# Auth\n" + "x = 1\n" * 99)  # 100 lines

    # Feature 2: Payments (400 LOC, 1 minor violation -2)
    os.makedirs(os.path.join(test_dir, "payments"))
    with open(os.path.join(test_dir, "payments/pay.py"), "w") as f:
        f.write("# Payments\n" + "x = 1\n" * 399)  # 400 lines

    return test_dir


def test_overall_pillars(monkeypatch):
    test_dir = setup_test_project()
    import src.config

    monkeypatch.setattr(src.config, "get_ai_mode", lambda: "realtime")
    monkeypatch.setattr(src.config, "get_test_mode_limit", lambda: 0)
    auditor = CodeAuditor(test_dir)

    # Mock AI Service to avoid non-deterministic results in unit tests
    from unittest.mock import AsyncMock
    from src.engine.ai_service import ai_service

    ai_service.verify_violations_batch = AsyncMock(return_value={})
    ai_service.deep_audit_batch = AsyncMock(return_value=[])

    # Giả lập vi phạm
    # Security violation in auth
    auditor.log_violation(
        {
            "pillar": "Security",
            "file": os.path.join(test_dir, "auth/login.py"),
            "rule_id": "HARDCODED_SECRET",
            "weight": -5.0,
            "reason": "Test reason",
            "snippet": "",
        }
    )
    # Maintainability violation in payments
    auditor.log_violation(
        {
            "pillar": "Maintainability",
            "file": os.path.join(test_dir, "payments/pay.py"),
            "rule_id": "MISSING_DOCSTRING",
            "weight": -2.0,
            "reason": "Test reason",
            "snippet": "",
        }
    )

    auditor.run()

    # Kiểm tra project_pillars
    print("\nProject Pillars:", json.dumps(auditor.project_pillars, indent=2))

    assert round(auditor.project_pillars["Security"], 2) == 9.33
    assert round(auditor.project_pillars["Maintainability"], 2) == 9.41
    assert auditor.project_pillars["Performance"] == 10.0
    assert auditor.project_pillars["Reliability"] == 10.0

    print(
        "PASS: Project level pillars calculated correctly based on overall LOC and punishments."
    )


if __name__ == "__main__":
    try:
        test_overall_pillars()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
