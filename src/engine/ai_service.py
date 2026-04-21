import asyncio
import io
import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.config import get_openai_batch_api_key, get_openai_batch_model
from src.engine.ai_telemetry import AiBudgetExceededError, ai_telemetry

try:
    from src.api.audit_state import AuditState, JobManager
except ImportError:

    class AuditState:
        is_cancelled = False

    class JobManager:
        @staticmethod
        def get_active_job_id():
            return None

        @staticmethod
        def is_cancel_requested(job_id):
            return False


logger = logging.getLogger(__name__)

load_dotenv()


class DeepAuditViolation(BaseModel):
    file: str = Field(..., description="Đường dẫn file vi phạm")
    type: str = Field(
        ..., description="Trụ cột: Performance, Maintainability, Reliability, Security"
    )
    reason: str = Field(..., description="Giải thích chi tiết lỗi logic/kiến trúc")
    weight: float = Field(
        ..., description="Điểm phạt (từ -0.5 đến -2.0, KHÔNG được quá -2.0)"
    )
    confidence: float = Field(..., description="Độ tin cậy từ 0.0 đến 1.0")
    line: int = Field(default=0, description="Dòng code xảy ra lỗi (nếu xác định được)")
    rule_id: str = Field(
        default="AI_REASONING",
        description="Rule ID cụ thể nếu vi phạm khớp với một luật AI-only đã định nghĩa.",
    )
    is_custom: bool = Field(
        default=False,
        description="True nếu vi phạm bộ quy tắc tùy chỉnh của người dùng",
    )
    needs_verification: bool = Field(
        default=False,
        description="True nếu lỗi này liên kết đến logic ở file khác và bạn không chắc chắn.",
    )
    verify_target: str = Field(
        default="",
        description="Nếu needs_verification=True, cung cấp tên hàm/class để hệ thống cross-check.",
    )


class DeepAuditResponse(BaseModel):
    violations: List[DeepAuditViolation]


class ViolationValidation(BaseModel):
    index: int = Field(..., description="Số thứ tự của vi phạm trong danh sách đầu vào")
    is_false_positive: bool = Field(
        ..., description="True nếu là báo lỗi sai, False nếu là lỗi thật"
    )
    explanation: str = Field(..., description="Giải thích ngắn gọn")
    confidence: float = Field(..., description="Độ tin cậy 0.0 - 1.0")


class ValidationResponse(BaseModel):
    results: List[ViolationValidation]


class AiService:
    OPENAI_BATCH_BASE_URL = "https://api.openai.com/v1"
    BATCH_TERMINAL_STATUSES = {
        "completed",
        "failed",
        "expired",
        "cancelled",
        "canceled",
    }

    def __init__(self):
        self.base_url = os.getenv(
            "AI_BASE_URL", "https://parents-sail-gig-anti.trycloudflare.com/v1"
        )
        self.api_key = os.getenv("AI_API_KEY", "xxxxxxx")
        self.model = os.getenv("AI_MODEL", "gpt-5.4")
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=180.0,
        )

    def _get_realtime_client(self):
        return self.client

    def _get_realtime_model(self) -> str:
        return self.model

    def _get_batch_model(self) -> str:
        return get_openai_batch_model()

    def _get_batch_api_key(self) -> str:
        return get_openai_batch_api_key()

    def _build_telemetry_context(
        self, source: str, telemetry: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        context = dict(telemetry or {})
        context["source"] = source
        context.setdefault("job_id", JobManager.get_active_job_id())
        return context

    def _get_realtime_provider(self) -> str:
        return ai_telemetry.detect_provider(self.base_url, mode="realtime")

    async def create_tracked_chat_completion(
        self,
        *,
        messages: List[Dict[str, Any]],
        source: str,
        telemetry: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.0,
        response_format: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
    ):
        provider = self._get_realtime_provider()
        mode = "realtime"
        resolved_model = model or self._get_realtime_model()
        context = self._build_telemetry_context(source, telemetry)
        request_log = ai_telemetry.begin_request(
            payload=messages,
            provider=provider,
            mode=mode,
            model=resolved_model,
            context=context,
        )
        client = self._get_realtime_client()
        request_kwargs = {
            "model": resolved_model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format is not None:
            request_kwargs["response_format"] = response_format
        if max_tokens is not None:
            request_kwargs["max_tokens"] = max_tokens

        try:
            response = await client.chat.completions.create(**request_kwargs)
            content = self._normalize_content(
                response.choices[0].message.content if response.choices else ""
            )
            ai_telemetry.complete_request(
                request_log["request_id"],
                provider=provider,
                mode=mode,
                model=resolved_model,
                output_payload=content,
                usage=getattr(response, "usage", None),
            )
            return response
        except Exception as exc:
            ai_telemetry.fail_request(
                request_log["request_id"],
                provider=provider,
                mode=mode,
                model=resolved_model,
                error_reason=str(exc),
            )
            raise

    async def stream_tracked_chat_completion(
        self,
        *,
        messages: List[Dict[str, Any]],
        source: str,
        telemetry: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None,
    ):
        provider = self._get_realtime_provider()
        mode = "realtime"
        resolved_model = model or self._get_realtime_model()
        context = self._build_telemetry_context(source, telemetry)
        request_log = ai_telemetry.begin_request(
            payload=messages,
            provider=provider,
            mode=mode,
            model=resolved_model,
            context=context,
        )

        request_kwargs = {
            "model": resolved_model,
            "messages": messages,
            "stream": True,
            "temperature": temperature,
        }
        if max_tokens is not None:
            request_kwargs["max_tokens"] = max_tokens

        chunks: List[str] = []
        usage = None
        try:
            stream = await self._get_realtime_client().chat.completions.create(
                **request_kwargs
            )
            async for chunk in stream:
                if getattr(chunk, "usage", None) is not None:
                    usage = chunk.usage
                delta = None
                if chunk.choices:
                    delta = getattr(chunk.choices[0].delta, "content", None)
                if delta is not None:
                    chunks.append(delta)
                    yield delta
            ai_telemetry.complete_request(
                request_log["request_id"],
                provider=provider,
                mode=mode,
                model=resolved_model,
                output_payload="".join(chunks),
                usage=usage,
            )
        except Exception as exc:
            ai_telemetry.fail_request(
                request_log["request_id"],
                provider=provider,
                mode=mode,
                model=resolved_model,
                error_reason=str(exc),
                output_payload="".join(chunks),
            )
            raise

    def _is_cancel_requested(self) -> bool:
        try:
            job_id = JobManager.get_active_job_id()
            if job_id and JobManager.is_cancel_requested(job_id):
                return True
        except Exception:
            logger.debug("AI cancel lookup failed unexpectedly.", exc_info=True)
        return getattr(AuditState, "is_cancelled", False)

    def _extract_json(self, content: str) -> str:
        json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        json_match = re.search(r"(\[.*\]|\{.*\})", content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        return content

    def _normalize_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif "text" in item:
                        text_parts.append(str(item.get("text", "")))
                else:
                    text_parts.append(str(item))
            return "".join(text_parts)
        if content is None:
            return ""
        return str(content)

    def _parse_response_model(
        self, content: str, response_model: type[BaseModel]
    ) -> Any:
        json_str = self._extract_json(content)
        try:
            data = json.loads(json_str, strict=False)
        except json.JSONDecodeError:
            json_str_fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", json_str)
            data = json.loads(json_str_fixed, strict=False)
        return response_model.model_validate(data)

    async def _call_llm_json(
        self,
        prompt: str,
        system_message: str,
        response_model: type[BaseModel],
        source: str = "ai.json_call",
        telemetry: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> Any:
        model = self._get_realtime_model()
        for attempt in range(max_retries):
            if self._is_cancel_requested():
                logger.info("⏹️ Bỏ qua request AI mới vì job đã nhận yêu cầu huỷ.")
                return None
            try:
                response = await self.create_tracked_chat_completion(
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt},
                    ],
                    source=source,
                    telemetry=telemetry,
                    model=model,
                    temperature=0.0,
                    response_format=(
                        {"type": "json_object"}
                        if "gemini" not in model.lower()
                        else None
                    ),
                )
                content = self._normalize_content(
                    response.choices[0].message.content if response.choices else ""
                )
                if not content:
                    raise ValueError("Empty AI response")
                parsed = self._parse_response_model(content, response_model)
                if self._is_cancel_requested():
                    logger.info(
                        "⏹️ Bỏ qua kết quả AI vừa nhận vì job đã nhận yêu cầu huỷ."
                    )
                    return None
                return parsed
            except Exception as exc:
                if self._is_cancel_requested():
                    logger.info(
                        "⏹️ Dừng retry AI sau request đang chạy vì job đã nhận yêu cầu huỷ."
                    )
                    return None
                logger.warning(f"⚠️ AI call attempt {attempt + 1} failed: {exc}")
                if isinstance(exc, AiBudgetExceededError):
                    raise
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
        return None

    def _load_ai_only_rules(self) -> str:
        rules_path = os.path.join(os.path.dirname(__file__), "rules.json")
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            ai_rules = []
            for rule in data.get("rules", []):
                has_regex = rule.get("regex") is not None
                has_ast = rule.get("ast") is not None
                has_ai = rule.get("ai") is not None and rule.get("ai", {}).get("prompt")
                if not has_regex and not has_ast and has_ai:
                    ai_rules.append(
                        {
                            "id": rule["id"],
                            "pillar": rule["pillar"],
                            "severity": rule["severity"],
                            "weight": rule["weight"],
                            "description": rule["reason"],
                            "detect_instruction": rule["ai"]["prompt"],
                        }
                    )
            if not ai_rules:
                return ""
            rules_text = "\n".join(
                f"- **{rule['id']}** [{rule['pillar']}/{rule['severity']}] (weight: {rule['weight']}): {rule['description']}\n"
                f"  HƯỚNG DẪN PHÁT HIỆN: {rule['detect_instruction']}"
                for rule in ai_rules
            )
            rule_ids = ", ".join(rule["id"] for rule in ai_rules)
            return (
                "\n## DANH SÁCH LUẬT AI-ONLY (BẮT BUỘC KIỂM TRA):\n"
                "Các luật dưới đây CHỈ có thể được phát hiện bởi AI (không có Regex/AST). "
                "Hãy ĐẶC BIỆT chú ý kiểm tra từng luật.\n"
                f"Khi phát hiện vi phạm khớp với luật nào, hãy đặt `rule_id` = ID tương ứng ({rule_ids}).\n"
                "Nếu vi phạm không khớp luật nào trong danh sách, đặt `rule_id` = 'AI_REASONING'.\n\n"
                f"{rules_text}\n"
            )
        except Exception:
            return ""

    def _build_deep_audit_messages(
        self,
        files_chunk: List[Dict[str, str]],
        custom_rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, str]]:
        custom_rules_prompt = ""
        if custom_rules:
            natural_text = custom_rules.get("natural_text", "")
            if natural_text:
                custom_rules_prompt = (
                    f"\nUSER DEFINED PROJECT RULES (ƯU TIÊN): {natural_text}\n"
                )
            else:
                custom_rules_prompt = (
                    "\nUSER DEFINED PROJECT RULES (ƯU TIÊN): "
                    f"{json.dumps(custom_rules, ensure_ascii=False)}\n"
                )

        files_prompt = "".join(
            f"\n--- FILE: {file_info['path']} ---\n{file_info['content']}\n"
            for file_info in files_chunk
        )
        extensions = {os.path.splitext(file_info["path"])[1] for file_info in files_chunk}
        tech_context = f"Dự án đang sử dụng các ngôn ngữ/format: {', '.join(sorted(extensions))}"
        ai_only_rules_prompt = self._load_ai_only_rules()

        prompt = f"""
Bạn là một Auditor Senior chuyên sâu về: {tech_context}.
Hãy thực hiện quét sâu danh sách mã nguồn dưới đây để tìm các lỗi tiềm ẩn mà các công cụ quét tĩnh thông thường (Regex/AST) không thể bắt được.

DANH SÁCH MÃ NGUỒN:
{files_prompt}

{custom_rules_prompt}
{ai_only_rules_prompt}

TẬP TRUNG VÀO:
1. Các vi phạm đối với DANH SÁCH LUẬT AI-ONLY ở trên (BẮT BUỘC kiểm tra từng luật).
2. Các vi phạm đối với TẬP LUẬT TÙY CHỈNH CỦA NGƯỜI DÙNG (nếu có ở trên).
3. Lỗi logic luồng xử lý (Logic flaws, race conditions, improper error handling).
4. Lỗi kiến trúc (Circular dependencies, God objects, violation of Separation of Concerns).
5. Nguy cơ bảo mật tiềm ẩn (Insecure data flow, business logic vulnerabilities).
6. Khả năng bảo trì (Clean code, adherence to best practices for {tech_context}).

Yêu cầu trả về kết quả dưới dạng đối tượng JSON với key 'violations' là một mảng:
{{
  "violations": [
    {{
      "file": "path/to/file.py",
      "type": "Security",
      "reason": "Giải thích chi tiết...",
      "weight": -2.0,
      "confidence": 0.95,
      "line": 12,
      "rule_id": "INSECURE_RANDOM",
      "is_custom": true,
      "needs_verification": true,
      "verify_target": "get_user"
    }}
  ]
}}
Nếu không thấy lỗi nào, trả về {{"violations": []}}.
QUY TẮC rule_id: Nếu vi phạm khớp với một luật AI-ONLY đã liệt kê ở trên, BẮT BUỘC đặt `rule_id` = ID của luật đó. Nếu không khớp luật nào, đặt `rule_id` = 'AI_REASONING'.
AI cũng có trách nhiệm phát hiện xem một lỗi có vi phạm TRỰC TIẾP 'USER DEFINED PROJECT RULES' hay không để đặt 'is_custom' = true.
QUAN TRỌNG: NGUYÊN TẮC 'TWO-PASS AUDIT'. Nếu bạn nghi ngờ một lời gọi hàm dẫn đến lỗi logic chéo file, TUYỆT ĐỐI KHÔNG SUY ĐOÁN.
Hãy bật `needs_verification: true` và gõ tên hàm đó vào `verify_target`.
"""
        system_msg = (
            "You are a senior auditor. Respond with strictly valid JSON matching the requested schema."
        )
        return [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]

    def _build_validation_messages(
        self, violations_chunk: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        parts = []
        for index, violation in enumerate(violations_chunk):
            ai_instruction = (
                f"CHỈ ĐẠO CỤ THỂ CHO LỖI NÀY: {violation.get('ai_prompt')}\n"
                if violation.get("ai_prompt")
                else ""
            )
            parts.append(
                f"\n--- Vi phạm #{index} ---\n"
                f"File: {violation['file']}\n"
                f"Lỗi: {violation['reason']}\n"
                f"Trụ cột: {violation['type']}\n"
                f"Đoạn mã:\n```\n{violation.get('snippet', '')}\n```\n"
                f"{ai_instruction}"
            )
        items_prompt = "".join(parts)
        prompt = f"""
Bạn là một chuyên gia Review Code. Hãy xác định xem các lỗi dưới đây là lỗi thật (True Positive) hay báo lỗi sai (False Positive).

DANH SÁCH VI PHẠM:
{items_prompt}

Yêu cầu trả về kết quả dưới dạng đối tượng JSON với key 'results' là một mảng, mỗi phần tử tương ứng với một vi phạm theo đúng thứ tự 'index':
{{
  "results": [
    {{
      "index": 0,
      "is_false_positive": boolean,
      "explanation": "Giải thích...",
      "confidence": 0.9
    }}
  ]
}}
"""
        system_msg = (
            "You are a code reviewer. Respond with strictly valid JSON matching the requested schema."
        )
        return [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]

    def _build_cross_check_messages(
        self, flagged_violations: List[Dict[str, Any]], context_cache: Dict[str, str]
    ) -> List[Dict[str, str]]:
        items_prompt = "".join(
            (
                f"\n--- Cờ nghi vấn #{index} ---\n"
                f"Bối cảnh lỗi ban đầu ở File: {violation['file']}\n"
                f"Lý do bạn nghi ngờ: {violation['reason']}\n"
                f"Trụ cột: {violation['type']}\n"
                f"BẰNG CHỨNG HỆ THỐNG CUNG CẤP TỪ {violation.get('verify_target', '')}:\n"
                f"{context_cache.get(violation.get('verify_target', ''), 'Code not found')}\n"
            )
            for index, violation in enumerate(flagged_violations)
        )
        prompt = f"""
GIÁM ĐỐC KỸ THUẬT QUY ĐỊNH (PHASE 2 CROSS-CHECK):
Dưới đây là các 'Cờ Nghi Vấn' do chính bạn cắm cờ ở đợt review trước do thiếu ngữ cảnh liên kết.
Hệ thống Python AST hiện tại đã dò tìm và đính kèm Bằng Chứng Ngữ Cảnh thực tế để bạn đối chiếu.

DANH SÁCH CỜ:
{items_prompt}

NHIỆM VỤ: Hãy nhìn vào Nội dung Bằng chứng.
- Nếu bằng chứng chỉ ra code được viết an toàn -> is_false_positive = true.
- Nếu bằng chứng cho thấy có lỗi thật -> is_false_positive = false.

Trả về JSON:
{{
  "results": [
    {{
      "index": 0,
      "is_false_positive": boolean,
      "explanation": "Lý giải ngắn gọn sau khi soi bằng chứng...",
      "confidence": 0.95
    }}
  ]
}}
"""
        system_msg = (
            "You are a lead auditor. Resolve flagged suspicions with evidence. Return strict JSON."
        )
        return [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]

    async def deep_audit_batch(
        self,
        files_chunk: List[Dict[str, str]],
        custom_rules: Optional[Dict[str, Any]] = None,
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not files_chunk:
            return []
        messages = self._build_deep_audit_messages(files_chunk, custom_rules)
        validated_data = await self._call_llm_json(
            messages[1]["content"],
            messages[0]["content"],
            DeepAuditResponse,
            source=(telemetry or {}).get("source", "audit.deep_audit"),
            telemetry=telemetry,
        )
        return (
            [violation.model_dump() for violation in validated_data.violations]
            if validated_data
            else []
        )

    async def verify_violations_batch(
        self,
        violations_chunk: List[Dict[str, Any]],
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> Dict[int, Dict[str, Any]]:
        if not violations_chunk:
            return {}
        messages = self._build_validation_messages(violations_chunk)
        validated_data = await self._call_llm_json(
            messages[1]["content"],
            messages[0]["content"],
            ValidationResponse,
            source=(telemetry or {}).get("source", "audit.validation"),
            telemetry=telemetry,
        )
        return (
            {result.index: result.model_dump() for result in validated_data.results}
            if validated_data
            else {}
        )

    async def verify_violation(self, file_path, code_snippet, reason, pillar):
        res = await self.verify_violations_batch(
            [
                {
                    "file": file_path,
                    "snippet": code_snippet,
                    "reason": reason,
                    "type": pillar,
                }
            ]
        )
        if 0 in res:
            validation = res[0]
            return (
                validation["is_false_positive"],
                validation["explanation"],
                validation["confidence"],
            )
        return False, "AI failed to respond", 0.0

    async def verify_flagged_issues(
        self,
        flagged_violations: List[Dict[str, Any]],
        context_cache: Dict[str, str],
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not flagged_violations:
            return []
        messages = self._build_cross_check_messages(flagged_violations, context_cache)
        validated_data = await self._call_llm_json(
            messages[1]["content"],
            messages[0]["content"],
            ValidationResponse,
            source=(telemetry or {}).get("source", "audit.cross_check"),
            telemetry=telemetry,
        )
        if not validated_data:
            return []

        verified_violations = []
        for result in validated_data.results:
            idx = result.index
            if 0 <= idx < len(flagged_violations):
                if not result.is_false_positive:
                    bug = flagged_violations[idx]
                    bug["reason"] = (
                        f"{bug['reason']} [Cross-Checked: {result.explanation}]"
                    )
                    verified_violations.append(bug)
                else:
                    logger.info(
                        "   🛡️ Đã gỡ cờ một False Positive: "
                        f"{flagged_violations[idx]['reason']} nhờ đối chiếu bằng chứng."
                    )
        return verified_violations

    def parse_validation_content(self, content: str) -> ValidationResponse:
        return self._parse_response_model(content, ValidationResponse)

    def parse_deep_audit_content(self, content: str) -> DeepAuditResponse:
        return self._parse_response_model(content, DeepAuditResponse)

    def build_validation_batch_requests(self, violations_chunks, telemetry=None):
        requests = []
        for idx, chunk in enumerate(violations_chunks):
            requests.append(
                {
                    "custom_id": f"validation-{idx}",
                    "messages": self._build_validation_messages(chunk),
                    "telemetry": dict(telemetry or {}),
                }
            )
        return requests

    def build_deep_audit_batch_requests(
        self, deep_chunks, custom_rules=None, telemetry=None
    ):
        requests = []
        for idx, chunk in enumerate(deep_chunks):
            requests.append(
                {
                    "custom_id": f"deep-audit-{idx}",
                    "messages": self._build_deep_audit_messages(chunk, custom_rules),
                    "telemetry": dict(telemetry or {}),
                }
            )
        return requests

    def build_cross_check_batch_requests(
        self, flagged_chunks, context_cache, telemetry=None
    ):
        requests = []
        for idx, chunk in enumerate(flagged_chunks):
            requests.append(
                {
                    "custom_id": f"cross-check-{idx}",
                    "messages": self._build_cross_check_messages(chunk, context_cache),
                    "telemetry": dict(telemetry or {}),
                }
            )
        return requests

    def _build_chat_completion_body(self, messages, model: Optional[str] = None):
        batch_model = model or self._get_batch_model()
        body = {
            "model": batch_model,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        return body

    def _batch_request_headers(self, content_type: Optional[str] = None):
        api_key = self._get_batch_api_key()
        if not api_key:
            raise RuntimeError("OpenAI Batch API key chưa được cấu hình.")
        headers = {"Authorization": f"Bearer {api_key}"}
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _run_http_request(
        self, method: str, url: str, headers: Dict[str, str], body: Optional[bytes] = None
    ) -> bytes:
        req = urllib_request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib_request.urlopen(req, timeout=180) as response:
                return response.read()
        except urllib_error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(
                f"OpenAI Batch API HTTP {exc.code}: {detail or exc.reason}"
            ) from exc
        except urllib_error.URLError as exc:
            raise RuntimeError(f"OpenAI Batch API connection error: {exc.reason}") from exc

    async def _batch_http_json(self, method: str, path: str, payload: Optional[dict] = None):
        def do_request():
            body = json.dumps(payload).encode("utf-8") if payload is not None else None
            raw = self._run_http_request(
                method,
                f"{self.OPENAI_BATCH_BASE_URL}{path}",
                self._batch_request_headers("application/json"),
                body=body,
            )
            return json.loads(raw.decode("utf-8"))

        return await asyncio.to_thread(do_request)

    async def _batch_download_text(self, file_id: str) -> str:
        def do_request():
            raw = self._run_http_request(
                "GET",
                f"{self.OPENAI_BATCH_BASE_URL}/files/{file_id}/content",
                self._batch_request_headers(),
            )
            return raw.decode("utf-8")

        return await asyncio.to_thread(do_request)

    async def _batch_upload_jsonl(self, lines: List[str]) -> dict:
        payload = ("\n".join(lines) + "\n").encode("utf-8")

        def do_request():
            boundary = f"----BatchBoundary{uuid.uuid4().hex}"
            body = io.BytesIO()
            body.write(f"--{boundary}\r\n".encode("utf-8"))
            body.write(
                b'Content-Disposition: form-data; name="purpose"\r\n\r\nbatch\r\n'
            )
            body.write(f"--{boundary}\r\n".encode("utf-8"))
            body.write(
                b'Content-Disposition: form-data; name="file"; filename="requests.jsonl"\r\n'
            )
            body.write(b"Content-Type: application/jsonl\r\n\r\n")
            body.write(payload)
            body.write(b"\r\n")
            body.write(f"--{boundary}--\r\n".encode("utf-8"))
            raw = self._run_http_request(
                "POST",
                f"{self.OPENAI_BATCH_BASE_URL}/files",
                self._batch_request_headers(
                    f"multipart/form-data; boundary={boundary}"
                ),
                body=body.getvalue(),
            )
            return json.loads(raw.decode("utf-8"))

        return await asyncio.to_thread(do_request)

    async def submit_chat_completion_batch(
        self,
        requests: List[Dict[str, Any]],
        metadata: Optional[Dict[str, str]] = None,
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not requests:
            raise ValueError("Không có request nào để submit vào OpenAI Batch.")

        batch_model = self._get_batch_model()
        provider = "openai"
        mode = "openai_batch"
        pending_requests = ai_telemetry.prepare_batch_requests(
            requests,
            provider=provider,
            mode=mode,
            default_model=batch_model,
            default_context=telemetry,
        )

        lines = []
        for request_item in requests:
            lines.append(
                json.dumps(
                    {
                        "custom_id": request_item["custom_id"],
                        "method": "POST",
                        "url": "/v1/chat/completions",
                        "body": self._build_chat_completion_body(
                            request_item["messages"],
                            model=request_item.get("model"),
                        ),
                    },
                    ensure_ascii=False,
                )
            )

        try:
            uploaded = await self._batch_upload_jsonl(lines)
            batch_payload = {
                "input_file_id": uploaded["id"],
                "endpoint": "/v1/chat/completions",
                "completion_window": "24h",
            }
            if metadata:
                batch_payload["metadata"] = metadata
            created = await self._batch_http_json("POST", "/batches", batch_payload)
            created["input_file_id"] = uploaded["id"]
            ai_telemetry.bind_batch_envelope(created["id"], pending_requests)
            return created
        except Exception as exc:
            for record in pending_requests.values():
                ai_telemetry.fail_request(
                    record["request_id"],
                    provider=provider,
                    mode=mode,
                    model=batch_model,
                    error_reason=str(exc),
                )
            raise

    async def retrieve_batch(self, batch_id: str) -> Dict[str, Any]:
        return await self._batch_http_json("GET", f"/batches/{batch_id}")

    async def cancel_openai_batch(self, batch_id: str) -> Dict[str, Any]:
        return await self._batch_http_json("POST", f"/batches/{batch_id}/cancel")

    async def wait_for_batch_completion(
        self,
        batch_id: str,
        on_status=None,
        poll_interval_seconds: int = 5,
    ) -> Dict[str, Any]:
        last_status = None
        while True:
            if self._is_cancel_requested():
                try:
                    await self.cancel_openai_batch(batch_id)
                except Exception:
                    logger.warning(
                        f"Không thể huỷ remote OpenAI batch {batch_id}.", exc_info=True
                    )
            batch = await self.retrieve_batch(batch_id)
            status = (batch.get("status") or "").lower()
            if on_status and status != last_status:
                maybe_coro = on_status(batch)
                if asyncio.iscoroutine(maybe_coro):
                    await maybe_coro
            if status in self.BATCH_TERMINAL_STATUSES:
                return batch
            last_status = status
            await asyncio.sleep(poll_interval_seconds)

    def _parse_output_lines(self, content: str) -> Dict[str, Dict[str, Any]]:
        parsed: Dict[str, Dict[str, Any]] = {}
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            item = json.loads(line)
            custom_id = item.get("custom_id")
            if not custom_id:
                continue
            response = item.get("response") or {}
            body = response.get("body") or {}
            choices = body.get("choices") or []
            message = choices[0].get("message", {}) if choices else {}
            parsed[custom_id] = {
                "status_code": response.get("status_code"),
                "content": self._normalize_content(message.get("content")),
                "body": body,
            }
        return parsed

    def _parse_error_lines(self, content: str) -> Dict[str, Any]:
        parsed: Dict[str, Any] = {}
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            item = json.loads(line)
            custom_id = item.get("custom_id")
            if not custom_id:
                continue
            response = item.get("response") or {}
            body = response.get("body") or {}
            nested_error = body.get("error") if isinstance(body.get("error"), dict) else {}
            top_level_error = item.get("error")
            top_level_message = (
                top_level_error.get("message")
                if isinstance(top_level_error, dict)
                else top_level_error
            )
            message = (
                nested_error.get("message")
                or top_level_message
                or item.get("message")
                or ""
            )
            parsed[custom_id] = {
                "status_code": response.get("status_code"),
                "message": self._normalize_content(message),
                "body": body,
                "error": nested_error or top_level_error or {},
                "raw": item,
            }
        return parsed

    async def resolve_chat_completion_batch(
        self,
        batch_id: str,
        on_status=None,
    ) -> Dict[str, Any]:
        batch = await self.wait_for_batch_completion(batch_id, on_status=on_status)
        status = (batch.get("status") or "").lower()
        if status in {"cancelled", "canceled"}:
            self._fail_pending_batch_requests(
                batch_id, f"OpenAI Batch {batch_id} đã bị hủy."
            )
            raise RuntimeError(f"OpenAI Batch {batch_id} đã bị hủy.")
        if status == "failed":
            self._fail_pending_batch_requests(
                batch_id,
                f"OpenAI Batch {batch_id} thất bại: {batch.get('errors') or batch.get('error_file_id') or 'unknown error'}",
            )
            raise RuntimeError(
                f"OpenAI Batch {batch_id} thất bại: {batch.get('errors') or batch.get('error_file_id') or 'unknown error'}"
            )
        if status == "expired":
            self._fail_pending_batch_requests(
                batch_id, f"OpenAI Batch {batch_id} đã hết hạn trước khi hoàn tất."
            )
            raise RuntimeError(f"OpenAI Batch {batch_id} đã hết hạn trước khi hoàn tất.")

        outputs = {}
        errors = {}
        output_file_id = batch.get("output_file_id")
        error_file_id = batch.get("error_file_id")
        if output_file_id:
            outputs = self._parse_output_lines(await self._batch_download_text(output_file_id))
        if error_file_id:
            errors = self._parse_error_lines(await self._batch_download_text(error_file_id))

        batch_model = self._get_batch_model()
        try:
            for custom_id, output in outputs.items():
                ai_telemetry.resolve_batch_request(
                    batch_id=batch_id,
                    custom_id=custom_id,
                    provider="openai",
                    mode="openai_batch",
                    model=(output.get("body") or {}).get("model", batch_model),
                    output_payload=output.get("content", ""),
                    usage=(output.get("body") or {}).get("usage"),
                )
            for custom_id, error in errors.items():
                ai_telemetry.resolve_batch_request(
                    batch_id=batch_id,
                    custom_id=custom_id,
                    provider="openai",
                    mode="openai_batch",
                    model=batch_model,
                    error_reason=error.get("message")
                    or json.dumps(error.get("raw") or error, ensure_ascii=False),
                    output_payload=error.get("raw") or error,
                )
            pending_map = self._get_pending_batch_requests(batch_id)
            unresolved = [
                custom_id
                for custom_id in pending_map.keys()
                if custom_id not in outputs and custom_id not in errors
            ]
            for custom_id in unresolved:
                ai_telemetry.resolve_batch_request(
                    batch_id=batch_id,
                    custom_id=custom_id,
                    provider="openai",
                    mode="openai_batch",
                    model=batch_model,
                    error_reason="Missing batch output.",
                )
        finally:
            ai_telemetry.finalize_batch_tracking(batch_id)

        return {
            "batch": batch,
            "outputs": outputs,
            "errors": errors,
        }

    async def check_realtime_health(self):
        model = self._get_realtime_model()
        response = await self.create_tracked_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a health checker. Keep your response very short.",
                },
                {"role": "user", "content": "Hello, are you working?"},
            ],
            source="health.ai",
            max_tokens=10,
            temperature=0.0,
        )
        content = self._normalize_content(
            response.choices[0].message.content if response.choices else ""
        )
        if content:
            lowered = content.lower()
            if "token error" in lowered or "failed" in lowered:
                return {
                    "status": "unhealthy",
                    "mode": "realtime",
                    "provider": "proxy",
                    "reason": content,
                }
            return {
                "status": "healthy",
                "mode": "realtime",
                "provider": "proxy",
                "model": model,
            }
        return {
            "status": "unhealthy",
            "mode": "realtime",
            "provider": "proxy",
            "reason": "Empty response",
        }

    async def check_openai_batch_health(self):
        model = self._get_batch_model()
        api_key = self._get_batch_api_key()
        if not api_key:
            return {
                "status": "unhealthy",
                "mode": "openai_batch",
                "provider": "openai",
                "model": model,
                "reason": "OpenAI Batch API key chưa được cấu hình.",
            }

        request_log = ai_telemetry.begin_request(
            payload={"method": "GET", "path": f"/models/{model}"},
            provider="openai",
            mode="openai_batch",
            model=model,
            context={"source": "health.ai"},
        )
        try:
            data = await self._batch_http_json("GET", f"/models/{model}")
            ai_telemetry.complete_request(
                request_log["request_id"],
                provider="openai",
                mode="openai_batch",
                model=model,
                output_payload=data,
                usage={
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "prompt_tokens_details": {"cached_tokens": 0},
                },
            )
            return {
                "status": "healthy",
                "mode": "openai_batch",
                "provider": "openai",
                "model": data.get("id", model),
            }
        except Exception as exc:
            ai_telemetry.fail_request(
                request_log["request_id"],
                provider="openai",
                mode="openai_batch",
                model=model,
                error_reason=str(exc),
            )
            raise

    def _get_pending_batch_requests(self, batch_id: str) -> Dict[str, Dict[str, Any]]:
        return dict(ai_telemetry._pending_batches.get(batch_id, {}))

    def _fail_pending_batch_requests(self, batch_id: str, error_reason: str):
        pending_map = self._get_pending_batch_requests(batch_id)
        for record in pending_map.values():
            ai_telemetry.fail_request(
                record["request_id"],
                provider="openai",
                mode="openai_batch",
                model=self._get_batch_model(),
                error_reason=error_reason,
                batch_envelope_id=batch_id,
            )
        ai_telemetry.finalize_batch_tracking(batch_id)


ai_service = AiService()
