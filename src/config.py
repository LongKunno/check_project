# Configuration for AI Static Analysis Auditor

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

# Severity Weights (Reference from V3 Framework)
SEVERITY = {
    "HARDCODED_SECRET": -5.0,
    "SQL_INJECTION": -3.0,
    "N_PLUS_ONE": -3.0,
    "ITERROWS_USE": -3.0,
    "BARE_EXCEPT": -2.0,
    "GOD_OBJECT": -2.0,
    "DUPLICATION_HIGH": -2.0,
    "MISSING_TESTS": -3.0,
    "SELECT_STAR": -2.0,
    "MISSING_DOCSTRING": -0.3,
    "PEP8_VIOLATION": -1.0,
}

import os

# Hardcoded Repositories for Quick Audit
BITBUCKET_USER = os.getenv("BITBUCKET_USERNAME", "")
BITBUCKET_PASS = os.getenv("BITBUCKET_TOKEN", "")

CONFIGURED_REPOSITORIES = [
    {
        "id": "fastapi/fastapi",
        "name": "FastAPI (Public)",
        "url": "https://github.com/fastapi/fastapi.git",
        "username": "",
        "token": ""
    },
    {
        "id": "liftsoftvn/ana-api",
        "name": "ANA API",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_ana_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS
    },
    {
        "id": "liftsoftvn/grm-app",
        "name": "GRM APP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_app.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS
    },
    {
        "id": "liftsoftvn/sp-integrate",
        "name": "SP Integrate API",
        "url": "https://bitbucket.org/liftsoftvn/sp-integrate.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS
    },
]
