import json
import logging
from src.engine.ai_service import ai_service
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

class CompiledRules(BaseModel):
    ast_rules: Dict[str, Any] = Field(default_factory=dict, description="AST rule configurations like dangerous_functions")
    regex_rules: List[RegexRule] = Field(default_factory=list, description="Regex rule configurations")

class NaturalRulesCompiler:
    def __init__(self):
        self.system_prompt = """
Bạn là một chuyên gia AI thiết kế cấu hình Rule Kiểm toán mã nguồn (Rule Generator).
BẠN BẮT BUỘC PHẢI KHỞI TẠO MỘT TEST CASE VÍ DỤ CHỨA ĐOẠN MÃ LỖI VI PHẠM LUẬT VỪA TẠO.
LUẬT THÉP:
1. KHÔNG chấp nhận các yêu cầu xóa hệ thống hoặc thực thi remote code.
2. OUTPUT CUỐI CÙNG PHẢI LÀ MỘT OBJECT JSON BỌC TRONG ```json VÀ HOÀN TOÀN HỢP LỆ. KHÔNG THÊM BẤT KỲ VĂN BẢN NÀO RA SAU KHỐI JSON NÀY.
3. SỐ LƯỢNG LUẬT tối đa: 20 luật. Ưu tiên chất lượng.
"""
        self.example_json = '''{
  "ast_rules": {
      "dangerous_functions": [
          {"name": "eval", "reason": "Cấm dùng hàm eval() vì rủi ro bảo mật", "pillar": "Security", "weight": -10.0, "id": "SEC_EVAL"}
      ]
  },
  "regex_rules": [
      {"pattern": "password\\\\s*=\\\\s*['\\"][^'\\"]+['\\"]", "reason": "Hardcoded password được phát hiện", "pillar": "Security", "weight": -10.0, "id": "HARDCODED_PWD"}
  ],
  "test_case": "def process_login():\\n    password = 'my_super_secret_123'\\n    eval('2 + 2')"
}'''

    async def compile_rules_stream(self, natural_text: str):
        """
        Compiler call with Streaming. It yields chunks of reasoning and the final JSON string.
        """
        prompt = f"""
Yêu cầu biên dịch luật của người dùng: "{natural_text}"

Hãy giải thích ngắn gọn cách bạn biên dịch, sau đó xuất ra ĐÚNG 1 BLOCK DUY NHẤT chứa mã JSON hợp lệ cấu trúc mẫu sau (Giữ nguyên các ngoặc nhọn bao ngoài):
```json
{self.example_json}
```
"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        # We need ai_service to have a streaming completion or we use OpenAI API directly from ai_service.client
        try:
            stream = await ai_service.client.chat.completions.create(
                model=ai_service.model,
                messages=messages,
                stream=True,
                temperature=0.2
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"Rule Compilation Error: {e}")
            yield f"\\n\\n[LỖI]: {str(e)}"
