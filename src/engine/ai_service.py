import os
import asyncio
import json
import re
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from dotenv import load_dotenv

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

# --- PYDANTIC MODELS FOR SCHEMA VALIDATION ---


class DeepAuditViolation(BaseModel):
    file: str = Field(..., description="Đường dẫn file vi phạm")
    type: str = Field(
        ..., description="Trụ cột: Performance, Maintainability, Reliability, Security"
    )
    reason: str = Field(..., description="Giải thích chi tiết lỗi logic/kiến trúc")
    weight: float = Field(
        ..., description="Trọng số phạt (từ -0.5 đến -2.0, KHÔNG được quá -2.0)"
    )
    confidence: float = Field(..., description="Độ tin cậy từ 0.0 đến 1.0")
    line: int = Field(default=0, description="Dòng code xảy ra lỗi (nếu xác định được)")
    rule_id: str = Field(
        default="AI_REASONING",
        description="Rule ID cụ thể nếu vi phạm khớp với một luật AI-only đã định nghĩa (vd: UNCHECKED_NONE_RETURN). Nếu không khớp luật nào, để 'AI_REASONING'.",
    )
    is_custom: bool = Field(
        default=False,
        description="True nếu vi phạm bộ quy tắc tùy chỉnh của người dùng",
    )
    needs_verification: bool = Field(
        default=False,
        description="True nếu lỗi này liên kết đến logic ở file khác và bạn không chắc chắn. Hãy cảnh báo thay vì phán xét bừa.",
    )
    verify_target: str = Field(
        default="",
        description="Nếu needs_verification=True, hãy cung cấp TÊN HÀM hoặc TÊN CLASS ở file khác mà bạn cần hệ thống tìm mã nguồn cho bạn xem để xác minh lỗi này. Ví dụ: 'get_user_profile'",
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


# --- AI SERVICE IMPLEMENTATION ---


class AiService:
    def __init__(self):
        self.base_url = os.getenv(
            "AI_BASE_URL", "https://parents-sail-gig-anti.trycloudflare.com/v1"
        )
        self.api_key = os.getenv("AI_API_KEY", "xxxxxxx")
        self.model = os.getenv("AI_MODEL", "gpt-5.4")

        self.client = AsyncOpenAI(
            base_url=self.base_url, api_key=self.api_key, timeout=180.0
        )

    def _is_cancel_requested(self) -> bool:
        try:
            job_id = JobManager.get_active_job_id()
            if job_id and JobManager.is_cancel_requested(job_id):
                return True
        except Exception:
            logger.debug("AI cancel lookup failed unexpectedly.", exc_info=True)
        return getattr(AuditState, "is_cancelled", False)

    async def _call_llm_json(
        self,
        prompt: str,
        system_message: str,
        response_model: type[BaseModel],
        max_retries: int = 3,
    ) -> Any:
        for attempt in range(max_retries):
            if self._is_cancel_requested():
                logger.info(
                    "⏹️ Bỏ qua request AI mới vì job đã nhận yêu cầu huỷ."
                )
                return None
            try:
                messages = [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ]
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.0,
                    response_format=(
                        {"type": "json_object"}
                        if "gemini" not in self.model.lower()
                        else None
                    ),
                )
                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty AI response")

                json_str = self._extract_json(content)
                try:
                    data = json.loads(json_str, strict=False)
                except json.JSONDecodeError:
                    import re

                    json_str_fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", json_str)
                    data = json.loads(json_str_fixed, strict=False)
                if self._is_cancel_requested():
                    logger.info(
                        "⏹️ Bỏ qua kết quả AI vừa nhận vì job đã nhận yêu cầu huỷ."
                    )
                    return None
                return response_model.model_validate(data)
            except Exception as e:
                if self._is_cancel_requested():
                    logger.info(
                        "⏹️ Dừng retry AI sau request đang chạy vì job đã nhận yêu cầu huỷ."
                    )
                    return None
                logger.warning(f"⚠️ AI call attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
        return None

    def _extract_json(self, content: str) -> str:
        """Trích xuất khối JSON từ nội dung trả về của AI (xử lý Markdown code blocks)."""
        json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        # Tìm kiếm khối mảng [ ] hoặc đối tượng { } nếu không có code block
        json_match = re.search(r"(\[.*\]|\{.*\})", content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        return content

    def _load_ai_only_rules(self) -> str:
        """Load các rules AI-only từ rules.json để inject vào prompt AI.
        Quy tắc tự nhận diện: regex=null AND ast=null AND ai≠null → AI-only rule.
        Không cần thêm flag gì, chỉ cần thêm rule vào rules.json là tự động hoạt động.
        """
        rules_path = os.path.join(os.path.dirname(__file__), "rules.json")
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            ai_rules = []
            for r in data.get("rules", []):
                # Tự nhận diện: không có regex, không có AST, nhưng CÓ ai prompt
                has_regex = r.get("regex") is not None
                has_ast = r.get("ast") is not None
                has_ai = r.get("ai") is not None and r.get("ai", {}).get("prompt")
                if not has_regex and not has_ast and has_ai:
                    ai_rules.append(
                        {
                            "id": r["id"],
                            "pillar": r["pillar"],
                            "severity": r["severity"],
                            "weight": r["weight"],
                            "description": r["reason"],
                            "detect_instruction": r["ai"]["prompt"],
                        }
                    )
            if not ai_rules:
                return ""
            rules_text = "\n".join(
                f"- **{r['id']}** [{r['pillar']}/{r['severity']}] (weight: {r['weight']}): {r['description']}\n  HƯỚNG DẪN PHÁT HIỆN: {r['detect_instruction']}"
                for r in ai_rules
            )
            rule_ids = ", ".join(r["id"] for r in ai_rules)
            return f"\n## DANH SÁCH LUẬT AI-ONLY (BẮT BUỘC KIỂM TRA):\nCác luật dưới đây CHỈ có thể được phát hiện bởi AI (không có Regex/AST). Hãy ĐẶC BIỆT chú ý kiểm tra từng luật.\nKhi phát hiện vi phạm khớp với luật nào, hãy đặt `rule_id` = ID tương ứng ({rule_ids}).\nNếu vi phạm không khớp luật nào trong danh sách, đặt `rule_id` = 'AI_REASONING'.\n\n{rules_text}\n"
        except Exception:
            return ""

    async def deep_audit_batch(
        self,
        files_chunk: List[Dict[str, str]],
        custom_rules: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Thực hiện quét sâu một nhóm file để tìm các lỗi logic/kiến trúc.
        Bao gồm cả việc tìm kiếm các vi phạm dựa trên luật tùy chỉnh của người dùng.
        """
        if not files_chunk:
            return []

        custom_rules_prompt = ""
        if custom_rules:
            natural_text = custom_rules.get("natural_text", "")
            if natural_text:
                custom_rules_prompt = (
                    f"\nUSER DEFINED PROJECT RULES (ƯU TIÊN): {natural_text}\n"
                )
            else:
                # Fallback to compiled json description if natural text is missing
                custom_rules_prompt = f"\nUSER DEFINED PROJECT RULES (ƯU TIÊN): {json.dumps(custom_rules, ensure_ascii=False)}\n"

        files_prompt_parts = []
        for f in files_chunk:
            files_prompt_parts.append(f"\n--- FILE: {f['path']} ---\n{f['content']}\n")
        files_prompt = "".join(files_prompt_parts)

        # Tự động phát hiện Tech Stack dựa trên file extensions (đơn giản)
        extensions = {os.path.splitext(f["path"])[1] for f in files_chunk}
        tech_context = (
            f"Dự án đang sử dụng các ngôn ngữ/format: {', '.join(extensions)}"
        )

        # Load AI-only rules để inject vào prompt
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
QUAN TRỌNG: NGUYÊN TẮC 'TWO-PASS AUDIT'. Nếu bạn nghi ngờ một lời gọi hàm dẫn đến lỗi logic chéo file (vd: N+1 query lấp lửng từ 1 API trả về), TUYỆT ĐỐI KHÔNG SUY ĐOÁN. Hãy bật `needs_verification: true` và gõ tên hàm đó vào `verify_target`. Hệ thống sẽ đi móc code nguyên thủy của hàm đó ở file khác ném trả lại cho bạn ở lần Review thứ 2.
"""
        system_msg = "You are a senior auditor. Respond with strictly valid JSON matching the requested schema."
        validated_data = await self._call_llm_json(
            prompt, system_msg, DeepAuditResponse
        )
        return (
            [v.model_dump() for v in validated_data.violations]
            if validated_data
            else []
        )

    async def verify_violations_batch(
        self, violations_chunk: List[Dict[str, Any]]
    ) -> Dict[int, Dict[str, Any]]:
        """
        Xác thực một nhóm các vi phạm trong một request duy nhất.
        """
        if not violations_chunk:
            return {}

        items_prompt_parts = []
        for i, v in enumerate(violations_chunk):
            ai_instruction = (
                f"\nCHỈ ĐẠO CỤ THỂ CHO LỖI NÀY: {v['ai_prompt']}"
                if v.get("ai_prompt")
                else ""
            )
            items_prompt_parts.append(
                f"\n--- Vi phạm #{i} ---\nFile: {v['file']}\nLỗi: {v['reason']}\nTrụ cột: {v['type']}\nĐoạn mã:\n```\n{v.get('snippet', '')}\n```\n{ai_instruction}\n"
            )
        items_prompt = "".join(items_prompt_parts)

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
        system_msg = "You are a code reviewer. Respond with strictly valid JSON matching the requested schema."
        validated_data = await self._call_llm_json(
            prompt, system_msg, ValidationResponse
        )
        return (
            {res.index: res.model_dump() for res in validated_data.results}
            if validated_data
            else {}
        )

    async def verify_violation(self, file_path, code_snippet, reason, pillar):
        """
        Xác thực xem một vi phạm tìm thấy bởi Static Analysis có phải là thật không (Single Item).
        """
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
            v = res[0]
            return v["is_false_positive"], v["explanation"], v["confidence"]
        return False, "AI failed to respond", 0.0

    async def verify_flagged_issues(
        self, flagged_violations: List[Dict[str, Any]], context_cache: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """
        [TWO-PASS AUDIT] Xác minh (Cross-check) các lỗi đã bị AI tự tay cắm cờ nghi ngờ ở Bước 1.
        Truyền đoạn mã nguồn 'bằng chứng' (context snippet) của hàm mục tiêu vào gỡ lỗi.
        """
        if not flagged_violations:
            return []

        items_prompt_parts = []
        for i, v in enumerate(flagged_violations):
            target = v.get("verify_target", "")
            found_context = context_cache.get(target, "Code not found")

            items_prompt_parts.append(
                f"\n--- Cờ nghi vấn #{i} ---\n"
                f"Bối cảnh lỗi ban đầu ở File: {v['file']}\n"
                f"Lý do bạn nghi ngờ: {v['reason']}\n"
                f"Trụ cột: {v['type']}\n"
                f"BẰNG CHỨNG HỆ THỐNG CUNG CẤP TỪ {target}:\n{found_context}\n"
            )
        items_prompt = "".join(items_prompt_parts)

        prompt = f"""
        GIÁM ĐỐC KỸ THUẬT QUY ĐỊNH (PHASE 2 CROSS-CHECK):
        Dưới đây là các 'Cờ Nghi Vấn' (False Positive Suspicions) do chính bạn cắm cờ ở đợt review trước do thiếu ngữ cảnh liên kết.
        Hệ thống Python AST hiện tại đã dò tìm và đính kèm Bằng Chứng Ngữ Cảnh thực tế để bạn đối chiếu.
        
        DANH SÁCH CỜ:
        {items_prompt}
        
        NHIỆM VỤ: Hãy nhìn vào Nội dung Bằng chứng.
        - Nếu bằng chứng chỉ ra code được viết an toàn, không có lỗi như bạn tưởng -> Lỗi này là Báo cáo sai (False Positive). Đánh dấu is_false_positive = true.
        - Nếu bằng chứng cho thấy có lỗi thật (vd: DB chưa dọn, không gọi cache ngầm) -> Đánh dấu is_false_positive = false.
        
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
        system_msg = "You are a lead auditor. Resolve flagged suspicions with evidence. Return strict JSON."
        validated_data = await self._call_llm_json(
            prompt, system_msg, ValidationResponse
        )

        if not validated_data:
            return []

        verified_violations = []
        for res in validated_data.results:
            idx = res.index
            if 0 <= idx < len(flagged_violations):
                if not res.is_false_positive:
                    bug = flagged_violations[idx]
                    bug["reason"] = (
                        f"{bug['reason']} [Cross-Checked: {res.explanation}]"
                    )
                    verified_violations.append(bug)
                else:
                    logger.info(
                        f"   🛡️ Đã gỡ cờ một False Positive: {flagged_violations[idx]['reason']} nhờ đối chiếu bằng chứng."
                    )

        return verified_violations


ai_service = AiService()
