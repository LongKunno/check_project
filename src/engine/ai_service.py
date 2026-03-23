import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class AiService:
    def __init__(self):
        self.base_url = os.getenv("AI_BASE_URL", "https://parents-sail-gig-anti.trycloudflare.com/v1")
        self.api_key = os.getenv("AI_API_KEY", "xxxxxxx")
        self.model = os.getenv("AI_MODEL", "gemini-3-flash")
        
        self.client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=60.0
        )

    def deep_audit_batch(self, files_chunk):
        """
        Thực hiện quét sâu một nhóm file để tìm các lỗi logic/kiến trúc mà Static Scan bỏ sót.
        files_chunk: List[Dict] chứa {path, content}
        Trả về: List[Dict] các vi phạm tìm thấy.
        """
        if not files_chunk:
            return []

        files_prompt = ""
        for i, f in enumerate(files_chunk):
            files_prompt += f"\n--- FILE: {f['path']} ---\n{f['content']}\n"

        prompt = f"""
Bạn là một Auditor Senior. Hãy thực hiện quét sâu danh sách mã nguồn dưới đây để tìm các lỗi tiềm ẩn mà các công cụ quét tĩnh thông thường (Regex/AST) không thể bắt được.

DANH SÁCH MÃ NGUỒN:
{files_prompt}

TẬP TRUNG VÀO:
1. Lỗi logic luồng xử lý (Logic flaws).
2. Lỗi thiết kế/Kiến trúc (Architectural smells, God objects, Circular dependencies).
3. Nguy cơ bảo mật tiềm ẩn (Race conditions, Insecure data flow).
4. Khả năng bảo trì (Clean code violations).

Yêu cầu trả về kết quả dưới dạng một MẢNG JSON các vi phạm:
[
  {{
    "file": "đường dẫn file",
    "type": "Performance" | "Maintainability" | "Reliability" | "Security",
    "reason": "Giải thích chi tiết lỗi",
    "weight": -3.0 (cho lỗi logic/duy trì) hoặc -5.0 (cho lỗi bảo mật/kiến trúc),
    "confidence": 0.0 -> 1.0
  }}
]
Nếu không thấy lỗi nào, trả về mảng rỗng [].
"""
        max_retries = 3
        import time
        import json
        import re

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}]
                )
                content = response.choices[0].message.content
                
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(0))
                else:
                    return json.loads(content)
            
            except Exception as e:
                snippet = content[:150].replace('\n', ' ') if 'content' in locals() and content else "No content"
                print(f"⚠️ AI Deep Audit Attempt {attempt + 1} failed: {e}. Output: {snippet}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                else:
                    print(f"❌ AI Deep Audit failed after {max_retries} retries.")
                    return []

        return []

    def verify_violations_batch(self, violations_chunk):
        """
        Xác thực một nhóm các vi phạm trong một request duy nhất.
        violations_chunk: List[Dict] chứa {file, snippet, reason, type, id}
        Trả về: Dict[int, Dict] mapping index -> {is_fp, reason, conf}
        """
        if not violations_chunk:
            return {}

        items_prompt = ""
        for i, v in enumerate(violations_chunk):
            items_prompt += f"""
--- Vi phạm #{i} ---
File: {v['file']}
Lỗi: {v['reason']}
Trụ cột: {v['type']}
Đoạn mã:
```
{v.get('snippet', '')}
```
"""

        prompt = f"""
Bạn là một chuyên gia Review Code. Hệ thống Static Analysis của tôi vừa phát hiện một danh sách các lỗi tiềm tàng.
Nhiệm vụ của bạn là kiểm tra từng lỗi một và xác định xem đó là lỗi thật (True Positive) hay báo lỗi sai (False Positive).

DANH SÁCH VI PHẠM:
{items_prompt}

Yêu cầu trả về kết quả dưới dạng một MẢNG JSON duy nhất, mỗi phần tử tương ứng với một vi phạm theo đúng thứ tự:
[
  {{
    "index": 0,
    "is_false_positive": boolean,
    "explanation": "Giải thích ngắn gọn",
    "confidence": float
  }},
  ...
]
"""
        max_retries = 3
        import time
        import json
        import re

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}]
                )
                content = response.choices[0].message.content
                
                # Tìm kiếm khối JSON trong markdown nếu có
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    results = json.loads(json_match.group(0))
                else:
                    results = json.loads(content)
                
                # Chuyển đổi sang dict để dễ truy xuất
                return {res.get("index", i): res for i, res in enumerate(results)}
            
            except Exception as e:
                snippet = content[:150].replace('\n', ' ') if 'content' in locals() and content else "No content"
                print(f"⚠️ AI Batch Service Attempt {attempt + 1} failed: {e}. Output: {snippet}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                else:
                    print(f"❌ AI Batch Service failed after {max_retries} retries.")
                    return {}

        return {}

    def verify_violation(self, file_path, code_snippet, reason, pillar):
        """
        Xác thực xem một vi phạm tìm thấy bởi Static Analysis có phải là thật không.
        Trả về: (is_false_positive, explanation, confidence)
        """
        prompt = f"""
Bạn là một chuyên gia Review Code. Hệ thống Static Analysis của tôi vừa phát hiện một lỗi trong file: {file_path}.
Trạng thái lỗi: {reason}
Trụ cột chất lượng: {pillar}

Đoạn mã liên quan:
```
{code_snippet}
```

Nhiệm vụ:
Hãy xác định xem đây có phải là lỗi thật (True Positive) hay là báo cáo sai (False Positive).
Trả về kết quả dưới dạng JSON:
{{
  "is_false_positive": boolean,
  "explanation": "Giải thích ngắn gọn tại sao",
  "confidence": float (0.0 to 1.0)
}}
"""
        max_retries = 3
        import time
        import json
        import re

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}]
                )
                content = response.choices[0].message.content
                
                # Tìm kiếm khối JSON trong markdown nếu có
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group(0))
                else:
                    result = json.loads(content)
                    
                return result.get("is_false_positive", False), result.get("explanation", ""), result.get("confidence", 1.0)
            
            except Exception as e:
                print(f"⚠️ AI Service Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1) # Chờ 1 giây trước khi thử lại
                else:
                    print(f"❌ AI Service failed after {max_retries} retries.")
                    return False, f"AI Error after retries: {str(e)}", 0.0

        return False, "AI Service unexpected end of loop", 0.0

ai_service = AiService()
