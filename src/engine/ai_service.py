import os
import asyncio
import json
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# --- PYDANTIC MODELS FOR SCHEMA VALIDATION ---

class DeepAuditViolation(BaseModel):
    file: str = Field(..., description="Đường dẫn file vi phạm")
    type: str = Field(..., description="Trụ cột: Performance, Maintainability, Reliability, Security")
    reason: str = Field(..., description="Giải thích chi tiết lỗi logic/kiến trúc")
    weight: float = Field(..., description="Trọng số phạt (ví dụ: -3.0 hoặc -5.0)")
    confidence: float = Field(..., description="Độ tin cậy từ 0.0 đến 1.0")
    line: int = Field(default=0, description="Dòng code xảy ra lỗi (nếu xác định được)")
    is_custom: bool = Field(default=False, description="True nếu vi phạm bộ quy tắc tùy chỉnh của người dùng")

class DeepAuditResponse(BaseModel):
    violations: List[DeepAuditViolation]

class ViolationValidation(BaseModel):
    index: int = Field(..., description="Số thứ tự của vi phạm trong danh sách đầu vào")
    is_false_positive: bool = Field(..., description="True nếu là báo lỗi sai, False nếu là lỗi thật")
    explanation: str = Field(..., description="Giải thích ngắn gọn")
    confidence: float = Field(..., description="Độ tin cậy 0.0 - 1.0")

class ValidationResponse(BaseModel):
    results: List[ViolationValidation]

# --- AI SERVICE IMPLEMENTATION ---

class AiService:
    def __init__(self):
        self.base_url = os.getenv("AI_BASE_URL", "https://parents-sail-gig-anti.trycloudflare.com/v1")
        self.api_key = os.getenv("AI_API_KEY", "xxxxxxx")
        self.model = os.getenv("AI_MODEL", "gemini-3-flash")
        
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=60.0
        )

    def _extract_json(self, content: str) -> str:
        """Trích xuất khối JSON từ nội dung trả về của AI (xử lý Markdown code blocks)."""
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        # Tìm kiếm khối mảng [ ] hoặc đối tượng { } nếu không có code block
        json_match = re.search(r'(\[.*\]|\{.*\})', content, re.DOTALL)
        if json_match:
            return json_match.group(1)
        return content

    async def deep_audit_batch(self, files_chunk: List[Dict[str, str]], custom_rules: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Thực hiện quét sâu một nhóm file để tìm các lỗi logic/kiến trúc.
        Bao gồm cả việc tìm kiếm các vi phạm dựa trên luật tùy chỉnh của người dùng.
        """
        if not files_chunk:
            return []
            
        custom_rules_prompt = ""
        if custom_rules:
            natural_text = custom_rules.get('natural_text', '')
            if natural_text:
                custom_rules_prompt = f"\nUSER DEFINED PROJECT RULES (ƯU TIÊN): {natural_text}\n"
            else:
                # Fallback to compiled json description if natural text is missing
                custom_rules_prompt = f"\nUSER DEFINED PROJECT RULES (ƯU TIÊN): {json.dumps(custom_rules, ensure_ascii=False)}\n"

        files_prompt = ""
        for f in files_chunk:
            files_prompt += f"\n--- FILE: {f['path']} ---\n{f['content']}\n"

        # Tự động phát hiện Tech Stack dựa trên file extensions (đơn giản)
        extensions = {os.path.splitext(f['path'])[1] for f in files_chunk}
        tech_context = f"Dự án đang sử dụng các ngôn ngữ/format: {', '.join(extensions)}"

        prompt = f"""
Bạn là một Auditor Senior chuyên sâu về: {tech_context}.
Hãy thực hiện quét sâu danh sách mã nguồn dưới đây để tìm các lỗi tiềm ẩn mà các công cụ quét tĩnh thông thường (Regex/AST) không thể bắt được.

DANH SÁCH MÃ NGUỒN:
{files_prompt}

{custom_rules_prompt}

TẬP TRUNG VÀO:
1. Các vi phạm đối với TẬP LUẬT TÙY CHỈNH CỦA NGƯỜI DÙNG (nếu có ở trên).
2. Lỗi logic luồng xử lý (Logic flaws, race conditions, improper error handling).
3. Lỗi kiến trúc (Circular dependencies, God objects, violation of Separation of Concerns).
4. Nguy cơ bảo mật tiềm ẩn (Insecure data flow, business logic vulnerabilities).
5. Khả năng bảo trì (Clean code, adherence to best practices for {tech_context}).

Yêu cầu trả về kết quả dưới dạng đối tượng JSON với key 'violations' là một mảng:
{{
  "violations": [
    {{
      "file": "path/to/file.py",
      "type": "Security",
      "reason": "Giải thích chi tiết...",
      "weight": -5.0,
      "confidence": 0.95,
      "line": 12,
      "is_custom": true
    }}
  ]
}}
Nếu không thấy lỗi nào, trả về {{"violations": []}}.
AI cũng có trách nhiệm phát hiện xem một lỗi có vi phạm TRỰC TIẾP 'USER DEFINED PROJECT RULES' hay không để đặt 'is_custom' = true.
"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    {"role": "system", "content": "You are a senior auditor. Respond with strictly valid JSON matching the requested schema."},
                    {"role": "user", "content": prompt}
                ]
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    response_format={"type": "json_object"} if "gemini" not in self.model.lower() else None
                )
                content = response.choices[0].message.content
                if not content: raise ValueError("Empty AI response")

                json_str = self._extract_json(content)
                data = json.loads(json_str)
                validated_data = DeepAuditResponse.model_validate(data)
                return [v.model_dump() for v in validated_data.violations]
            
            except (ValidationError, json.JSONDecodeError, Exception) as e:
                print(f"⚠️ AI Deep Audit Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                else:
                    return []
        return []

    async def verify_violations_batch(self, violations_chunk: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        """
        Xác thực một nhóm các vi phạm trong một request duy nhất.
        """
        if not violations_chunk:
            return {}

        items_prompt = ""
        for i, v in enumerate(violations_chunk):
            items_prompt += f"\n--- Vi phạm #{i} ---\nFile: {v['file']}\nLỗi: {v['reason']}\nTrụ cột: {v['type']}\nĐoạn mã:\n```\n{v.get('snippet', '')}\n```\n"

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
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    {"role": "system", "content": "You are a code reviewer. Respond with strictly valid JSON matching the requested schema."},
                    {"role": "user", "content": prompt}
                ]
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    response_format={"type": "json_object"} if "gemini" not in self.model.lower() else None
                )
                content = response.choices[0].message.content
                if not content: raise ValueError("Empty AI response")

                json_str = self._extract_json(content)
                data = json.loads(json_str)
                validated_data = ValidationResponse.model_validate(data)
                return {res.index: res.model_dump() for res in validated_data.results}
            
            except (ValidationError, json.JSONDecodeError, Exception) as e:
                print(f"⚠️ AI Batch Service Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                else:
                    return {}
        return {}

    async def verify_violation(self, file_path, code_snippet, reason, pillar):
        """
        Xác thực xem một vi phạm tìm thấy bởi Static Analysis có phải là thật không (Single Item).
        """
        res = await self.verify_violations_batch([{"file": file_path, "snippet": code_snippet, "reason": reason, "type": pillar}])
        if 0 in res:
            v = res[0]
            return v['is_false_positive'], v['explanation'], v['confidence']
        return False, "AI failed to respond", 0.0

ai_service = AiService()

