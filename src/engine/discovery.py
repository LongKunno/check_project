import os
import json
import subprocess
from src.config import EXCLUDE_DIRS, SCAN_EXTENSIONS

class DiscoveryStep:
    """
    Discovery Phase (Step 1):
    Calculates Lines of Code (LOC) and identifies valid source files for auditing.
    """
    def __init__(self, target_dir):
        """Initializes the discovery step with a target directory."""
        self.target_dir = target_dir
        import tempfile
        self.precheck_script = os.path.join(tempfile.gettempdir(), f'ai_precheck_{abs(hash(target_dir))}.py')
        self.report_file = os.path.join(target_dir, 'ai_audit_report.json')

    def generate_precheck_script(self):
        script_content = f"""
import os
import json

def run_precheck():
    exclude_dirs = {EXCLUDE_DIRS}
    scan_ext = {SCAN_EXTENSIONS}
    results = {{
        "total_loc": 0,
        "total_files": 0,
        "files": [],
        "features": {{}}
    }}
    
    # Danh sách các tên thư mục source phổ biến (ưu tiên theo thứ tự)
    SOURCE_DIR_CANDIDATES = ['source_code', 'code', 'src', 'app', 'backend', 'api', 'growme_app', 'growme_api']
    
    detected_source_dir = None
    for candidate in SOURCE_DIR_CANDIDATES:
        if os.path.isdir(candidate):
            detected_source_dir = candidate
            break
    
    use_source_code = detected_source_dir is not None
    base_scan_path = detected_source_dir if use_source_code else '.'
    
    # --- PHASE 1: Scan toàn bộ cây thư mục để xây dựng bản đồ Django Apps ---
    # Django App = thư mục chứa ít nhất 1 trong: models.py, views.py, apps.py
    app_indicator_files = {{'models.py', 'views.py', 'apps.py'}}
    django_app_dirs = set()  # Chứa absolute path của các Django App directories
    
    # Thư mục trung gian cần bỏ qua khi đặt tên feature (ví dụ: 'code/')
    TRANSPARENT_DIRS = {{'code', 'src', 'app'}}
    
    for scan_root, scan_dirs, scan_files in os.walk(base_scan_path, followlinks=True):
        scan_dirs[:] = [d for d in scan_dirs if d not in exclude_dirs]
        if app_indicator_files.intersection(scan_files):
            django_app_dirs.add(os.path.realpath(scan_root))
    
    def get_feature_name(file_dir):
        \"\"\"
        Xác định feature name cho một file dựa trên Django App gần nhất chứa nó.
        
        Logic:
        1. Từ thư mục của file, đi ngược lên tìm Django App gần nhất
        2. Tạo tên feature = context_parent/app_name (bỏ qua các thư mục trung gian như 'code/')
        3. Nếu không tìm thấy Django App, dùng folder cấp 1 như cũ (fallback)
        \"\"\"
        real_dir = os.path.realpath(file_dir)
        real_base = os.path.realpath(base_scan_path)
        
        # Đi ngược lên từ thư mục hiện tại để tìm Django App gần nhất
        check_dir = real_dir
        while check_dir.startswith(real_base) and check_dir != os.path.dirname(real_base):
            if check_dir in django_app_dirs:
                # Tìm thấy Django App! Tạo tên feature
                rel_app = os.path.relpath(check_dir, real_base)
                parts = rel_app.split(os.sep)
                
                # Lọc bỏ các thư mục trung gian (transparent dirs) khỏi tên
                clean_parts = [p for p in parts if p not in TRANSPARENT_DIRS]
                
                if clean_parts:
                    return '/'.join(clean_parts)
                else:
                    return parts[0]
            check_dir = os.path.dirname(check_dir)
        
        # Fallback: không tìm thấy Django App -> dùng folder cấp 1
        rel_to_base = os.path.relpath(file_dir, base_scan_path)
        if rel_to_base == '.':
            return f"{{detected_source_dir}}_root" if use_source_code else "root"
        parts = rel_to_base.split(os.sep)
        # Lọc bỏ transparent dirs cho fallback
        clean_parts = [p for p in parts if p not in TRANSPARENT_DIRS]
        if clean_parts:
            return clean_parts[0]
        return parts[0]
    
    # --- PHASE 2: Scan lại và gán Feature cho từng file ---
    visited_dirs = set()
    
    for root, dirs, files in os.walk(base_scan_path, followlinks=True):
        real_root = os.path.realpath(root)
        if real_root in visited_dirs:
            dirs[:] = []
            continue
        visited_dirs.add(real_root)
        
        # Lọc thư mục rác ở mọi cấp độ
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        # BẮT BUỘC Sắp xếp dirs và files theo Alphabet (Deterministic Order)
        dirs.sort()
        files.sort()
            
        for file in files:
            if any(file.endswith(ext) for ext in scan_ext) and file != 'ai_precheck.py':
                path = os.path.join(root, file)
                
                # Sử dụng Django App detection để gán feature
                feature_name = get_feature_name(root)

                if feature_name not in results["features"]:
                    results["features"][feature_name] = {{"loc": 0, "files_count": 0}}

                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        loc = len(lines)
                        if loc > 0:
                            results["total_files"] += 1
                            results["total_loc"] += loc
                            results["files"].append({{"path": os.path.abspath(path), "loc": loc, "feature": feature_name}})
                            results["features"][feature_name]["loc"] += loc
                            results["features"][feature_name]["files_count"] += 1
                except Exception:
                    continue
    
    with open('ai_audit_report.json', 'w') as f:
        json.dump(results, f)

if __name__ == "__main__":
    run_precheck()
"""
        with open(self.precheck_script, 'w') as f:
            f.write(script_content)

    def run_discovery(self):
        """Executes the precheck script and returns the results."""
        self.generate_precheck_script()
        
        try:
            # Run the script
            subprocess.run(['python3', self.precheck_script], cwd=self.target_dir, check=True)
            
            # Read results
            with open(self.report_file, 'r') as f:
                data = json.load(f)
            
            return data
        finally:
            # Cleanup
            if os.path.exists(self.precheck_script):
                os.remove(self.precheck_script)
            if os.path.exists(self.report_file):
                os.remove(self.report_file)

if __name__ == "__main__":
    # Test discovery on the current project
    discovery = DiscoveryStep('.')
    report = discovery.run_discovery()
    print(json.dumps(report, indent=2))
