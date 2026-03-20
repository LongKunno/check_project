import os
import shutil
import json
import sys

# Thêm project root vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.engine.discovery import DiscoveryStep

def setup_test_dir(use_source_code=False):
    test_dir = '/tmp/test_discovery_project'
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)
    
    if use_source_code:
        # Structure with source_code
        os.makedirs(os.path.join(test_dir, 'source_code/auth'))
        os.makedirs(os.path.join(test_dir, 'source_code/payments'))
        os.makedirs(os.path.join(test_dir, 'docs'))
        
        with open(os.path.join(test_dir, 'source_code/auth/login.py'), 'w') as f:
            f.write("# Auth login\nprint('hello')")
        with open(os.path.join(test_dir, 'source_code/payments/pay.py'), 'w') as f:
            f.write("# Payment\nprint('money')")
        with open(os.path.join(test_dir, 'source_code/main.py'), 'w') as f:
            f.write("# Main\nprint('main')")
        with open(os.path.join(test_dir, 'docs/readme.md'), 'w') as f:
            f.write("# Readme")
    else:
        # Structure without source_code
        os.makedirs(os.path.join(test_dir, 'auth'))
        os.makedirs(os.path.join(test_dir, 'payments'))
        
        with open(os.path.join(test_dir, 'auth/login.py'), 'w') as f:
            f.write("# Auth login\nprint('hello')")
        with open(os.path.join(test_dir, 'payments/pay.py'), 'w') as f:
            f.write("# Payment\nprint('money')")
        with open(os.path.join(test_dir, 'main.py'), 'w') as f:
            f.write("# Main\nprint('main')")
            
    return test_dir

def test_discovery():
    print("Testing WITHOUT source_code folder...")
    td1 = setup_test_dir(use_source_code=False)
    discovery1 = DiscoveryStep(td1)
    report1 = discovery1.run_discovery()
    print("Features found:", list(report1['features'].keys()))
    assert 'auth' in report1['features']
    assert 'payments' in report1['features']
    assert 'root' in report1['features']
    print("PASS: Grouping by top-level folders working.")

    print("\nTesting WITH source_code folder...")
    td2 = setup_test_dir(use_source_code=True)
    discovery2 = DiscoveryStep(td2)
    report2 = discovery2.run_discovery()
    print("Features found:", list(report2['features'].keys()))
    # Features should be from INSIDE source_code
    assert 'auth' in report2['features']
    assert 'payments' in report2['features']
    assert 'source_code_root' in report2['features']
    # 'docs' should NOT be a feature because it's outside source_code
    assert 'docs' not in report2['features']
    print("PASS: source_code prioritization working.")

if __name__ == "__main__":
    try:
        test_discovery()
        print("\nALL TESTS PASSED!")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
