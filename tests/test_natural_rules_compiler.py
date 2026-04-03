import asyncio
import sys
import os
import re

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.engine.natural_rules_compiler import NaturalRulesCompiler
from src.engine.database import AuditDatabase

async def main():
    print("Testing Natural Rules Compiler Streaming...")
    compiler = NaturalRulesCompiler()
    
    prompt = "Cấm dùng hàm eval() trong Python vì rủi ro bảo mật quá cao, cần cho 10 điểm phạt. Đồng thời cấm hardcode password có dạng Regex password='...'."
    
    chunks = []
    async for chunk in compiler.compile_rules_stream(prompt):
        sys.stdout.write(chunk)
        sys.stdout.flush()
        chunks.append(chunk)
    full_output = ''.join(chunks)
    
    print("\\n\\n--- PARSING JSON TEST ---")
    import json
    json_match = re.search(r'```json\\n([\\s\\S]*?)```', full_output)
    if json_match:
        json_str = json_match.group(1).strip()
        if not json_str.startswith('{'):
            json_str = '{' + json_str + '}'
            
        try:
            parsed = json.loads(json_str)
            print("Parsed Successfully:")
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
        except Exception as e:
            print("JSON Parse Error:", e)
    else:
        print("No JSON found.")

    print("\\n\\nTesting DB Integration...")
    AuditDatabase.save_project_rules('test_target', prompt, {"ast": "test"})
    res = AuditDatabase.get_project_rules('test_target')
    assert res is not None, "DB returned None for test_target"
    assert res['natural_text'] == prompt
    assert res['compiled_json'] == {"ast": "test"}
    print("DB Test Passed!")

if __name__ == "__main__":
    asyncio.run(main())
