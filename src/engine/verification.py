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
        Sử dụng file JSON tạm thời để truyền danh sách file nhằm tránh lỗi 
        'Argument list too long' trên OS khi xử lý hàng chục nghìn file.
        """
        self.target_dir = target_dir
        self.file_list = file_list
        self.verification_script = os.path.join(target_dir, 'ai_double_check.py')
        self.file_list_json = os.path.join(target_dir, 'audit_files.json')

    def generate_verification_script(self):
        script_content = r"""
import ast
import re
import json
import sys

def double_check(file_list_json):
    with open(file_list_json, 'r', encoding='utf-8') as f:
        file_list = json.load(f)
        
    violations = []
    
    # Regex Patterns
    # SECRET_REGEX: Bắt 'token=...', 'password:...', '"secret":...' (case-insensitive)
    SECRET_REGEX = re.compile(r'(?i)(password|secret|api_key|token)\s*[:=]\s*[\'"][^\'"]+[\'"]')
    VERIFY_FALSE_REGEX = re.compile(r'verify\s*=\s*' + 'False')
    SELECT_STAR_REGEX = re.compile(r'SELECT\s+\*')
    ITERROWS_REGEX = re.compile(r'\.iterrows\(\)')
    
    for file_path in file_list:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Regex Checks
                if SECRET_REGEX.search(content):
                    violations.append({"file": file_path, "type": "Security", "reason": "Hardcoded Secret detected (Regex)", "weight": -5})
                if VERIFY_FALSE_REGEX.search(content):
                    violations.append({"file": file_path, "type": "Security", "reason": "verify=" + "False detected (Regex)", "weight": -3})
                if SELECT_STAR_REGEX.search(content):
                    violations.append({"file": file_path, "type": "Performance", "reason": "SELECT * in BigQuery/SQL (Regex)", "weight": -2})
                if ITERROWS_REGEX.search(content):
                    violations.append({"file": file_path, "type": "Performance", "reason": "Pandas .iterrows() detected (Regex)", "weight": -3})

                # AST Checks
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    # Bare Except
                    if isinstance(node, ast.ExceptHandler) and node.type is None:
                        violations.append({"file": file_path, "type": "Reliability", "reason": "Bare except: block (AST)", "weight": -2})
                    
                    # Function length
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if node.end_lineno - node.lineno > 100:
                            violations.append({"file": file_path, "type": "Maintainability", "reason": f"Function {node.name} too long > 100 lines (AST)", "weight": -2})
                            
        except Exception:
            continue
            
    return violations

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 ai_double_check.py <file_list_json>")
        sys.exit(1)
    
    result = double_check(sys.argv[1])
    print(json.dumps(result))
"""
        with open(self.verification_script, 'w') as f:
            f.write(script_content)

    def run_verification(self):
        self.generate_verification_script()
        try:
            # Lưu danh sách file vào JSON file thay vì truyền qua Argument
            file_paths = [f['path'] for f in self.file_list]
            with open(self.file_list_json, 'w', encoding='utf-8') as f:
                json.dump(file_paths, f)
                
            result = subprocess.run(
                ['python3', 'ai_double_check.py', 'audit_files.json'], 
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
