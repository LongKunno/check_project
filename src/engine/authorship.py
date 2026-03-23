import os
import subprocess
import re

class AuthorshipTracker:
    """
    Theo dõi tác giả của từng dòng mã nguồn dựa trên Git blame.
    Chỉ tính toán các dòng mã được commit trong vòng 6 tháng gần đây
    để đảm bảo tính chính xác và không đánh giá code legacy.
    """
    def __init__(self, target_dir):
        self.target_dir = os.path.abspath(target_dir)
        self.is_git_repo = os.path.exists(os.path.join(self.target_dir, '.git'))
        self.file_authors_cache = {}
        self.member_loc = {}

    def parse_blame(self, file_path):
        """
        Sử dụng git blame --line-porcelain --since="6 months" để lấy tác giả của từng dòng.
        Lưu trữ kết quả vào cache để sử dụng lại.
        Trương hợp code cũ hơn 6 tháng, git sẽ đánh dấu commit bằng kí tự boundary (thường là '^').
        """
        if file_path in self.file_authors_cache:
            return self.file_authors_cache[file_path]
            
        line_authors = {}
        if not self.is_git_repo:
            return line_authors

        try:
            # Chạy git blame với giới hạn 6 tháng
            result = subprocess.run(
                ['git', 'blame', '--line-porcelain', '--since=6.months', file_path],
                cwd=self.target_dir,
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode != 0:
                return line_authors
                
            lines = result.stdout.splitlines()
            
            current_commit = None
            is_boundary = False
            current_author = "Unknown"
            
            i = 0
            while i < len(lines):
                line = lines[i]
                
                # Bắt đầu một block mô tả commit của 1 dòng (40 kí tự hash + số dòng)
                if re.match(r'^[0-9a-f]{40}\s', line):
                    parts = line.split()
                    current_commit = parts[0]
                    # Nếu commit bắt đầu bằng '^', nó là boundary (ngoài phạm vi 6 tháng)
                    is_boundary = current_commit.startswith('^')
                    
                    # Nếu block này đã được parse trước đó, git sẽ không lặp lại author, 
                    # nó chỉ lặp lại hash. Nhưng --line-porcelain thường nhồi author vào mọi dòng.
                elif line.startswith('author '):
                    current_author = line[7:].strip()
                elif line.startswith('boundary'):
                    is_boundary = True
                elif line.startswith('\t'):
                    # Kết thúc block của một dòng mã
                    # Số dòng (line number) được đếm tự động hoặc lấy từ parts[2] của dòng hash
                    # Tuy nhiên để chắc chắn, ta dùng độ dài của từ điển `line_authors` + 1
                    line_no = len(line_authors) + 1
                    
                    if is_boundary:
                        line_authors[line_no] = {"author": current_author, "boundary": True}
                    else:
                        line_authors[line_no] = {"author": current_author, "boundary": False}
                        # Cộng dồn LOC cho author này
                        if current_author not in self.member_loc:
                            self.member_loc[current_author] = 0
                        self.member_loc[current_author] += 1
                        
                    # Reset data for next line
                    is_boundary = False
                i += 1
                
        except Exception as e:
            pass
            
        self.file_authors_cache[file_path] = line_authors
        return line_authors

    def get_author_info(self, file_path, line_no):
        """
        Trả về dictionary chứa {"author": string, "boundary": boolean} của 1 dòng mã.
        Nếu code ngoài 6 tháng hoặc không có thông tin, boundary = True.
        """
        rel_path = os.path.relpath(file_path, self.target_dir)
        # Fix cho trường hợp file path đã tương đối rồi thì để nguyên
        if not file_path.startswith('/'): rel_path = file_path
            
        authors = self.parse_blame(rel_path)
        return authors.get(line_no, {"author": "Unknown", "boundary": True})

    def get_all_member_loc(self):
        """Trả về tổng số dòng code (trong 6 tháng) của từng member."""
        return self.member_loc
