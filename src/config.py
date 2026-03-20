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

# Rules Metadata (SonarQube Style)
# severity: Blocker, Critical, Major, Minor, Info
# debt: remediation effort in minutes
RULES_METADATA = {
    "HARDCODED_SECRET": {"category": "Security", "severity": "Blocker", "debt": 60},
    "SQL_INJECTION": {"category": "Security", "severity": "Critical", "debt": 45},
    "N_PLUS_ONE": {"category": "Performance", "severity": "Major", "debt": 30},
    "ITERROWS_USE": {"category": "Performance", "severity": "Minor", "debt": 15},
    "HARDCODED_SECRET": {"category": "Security", "severity": "Blocker", "debt": 10},
    "SQL_INJECTION": {"category": "Security", "severity": "Blocker", "debt": 180},
    "UNRESTRICTED_CORS": {"category": "Security", "severity": "Major", "debt": 20},
    "UNUSED_IMPORT": {"category": "Maintainability", "severity": "Minor", "debt": 5},
    "PRINT_STATEMENT": {"category": "Maintainability", "severity": "Info", "debt": 2},
    "MISSING_TESTS": {"category": "Reliability", "severity": "Critical", "debt": 45},
    "SELECT_STAR": {"category": "Performance", "severity": "Minor", "debt": 10},
}

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

# Legacy Severity Weights (kept for backward compatibility)
SEVERITY = {k: -float(v['debt'])/10 for k, v in RULES_METADATA.items()}

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
