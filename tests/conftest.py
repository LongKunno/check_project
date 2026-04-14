"""
Pytest Configuration — Shared fixtures for all test modules.
"""

import pytest
import json
import os

# ─── Path Fixtures ────────────────────────────────────────────────────────────

RULES_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "engine", "rules.json")


@pytest.fixture
def core_rules():
    """Load the actual rules.json used by the engine."""
    with open(RULES_JSON_PATH, "r") as f:
        data = json.load(f)
    return data


@pytest.fixture
def regex_only_rules(core_rules):
    """Rules containing only regex-based rules (for RegexScanner tests)."""
    regex_rules = [r for r in core_rules["rules"] if r.get("regex")]
    return {"rules": regex_rules, "disabled_ids": []}


@pytest.fixture
def ast_only_rules(core_rules):
    """Rules containing only AST-based rules (for PythonASTScanner tests)."""
    ast_rules = [r for r in core_rules["rules"] if r.get("ast")]
    return {"rules": ast_rules, "disabled_ids": []}


@pytest.fixture
def all_rules(core_rules):
    """All rules with empty disabled list."""
    return {"rules": core_rules["rules"], "disabled_ids": []}


@pytest.fixture
def disabled_rules(core_rules):
    """All rules with some disabled for testing disabled filter logic."""
    return {"rules": core_rules["rules"], "disabled_ids": ["HARDCODED_SECRET", "PRINT_STATEMENT"]}


# ─── Scanner Instances ────────────────────────────────────────────────────────


@pytest.fixture
def regex_scanner():
    from src.engine.scanners import RegexScanner
    return RegexScanner()


@pytest.fixture
def ast_scanner():
    from src.engine.scanners import PythonASTScanner
    return PythonASTScanner()


# ─── Helper Functions ─────────────────────────────────────────────────────────


def scan_code(scanner, code, rules, filename="test_file.py"):
    """Helper: scan a string of Python code with given rules."""
    import ast as ast_module
    lines = code.split("\n")
    try:
        tree = ast_module.parse(code)
    except SyntaxError:
        tree = None
    return scanner.scan(filename, code, lines, tree, rules)


def assert_violation_found(violations, rule_id):
    """Assert that at least one violation with given rule_id exists."""
    found = [v for v in violations if v.get("rule_id") == rule_id]
    assert len(found) > 0, f"Expected violation '{rule_id}' not found. Got: {[v['rule_id'] for v in violations]}"
    return found


def assert_no_violation(violations, rule_id):
    """Assert that no violation with given rule_id exists."""
    found = [v for v in violations if v.get("rule_id") == rule_id]
    assert len(found) == 0, f"Unexpected violation '{rule_id}' found {len(found)} times."
