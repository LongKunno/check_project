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
        
        for node in ast.walk(tree):
            # Bare Except
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                rule = ast_cfg.get('bare_except', {})
                snippet = "\n".join(lines[max(0, node.lineno-2):min(len(lines), node.lineno+1)])
                violations.append({
                    "file": file_path, "type": rule.get('pillar', 'Reliability'), 
                    "reason": rule.get('reason', 'Bare except'), "weight": rule.get('weight', -2), 
                    "rule_id": rule.get('id', 'BARE_EXCEPT'), "line": node.lineno, "snippet": snippet
                })
            
            # Function length & Complexity
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Function length
                len_rule = ast_cfg.get('max_function_length', {})
                if node.end_lineno - node.lineno > len_rule.get('limit', 100):
                    snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                    violations.append({
                        "file": file_path, "type": len_rule.get('pillar', 'Maintainability'), 
                        "reason": f"{len_rule.get('reason')}: {node.name} (> {len_rule.get('limit')} lines)", 
                        "weight": len_rule.get('weight', -2), "rule_id": len_rule.get('id', 'GOD_OBJECT'), 
                        "line": node.lineno, "snippet": snippet
                    })
                
                # Complexity
                comp_rule = ast_cfg.get('complexity', {})
                complexity = self.calculate_complexity(node)
                if complexity > comp_rule.get('limit', 10):
                    snippet = "\n".join(lines[max(0, node.lineno-1):min(len(lines), node.lineno+2)])
                    violations.append({
                        "file": file_path, "type": comp_rule.get('pillar', 'Performance'), 
                        "reason": f"{comp_rule.get('reason')}: {node.name} (Complexity: {complexity} > {comp_rule.get('limit')})", 
                        "weight": comp_rule.get('weight', -5), "rule_id": comp_rule.get('id', 'HIGH_COMPLEXITY'), 
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
            
            # Track Imports & Usage
            if isinstance(node, ast.Import):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.ImportFrom):
                for n in node.names: imported_names.add((n.asname or n.name, node.lineno))
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)

        # Check unused imports
        used_names_str = set(used_names)
        for name, line_no in imported_names:
            if name not in used_names_str and name not in ['os', 'sys', 'json', 'ast', 're']:
                snippet = lines[line_no-1] if line_no <= len(lines) else ""
                violations.append({"file": file_path, "type": "Maintainability", "reason": f"Import '{name}' might be unused (AST)", "weight": -0.5, "rule_id": "UNUSED_IMPORT", "line": line_no, "snippet": snippet})
        
        return violations

def double_check_modular(file_list_json, rules_json):
    with open(rules_json, 'r', encoding='utf-8') as f:
        rules = json.load(f)
        
    with open(file_list_json, 'r', encoding='utf-8') as f:
        file_list = json.load(f)
        
    violations = []
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
    def __init__(self, target_dir, file_list):
        self.target_dir = target_dir
        self.file_list = file_list
        self.verification_script = os.path.join(target_dir, 'ai_double_check.py')
        self.file_list_json = os.path.join(target_dir, 'audit_files.json')
        self.rules_json_path = os.path.join(target_dir, 'audit_rules.json')
        self.config_rules_path = os.path.join(os.path.dirname(__file__), 'rules.json')

    def load_rules(self):
        with open(self.config_rules_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def generate_verification_script(self):
        # We reuse the logic but wrap it for the subprocess
        import inspect
        
        script_code = inspect.getsource(BaseScanner) + "\n"
        script_code += inspect.getsource(RegexScanner) + "\n"
        script_code += inspect.getsource(PythonASTScanner) + "\n"
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
