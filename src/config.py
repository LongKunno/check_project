# Configuration for AI Static Analysis Auditor
import os

# Pillar Weights
WEIGHTS = {
    "Performance": 0.35,
    "Maintainability": 0.25,
    "Reliability": 0.20,
    "Security": 0.20,
}

# Directories to ignore
EXCLUDE_DIRS = [
    ".git",
    "venv",
    "env",
    ".venv",
    "__pycache__",
    "migrations",
    "node_modules",
    "staticfiles",
    "media",
    ".idea",
    ".vscode",
]

# File extensions to scan
SCAN_EXTENSIONS = [".py"]

# Normalization Factor (K)
K_FACTOR = 2.0


def _parse_int_setting(value, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    """Parse integer setting với range guard; lỗi thì fallback về default."""
    try:
        parsed = int(value)
    except (ValueError, TypeError):
        return default

    if minimum is not None and parsed < minimum:
        return default
    if maximum is not None and parsed > maximum:
        return default
    return parsed


# TEST MODE: Giới hạn số file được phân tích để tiết kiệm Token (chỉ phân tích tối đa N file)
# Đặt thành 0 hoặc xóa khỏi .env để tắt Test Mode và quét toàn bộ dự án
TEST_MODE_LIMIT_FILES = _parse_int_setting(
    os.getenv("TEST_MODE_LIMIT_FILES", 0), default=0, minimum=0
)

# AI TOGGLE: Bật/tắt việc sử dụng AI trong quá trình Audit
# true  = Bật AI (Hybrid Validation + Deep Reasoning + Cross-Check) — đầy đủ nhưng tốn token
# false = Tắt AI, chỉ dùng Static Analysis (Regex + AST) — nhanh, miễn phí, không cần API key
AI_ENABLED = os.getenv("AI_ENABLED", "true").lower() in ("true", "1", "yes")

# AI CONCURRENCY: Giới hạn số request AI chạy song song cho Validation + Deep Audit.
# Miền hợp lệ: 1..100. Nếu parse lỗi hoặc out-of-range thì fallback về 5.
AI_MAX_CONCURRENCY = _parse_int_setting(
    os.getenv("AI_MAX_CONCURRENCY", 5), default=5, minimum=1, maximum=100
)

# AUTH TOGGLE: Bật/tắt yêu cầu đăng nhập Google OAuth
# true  = Bắt buộc đăng nhập để truy cập Dashboard
# false = Bỏ qua xác thực, mọi người đều truy cập được (dùng cho local dev / demo)
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "true").lower() in ("true", "1", "yes")


def get_ai_enabled() -> bool:
    """Đọc AI_ENABLED từ DB (ưu tiên) hoặc .env (fallback).
    Cho phép thay đổi runtime từ Settings UI mà không cần restart."""
    try:
        from src.engine.database import AuditDatabase
        val = AuditDatabase.get_config("ai_enabled")
        if val is not None:
            return val.lower() in ("true", "1", "yes")
    except Exception:
        pass
    return AI_ENABLED


def get_test_mode_limit() -> int:
    """Đọc TEST_MODE_LIMIT_FILES từ DB (ưu tiên) hoặc .env (fallback).
    0 = full scan (production), >0 = giới hạn N files (test)."""
    try:
        from src.engine.database import AuditDatabase
        val = AuditDatabase.get_config("test_mode_limit_files")
        if val is not None:
            return int(val)
    except Exception:
        pass
    return TEST_MODE_LIMIT_FILES


def get_ai_max_concurrency() -> int:
    """Đọc AI_MAX_CONCURRENCY từ DB (ưu tiên) hoặc .env (fallback).
    Giá trị hợp lệ: 1..100; nếu DB lỗi hoặc out-of-range thì fallback về 5."""
    try:
        from src.engine.database import AuditDatabase

        val = AuditDatabase.get_config("ai_max_concurrency")
        if val is not None:
            return _parse_int_setting(val, default=5, minimum=1, maximum=100)
    except Exception:
        pass
    return AI_MAX_CONCURRENCY


def get_auth_required() -> bool:
    """Đọc AUTH_REQUIRED từ DB (ưu tiên) hoặc .env (fallback).
    True = bắt buộc đăng nhập, False = bỏ qua xác thực."""
    try:
        from src.engine.database import AuditDatabase
        val = AuditDatabase.get_config("auth_required")
        if val is not None:
            return val.lower() in ("true", "1", "yes")
    except Exception:
        pass
    return AUTH_REQUIRED

# [DEPRECATED] RULES_METADATA & SEVERITY have been moved to: src/engine/rules.json

# SonarQube Configuration
SONAR_CONFIG = {
    "DEVELOPMENT_COST_PER_LOC_MINS": 30,  # Minutes per line of code
    "RATING_LEVELS": {"A": 0.05, "B": 0.10, "C": 0.20, "D": 0.50},
}

# [DEPRECATED] — Danh sách này chỉ dùng để seed vào bảng configured_repositories
# trong PostgreSQL khi lần đầu khởi động. Sau đó quản lý qua API & UI.
# Xem: AuditDatabase.seed_default_repositories()
BITBUCKET_USER = os.getenv("BITBUCKET_USERNAME", "")
BITBUCKET_PASS = os.getenv("BITBUCKET_TOKEN", "")

CONFIGURED_REPOSITORIES = [
    {
        "id": "longkunno-check-project",
        "name": "Check Project",
        "url": "https://github.com/LongKunno/check_project.git",
        "username": "",
        "token": "",
        "branch": "main",
    },
    {
        "id": "liftsoftvn/ana-api",
        "name": "ANA API",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_ana_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/lift_wky_api",
        "name": "WKY API",
        "url": "https://bitbucket.org/liftsoftvn/lift_wky_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "main",
    },
    {
        "id": "liftsoftvn/lpp_grm_crb",
        "name": "GRM CRB",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_crb.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/lpp_lap_api",
        "name": "LAP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_lap_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/mpf_mobile_api",
        "name": "MPF Mobile API",
        "url": "https://bitbucket.org/liftsoftvn/mpf_mobile_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "develop",
    },
    {
        "id": "liftsoftvn/mpf_api",
        "name": "MPF API",
        "url": "https://bitbucket.org/liftsoftvn/mpf_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/lpp_msp_app",
        "name": "MSP APP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_msp_app.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/adcom_api",
        "name": "Adcom API",
        "url": "https://bitbucket.org/liftsoftvn/adcom_api.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/grm-app",
        "name": "GRM APP",
        "url": "https://bitbucket.org/liftsoftvn/lpp_grm_app.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
    {
        "id": "liftsoftvn/sp-integrate",
        "name": "SP Integrate API",
        "url": "https://bitbucket.org/liftsoftvn/sp-integrate.git",
        "username": BITBUCKET_USER,
        "token": BITBUCKET_PASS,
        "branch": "master",
    },
]
