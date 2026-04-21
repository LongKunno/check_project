"""
Unit Tests — PythonASTScanner
Test từng AST check function với các trường hợp positive/negative.
"""

import pytest
from tests.conftest import scan_code, assert_violation_found, assert_no_violation


class TestBareExcept:
    """BARE_EXCEPT — except: hoặc except Exception: không xử lý."""

    def test_bare_except_with_pass_is_reported_once_as_swallowed(
        self, ast_scanner, ast_only_rules
    ):
        code = """
try:
    risky()
except:
    pass
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "SWALLOWED_EXCEPTION")
        assert_no_violation(violations, "BARE_EXCEPT")

    def test_except_exception_with_pass_is_reported_once_as_swallowed(
        self, ast_scanner, ast_only_rules
    ):
        code = """
try:
    risky()
except Exception:
    pass
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "SWALLOWED_EXCEPTION")
        assert_no_violation(violations, "BARE_EXCEPT")

    def test_except_with_logging_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
try:
    risky()
except Exception as e:
    logger.error(f"Error: {e}")
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "BARE_EXCEPT")

    def test_except_with_raise_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
try:
    risky()
except:
    raise
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "BARE_EXCEPT")

    def test_specific_exception_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
try:
    risky()
except ValueError:
    pass
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "BARE_EXCEPT")


class TestSwallowedException:
    """SWALLOWED_EXCEPTION — except: pass (nuốt lỗi)."""

    def test_except_pass_detected(self, ast_scanner, ast_only_rules):
        code = """
try:
    risky()
except ValueError:
    pass
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "SWALLOWED_EXCEPTION")

    def test_except_with_body_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
try:
    risky()
except ValueError as e:
    log(e)
    return None
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "SWALLOWED_EXCEPTION")

    def test_swallowed_exception_does_not_double_report_bare_except(
        self, ast_scanner, ast_only_rules
    ):
        code = """
try:
    risky()
except Exception:
    pass
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        relevant = [
            violation["rule_id"]
            for violation in violations
            if violation["rule_id"] in {"BARE_EXCEPT", "SWALLOWED_EXCEPTION"}
        ]

        assert relevant == ["SWALLOWED_EXCEPTION"]


class TestGodObject:
    """GOD_OBJECT (max_function_length) — Hàm quá dài."""

    def test_long_function_detected(self, ast_scanner, ast_only_rules):
        # GOD_OBJECT limit = 150 trong rules.json
        body_lines = "\n".join([f"    x_{i} = {i}" for i in range(160)])
        code = f"def very_long_function():\n{body_lines}\n    return x_0"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "GOD_OBJECT")

    def test_short_function_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
def short_function():
    x = 1
    y = 2
    return x + y
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "GOD_OBJECT")


class TestHighComplexity:
    """HIGH_COMPLEXITY — Cyclomatic Complexity > 12."""

    def test_complex_function_detected(self, ast_scanner, ast_only_rules):
        # HIGH_COMPLEXITY limit = 25 trong rules.json
        conditions = "\n".join([f"    if x == {i}:\n        pass" for i in range(30)])
        code = f"def complex_func(x):\n{conditions}\n    return x"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "HIGH_COMPLEXITY")

    def test_simple_function_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
def simple_func(x):
    if x > 0:
        return x
    return 0
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "HIGH_COMPLEXITY")


class TestTooManyParams:
    """TOO_MANY_PARAMS — Hàm nhận quá nhiều tham số (> 7)."""

    def test_many_params_detected(self, ast_scanner, ast_only_rules):
        # TOO_MANY_PARAMS limit = 12 trong rules.json
        code = "def func(a, b, c, d, e, f, g, h, i, j, k, l, m):\n    pass"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "TOO_MANY_PARAMS")

    def test_few_params_not_flagged(self, ast_scanner, ast_only_rules):
        code = "def func(a, b, c):\n    pass"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "TOO_MANY_PARAMS")

    def test_kwargs_counted(self, ast_scanner, ast_only_rules):
        # 10 normal + vararg + kwarg = 12, cần > 12 để bị flag
        code = "def func(a, b, c, d, e, f, g, h, i, j, k, *args, **kwargs):\n    pass"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "TOO_MANY_PARAMS")


class TestDangerousFunctions:
    """DANGEROUS_FUNC — eval(), exec(), compile()."""

    def test_eval_detected(self, ast_scanner, ast_only_rules):
        code = "result = eval(user_input)"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "DANGEROUS_FUNC")

    def test_exec_detected(self, ast_scanner, ast_only_rules):
        code = "exec(code_string)"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "DANGEROUS_FUNC")


class TestPrintStatement:
    """PRINT_STATEMENT — print() trong production code."""

    def test_print_detected(self, ast_scanner, ast_only_rules):
        # PRINT_STATEMENT dùng type=dangerous_functions, cần code trong function
        # không ở trong test file và không ở __main__
        code = "def process():\n    print('debug output')\n    return True"
        violations = scan_code(ast_scanner, code, ast_only_rules, filename="app/main.py")
        assert_violation_found(violations, "PRINT_STATEMENT")

    def test_print_in_test_not_flagged(self, ast_scanner, ast_only_rules):
        code = "print('test output')"
        violations = scan_code(ast_scanner, code, ast_only_rules, filename="tests/test_foo.py")
        assert_no_violation(violations, "PRINT_STATEMENT")

    def test_print_in_main_guard_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
if __name__ == "__main__":
    print("running main")
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "PRINT_STATEMENT")


class TestNPlusOneQuery:
    """N_PLUS_ONE — Database query trong loop."""

    def test_query_in_loop_detected(self, ast_scanner, ast_only_rules):
        code = """
for user_id in user_ids:
    user = User.objects.get(id=user_id)
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "N_PLUS_ONE")

    def test_query_outside_loop_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
users = User.objects.filter(active=True)
for user in users:
    process(user)
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "N_PLUS_ONE")


class TestMissingTimeout:
    """NO_TIMEOUT_SET — requests.get() without timeout."""

    def test_no_timeout_detected(self, ast_scanner, ast_only_rules):
        code = "import requests\nresponse = requests.get(url)"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "NO_TIMEOUT_SET")

    def test_with_timeout_not_flagged(self, ast_scanner, ast_only_rules):
        code = "import requests\nresponse = requests.get(url, timeout=30)"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "NO_TIMEOUT_SET")


class TestMissingWithOpen:
    """MEMORY_LEAK_OPEN — open() without 'with' statement."""

    def test_open_without_with_detected(self, ast_scanner, ast_only_rules):
        code = "f = open('file.txt', 'r')"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "MEMORY_LEAK_OPEN")

    def test_open_with_with_not_flagged(self, ast_scanner, ast_only_rules):
        code = """
with open('file.txt', 'r') as f:
    data = f.read()
"""
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "MEMORY_LEAK_OPEN")


class TestUnusedImport:
    """UNUSED_IMPORT — Import không sử dụng."""

    def test_unused_import_detected(self, ast_scanner, ast_only_rules):
        code = "import collections\nx = 1"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_violation_found(violations, "UNUSED_IMPORT")

    def test_used_import_not_flagged(self, ast_scanner, ast_only_rules):
        code = "import collections\nd = collections.OrderedDict()"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "UNUSED_IMPORT")

    def test_from_import_used_not_flagged(self, ast_scanner, ast_only_rules):
        code = "from pathlib import Path\np = Path('.')"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert_no_violation(violations, "UNUSED_IMPORT")


class TestASTDisabledRules:
    """Test disabled rules are skipped by AST scanner."""

    def test_disabled_print_skipped(self, ast_scanner, disabled_rules):
        code = "def process():\n    print('debug')"
        violations = scan_code(ast_scanner, code, disabled_rules)
        assert_no_violation(violations, "PRINT_STATEMENT")


class TestASTEdgeCases:
    """Edge cases for AST scanner."""

    def test_syntax_error_returns_empty(self, ast_scanner, ast_only_rules):
        code = "def broken(::\n    pass"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        assert len(violations) == 0

    def test_empty_code(self, ast_scanner, ast_only_rules):
        violations = scan_code(ast_scanner, "", ast_only_rules)
        assert len(violations) == 0

    def test_violation_metadata_complete(self, ast_scanner, ast_only_rules):
        code = "result = eval(user_input)"
        violations = scan_code(ast_scanner, code, ast_only_rules)
        v = violations[0]
        required_keys = {"file", "type", "reason", "weight", "rule_id", "line", "snippet", "severity", "debt"}
        assert required_keys.issubset(set(v.keys())), f"Missing keys: {required_keys - set(v.keys())}"
