import os
import shutil
import json
import sys

# Thêm project root vào path để import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.engine.auditor import CodeAuditor

def setup_test_project():
    test_dir = '/tmp/test_project_pillars'
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)
    
    # Feature 1: Auth (100 LOC, 1 major violation -5)
    os.makedirs(os.path.join(test_dir, 'auth'))
    with open(os.path.join(test_dir, 'auth/login.py'), 'w') as f:
        f.write("# Auth\n" + "x = 1\n" * 99) # 100 lines
        
    # Feature 2: Payments (400 LOC, 1 minor violation -2)
    os.makedirs(os.path.join(test_dir, 'payments'))
    with open(os.path.join(test_dir, 'payments/pay.py'), 'w') as f:
        f.write("# Payments\n" + "x = 1\n" * 399) # 400 lines
        
    return test_dir

def test_overall_pillars():
    test_dir = setup_test_project()
    auditor = CodeAuditor(test_dir)
    
    # Mock AI Service to avoid non-deterministic results in unit tests
    from unittest.mock import AsyncMock
    from src.engine.ai_service import ai_service
    ai_service.verify_violations_batch = AsyncMock(return_value={})
    ai_service.deep_audit_batch = AsyncMock(return_value=[])
    
    # Giả lập vi phạm
    # Security violation in auth
    auditor.log_violation('Security', os.path.join(test_dir, 'auth/login.py'), 'HARDCODED_SECRET', -5.0)
    # Maintainability violation in payments
    auditor.log_violation('Maintainability', os.path.join(test_dir, 'payments/pay.py'), 'MISSING_DOCSTRING', -2.0)
    
    auditor.run()
    
    # Kiểm tra project_pillars
    print("\nProject Pillars:", json.dumps(auditor.project_pillars, indent=2))
    
    # Tổng LOC = 500
    # Security: punishment 5. Normalized = 5 / (500/1000) = 10. Score = 10 / (1 + 10/2) = 10 / 6 = 1.67
    # Maintainability: punishment 2. Normalized = 2 / (500/1000) = 4. Score = 10 / (1 + 4/2) = 10 / 3 = 3.33
    
    assert round(auditor.project_pillars['Security'], 1) == 1.7
    assert round(auditor.project_pillars['Maintainability'], 1) == 3.3
    assert auditor.project_pillars['Performance'] == 10.0
    assert auditor.project_pillars['Reliability'] == 10.0
    
    print("PASS: Project level pillars calculated correctly based on overall LOC and punishments.")

if __name__ == "__main__":
    try:
        test_overall_pillars()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
