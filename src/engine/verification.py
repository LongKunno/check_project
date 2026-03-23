import ast
import re
import os
import json
import subprocess

class VerificationStep:
    """
    Verification Phase (Step 3):
    Performs deep analysis using AST and Regex to confirm violations.
    """
    def __init__(self, target_dir, file_list):
        """
        Khởi tạo bước xác thực. 
        """
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
        script_content = r"""
import ast
import re
import json
import sys

def calculate_complexity(node):
    '''Tính toán Cyclomatic Complexity cơ bản.'''
    complexity = 1
    for child in ast.walk(node):
        if isinstance(child, (ast.If, ast.While, ast.For, ast.And, ast.Or, ast.ExceptHandler, ast.With)):
            complexity += 1
    return complexity

def double_check(file_list_json, rules_json):
    with open(rules_json, 'r', encoding='utf-8') as f:
        rules = json.load(f)
        
    with open(file_list_json, 'r', encoding='utf-8') as f:
        file_list = json.load(f)
        
    violations = []
    
    # Pre-compile regex rules
    regex_rules = []
    for r in rules.get('regex_rules', []):
        try:
            regex_rules.append({
                "id": r['id'],
                "pattern": re.compile(r['pattern']),
                "pillar": r['pillar'],
                "reason": r['reason'],
                "weight": r['weight']
            })
        except Exception:
            continue

    ast_cfg = rules.get('ast_rules', {})
    dangerous_funcs = {df['name']: df for df in ast_cfg.get('dangerous_functions', [])}
    
    for file_path in file_list:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
                
                # Regex Checks
                for r in regex_rules:
                    match = r['pattern'].search(content)
                    if match:
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

                # AST Checks
                tree = ast.parse(content)
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
                        complexity = calculate_complexity(node)
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
                            # Handle os.system etc.
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
                    
                    # Track Imports & Usage (Simple)
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
                            
        except Exception:
            continue
            
    return violations

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 ai_double_check.py <file_list_json> <rules_json>")
        sys.exit(1)
    
    result = double_check(sys.argv[1], sys.argv[2])
    print(json.dumps(result))
"""
        with open(self.verification_script, 'w') as f:
            f.write(script_content)

    def run_verification(self):
        self.generate_verification_script()
        try:
            # Lưu danh sách file vào JSON file
            file_paths = [f['path'] for f in self.file_list]
            with open(self.file_list_json, 'w', encoding='utf-8') as f:
                json.dump(file_paths, f)
            
            # Lưu quy tắc vào JSON file
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
            return json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            print(f"❌ Verification script failed!")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            raise
        finally:
            if os.path.exists(self.verification_script):
                os.remove(self.verification_script)
            if os.path.exists(self.file_list_json):
                os.remove(self.file_list_json)
            if os.path.exists(self.rules_json_path):
                os.remove(self.rules_json_path)
