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
