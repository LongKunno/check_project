import ast
import os
import json
import subprocess
import sys
import logging

logger = logging.getLogger(__name__)

# Các scanner và dependency checker đã được tách ra module riêng
from src.engine.scanners import _build_flat_meta, BaseScanner, RegexScanner, PythonASTScanner
from src.engine.dependency_checker import detect_circular_dependencies




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
        logger.warning(f"Error checking circular dependencies: {e}")

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
                    except SyntaxError:
                        logger.debug(f"Skipped AST parse for {file_path}: SyntaxError (file may have invalid Python syntax)")

                for scanner in scanners:
                    scan_results = scanner.scan(file_path, content, lines, tree, rules)
                    for v in scan_results:
                        v['id'] = f"v_{id_counter}"
                        violations.append(v)
                        id_counter += 1
        except Exception as e:
            logger.warning(f"Error scanning {file_path}: {e}")
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
        import tempfile
        self.temp_dir = tempfile.mkdtemp(prefix="auditor_")
        self.verification_script = os.path.join(self.temp_dir, 'ai_double_check.py')
        self.file_list_json = os.path.join(self.temp_dir, 'audit_files.json')
        self.rules_json_path = os.path.join(self.temp_dir, 'audit_rules.json')
        self.config_rules_path = os.path.join(os.path.dirname(__file__), 'rules.json')

    def load_rules(self):
        """Loads và merges default rules với custom rules (theo Unified Schema)."""
        with open(self.config_rules_path, 'r', encoding='utf-8') as f:
            merged = json.load(f)

        if not self.custom_rules:
            merged['disabled_ids'] = []
            return merged

        disabled_ids = self.custom_rules.get('disabled_core_rules', [])
        merged['disabled_ids'] = disabled_ids

        self._apply_disabled_rules(merged, disabled_ids)
        self._apply_custom_weights(merged)
        self._merge_custom_payload(merged)

        return merged

    def _apply_disabled_rules(self, merged, disabled_ids):
        """Lọc bỏ các luật bị người dùng disabled."""
        if disabled_ids:
            merged['rules'] = [r for r in merged.get('rules', []) if r.get('id') not in disabled_ids]

    def _apply_custom_weights(self, merged):
        """Áp dụng Custom Weights."""
        custom_weights = self.custom_rules.get('custom_weights', {})
        if not custom_weights:
            return
            
        for r in merged.get('rules', []):
            r_id = r.get('id')
            if r_id and r_id in custom_weights:
                try:
                    r['weight'] = float(custom_weights[r_id])
                except (ValueError, TypeError):
                    logger.warning(f"Invalid custom weight for rule {r_id}: {custom_weights[r_id]}")

    def _merge_custom_payload(self, merged):
        """Merge thêm Custom Rules do AI sinh ra hoặc từ schema cũ."""
        custom = self.custom_rules.get('compiled_json')
        if not custom:
            return
            
        extra_rules = custom.get('rules', [])
        if extra_rules:
            merged.setdefault('rules', []).extend(extra_rules)
            return

        # Legacy schema fallback
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
                "ast": None, "ai": None
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
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

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
                ['python3', self.verification_script, self.file_list_json, self.rules_json_path],
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
            logger.error(f"❌ Verification script failed: {e.stderr}")
            raise
        finally:
            for f in [self.verification_script, self.file_list_json, self.rules_json_path]:
                if os.path.exists(f): os.remove(f)
            import shutil
            if os.path.exists(self.temp_dir): shutil.rmtree(self.temp_dir, ignore_errors=True)


if __name__ == "__main__":
    pass
