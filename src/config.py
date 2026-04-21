# Configuration for AI Static Analysis Auditor
import logging
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

logger = logging.getLogger(__name__)


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

# AI MODE:
# - realtime: dùng proxy/local API hiện tại
# - openai_batch: dùng OpenAI Batch API chính thức
AI_MODE = os.getenv("AI_MODE", "realtime").strip().lower() or "realtime"
if AI_MODE not in {"realtime", "openai_batch"}:
    AI_MODE = "realtime"

# AI CONCURRENCY: Giới hạn số request AI chạy song song cho Validation + Deep Audit.
# Miền hợp lệ: 1..100. Nếu parse lỗi hoặc out-of-range thì fallback về 5.
AI_MAX_CONCURRENCY = _parse_int_setting(
    os.getenv("AI_MAX_CONCURRENCY", 5), default=5, minimum=1, maximum=100
)

# OPENAI BATCH MODEL: model dùng riêng cho Batch API chính thức.
OPENAI_BATCH_MODEL_FALLBACK = "gpt-4.1-nano"
OPENAI_BATCH_MODEL_OVERRIDES = {
    "gpt-5-nano": "gpt-4.1-nano",
}


def normalize_openai_batch_model(value: str | None) -> str:
    """Chuẩn hóa batch model để runtime cũ không tiếp tục dùng model không mong muốn."""
    model = str(value or "").strip()
    if not model:
        return OPENAI_BATCH_MODEL_FALLBACK
    return OPENAI_BATCH_MODEL_OVERRIDES.get(model, model)


OPENAI_BATCH_MODEL = normalize_openai_batch_model(
    os.getenv("OPENAI_BATCH_MODEL", OPENAI_BATCH_MODEL_FALLBACK)
)

# OPENAI BATCH API KEY: ưu tiên DB (mã hóa), fallback .env
OPENAI_BATCH_API_KEY = os.getenv("OPENAI_BATCH_API_KEY", "").strip()

# MEMBER RECENCY WINDOW: Chỉ tính Git authorship trong N tháng gần đây cho member scoring.
# Miền hợp lệ: 1..24. Nếu parse lỗi hoặc out-of-range thì fallback về 3.
MEMBER_RECENT_MONTHS = _parse_int_setting(
    os.getenv("MEMBER_RECENT_MONTHS", 3), default=3, minimum=1, maximum=24
)

# AUTH TOGGLE: Bật/tắt yêu cầu đăng nhập Google OAuth
# true  = Bắt buộc đăng nhập để truy cập Dashboard
# false = Bỏ qua xác thực, mọi người đều truy cập được (dùng cho local dev / demo)
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "true").lower() in ("true", "1", "yes")


def _get_db_config_value(key: str):
    try:
        from src.engine.database import AuditDatabase

        return AuditDatabase.get_config(key)
    except Exception:
        logger.warning(
            "Không thể đọc config '%s' từ database, dùng fallback từ env/default.",
            key,
            exc_info=True,
        )
        return None


def get_ai_enabled() -> bool:
    """Đọc AI_ENABLED từ DB (ưu tiên) hoặc .env (fallback).
    Cho phép thay đổi runtime từ Settings UI mà không cần restart."""
    val = _get_db_config_value("ai_enabled")
    if val is not None:
        return str(val).lower() in ("true", "1", "yes")
    return AI_ENABLED


def get_ai_mode() -> str:
    """Đọc AI_MODE từ DB (ưu tiên) hoặc .env (fallback)."""
    val = _get_db_config_value("ai_mode")
    if val in {"realtime", "openai_batch"}:
        return val
    return AI_MODE


def get_test_mode_limit() -> int:
    """Đọc TEST_MODE_LIMIT_FILES từ DB (ưu tiên) hoặc .env (fallback).
    0 = full scan (production), >0 = giới hạn N files (test)."""
    val = _get_db_config_value("test_mode_limit_files")
    if val is not None:
        return _parse_int_setting(val, default=TEST_MODE_LIMIT_FILES, minimum=0)
    return TEST_MODE_LIMIT_FILES


def get_ai_max_concurrency() -> int:
    """Đọc AI_MAX_CONCURRENCY từ DB (ưu tiên) hoặc .env (fallback).
    Giá trị hợp lệ: 1..100; nếu DB lỗi hoặc out-of-range thì fallback về 5."""
    val = _get_db_config_value("ai_max_concurrency")
    if val is not None:
        return _parse_int_setting(
            val,
            default=5,
            minimum=1,
            maximum=100,
        )
    return AI_MAX_CONCURRENCY


def get_openai_batch_model() -> str:
    """Đọc OPENAI_BATCH_MODEL từ DB (ưu tiên) hoặc .env (fallback)."""
    val = _get_db_config_value("openai_batch_model")
    if val:
        return normalize_openai_batch_model(str(val))
    return OPENAI_BATCH_MODEL


def get_openai_batch_api_key() -> str:
    """Đọc OpenAI Batch API key từ DB (mã hóa, ưu tiên) hoặc .env (fallback)."""
    val = _get_db_config_value("openai_batch_api_key_encrypted")
    if val:
        from src.engine.settings_crypto import SettingsCryptoError, decrypt_setting

        try:
            decrypted = decrypt_setting(val)
        except SettingsCryptoError:
            if OPENAI_BATCH_API_KEY:
                logger.warning(
                    "Không thể giải mã OpenAI Batch API key từ DB, dùng fallback từ biến môi trường."
                )
                return OPENAI_BATCH_API_KEY
            raise
        if decrypted:
            return decrypted
    return OPENAI_BATCH_API_KEY


def has_openai_batch_api_key() -> bool:
    """True nếu có OpenAI Batch API key từ DB hoặc .env."""
    encrypted_val = _get_db_config_value("openai_batch_api_key_encrypted")
    return bool(str(encrypted_val or "").strip() or OPENAI_BATCH_API_KEY)


def get_member_recent_months() -> int:
    """Đọc MEMBER_RECENT_MONTHS từ DB (ưu tiên) hoặc .env (fallback).
    Giá trị hợp lệ: 1..24; nếu DB lỗi hoặc out-of-range thì fallback về 3."""
    val = _get_db_config_value("member_recent_months")
    if val is not None:
        return _parse_int_setting(
            val,
            default=3,
            minimum=1,
            maximum=24,
        )
    return MEMBER_RECENT_MONTHS


def get_auth_required() -> bool:
    """Đọc AUTH_REQUIRED từ DB (ưu tiên) hoặc .env (fallback).
    True = bắt buộc đăng nhập, False = bỏ qua xác thực."""
    val = _get_db_config_value("auth_required")
    if val is not None:
        return str(val).lower() in ("true", "1", "yes")
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
