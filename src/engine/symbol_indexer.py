import os
import ast
import logging

class AstContextExtractor:
    """
    Module trích xuất ngữ cảnh tĩnh để phục vụ Bước Tự động Xác minh (Pass 2).
    Sử dụng AST để tìm chính xác tọa độ (start_line, end_line) của một Method hoặc Class thay vì cắt dòng mù quáng.
    """
    def __init__(self, target_dir):
        self.target_dir = os.path.abspath(target_dir)
        self.symbol_map = {} # {'function_name': [('file_path', start, end), ...]}
        
    def index_project(self):
        """Duyệt nhanh toàn bộ dự án để xây dựng từ điển danh mục hàm/class."""
        logging.getLogger(__name__).info("   🔍 [Indexer] Đang lập chỉ mục mã nguồn (AST Indexing) để hỗ trợ AI...")
        for root, _, files in os.walk(self.target_dir):
            if any(exclude in root for exclude in ['venv', '__pycache__', '.git', 'node_modules']):
                continue
            for f in files:
                if f.endswith('.py'):
                    file_path = os.path.join(root, f)
                    self._index_file(file_path)
                    
    def _index_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                tree = ast.parse(content)
        except Exception as e:
            logging.getLogger(__name__).warning(f"Error parsing AST for {file_path}: {e}")
            return

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                name = node.name
                start = node.lineno
                # end_lineno có sẵn từ Python 3.8+
                end = getattr(node, 'end_lineno', start + 15) 
                
                if name not in self.symbol_map:
                    self.symbol_map[name] = []
                self.symbol_map[name].append((file_path, start, end))
                
    def get_symbol_snippet(self, symbol_name):
        """Lấy toàn bộ body của mục tiêu được yêu cầu."""
        if not symbol_name or symbol_name not in self.symbol_map:
            return f"// Target '{symbol_name}' not found in project or is a built-in function."
            
        snippets = []
        for path, start, end in self.symbol_map[symbol_name]:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    snippet = "".join(lines[max(0, start-1):end])
                    rel_path = os.path.relpath(path, self.target_dir)
                    snippets.append(f"--- SOURCE CODE FROM: {rel_path} (Lines {start}-{end}) ---\n```python\n{snippet}\n```")
            except Exception as e:
                logging.getLogger(__name__).warning(f"Error reading block from {path}: {e}")
                
        return "\n\n".join(snippets)
