"""
Các lớp Scanner mã nguồn (Regex và Python AST).
Tách ra từ verification.py để dễ bảo trì và test độc lập.
"""

import ast
import re


def _build_flat_meta(rules_list):
    """Tạo dict {rule_id: rule_object} để tra cứu nhanh."""
    return {r["id"]: r for r in rules_list}


class BaseScanner:
    """Lớp cơ sở cho các loại quét mã nguồn khác nhau."""

    def scan(self, file_path, content, lines, tree, rules):
        return []


class RegexScanner(BaseScanner):
    """Quét dựa trên biểu thức chính quy (Regex).
    Duyệt qua tất cả rule có khối 'regex' không null trong mảng 'rules'.
    """

    # Cache compiled regex patterns để tránh recompile cho mỗi file
    _pattern_cache = {}

    def scan(self, file_path, content, lines, tree, rules):
        violations = []
        disabled_ids = rules.get("disabled_ids", [])

        for r in rules.get("rules", []):
            rule_id = r.get("id")
            if rule_id in disabled_ids:
                continue
            regex_cfg = r.get("regex")
            if not regex_cfg:
                continue
            try:
                pattern_str = regex_cfg["pattern"]
                if pattern_str not in self._pattern_cache:
                    if len(self._pattern_cache) >= 1024:
                        self._pattern_cache.clear()  # Ngăn tràn RAM do cài đặt vòng lặp vô tận Regex
                    self._pattern_cache[pattern_str] = re.compile(pattern_str)
                pattern = self._pattern_cache[pattern_str]
                for match in pattern.finditer(content):
                    start_idx = match.start()
                    line_no = content[:start_idx].count("\n") + 1
                    snippet = "\n".join(
                        lines[max(0, line_no - 2) : min(len(lines), line_no + 1)]
                    )
                    violations.append(
                        {
                            "file": file_path,
                            "type": r.get("pillar", "Maintainability"),
                            "reason": r.get("reason", ""),
                            "weight": r.get("weight", -2.0),
                            "rule_id": rule_id,
                            "line": line_no,
                            "snippet": snippet,
                            "severity": r.get("severity", "Minor"),
                            "debt": r.get("debt", 10),
                            "ai_prompt": (
                                r.get("ai", {}).get("prompt") if r.get("ai") else None
                            ),
                        }
                    )
            except Exception:
                continue
        return violations


class PythonASTScanner(BaseScanner):
    """Quét dựa trên cây cú pháp AST của Python.
    Duyệt qua tất cả rule có khối 'ast' không null trong mảng 'rules'.
    """

    def calculate_complexity(self, node):
        complexity = 1
        for child in ast.walk(node):
            if isinstance(
                child,
                (
                    ast.If,
                    ast.While,
                    ast.For,
                    ast.And,
                    ast.Or,
                    ast.ExceptHandler,
                    ast.With,
                ),
            ):
                complexity += 1
        return complexity

    def _make_violation(self, file_path, rule, line_no, snippet, reason_override=None):
        return {
            "file": file_path,
            "type": rule.get("pillar", "Maintainability"),
            "reason": reason_override or rule.get("reason", ""),
            "weight": rule.get("weight", -2.0),
            "rule_id": rule.get("id", ""),
            "line": line_no,
            "snippet": snippet,
            "severity": rule.get("severity", "Minor"),
            "debt": rule.get("debt", 10),
            "ai_prompt": rule.get("ai", {}).get("prompt") if rule.get("ai") else None,
        }

    def scan(self, file_path, content, lines, tree, rules):
        if tree is None:
            return []

        violations = []
        disabled_ids = rules.get("disabled_ids", [])
        ast_rules_by_type = {}
        dangerous_functions_rules = []

        for r in rules.get("rules", []):
            if r.get("id") in disabled_ids:
                continue
            ast_cfg = r.get("ast")
            if not ast_cfg:
                continue
            ast_type = ast_cfg.get("type")
            if ast_type == "dangerous_functions":
                dangerous_functions_rules.append(r)
            elif ast_type:
                ast_rules_by_type[ast_type] = r

        dangerous_funcs = {}
        for df_rule in dangerous_functions_rules:
            for target in df_rule.get("ast", {}).get("targets", []):
                dangerous_funcs[target["name"]] = (df_rule, target)

        for parent_node in ast.walk(tree):
            for child in ast.iter_child_nodes(parent_node):
                child.parent = parent_node

        imported_names = set()
        used_names = set()

        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler):
                self._check_exceptions(
                    node, file_path, lines, ast_rules_by_type, violations
                )
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                self._check_functions(
                    node, file_path, lines, ast_rules_by_type, violations
                )
            elif isinstance(node, ast.Call):
                self._check_calls(
                    node,
                    file_path,
                    lines,
                    ast_rules_by_type,
                    dangerous_funcs,
                    violations,
                )
            elif isinstance(node, (ast.For, ast.While, ast.AsyncFor)):
                self._check_loops(node, file_path, lines, ast_rules_by_type, violations)
            elif isinstance(node, ast.Import):
                for n in node.names:
                    imported_names.add((n.asname or n.name, node.lineno))
            elif isinstance(node, ast.ImportFrom):
                for n in node.names:
                    imported_names.add((n.asname or n.name, node.lineno))
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)

        self._check_unused_imports(
            tree, file_path, lines, disabled_ids, imported_names, used_names, violations
        )

        return violations

    def _except_body_has_handling(self, node):
        """Kiểm tra xem except body có xử lý thực sự hay chỉ pass/rỗng.
        Bất kỳ statement nào khác pass (logging, raise, assignment, ...) đều tính là có xử lý.
        """
        if not node.body:
            return False
        if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            return False
        return True

    def _check_exceptions(self, node, file_path, lines, ast_rules_by_type, violations):
        # 1. Bare except: except:
        is_bare = node.type is None

        # 2. General Exception: except Exception: or except Exception as e:
        is_general_exception = False
        if node.type is not None:
            if isinstance(node.type, ast.Name) and node.type.id == "Exception":
                is_general_exception = True
            elif isinstance(node.type, ast.Attribute) and node.type.attr == "Exception":
                is_general_exception = True

        if is_bare or is_general_exception:
            # Chỉ phạt nếu body không xử lý gì (chỉ pass hoặc rỗng)
            # Logging, raise, hay bất kỳ statement nào đều tính là đã xử lý → bỏ qua
            if not self._except_body_has_handling(node):
                rule = ast_rules_by_type.get("bare_except")
                if rule:
                    snippet = "\n".join(
                        lines[
                            max(0, node.lineno - 2) : min(len(lines), node.lineno + 1)
                        ]
                    )
                    reason = (
                        "Bắt ngoại lệ quá chung chung và không xử lý gì (Exception hoặc Bare except)"
                        if is_general_exception
                        else rule.get("reason")
                    )
                    violations.append(
                        self._make_violation(
                            file_path,
                            rule,
                            node.lineno,
                            snippet,
                            reason_override=reason,
                        )
                    )

        if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            rule = ast_rules_by_type.get("swallowed_exception")
            if rule:
                snippet = "\n".join(
                    lines[max(0, node.lineno - 2) : min(len(lines), node.lineno + 1)]
                )
                violations.append(
                    self._make_violation(file_path, rule, node.lineno, snippet)
                )

    def _check_functions(self, node, file_path, lines, ast_rules_by_type, violations):
        rule = ast_rules_by_type.get("max_function_length")
        if rule:
            limit = rule.get("ast", {}).get("limit", rule.get("limit", 80))
            if node.end_lineno - node.lineno > limit:
                snippet = "\n".join(
                    lines[max(0, node.lineno - 1) : min(len(lines), node.lineno + 2)]
                )
                violations.append(
                    self._make_violation(
                        file_path,
                        rule,
                        node.lineno,
                        snippet,
                        reason_override=f"{rule.get('reason')}: {node.name} (> {limit} lines)",
                    )
                )

        rule = ast_rules_by_type.get("complexity")
        if rule:
            limit = rule.get("ast", {}).get("limit", rule.get("limit", 12))
            complexity = self.calculate_complexity(node)
            if complexity > limit:
                snippet = "\n".join(
                    lines[max(0, node.lineno - 1) : min(len(lines), node.lineno + 2)]
                )
                violations.append(
                    self._make_violation(
                        file_path,
                        rule,
                        node.lineno,
                        snippet,
                        reason_override=f"{rule.get('reason')}: {node.name} (Complexity: {complexity} > {limit})",
                    )
                )

        rule = ast_rules_by_type.get("max_parameters")
        if rule:
            limit = rule.get("ast", {}).get("limit", rule.get("limit", 7))
            num_args = len(node.args.args) + len(node.args.kwonlyargs)
            if getattr(node.args, "vararg", None):
                num_args += 1
            if getattr(node.args, "kwarg", None):
                num_args += 1
            if num_args > limit:
                snippet = "\n".join(
                    lines[max(0, node.lineno - 1) : min(len(lines), node.lineno + 2)]
                )
                violations.append(
                    self._make_violation(
                        file_path,
                        rule,
                        node.lineno,
                        snippet,
                        reason_override=f"{rule.get('reason')}: {node.name} ({num_args} > {limit})",
                    )
                )

    def _check_calls(
        self, node, file_path, lines, ast_rules_by_type, dangerous_funcs, violations
    ):
        func_name = ""
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name):
                func_name = f"{node.func.value.id}.{node.func.attr}"

        if func_name in dangerous_funcs:
            base_rule, target_cfg = dangerous_funcs[func_name]

            if func_name == "print" and base_rule.get("id") == "PRINT_STATEMENT":
                import os

                basename = os.path.basename(file_path)
                if (
                    "/tests/" in file_path.replace("\\", "/")
                    or basename.startswith("test_")
                    or basename.endswith("_test.py")
                ):
                    return

                in_main_guard = False
                parent = getattr(node, "parent", None)
                while parent:
                    if isinstance(parent, ast.If):
                        test = parent.test
                        if (
                            isinstance(test, ast.Compare)
                            and isinstance(test.left, ast.Name)
                            and test.left.id == "__name__"
                            and len(test.comparators) == 1
                            and isinstance(test.comparators[0], ast.Constant)
                            and test.comparators[0].value == "__main__"
                        ):
                            in_main_guard = True
                            break
                    parent = getattr(parent, "parent", None)
                if in_main_guard:
                    return

            snippet = "\n".join(
                lines[max(0, node.lineno - 2) : min(len(lines), node.lineno + 1)]
            )
            merged_rule = {
                **base_rule,
                "reason": target_cfg.get("reason", base_rule.get("reason")),
            }
            if "weight" in target_cfg:
                merged_rule["weight"] = target_cfg["weight"]
            violations.append(
                self._make_violation(file_path, merged_rule, node.lineno, snippet)
            )

        if func_name == "open":
            rule = ast_rules_by_type.get("missing_with_open")
            if rule:
                is_with = False
                curr = node
                for _ in range(5):
                    if hasattr(curr, "parent"):
                        if isinstance(curr.parent, ast.With):
                            is_with = True
                            break
                        curr = curr.parent
                    else:
                        break
                if not is_with:
                    snippet = "\n".join(
                        lines[
                            max(0, node.lineno - 1) : min(len(lines), node.lineno + 2)
                        ]
                    )
                    violations.append(
                        self._make_violation(file_path, rule, node.lineno, snippet)
                    )

        if func_name in [
            "requests.get",
            "requests.post",
            "requests.put",
            "requests.delete",
            "requests.patch",
            "httpx.get",
        ]:
            rule = ast_rules_by_type.get("missing_timeout")
            if rule:
                if not any(kw.arg == "timeout" for kw in node.keywords):
                    snippet = "\n".join(
                        lines[
                            max(0, node.lineno - 1) : min(len(lines), node.lineno + 2)
                        ]
                    )
                    violations.append(
                        self._make_violation(file_path, rule, node.lineno, snippet)
                    )

    def _check_loops(self, node, file_path, lines, ast_rules_by_type, violations):
        rule = ast_rules_by_type.get("n_plus_one_query")
        if not rule:
            return

        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Call):
                func_name_parts = []
                curr = subnode.func
                while isinstance(curr, ast.Attribute):
                    func_name_parts.insert(0, curr.attr)
                    curr = curr.value
                if isinstance(curr, ast.Name):
                    func_name_parts.insert(0, curr.id)
                full_call = ".".join(func_name_parts)
                if (
                    "objects.get" in full_call
                    or "objects.filter" in full_call
                    or "objects.all" in full_call
                    or full_call.endswith(".execute")
                    or full_call.startswith("requests.")
                    or full_call.startswith("httpx.")
                ):
                    snippet = "\n".join(
                        lines[
                            max(0, subnode.lineno - 1) : min(
                                len(lines), subnode.lineno + 2
                            )
                        ]
                    )
                    violations.append(
                        self._make_violation(
                            file_path,
                            rule,
                            subnode.lineno,
                            snippet,
                            reason_override=f"{rule.get('reason')}. Found '{full_call}()' inside loop.",
                        )
                    )
                    break

    def _check_unused_imports(
        self,
        tree,
        file_path,
        lines,
        disabled_ids,
        imported_names,
        used_names,
        violations,
    ):
        if "UNUSED_IMPORT" in disabled_ids:
            return

        used_dotted_names = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute):
                parts = []
                curr = node
                while isinstance(curr, ast.Attribute):
                    parts.insert(0, curr.attr)
                    curr = curr.value
                if isinstance(curr, ast.Name):
                    parts.insert(0, curr.id)
                    for i in range(1, len(parts) + 1):
                        used_dotted_names.add(".".join(parts[:i]))

        for name, line_no in imported_names:
            root_name = name.split(".")[0]
            is_used = (
                name in used_names
                or name in used_dotted_names
                or root_name in used_dotted_names
            )
            if not is_used and name not in ["os", "sys", "json", "ast", "re"]:
                snippet = lines[line_no - 1] if line_no <= len(lines) else ""
                violations.append(
                    {
                        "file": file_path,
                        "type": "Maintainability",
                        "reason": f"Import '{name}' might be unused (AST)",
                        "weight": -0.5,
                        "rule_id": "UNUSED_IMPORT",
                        "line": line_no,
                        "snippet": snippet,
                        "severity": "Minor",
                        "debt": 5,
                        "ai_prompt": None,
                    }
                )

        return violations
