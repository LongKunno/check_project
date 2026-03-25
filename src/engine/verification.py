import ast
import re
import os
import json
import subprocess
import sys


class BaseScanner:
    """Lớp cơ sở cho các loại quét mã nguồn khác nhau."""
    def scan(self, file_path, content, lines, tree, rules):
        return []

class RegexScanner(BaseScanner):
    """Quét dựa trên biểu thức chính quy (Regex)."""
    def scan(self, file_path, content, lines, tree, rules):
        violations = []
        regex_rules = rules.get('regex_rules', [])
        for r in regex_rules:
            try:
                pattern = re.compile(r['pattern'])
                for match in pattern.finditer(content):
                    start_idx = match.start()
                    line_no = content[:start_idx].count('\n') + 1
                    snippet = "\n".join(lines[max(0, line_no-2):min(len(lines), line_no+1)])
                    violations.append({
                        "file": file_path, 
                        "type": r['pillar'], 
                        "reason": r['reason'], 
                        "weight": r['weight'], 
                        "rule_id": r['id'],
                        "line": line_no,
                        "snippet": snippet
                    })
            except Exception:
                continue
        return violations

class PythonASTScanner(BaseScanner):
    """Quét dựa trên cây cú pháp AST của Python."""
    def calculate_complexity(self, node):
        complexity = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.And, ast.Or, ast.ExceptHandler, ast.With)):
                complexity += 1
        return complexity

    def scan(self, file_path, content, lines, tree, rules):
        if tree is None:
            return []
            
        violations = []
        ast_cfg = rules.get('ast_rules', {})
        dangerous_funcs = {df['name']: df for df in ast_cfg.get('dangerous_functions', [])}
        
        imported_names = set()
        used_names = set()
        
        # Bổ sung quan hệ Parent-Child cho cây AST (Rất hữu ích để check context như "with open")
        for parent_node in ast.walk(tree):
            for child in ast.iter_child_nodes(parent_node):
                child.parent = parent_node
        
        for node in ast.walk(tree):
            # Bare Except & Swallowed Exceptions
            if isinstance(node, ast.ExceptHandler):
                if node.type is None:
                    rule = ast_cfg.get('bare_except', {})
                    if rule:
                        snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                        violations.append({
                            "file": file_path, "type": rule.get('pillar', 'Reliability'), 
                            "reason": rule.get('reason', 'Bare except'), "weight": rule.get('weight', -2), 
                            "rule_id": rule.get('id', 'BARE_EXCEPT'), "line": node.lineno, "snippet": snippet
                        })
                
                # Swallowed Exception (Nuốt lỗi ngầm)
                if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    sw_rule = ast_cfg.get('swallowed_exception', {})
                    if sw_rule:
                        snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                        violations.append({
                            "file": file_path, "type": sw_rule.get('pillar', 'Reliability'), 
                            "reason": sw_rule.get('reason', 'Swallowed exception'), "weight": sw_rule.get('weight', -5), 
                            "rule_id": sw_rule.get('id', 'SWALLOWED_EXCEPTION'), "line": node.lineno, "snippet": snippet
                        })
            
            # Function length, Complexity & Parameters
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Function length
                len_rule = ast_cfg.get('max_function_length', {})
                if len_rule and node.end_lineno - node.lineno > len_rule.get('limit', 100):
                    snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                    violations.append({
                        "file": file_path, "type": len_rule.get('pillar', 'Maintainability'), 
                        "reason": f"{len_rule.get('reason')}: {node.name} (> {len_rule.get('limit')} lines)", 
                        "weight": len_rule.get('weight', -2), "rule_id": len_rule.get('id', 'GOD_OBJECT'), 
                        "line": node.lineno, "snippet": snippet
                    })
                
                # Complexity
                comp_rule = ast_cfg.get('complexity', {})
                if comp_rule:
                    complexity = self.calculate_complexity(node)
                    if complexity > comp_rule.get('limit', 10):
                        snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                        violations.append({
                            "file": file_path, "type": comp_rule.get('pillar', 'Performance'), 
                            "reason": f"{comp_rule.get('reason')}: {node.name} (Complexity: {complexity} > {comp_rule.get('limit')})", 
                            "weight": comp_rule.get('weight', -5), "rule_id": comp_rule.get('id', 'HIGH_COMPLEXITY'), 
                            "line": node.lineno, "snippet": snippet
                        })
                
                # Parameters limit
                param_rule = ast_cfg.get('max_parameters', {})
                if 'limit' in param_rule:
                    num_args = len(node.args.args) + len(node.args.kwonlyargs)
                    if getattr(node.args, 'vararg', None): num_args += 1
                    if getattr(node.args, 'kwarg', None): num_args += 1
                    if num_args > param_rule['limit']:
                        snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                        violations.append({
                            "file": file_path, "type": param_rule.get('pillar', 'Maintainability'), 
                            "reason": f"{param_rule.get('reason')}: {node.name} ({num_args} > {param_rule.get('limit')})", 
                            "weight": param_rule.get('weight', -3), "rule_id": param_rule.get('id', 'TOO_MANY_PARAMS'), 
                            "line": node.lineno, "snippet": snippet
                        })

            # Dangerous functions
            if isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name):
                        func_name = f"{node.func.value.id}.{node.func.attr}"
                
                if func_name in dangerous_funcs:
                    df = dangerous_funcs[func_name]
                    snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                    violations.append({
                        "file": file_path, "type": df['pillar'], 
                        "reason": df['reason'], "weight": df['weight'], 
                        "rule_id": df['id'], "line": node.lineno, "snippet": snippet
                    })
                    
                # Cảnh báo thiếu vòng With cho tài nguyên (Memory Leak Guard)
                if func_name == 'open':
                    open_rule = ast_cfg.get('missing_with_open', {})
                    if open_rule:
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
                            violations.append({
                                "file": file_path, "type": open_rule.get('pillar', 'Performance'), 
                                "reason": open_rule.get('reason'), "weight": open_rule.get('weight', -4), 
                                "rule_id": open_rule.get('id', 'MEMORY_LEAK_OPEN'), "line": node.lineno, "snippet": snippet
                            })
                            
                # Cảnh báo gọi API thiếu Timeout (Reliability Network)
                if func_name in ['requests.get', 'requests.post', 'requests.put', 'requests.delete', 'requests.patch', 'httpx.get']:
                    timeout_rule = ast_cfg.get('missing_timeout', {})
                    if timeout_rule:
                        has_timeout = any(kw.arg == 'timeout' for kw in node.keywords)
                        if not has_timeout:
                            snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                            violations.append({
                                "file": file_path, "type": timeout_rule.get('pillar', 'Reliability'), 
                                "reason": timeout_rule.get('reason'), "weight": timeout_rule.get('weight', -5), 
                                "rule_id": timeout_rule.get('id', 'NO_TIMEOUT_SET'), "line": node.lineno, "snippet": snippet
                            })
            
            # N+1 Query Flow Detection (V7)
            if isinstance(node, (ast.For, ast.While, ast.AsyncFor)):
                n1_rule = ast_cfg.get('n_plus_one_query', {})
                if n1_rule:
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
                            
                            if ("objects.get" in full_call or 
                                "objects.filter" in full_call or 
                                "objects.all" in full_call or 
                                full_call.endswith(".execute") or 
                                full_call.startswith("requests.") or
                                full_call.startswith("httpx.")):
                                
                                snippet = "\n".join(lines[max(0, subnode.lineno-1):min(len(lines), subnode.lineno+2)])
                                violations.append({
                                    "file": file_path, "type": n1_rule.get('pillar', 'Performance'), 
                                    "reason": f"{n1_rule.get('reason')}. Found '{full_call}()' inside loop.", 
                                    "weight": n1_rule.get('weight', -5), 
                                    "rule_id": n1_rule.get('id', 'N_PLUS_ONE'), 
                                    "line": subnode.lineno, "snippet": snippet
                                })
                                break  # Chỉ bắt lỗi 1 lần cho mỗi vòng lặp để tránh spam
            
            # Track Imports & Usage
            if isinstance(node, ast.Import):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.ImportFrom):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)

        # Check unused imports
        disabled_ids = rules.get('disabled_ids', [])
        if 'UNUSED_IMPORT' not in disabled_ids:
            used_names_str = set(used_names)
            for name, line_no in imported_names:
                if name not in used_names_str and name not in ['os', 'sys', 'json', 'ast', 're']:
                    snippet = lines[line_no-1] if line_no <= len(lines) else ""
                    violations.append({"file": file_path, "type": "Maintainability", "reason": f"Import '{name}' might be unused (AST)", "weight": -0.5, "rule_id": "UNUSED_IMPORT", "line": line_no, "snippet": snippet})
        
        return violations

def detect_circular_dependencies(file_list, rules):
    ast_cfg = rules.get('ast_rules', {})
    circ_rule = ast_cfg.get('circular_dependency', {})
    disabled_ids = rules.get('disabled_ids', [])
    
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
            internal_deps = deps.intersection(set(mod_to_file.keys()))
            imports_map[file_to_mod[f]] = list(internal_deps)
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
                    "type": circ_rule.get('pillar', 'Architecture'),
                    "reason": f"{circ_rule.get('reason')} ({cycle_str})",
                    "weight": circ_rule.get('weight', -10),
                    "rule_id": circ_rule.get('id', 'CIRCULAR_DEPENDENCY'),
                    "line": 1,
                    "snippet": cycle_str
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
            full_path = file_path # In double_check_modular, it's already full path
            if not os.path.exists(full_path):
                continue
                
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
                
                tree = None
                if full_path.endswith('.py'):
                    try: tree = ast.parse(content)
                    except SyntaxError: pass
                
                for scanner in scanners:
                    scan_results = scanner.scan(full_path, content, lines, tree, rules)
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
    Performs deep analysis using AST and Regex to confirm violations.
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
        """Loads and merges default rules with custom rules."""
        with open(self.config_rules_path, 'r', encoding='utf-8') as f:
            merged = json.load(f) # Start with default rules as merged
            
        disabled_ids = []
        if self.custom_rules:
            disabled_ids = self.custom_rules.get('disabled_core_rules', [])
            
        merged['disabled_ids'] = disabled_ids # Pass disabled_ids to the merged rules for scanners

        if not self.custom_rules:
            return merged # Return default rules if no custom rules

        # Merge logic
        # Lọc bỏ các luật mặc định bị người dùng cấm (Toggled off)
        if disabled_ids:
            if 'regex_rules' in merged:
                merged['regex_rules'] = [r for r in merged['regex_rules'] if r.get('id') not in disabled_ids]
            if 'ast_rules' in merged:
                if 'dangerous_functions' in merged['ast_rules']:
                    merged['ast_rules']['dangerous_functions'] = [r for r in merged['ast_rules']['dangerous_functions'] if r.get('id') not in disabled_ids]
                for k in list(merged['ast_rules'].keys()):
                    if k != 'dangerous_functions':
                        r = merged['ast_rules'][k]
                        if isinstance(r, dict) and r.get('id') in disabled_ids:
                            del merged['ast_rules'][k]

        custom = self.custom_rules.get('compiled_json')
        if custom:
            # Merge Regex Rules
            if 'regex_rules' in custom:
                if isinstance(custom['regex_rules'], list):
                    merged.setdefault('regex_rules', []).extend(custom['regex_rules'])
            
            # Merge AST Rules
            # AI output format often has ast_rules as a list of rule objects.
            # Default engine expects a dict with specific keys.
            if 'ast_rules' in custom:
                # If AI sent a list of rules like [{"name": "eval", "pillar": "Security", ...}]
                if isinstance(custom['ast_rules'], list):
                    # We map these to 'dangerous_functions' for the PythonASTScanner
                    merged_ast = merged.setdefault('ast_rules', {})
                    if not isinstance(merged_ast, dict):
                        merged_ast = {}
                        merged['ast_rules'] = merged_ast
                    
                    merged_df = merged_ast.setdefault('dangerous_functions', [])
                    for r in custom['ast_rules']:
                        # Map rule name to 'name' for the scanner
                        node_name = r.get('name') or r.get('id')
                        if node_name:
                            merged_df.append({
                                "name": node_name,
                                "pillar": r.get('pillar', 'Maintainability'),
                                "reason": r.get('reason', 'Custom AI Rule'),
                                "weight": r.get('weight', -2.0),
                                "id": r.get('id') or f"CUSTOM_{node_name.upper()}"
                            })
                elif isinstance(custom['ast_rules'], dict):
                    # Deep merge dicts
                    for k, v in custom['ast_rules'].items():
                        if isinstance(v, list) and k in merged.get('ast_rules', {}):
                            merged['ast_rules'][k].extend(v)
                        else:
                            merged.setdefault('ast_rules', {})[k] = v
                        
        # Apply Custom Weights overrides
        custom_weights = self.custom_rules.get('custom_weights', {})
        if custom_weights:
            if 'regex_rules' in merged:
                for r in merged['regex_rules']:
                    r_id = r.get('id')
                    if r_id and r_id in custom_weights:
                        r['weight'] = float(custom_weights[r_id])
            if 'ast_rules' in merged:
                if 'dangerous_functions' in merged['ast_rules']:
                    for r in merged['ast_rules']['dangerous_functions']:
                        r_id = r.get('id')
                        if r_id and r_id in custom_weights:
                            r['weight'] = float(custom_weights[r_id])
                for k, v in merged['ast_rules'].items():
                    if k != 'dangerous_functions' and isinstance(v, dict):
                        v_id = v.get('id')
                        if v_id and v_id in custom_weights:
                            v['weight'] = float(custom_weights[v_id])
                            
        return merged

    def generate_verification_script(self):
        # We reuse the logic but wrap it for the subprocess
        import inspect
        
        script_code = inspect.getsource(BaseScanner) + "\n"
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
            # Dòng cuối cùng mới là kết quả JSON, các dòng trước có thể là log lỗi in ra stdout
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
    # Test
    pass
