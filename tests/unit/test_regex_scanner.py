"""
Unit Tests — RegexScanner
Mỗi Regex rule trong rules.json đều có ít nhất 1 positive case (phát hiện) và 1 negative case (bỏ qua).
"""

import pytest
from tests.conftest import scan_code, assert_violation_found, assert_no_violation


class TestHardcodedSecret:
    """HARDCODED_SECRET — Phát hiện secret/password/token hardcode."""

    def test_password_string_detected(self, regex_scanner, regex_only_rules):
        code = 'DB_PASSWORD = "SuperSecretPass123!"'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "HARDCODED_SECRET")

    def test_env_var_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'DB_PASSWORD = os.getenv("DB_PASSWORD")'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "HARDCODED_SECRET")

    def test_short_value_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'token = "abc"'  # < 10 chars, should not match
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "HARDCODED_SECRET")

    def test_api_key_detected(self, regex_scanner, regex_only_rules):
        code = 'API_KEY = "sk-1234567890abcdefghij"'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "HARDCODED_SECRET")


class TestDjangoDebug:
    """DJANGO_DEBUG — Phát hiện DEBUG = True."""

    def test_debug_true_detected(self, regex_scanner, regex_only_rules):
        code = "DEBUG = True"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "DJANGO_DEBUG")

    def test_debug_false_not_flagged(self, regex_scanner, regex_only_rules):
        code = "DEBUG = False"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "DJANGO_DEBUG")


class TestSqlInjection:
    """SQL_INJECTION — Phát hiện SQL injection qua f-string/format."""

    def test_fstring_execute_detected(self, regex_scanner, regex_only_rules):
        code = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "SQL_INJECTION")

    def test_format_execute_detected(self, regex_scanner, regex_only_rules):
        code = 'cursor.execute("SELECT * FROM users WHERE id = {}".format(user_id))'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "SQL_INJECTION")

    def test_parameterized_query_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "SQL_INJECTION")


class TestInsecureHash:
    """INSECURE_HASH — Phát hiện MD5/SHA1."""

    def test_md5_detected(self, regex_scanner, regex_only_rules):
        code = "import hashlib\nhash_val = hashlib.md5(data)"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "INSECURE_HASH")

    def test_sha256_not_flagged(self, regex_scanner, regex_only_rules):
        code = "import hashlib\nhash_val = hashlib.sha256(data)"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "INSECURE_HASH")


class TestXssDanger:
    """XSS_DANGER — Phát hiện innerHTML gán trực tiếp."""

    def test_innerhtml_detected(self, regex_scanner, regex_only_rules):
        code = 'element.innerHTML = user_input'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "XSS_DANGER")

    def test_textcontent_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'element.textContent = user_input'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "XSS_DANGER")


class TestVerifyFalse:
    """VERIFY_FALSE — Phát hiện verify=False trong requests."""

    def test_verify_false_detected(self, regex_scanner, regex_only_rules):
        code = 'requests.get(url, verify=False)'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "VERIFY_FALSE")

    def test_verify_true_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'requests.get(url, verify=True)'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "VERIFY_FALSE")


class TestUnrestrictedCors:
    """UNRESTRICTED_CORS — Phát hiện CORS cho phép tất cả origins."""

    def test_wildcard_cors_detected(self, regex_scanner, regex_only_rules):
        code = 'allow_origins=["*"]'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "UNRESTRICTED_CORS")

    def test_specific_origin_not_flagged(self, regex_scanner, regex_only_rules):
        code = 'allow_origins=["https://example.com"]'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "UNRESTRICTED_CORS")


class TestSelectStar:
    """SELECT_STAR — Phát hiện SELECT * trong queries."""

    def test_select_star_detected(self, regex_scanner, regex_only_rules):
        code = 'cursor.execute("SELECT * FROM users")'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "SELECT_STAR")


class TestIterrowsUse:
    """ITERROWS_USE — Phát hiện df.iterrows() chậm."""

    def test_iterrows_detected(self, regex_scanner, regex_only_rules):
        code = "for _, row in df.iterrows():"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "ITERROWS_USE")


class TestMutableDefault:
    """MUTABLE_DEFAULT_ARGS — Phát hiện mutable default arguments."""

    def test_list_default_detected(self, regex_scanner, regex_only_rules):
        code = "def foo(items=[]):\n    pass"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "MUTABLE_DEFAULT_ARGS")

    def test_dict_default_detected(self, regex_scanner, regex_only_rules):
        code = "def foo(config={}):\n    pass"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "MUTABLE_DEFAULT_ARGS")

    def test_none_default_not_flagged(self, regex_scanner, regex_only_rules):
        code = "def foo(items=None):\n    pass"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "MUTABLE_DEFAULT_ARGS")


class TestForgottenTodo:
    """FORGOTTEN_TODO — Phát hiện TODO/FIXME/HACK comments."""

    def test_todo_detected(self, regex_scanner, regex_only_rules):
        code = "# TODO: fix this later"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "FORGOTTEN_TODO")

    def test_fixme_detected(self, regex_scanner, regex_only_rules):
        code = "# FIXME: urgent bug"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "FORGOTTEN_TODO")


class TestCommentedOutCode:
    """COMMENTED_OUT_CODE — Phát hiện code bị comment out."""

    def test_commented_code_detected(self, regex_scanner, regex_only_rules):
        # Pattern cần 5+ dòng comment liên tiếp
        code = "# result = db.query(user_id)\n# if result:\n#     return result\n# else:\n#     return None\n# end"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "COMMENTED_OUT_CODE")


class TestHardcodedIp:
    """HARDCODED_IP_ADDRESS — Phát hiện IP address hardcode."""

    def test_ip_detected(self, regex_scanner, regex_only_rules):
        code = 'server_ip = "192.168.1.100"'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "HARDCODED_IP_ADDRESS")


class TestPep8WildcardImport:
    """PEP8_WILDCARD_IMPORT — Phát hiện from module import *."""

    def test_wildcard_import_detected(self, regex_scanner, regex_only_rules):
        code = "from os import *"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "PEP8_WILDCARD_IMPORT")

    def test_specific_import_not_flagged(self, regex_scanner, regex_only_rules):
        code = "from os import path"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "PEP8_WILDCARD_IMPORT")


class TestPep8LambdaAssignment:
    """PEP8_LAMBDA_ASSIGNMENT — Phát hiện gán lambda vào biến."""

    def test_lambda_assignment_detected(self, regex_scanner, regex_only_rules):
        code = "square = lambda x: x ** 2"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_violation_found(violations, "PEP8_LAMBDA_ASSIGNMENT")

    def test_inline_lambda_not_flagged(self, regex_scanner, regex_only_rules):
        code = "sorted(items, key=lambda x: x.name)"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        assert_no_violation(violations, "PEP8_LAMBDA_ASSIGNMENT")


class TestDisabledRules:
    """Test: disabled rules should be skipped entirely."""

    def test_disabled_rule_skipped(self, regex_scanner, disabled_rules):
        code = 'API_KEY = "sk-1234567890abcdefghij"'
        violations = scan_code(regex_scanner, code, disabled_rules)
        assert_no_violation(violations, "HARDCODED_SECRET")


class TestRegexScannerEdgeCases:
    """Edge cases for RegexScanner."""

    def test_empty_code(self, regex_scanner, regex_only_rules):
        violations = scan_code(regex_scanner, "", regex_only_rules)
        assert len(violations) == 0

    def test_binary_content_no_crash(self, regex_scanner, regex_only_rules):
        """Scanner should not crash on non-Python content."""
        code = "\x00\x01\x02\x03 binary content"
        violations = scan_code(regex_scanner, code, regex_only_rules)
        # Just verify no exception

    def test_violation_metadata(self, regex_scanner, regex_only_rules):
        """Verify violation dict has all required keys."""
        code = 'DB_PASSWORD = "SuperSecretPass123!"'
        violations = scan_code(regex_scanner, code, regex_only_rules)
        v = violations[0]
        required_keys = {"file", "type", "reason", "weight", "rule_id", "line", "snippet", "severity", "debt"}
        assert required_keys.issubset(set(v.keys())), f"Missing keys: {required_keys - set(v.keys())}"
        assert v["line"] == 1
        assert v["severity"] == "Blocker"
        assert v["weight"] < 0
