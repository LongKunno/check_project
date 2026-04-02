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
from pydantic import BaseModel

from src.engine.database import AuditDatabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_rules_path():
    # routers/rules.py -> routers/ -> api/ -> src/ + engine/rules.json
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'engine', 'rules.json')


def _run_scanners_sync(content, rules):
    """Chạy scanner đồng bộ trong ThreadPool (tránh block event loop)."""
    from src.engine.scanners import RegexScanner, PythonASTScanner
    file_path = "sandbox.py"
    lines = content.splitlines()
    tree = None
    try:
        tree = ast.parse(content)
    except Exception:
        pass
    violations = []
    for scanner in [RegexScanner(), PythonASTScanner()]:
        try:
            violations.extend(scanner.scan(file_path, content, lines, tree, rules))
        except Exception:
            pass
    return violations


@router.get("/rules")
async def get_rules(target: str = Query(..., description="Target ID")):
    """Lấy danh sách rules mặc định và custom của một dự án."""
    default_rules_with_weight = {}
    try:
        with open(_get_rules_path(), 'r', encoding='utf-8') as f:
            engine_rules = json.load(f)
        for r in engine_rules.get('rules', []):
            rule_id = r.get('id')
            if rule_id:
                default_rules_with_weight[rule_id] = {
                    "category": r.get('category', 'Maintainability'),
                    "severity": r.get('severity', 'Minor'),
                    "debt": r.get('debt', 10),
                    "weight": r.get('weight', -2.0),
                    "reason": r.get('reason', ''),
                    "has_regex": r.get('regex') is not None,
                    "has_ast": r.get('ast') is not None,
                    "has_ai": r.get('ai') is not None,
                    "regex": r.get('regex'),
                    "ast": r.get('ast'),
                    "ai": r.get('ai')
                }
    except Exception as e:
        logger.error(f"Error reading rules.json: {e}")

    rules = AuditDatabase.get_project_rules(target)
    response_data = {"default_rules": default_rules_with_weight}
    if rules:
        response_data.update(rules)
    return {"status": "success", "data": response_data}


class SaveRulesRequest(BaseModel):
    target: str
    natural_text: str = ""
    compiled_json: Optional[dict] = None
    custom_weights: dict = {}


@router.post("/rules/save")
async def save_rules(request: SaveRulesRequest):
    """Lưu custom rules và custom weights cho một dự án."""
    try:
        AuditDatabase.save_project_rules(
            target_id=request.target,
            natural_text=request.natural_text,
            compiled_json=request.compiled_json
        )
        AuditDatabase.save_custom_weights(
            target_id=request.target,
            custom_weights=request.custom_weights
        )
        return {"status": "success", "message": "Rules saved successfully."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules")
async def delete_rules(target: str = Query(..., description="Target ID to delete rules for")):
    """Xóa custom rules — khôi phục về mặc định."""
    try:
        AuditDatabase.delete_project_rules(target)
        return {"status": "success", "message": "Rules deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ToggleRuleRequest(BaseModel):
    target: str
    rule_id: str
    is_disabled: bool


@router.post("/rules/toggle")
async def toggle_rule(request: ToggleRuleRequest):
    """Bật/tắt một rule cụ thể cho một dự án."""
    try:
        AuditDatabase.toggle_core_rule(request.target, request.rule_id, request.is_disabled)
        return {"status": "success", "message": f"Rule {request.rule_id} toggled."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            asyncio.to_thread(_run_scanners_sync, request.code_snippet, request.compiled_json),
            timeout=5.0
        )
        return {"status": "success", "violations": violations}
    except asyncio.TimeoutError:
        return {"status": "error", "message": "Timeout: Regex quá phức tạp hoặc gây ReDoS!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
