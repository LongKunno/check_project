import ast
import re
import os
import json
import subprocess
import sys


def _build_flat_meta(rules_list):
    """Tạo dict {rule_id: rule_object} để tra cứu nhanh."""
    return {r['id']: r for r in rules_list}


class BaseScanner:
    """Lớp cơ sở cho các loại quét mã nguồn khác nhau."""
    def scan(self, file_path, content, lines, tree, rules):
        return []

class RegexScanner(BaseScanner):
    """Quét dựa trên biểu thức chính quy (Regex).
    Duyệt qua tất cả rule có khối 'regex' không null trong mảng 'rules'.
    """
    def scan(self, file_path, content, lines, tree, rules):
        violations = []
        disabled_ids = rules.get('disabled_ids', [])

        for r in rules.get('rules', []):
            rule_id = r.get('id')
            if rule_id in disabled_ids:
                continue
            regex_cfg = r.get('regex')
            if not regex_cfg:
                continue
            try:
                pattern = re.compile(regex_cfg['pattern'])
                for match in pattern.finditer(content):
                    start_idx = match.start()
                    line_no = content[:start_idx].count('\n') + 1
                    snippet = "\n".join(lines[max(0, line_no-2):min(len(lines), line_no+1)])
                    violations.append({
                        "file": file_path,
                        "type": r.get('pillar', 'Maintainability'),
                        "reason": r.get('reason', ''),
                        "weight": r.get('weight', -2.0),
                        "rule_id": rule_id,
                        "line": line_no,
                        "snippet": snippet,
                        "severity": r.get('severity', 'Minor'),
                        "debt": r.get('debt', 10),
                        "ai_prompt": r.get('ai', {}).get('prompt') if r.get('ai') else None
                    })
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
            if isinstance(child, (ast.If, ast.While, ast.For, ast.And, ast.Or, ast.ExceptHandler, ast.With)):
                complexity += 1
        return complexity

    def _make_violation(self, file_path, rule, line_no, snippet, reason_override=None):
        return {
            "file": file_path,
            "type": rule.get('pillar', 'Maintainability'),
            "reason": reason_override or rule.get('reason', ''),
            "weight": rule.get('weight', -2.0),
            "rule_id": rule.get('id', ''),
            "line": line_no,
            "snippet": snippet,
            "severity": rule.get('severity', 'Minor'),
            "debt": rule.get('debt', 10),
            "ai_prompt": rule.get('ai', {}).get('prompt') if rule.get('ai') else None
        }

    def scan(self, file_path, content, lines, tree, rules):
        if tree is None:
            return []

        violations = []
        disabled_ids = rules.get('disabled_ids', [])

        # Xây dựng bảng tra cứu rule theo ast.type
        ast_rules_by_type = {}
        dangerous_functions_rule = None

        for r in rules.get('rules', []):
            if r.get('id') in disabled_ids:
                continue
            ast_cfg = r.get('ast')
            if not ast_cfg:
                continue
            ast_type = ast_cfg.get('type')
            if ast_type == 'dangerous_functions':
                dangerous_functions_rule = r
            elif ast_type:
                ast_rules_by_type[ast_type] = r

        # Xây dựng map tên hàm nguy hiểm -> (rule, target_config)
        dangerous_funcs = {}
        if dangerous_functions_rule:
            for target in dangerous_functions_rule.get('ast', {}).get('targets', []):
                dangerous_funcs[target['name']] = (dangerous_functions_rule, target)

        # Bổ sung quan hệ Parent-Child cho cây AST
        for parent_node in ast.walk(tree):
            for child in ast.iter_child_nodes(parent_node):
                child.parent = parent_node

        imported_names = set()
        used_names = set()

        for node in ast.walk(tree):

            # --- BARE EXCEPT & SWALLOWED EXCEPTION ---
            if isinstance(node, ast.ExceptHandler):
                if node.type is None:
                    rule = ast_rules_by_type.get('bare_except')
                    if rule:
                        snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                        violations.append(self._make_violation(file_path, rule, node.lineno, snippet))

                if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    rule = ast_rules_by_type.get('swallowed_exception')
                    if rule:
                        snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                        violations.append(self._make_violation(file_path, rule, node.lineno, snippet))

            # --- FUNCTION-LEVEL CHECKS ---
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # max_function_length
                rule = ast_rules_by_type.get('max_function_length')
                if rule:
                    limit = rule.get('ast', {}).get('limit', rule.get('limit', 80))
                    if node.end_lineno - node.lineno > limit:
                        snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                        violations.append(self._make_violation(
                            file_path, rule, node.lineno, snippet,
                            reason_override=f"{rule.get('reason')}: {node.name} (> {limit} lines)"
                        ))

                # complexity
                rule = ast_rules_by_type.get('complexity')
                if rule:
                    limit = rule.get('ast', {}).get('limit', rule.get('limit', 12))
                    complexity = self.calculate_complexity(node)
                    if complexity > limit:
                        snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                        violations.append(self._make_violation(
                            file_path, rule, node.lineno, snippet,
                            reason_override=f"{rule.get('reason')}: {node.name} (Complexity: {complexity} > {limit})"
                        ))

                # max_parameters
                rule = ast_rules_by_type.get('max_parameters')
                if rule:
                    limit = rule.get('ast', {}).get('limit', rule.get('limit', 7))
                    num_args = len(node.args.args) + len(node.args.kwonlyargs)
                    if getattr(node.args, 'vararg', None): num_args += 1
                    if getattr(node.args, 'kwarg', None): num_args += 1
                    if num_args > limit:
                        snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                        violations.append(self._make_violation(
                            file_path, rule, node.lineno, snippet,
                            reason_override=f"{rule.get('reason')}: {node.name} ({num_args} > {limit})"
                        ))

            # --- CALL-LEVEL CHECKS ---
            if isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name):
                        func_name = f"{node.func.value.id}.{node.func.attr}"

                # Dangerous functions
                if func_name in dangerous_funcs:
                    base_rule, target_cfg = dangerous_funcs[func_name]
                    snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                    # Tạo bản sao rule với reason và weight riêng của từng target
                    merged_rule = {**base_rule, "reason": target_cfg.get('reason', base_rule.get('reason'))}
                    if 'weight' in target_cfg:
                        merged_rule['weight'] = target_cfg['weight']
                    violations.append(self._make_violation(file_path, merged_rule, node.lineno, snippet))

                # missing_with_open
                if func_name == 'open':
                    rule = ast_rules_by_type.get('missing_with_open')
                    if rule:
                        is_with = False
                        curr = node
                        for _ in range(5):
                            if hasattr(curr, 'parent'):
                                if isinstance(curr.parent, ast.With):
                                    is_with = True
                                    break
                                curr = curr.parent
                            else:
                                break
                        if not is_with:
                            snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                            violations.append(self._make_violation(file_path, rule, node.lineno, snippet))

                # missing_timeout
                if func_name in ['requests.get', 'requests.post', 'requests.put', 'requests.delete', 'requests.patch', 'httpx.get']:
                    rule = ast_rules_by_type.get('missing_timeout')
                    if rule:
                        has_timeout = any(kw.arg == 'timeout' for kw in node.keywords)
                        if not has_timeout:
                            snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                            violations.append(self._make_violation(file_path, rule, node.lineno, snippet))

            # --- N+1 QUERY ---
            if isinstance(node, (ast.For, ast.While, ast.AsyncFor)):
                rule = ast_rules_by_type.get('n_plus_one_query')
                if rule:
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
                                "objects.get" in full_call or
                                "objects.filter" in full_call or
                                "objects.all" in full_call or
                                full_call.endswith(".execute") or
                                full_call.startswith("requests.") or
                                full_call.startswith("httpx.")
                            ):
                                snippet = "\n".join(lines[max(0, subnode.lineno-1):min(len(lines), subnode.lineno+2)])
                                violations.append(self._make_violation(
                                    file_path, rule, subnode.lineno, snippet,
                                    reason_override=f"{rule.get('reason')}. Found '{full_call}()' inside loop."
                                ))
                                break

            # --- IMPORT TRACKING ---
            if isinstance(node, ast.Import):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.ImportFrom):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)

        # UNUSED_IMPORT (hardcoded vì không có rule AST cụ thể)
        if 'UNUSED_IMPORT' not in disabled_ids:
            for name, line_no in imported_names:
                if name not in used_names and name not in ['os', 'sys', 'json', 'ast', 're']:
                    snippet = lines[line_no-1] if line_no <= len(lines) else ""
                    violations.append({
                        "file": file_path, "type": "Maintainability",
                        "reason": f"Import '{name}' might be unused (AST)",
                        "weight": -0.5, "rule_id": "UNUSED_IMPORT", "line": line_no, "snippet": snippet,
                        "severity": "Minor", "debt": 5, "ai_prompt": None
                    })

        return violations


def detect_circular_dependencies(file_list, rules):
    """Phát hiện phụ thuộc vòng (Circular Import) ở cấp project."""
    disabled_ids = rules.get('disabled_ids', [])
    flat_meta = _build_flat_meta(rules.get('rules', []))
    circ_rule = flat_meta.get('CIRCULAR_DEPENDENCY')

    if not circ_rule or 'CIRCULAR_DEPENDENCY' in disabled_ids:
        return []

    imports_map = {}
    file_to_mod = {}
    mod_to_file = {}

    for f in file_list:
        if not f.endswith('.py'): continue
        mod_name = os.path.splitext(os.path.basename(f))[0]
        file_to_mod[f] = mod_name
        mod_to_file[mod_name] = f

    for f in file_list:
        if not f.endswith('.py'): continue
        try:
            with open(f, 'r', encoding='utf-8') as file:
                tree = ast.parse(file.read())
            deps = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for n in node.names: deps.add(n.name.split('.')[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module: deps.add(node.module.split('.')[0])
            imports_map[file_to_mod[f]] = list(deps.intersection(set(mod_to_file.keys())))
        except Exception:
            pass

    violations = []
    visited_fully = set()

    def dfs(node, path):
        if node in path:
            cycle = path[path.index(node):]
            if len(cycle) > 1:
                cycle_str = " -> ".join(cycle + [node])
                v = {
                    "file": mod_to_file[node],
                    "type": circ_rule.get('pillar', 'Maintainability'),
                    "reason": f"{circ_rule.get('reason')} ({cycle_str})",
                    "weight": circ_rule.get('weight', -10),
                    "rule_id": 'CIRCULAR_DEPENDENCY',
                    "line": 1,
                    "snippet": cycle_str,
                    "severity": circ_rule.get('severity', 'Blocker'),
                    "debt": circ_rule.get('debt', 60),
                    "ai_prompt": circ_rule.get('ai', {}).get('prompt') if circ_rule.get('ai') else None
                }
                if not any(existing["snippet"] == cycle_str for existing in violations):
                    violations.append(v)
            return

        for neighbor in imports_map.get(node, []):
            if neighbor not in visited_fully:
                dfs(neighbor, path + [node])

        visited_fully.add(node)

    for mod in imports_map:
        if mod not in visited_fully:
            dfs(mod, [])

    return violations


def double_check_modular(file_list_json, rules_json):
    with open(rules_json, 'r', encoding='utf-8') as f:
        rules = json.load(f)

    with open(file_list_json, 'r', encoding='utf-8') as f:
        file_list = json.load(f)

    violations = []

    # 1. Project-level Architecture Scans
    try:
        circ_violations = detect_circular_dependencies(file_list, rules)
        violations.extend(circ_violations)
    except Exception as e:
        print(f"Error checking circular dependencies: {e}")

    # 2. File-level Scans
    scanners = [RegexScanner(), PythonASTScanner()]

    id_counter = 0
    for file_path in file_list:
        try:
            if not os.path.exists(file_path):
                continue

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()

                tree = None
                if file_path.endswith('.py'):
                    try: tree = ast.parse(content)
                    except SyntaxError: pass

                for scanner in scanners:
                    scan_results = scanner.scan(file_path, content, lines, tree, rules)
                    for v in scan_results:
                        v['id'] = f"v_{id_counter}"
                        violations.append(v)
                        id_counter += 1
        except Exception as e:
            print(f"Error scanning {file_path}: {e}")
            continue

    return violations


class VerificationStep:
    """
    Verification Phase (Step 3):
    Thực hiện phân tích sâu bằng AST và Regex để xác nhận vi phạm.
    Đọc rules dưới dạng Unified Schema (mảng 'rules' nguyên khối).
    """
    def __init__(self, target_dir, file_list, custom_rules=None):
        self.target_dir = target_dir
        self.file_list = file_list
        self.custom_rules = custom_rules
        self.verification_script = os.path.join(target_dir, 'ai_double_check.py')
        self.file_list_json = os.path.join(target_dir, 'audit_files.json')
        self.rules_json_path = os.path.join(target_dir, 'audit_rules.json')
        self.config_rules_path = os.path.join(os.path.dirname(__file__), 'rules.json')

    def load_rules(self):
        """Loads và merges default rules với custom rules (theo Unified Schema)."""
        with open(self.config_rules_path, 'r', encoding='utf-8') as f:
            merged = json.load(f)  # {rules: [...]}

        disabled_ids = []
        if self.custom_rules:
            disabled_ids = self.custom_rules.get('disabled_core_rules', [])

        merged['disabled_ids'] = disabled_ids

        if not self.custom_rules:
            return merged

        # Lọc bỏ các luật bị người dùng disabled (Toggled off)
        if disabled_ids:
            merged['rules'] = [r for r in merged.get('rules', []) if r.get('id') not in disabled_ids]

        # Áp dụng Custom Weights (đổi trọng số theo từng rule ID)
        custom_weights = self.custom_rules.get('custom_weights', {})
        if custom_weights:
            for r in merged.get('rules', []):
                r_id = r.get('id')
                if r_id and r_id in custom_weights:
                    r['weight'] = float(custom_weights[r_id])

        # Merge thêm Custom Rules (do AI Compiler sinh ra)
        custom = self.custom_rules.get('compiled_json')
        if custom:
            extra_rules = custom.get('rules', [])
            if extra_rules:
                merged.setdefault('rules', []).extend(extra_rules)
            else:
                # Hỗ trợ schema cũ (compiled_json có regex_rules/ast_rules)
                for r in custom.get('regex_rules', []):
                    merged.setdefault('rules', []).append({
                        "id": r.get('id', 'CUSTOM_REGEX'),
                        "pillar": r.get('pillar', 'Maintainability'),
                        "category": r.get('pillar', 'Maintainability'),
                        "severity": r.get('severity', 'Minor'),
                        "debt": r.get('debt', 10),
                        "reason": r.get('reason', 'Custom Rule'),
                        "weight": r.get('weight', -2.0),
                        "regex": {"pattern": r.get('pattern', '')},
                        "ast": None,
                        "ai": None
                    })
                if isinstance(custom.get('ast_rules'), list):
                    for r in custom.get('ast_rules', []):
                        node_name = r.get('name') or r.get('id', 'custom')
                        merged.setdefault('rules', []).append({
                            "id": r.get('id', f'CUSTOM_{node_name.upper()}'),
                            "pillar": r.get('pillar', 'Maintainability'),
                            "category": r.get('pillar', 'Maintainability'),
                            "severity": r.get('severity', 'Minor'),
                            "debt": r.get('debt', 10),
                            "reason": r.get('reason', 'Custom AI Rule'),
                            "weight": r.get('weight', -2.0),
                            "regex": None,
                            "ast": {"type": "dangerous_functions", "targets": [{"name": node_name, "reason": r.get('reason', '')}]},
                            "ai": None
                        })

        return merged

    def generate_verification_script(self):
        import inspect

        script_code = inspect.getsource(BaseScanner) + "\n"
        script_code += inspect.getsource(_build_flat_meta) + "\n"
        script_code += inspect.getsource(RegexScanner) + "\n"
        script_code += inspect.getsource(PythonASTScanner) + "\n"
        script_code += inspect.getsource(detect_circular_dependencies) + "\n"
        script_code += inspect.getsource(double_check_modular) + "\n"

        final_script = f"""
import ast
import re
import json
import sys
import os

{script_code}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    result = double_check_modular(sys.argv[1], sys.argv[2])
    print(json.dumps(result))
"""
        with open(self.verification_script, 'w', encoding='utf-8') as f:
            f.write(final_script)

    def run_verification(self):
        self.generate_verification_script()
        try:
            file_paths = [f['path'] for f in self.file_list]
            with open(self.file_list_json, 'w', encoding='utf-8') as f:
                json.dump(file_paths, f)

            rules = self.load_rules()
            with open(self.rules_json_path, 'w', encoding='utf-8') as f:
                json.dump(rules, f)

            result = subprocess.run(
                ['python3', 'ai_double_check.py', 'audit_files.json', 'audit_rules.json'],
                cwd=self.target_dir,
                capture_output=True,
                text=True,
                check=True
            )
            stdout_lines = [l.strip() for l in result.stdout.split('\n') if l.strip()]
            if not stdout_lines:
                return []
            try:
                return json.loads(stdout_lines[-1])
            except json.JSONDecodeError as jde:
                raise ValueError(f"AI Audit Output Error: Expected JSON but got: '{stdout_lines[-1][:100]}...'. Error: {jde}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Verification script failed: {e.stderr}")
            raise
        finally:
            for f in [self.verification_script, self.file_list_json, self.rules_json_path]:
                if os.path.exists(f): os.remove(f)


if __name__ == "__main__":
    pass
