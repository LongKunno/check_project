"""
Router: Rules management — CRUD, compile, test, toggle.
"""

import os
import ast
import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel, Field

from src.engine.database import AuditDatabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _rethrow_runtime_error(exc: Exception):
    if isinstance(exc, RuntimeError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


def _get_rules_path():
    # routers/rules.py -> routers/ -> api/ -> src/ + engine/rules.json
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "engine",
        "rules.json",
    )


def _run_scanners_sync(content, compiled_json):
    """
    Chạy scanner đồng bộ trong ThreadPool (tránh block event loop).
    Cần flatten compiled_json (định dạng AI) sang cấu trúc {'rules': [...]} mà scanners yêu cầu.
    """
    from src.engine.scanners import RegexScanner, PythonASTScanner

    file_path = "sandbox.py"
    lines = content.splitlines()
    tree = None
    syntax_error = None
    try:
        tree = ast.parse(content)
    except Exception as e:
        logger.warning(f"SyntaxError when parsing sandbox code: {e}")
        syntax_error = str(e)

    # Flatten AI Rules (CompiledRules format) to Scanner Rules (List format)
    flattened_rules = []

    # 1. Regex Rules mapping
    for r in compiled_json.get("regex_rules", []):
        flattened_rules.append(
            {
                "id": r.get("id", "CUSTOM_REGEX"),
                "regex": {"pattern": r.get("pattern")},
                "reason": r.get("reason", "Custom Regex Rule"),
                "pillar": r.get("pillar", "Security"),
                "weight": r.get("weight", -1.0),
                "severity": r.get("severity", "Minor"),
            }
        )

    # 2. AST Rules mapping
    ast_cfg = compiled_json.get("ast_rules", {})

    # Dangerous functions are a special case of AST rule
    if "dangerous_functions" in ast_cfg:
        flattened_rules.append(
            {
                "id": "CUSTOM_DANGEROUS_FUNCS",
                "ast": {
                    "type": "dangerous_functions",
                    "targets": ast_cfg["dangerous_functions"],
                },
                "pillar": "Security",
                "weight": -2.0,
            }
        )

    # Native AST checks (bare_except, complexity, etc.)
    # In V2 we might have them as keys in ast_rules, e.g. "bare_except": {...}
    for key, val in ast_cfg.items():
        if key == "dangerous_functions":
            continue
        # Rule might be passed as a dict with its own metadata
        if isinstance(val, dict):
            flattened_rules.append(
                {
                    "id": val.get("id", f"AST_{key.upper()}"),
                    "ast": {"type": key, **val},
                    "reason": val.get("reason", f"AST check for {key}"),
                    "pillar": val.get("pillar", "Maintainability"),
                    "weight": val.get("weight", -2.0),
                }
            )

    scan_rules = {"rules": flattened_rules}
    violations = []

    if syntax_error:
        violations.append(
            {
                "file": file_path,
                "type": "Reliability",
                "reason": f"Lỗi cú pháp (Syntax Error): Không thể phân tích mã nguồn. Chi tiết: {syntax_error}",
                "weight": -10.0,
                "rule_id": "SYNTAX_ERROR",
                "line": 1,
                "snippet": content[:100] + "...",
                "severity": "Critical",
                "is_false_positive": False,
                "ai_explanation": "Code chứa cú pháp không hợp lệ đối với Python nên máy quét AST không thể khởi chạy. Vui lòng sửa lại code.",
            }
        )

    for scanner in [RegexScanner(), PythonASTScanner()]:
        try:
            violations.extend(scanner.scan(file_path, content, lines, tree, scan_rules))
        except Exception as e:
            logger.warning(f"Scanner {scanner.__class__.__name__} failed: {e}")
    return violations


@router.get("/rules")
async def get_rules(target: str = Query(..., description="Target ID")):
    """Lấy danh sách rules mặc định và custom của một dự án."""
    default_rules_with_weight = {}
    try:
        with open(_get_rules_path(), "r", encoding="utf-8") as f:
            engine_rules = json.load(f)
        for r in engine_rules.get("rules", []):
            rule_id = r.get("id")
            if rule_id:
                default_rules_with_weight[rule_id] = {
                    "category": r.get("category", "Maintainability"),
                    "severity": r.get("severity", "Minor"),
                    "debt": r.get("debt", 10),
                    "weight": r.get("weight", -2.0),
                    "reason": r.get("reason", ""),
                    "has_regex": r.get("regex") is not None,
                    "has_ast": r.get("ast") is not None,
                    "has_ai": r.get("ai") is not None,
                    "regex": r.get("regex"),
                    "ast": r.get("ast"),
                    "ai": r.get("ai"),
                }
    except Exception as e:
        logger.error(f"Error reading rules.json: {e}")

    global_rules = AuditDatabase.get_project_rules("GLOBAL") or {}
    project_rules = AuditDatabase.get_project_rules(target) or {}

    response_data = {
        "default_rules": default_rules_with_weight,
        "global_overrides": {
            "disabled_core_rules": global_rules.get("disabled_core_rules", []),
            "enabled_core_rules": global_rules.get("enabled_core_rules", []),
            "custom_weights": global_rules.get("custom_weights", {})
        },
        "project_rules": {
            "disabled_core_rules": project_rules.get("disabled_core_rules", []),
            "enabled_core_rules": project_rules.get("enabled_core_rules", []),
            "custom_weights": project_rules.get("custom_weights", {}),
            "compiled_json": project_rules.get("compiled_json", {}),
            "natural_text": project_rules.get("natural_text", "")
        }
    }
    return {"status": "success", "data": response_data}


class SaveRulesRequest(BaseModel):
    target: str
    natural_text: str = ""
    compiled_json: Optional[dict] = None
    custom_weights: dict = Field(default_factory=dict)


@router.post("/rules/save")
async def save_rules(request: SaveRulesRequest):
    """Lưu custom rules và custom weights cho một dự án."""
    try:
        AuditDatabase.save_project_rules(
            target_id=request.target,
            natural_text=request.natural_text,
            compiled_json=request.compiled_json,
        )
        AuditDatabase.save_custom_weights(
            target_id=request.target, custom_weights=request.custom_weights
        )
        return {"status": "success", "message": "Rules saved successfully."}
    except Exception as e:
        _rethrow_runtime_error(e)


@router.delete("/rules")
async def delete_rules(
    target: str = Query(..., description="Target ID to delete rules for")
):
    """Xóa custom rules — khôi phục về mặc định."""
    try:
        AuditDatabase.delete_project_rules(target)
        return {"status": "success", "message": "Rules deleted successfully."}
    except Exception as e:
        _rethrow_runtime_error(e)


class ResetRulesRequest(BaseModel):
    target: str
    level: str  # toggles | weights | custom | all


@router.post("/rules/reset")
async def reset_rules(request: ResetRulesRequest):
    """Reset rules theo cấp độ chọn lọc.
    
    Levels:
    - toggles: Reset disabled_core_rules + enabled_core_rules
    - weights: Reset custom_weights về mặc định
    - custom: Xóa compiled_json + natural_text (AI custom rules)
    - all: Xóa toàn bộ row (nuclear option)
    """
    valid_levels = {"toggles", "weights", "custom", "all"}
    if request.level not in valid_levels:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid level '{request.level}'. Must be one of: {', '.join(valid_levels)}"
        )
    try:
        AuditDatabase.partial_reset_project_rules(request.target, request.level)
        level_messages = {
            "toggles": "Rule toggles (bật/tắt) đã được reset.",
            "weights": "Custom weights đã được reset về mặc định.",
            "custom": "Custom AI Rules đã được xóa.",
            "all": "Toàn bộ cấu hình đã được xóa.",
        }
        return {
            "status": "success",
            "message": level_messages.get(request.level, "Reset thành công."),
            "level": request.level,
            "target": request.target,
        }
    except Exception as e:
        _rethrow_runtime_error(e)


class ToggleRuleRequest(BaseModel):
    target: str
    rule_id: str
    is_disabled: bool
    is_override_reset: Optional[bool] = False


@router.post("/rules/toggle")
async def toggle_rule(request: ToggleRuleRequest):
    """Bật/tắt một rule cụ thể cho một dự án."""
    try:
        AuditDatabase.toggle_core_rule(
            request.target, request.rule_id, request.is_disabled, request.is_override_reset
        )
        return {"status": "success", "message": f"Rule {request.rule_id} toggled."}
    except Exception as e:
        _rethrow_runtime_error(e)


class CompileRulesRequest(BaseModel):
    natural_text: str


@router.post("/rules/compile")
async def compile_rules(request: CompileRulesRequest):
    """Biên dịch ngôn ngữ tự nhiên thành JSON Rule bằng AI (streaming)."""
    from src.engine.natural_rules_compiler import NaturalRulesCompiler

    compiler = NaturalRulesCompiler()

    async def log_generator():
        try:
            async for chunk in compiler.compile_rules_stream(request.natural_text):
                yield chunk
        except Exception as e:
            yield f"\\n\\n[LỖI]: {str(e)}"

    return StreamingResponse(log_generator(), media_type="text/plain")


class TestRuleRequest(BaseModel):
    code_snippet: str
    compiled_json: dict


@router.post("/rules/test")
async def test_rule(request: TestRuleRequest):
    """Chạy thử nghiệm Rule trên Sandbox — có Timeout chống ReDoS."""
    try:
        violations = await asyncio.wait_for(
            asyncio.to_thread(
                _run_scanners_sync, request.code_snippet, request.compiled_json
            ),
            timeout=5.0,
        )

        # --- AI Review Step (Simulation of Phase 2 in Auditor) ---
        if violations:
            from src.engine.ai_service import ai_service

            # verify_violations_batch trả về { index: { "is_false_positive": bool, "explanation": str }, ... }
            review_results = await ai_service.verify_violations_batch(
                violations,
                telemetry={
                    "source": "rules.test.review",
                    "target": "sandbox.py",
                    "project": "sandbox",
                },
            )
            for str_idx, res in review_results.items():
                idx = int(str_idx)
                if idx < len(violations):
                    violations[idx]["is_false_positive"] = res.get(
                        "is_false_positive", False
                    )
                    violations[idx]["ai_explanation"] = res.get("explanation", "")

        # --- Deep Audit Step (Simulation of Phase 3 for AI-only rules) ---
        ai_rules = request.compiled_json.get("ai_rules", [])
        if ai_rules:
            from src.engine.ai_service import ai_service

            custom_rules_for_deep = {
                "natural_text": "Quy định riêng: "
                + json.dumps(ai_rules, ensure_ascii=False)
            }
            files_chunk = [{"path": "sandbox.py", "content": request.code_snippet}]
            # Gọi deep_audit_batch để AI tự lùng sục lỗi
            deep_violations = await ai_service.deep_audit_batch(
                files_chunk,
                custom_rules=custom_rules_for_deep,
                telemetry={
                    "source": "rules.test.deep_audit",
                    "target": "sandbox.py",
                    "project": "sandbox",
                },
            )

            for dv in deep_violations:
                dv["is_false_positive"] = False
                dv["ai_explanation"] = (
                    "Phát hiện trực tiếp bằng AI Deep Audit (Bỏ qua máy quét tĩnh)."
                )

            violations.extend(deep_violations)

        return {"status": "success", "violations": violations}
    except asyncio.TimeoutError:
        return {
            "status": "error",
            "message": "Timeout: Regex quá phức tạp hoặc gây ReDoS!",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


class AutoFixRequest(BaseModel):
    failed_json: str
    test_case_code: str
    error_message: str


@router.post("/rules/auto_fix")
async def auto_fix_rule(request: AutoFixRequest):
    """Gửi lỗi cho AI tự động sửa file JSON."""
    from src.engine.natural_rules_compiler import NaturalRulesCompiler

    compiler = NaturalRulesCompiler()

    async def log_generator():
        try:
            async for chunk in compiler.auto_fix_stream(
                request.failed_json, request.test_case_code, request.error_message
            ):
                yield chunk
        except Exception as e:
            yield f"\\n\\n[LỖI]: {str(e)}"

    return StreamingResponse(log_generator(), media_type="text/plain")
