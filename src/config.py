# Configuration for AI Static Analysis Auditor
import os
# Pillar Weights
WEIGHTS = {
    "Performance": 0.35,
    "Maintainability": 0.25,
    "Reliability": 0.20,
    "Security": 0.20
}

# Directories to ignore
EXCLUDE_DIRS = [
    '.git', 'venv', 'env', '.venv', '__pycache__', 
    'migrations', 'node_modules', 'staticfiles', 
    'media', '.idea', '.vscode'
]

# File extensions to scan
SCAN_EXTENSIONS = ['.py']

# Normalization Factor (K)
K_FACTOR = 2.0

# TEST MODE: Giới hạn số file được phân tích để tiết kiệm Token (chỉ phân tích tối đa N file)
# Đặt thành 0 hoặc xóa khỏi .env để tắt Test Mode và quét toàn bộ dự án
TEST_MODE_LIMIT_FILES = int(os.getenv("TEST_MODE_LIMIT_FILES", 0))

# [DEPRECATED] RULES_METADATA & SEVERITY have been moved to: src/engine/rules.json

# SonarQube Configuration
SONAR_CONFIG = {
    "DEVELOPMENT_COST_PER_LOC_MINS": 30, # Minutes per line of code
    "RATING_LEVELS": {
        "A": 0.05,
        "B": 0.10,
        "C": 0.20,
        "D": 0.50
    }
}

# Hardcoded Repositories for Quick Audit
BITBUCKET_USER = os.getenv("BITBUCKET_USERNAME", "")
BITBUCKET_PASS = os.getenv("BITBUCKET_TOKEN", "")

CONFIGURED_REPOSITORIES = [
    {
        "id": "longkunno-check-project",
        "name": "Check Project (Current)",
        "url": "https://github.com/LongKunno/check_project.git",
        "username": "",
        "token": "",
        "branch": "main"
    },
    {
        "id": "liftsoftvn/ana-api",
        "name": "ANA API",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_ana_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/lift_wky_api",
        "name": "WKY API",
        "url": "https://bitbucket.org/liftsoftvn/lift_wky_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "main"
    },
    {
        "id": "liftsoftvn/lpp_grm_crb",
        "name": "GRM CRB",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_crb.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/lpp_lap_api",
        "name": "LAP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_lap_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/mpf_mobile_api",
        "name": "MPF Mobile API",
        "url": "https://bitbucket.org/liftsoftvn/mpf_mobile_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/mpf_api",
        "name": "MPF API",
        "url": "https://bitbucket.org/liftsoftvn/mpf_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/lpp_msp_app",
        "name": "MSP APP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_msp_app.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/adcom_api",
        "name": "Adcom API",
        "url": "https://bitbucket.org/liftsoftvn/adcom_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/grm-app",
        "name": "GRM APP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_app.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
    {
        "id": "liftsoftvn/sp-integrate",
        "name": "SP Integrate API",
        "url": "https://bitbucket.org/liftsoftvn/sp-integrate.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master"
    },
]
