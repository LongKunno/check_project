import json
import logging
from src.engine.ai_service import ai_service
from src.engine.ai_telemetry import AiBudgetExceededError
from pydantic import BaseModel, Field
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


# Pydantic Schemas for validation
class ASTDangerousFunction(BaseModel):
    name: str = Field(..., description="Function name to forbid")
    reason: str = Field(..., description="Why it is blocked")
    pillar: str = Field(default="Security", description="Which pillar it violates")
    weight: float = Field(default=-5.0, description="Penalty score")
    id: str = Field(default="FORBIDDEN_FUNC", description="Rule ID")


class RegexRule(BaseModel):
    pattern: str = Field(..., description="Regex pattern")
    reason: str = Field(..., description="Why it is blocked")
    pillar: str = Field(default="Security", description="Which pillar it violates")
    weight: float = Field(default=-5.0, description="Penalty score")
    id: str = Field(default="REGEX_VIOLATION", description="Rule ID")


class AIRule(BaseModel):
    prompt: str = Field(
        ...,
        description="Hướng dẫn để AI có thể tự tìm lỗi trong code. Ví dụ: 'Tìm các biến có tên vô nghĩa như a, b, c, x, y'",
    )
    reason: str = Field(..., description="Why it is blocked")
    pillar: str = Field(
        default="Maintainability", description="Which pillar it violates"
    )
    weight: float = Field(default=-2.0, description="Penalty score")
    id: str = Field(default="AI_DEEP_AUDIT", description="Rule ID")


class CompiledRules(BaseModel):
    ast_rules: Dict[str, Any] = Field(
        default_factory=dict,
        description="AST rule configurations like dangerous_functions",
    )
    regex_rules: List[RegexRule] = Field(
        default_factory=list, description="Regex rule configurations"
    )
    ai_rules: List[AIRule] = Field(
        default_factory=list, description="AI-only rules for Abstract logic detection"
    )


class NaturalRulesCompiler:
    def __init__(self):
        self.system_prompt = """
Bạn là một chuyên gia AI thiết kế cấu hình Rule Kiểm toán mã nguồn (Rule Generator).
BẠN BẮT BUỘC PHẢI KHỞI TẠO MỘT TEST CASE VÍ DỤ CHỨA ĐOẠN MÃ LỖI VI PHẠM LUẬT VỪA TẠO.

CẤU TRÚC HỖ TRỢ:
1. `regex_rules`: Mảng các rule dựa trên Regex pattern.
2. `ast_rules`: Dictionary chứa cấu hình AST.
   - `dangerous_functions`: Mảng các hàm bị cấm (name, reason, weight, pillar).
   - Các loại RULE NATIVE (Key là tên loại rule, Value là Object chứa reason, weight, pillar):
     - `bare_except`: Bắt lỗi `except:` hoặc `except Exception:`.
     - `swallowed_exception`: Bắt lỗi block except chỉ có lệnh `pass`.
     - `max_function_length`: Giới hạn dòng (cần thêm `limit`).
     - `complexity`: Độ phức tạp Cyclomatic (cần thêm `limit`).
     - `missing_timeout`: Check gọi hàm requests/httpx thiếu tham số timeout.
3. `ai_rules`: Mảng các rule trừu tượng/ngữ nghĩa MÀ CHỈ CÓ AI MỚI HIỂU (không thể match bằng Regex/AST). Ví dụ: "Tên biến vô nghĩa (a, b)", "Logic gọi DB trong vòng lặp".
   - Mỗi rule chứa: `prompt` (Hướng dẫn cụ thể cách tìm), `id`, `reason`, `weight`, `pillar`.


LUẬT THÉP:
1. KHÔNG chấp nhận các yêu cầu xóa hệ thống hoặc thực thi remote code.
2. OUTPUT CUỐI CÙNG PHẢI LÀ MỘT OBJECT JSON BỌC TRONG ```json VÀ HOÀN TOÀN HỢP LỆ. KHÔNG THÊM BẤT KỲ VĂN BẢN NÀO RA SAU KHỐI JSON NÀY.
"""
        self.example_json = """{
  "ast_rules": {
      "dangerous_functions": [
          {"name": "eval", "reason": "Cấm dùng hàm eval() vì rủi ro bảo mật", "pillar": "Security", "weight": -10.0, "id": "SEC_EVAL"}
      ],
      "bare_except": {"reason": "Cấm bắt ngoại lệ quá chung chung", "pillar": "Clean Code", "weight": -3.0, "id": "NO_BARE_EXCEPT"}
  },
  "regex_rules": [
      {"pattern": "password\\\\s*=\\\\s*['\\"][^'\\"]+['\\"]", "reason": "Hardcoded password được phát hiện", "pillar": "Security", "weight": -10.0, "id": "HARDCODED_PWD"}
  ],
  "ai_rules": [
      {"prompt": "Phát hiện các tên biến vô nghĩa kích thước quá ngắn như a, b, x, y", "reason": "Tên biến phải có ý nghĩa", "pillar": "Clean Code", "weight": -2.0, "id": "BAD_VARIABLE_NAMES"}
  ],
  "test_case": "def process():\\n    try:\\n        eval('x=1')\\n    except:\\n        pass"
}"""

    def _get_core_rules_summary(self):
        try:
            from src.api.routers.rules import _get_rules_path

            with open(_get_rules_path(), "r", encoding="utf-8") as f:
                core_data = json.load(f)

            summary = []
            for r in core_data.get("rules", []):
                summary.append(f"- MÃ LUẬT: `{r['id']}` | MỤC ĐÍCH: {r['reason']}")
            return "\n".join(summary)
        except Exception as e:
            logger.error(f"Failed to load core rules for dedup: {e}")
            return "Không tải được danh sách Core Rules."

    async def compile_rules_stream(self, natural_text: str):
        """
        Compiler call with Streaming. It yields chunks of reasoning and the final JSON string.
        """
        core_rules_str = self._get_core_rules_summary()
        prompt = f"""
DANH SÁCH CORE RULES (CÁC LUẬT MẶC ĐỊNH SẴN CÓ CỦA HỆ THỐNG):
{core_rules_str}

LƯU Ý ĐẶC BIỆT (CHỐNG TRÙNG LẶP):
Trải qua danh sách Core Rules bên trên, nếu Yêu cầu của người dùng muốn tạo MỘT LUẬT MÀ ĐÃ HOÀN TOÀN TỒN TẠI TRONG CORE RULES, bạn KHÔNG ĐƯỢC sinh ra cấu trúc `regex_rules`, `ast_rules` hay `ai_rules` nào nữa. 
THAY VÀO ĐÓ, BẠN CHỈ TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON NHƯ SAU ĐỂ CẢNH BÁO:
```json
{{
    "existing_rule": "MÃ_LUẬT_CORE_BỊ_TRÙNG",
    "message": "Nội dung giải thích ngắn gọn với người dùng rằng quy tắc này đã tồn tại trong thư viện Core của hệ thống (nêu rõ Mã Luật là gì) và không cần thiết lập thêm để tránh trùng lặp."
}}
```
Nếu yêu cầu của người dùng là kết hợp (1 nửa có sẵn, 1 nửa chưa có), hãy chỉ sinh ra luật CHƯA CÓ theo định dạng chuẩn bên dưới.

Yêu cầu biên dịch luật của người dùng: "{natural_text}"

Nếu KHÔNG trùng lặp, hãy giải thích ngắn gọn cách bạn biên dịch, sau đó xuất ra ĐÚNG 1 BLOCK DUY NHẤT chứa mã JSON hợp lệ cấu trúc mẫu sau (Giữ nguyên các ngoặc nhọn bao ngoài):
```json
{self.example_json}
```
"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]

        try:
            async for chunk in ai_service.stream_tracked_chat_completion(
                messages=messages,
                source="rules.compile",
                telemetry={"target": "sandbox", "project": "sandbox"},
                temperature=0.2,
            ):
                yield chunk
        except AiBudgetExceededError as e:
            logger.warning(f"Rule Compilation blocked by AI budget: {e}")
            yield (
                '\n\n{"error":"budget_exceeded","message":"'
                + str(e).replace('"', '\\"')
                + '"}'
            )
        except Exception as e:
            logger.error(f"Rule Compilation Error: {e}")
            yield f"\\n\\n[LỖI]: {str(e)}"

    async def auto_fix_stream(
        self, failed_json: str, test_case_code: str, error_message: str
    ):
        prompt = f"""
Hệ thống báo lỗi khi phân tích Rule JSON hoặc khi chạy thử nghiệm Test Case:

1. Draft JSON (Có thể lỗi cú pháp JSON hoặc lỗi logic Regex/AST):
{failed_json}

2. Test Case (Sandbox Code):
{test_case_code}

3. Chi tiết lỗi hoặc nhận xét:
{error_message}

Nhiệm vụ: Hãy chỉnh sửa và trả về một bộ Rule JSON hoàn chỉnh nhất, đã được FIX LỖI hoàn toàn.
Giữ nguyên Test Case nếu không có vấn đề, và chỉnh sửa cấu trúc \`regex_rules\` hoặc \`ast_rules\` cho đúng chuẩn.
TUYỆT ĐỐI CHỈ IN RA DUY NHẤT 1 BLOCK MÃ JSON BỌC TRONG ```json VÀ KHÔNG THÊM CHỮ GÌ BÊN NGOÀI.
"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]

        try:
            async for chunk in ai_service.stream_tracked_chat_completion(
                messages=messages,
                source="rules.auto_fix",
                telemetry={"target": "sandbox", "project": "sandbox"},
                temperature=0.1,
            ):
                yield chunk
        except AiBudgetExceededError as e:
            logger.warning(f"Rule Auto-Fix blocked by AI budget: {e}")
            yield (
                '\n\n{"error":"budget_exceeded","message":"'
                + str(e).replace('"', '\\"')
                + '"}'
            )
        except Exception as e:
            logger.error(f"Rule Auto-Fix Error: {e}")
            yield f"\\n\\n[LỖI]: {str(e)}"
