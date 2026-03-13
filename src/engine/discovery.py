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
        self.precheck_script = os.path.join(target_dir, 'ai_precheck.py')
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
        "files": []
    }}
    
    for root, dirs, files in os.walk('.'):
        # Filter directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if any(file.endswith(ext) for ext in scan_ext) and file != 'ai_precheck.py':
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        loc = len(lines)
                        if loc > 0:
                            results["total_files"] += 1
                            results["total_loc"] += loc
                            results["files"].append({{"path": os.path.abspath(path), "loc": loc}})
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
            subprocess.run(['python3', 'ai_precheck.py'], cwd=self.target_dir, check=True)
            
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
