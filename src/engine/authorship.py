import os
import subprocess
import re
import logging


class AuthorshipTracker:
    """
    Theo dõi tác giả của từng dòng mã nguồn dựa trên Git blame.
    Chỉ tính toán các dòng mã được commit trong vòng 3 tháng gần đây
    để đảm bảo tính chính xác và không đánh giá code legacy.

    Sử dụng author-mail (email) làm khóa chính để phân biệt thành viên,
    tránh trùng lặp khi cùng một người dùng nhiều tên khác nhau.
    """

    def __init__(self, target_dir):
        self.target_dir = os.path.abspath(target_dir)
        self.is_git_repo = os.path.exists(os.path.join(self.target_dir, ".git"))
        self.file_authors_cache = {}
        self.file_member_loc_cache = {}
        self.member_loc = {}  # { email: int } — LOC trong 3 tháng
        self.member_names = {}  # { email: name } — Mapping email → display name

    def parse_blame(self, file_path):
        """
        Sử dụng git blame --line-porcelain --since="3 months" để lấy tác giả của từng dòng.
        Lưu trữ kết quả vào cache để sử dụng lại.
        Trương hợp code cũ hơn 3 tháng, git sẽ đánh dấu commit bằng kí tự boundary (thường là '^').
        """
        if file_path in self.file_authors_cache:
            return self.file_authors_cache[file_path]

        line_authors = {}
        file_member_loc = {}
        if not self.is_git_repo:
            self.file_authors_cache[file_path] = line_authors
            self.file_member_loc_cache[file_path] = file_member_loc
            return line_authors

        try:
            # Chạy git blame với giới hạn 3 tháng
            result = subprocess.run(
                ["git", "blame", "--line-porcelain", "--since=3.months", file_path],
                cwd=self.target_dir,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode != 0:
                self.file_authors_cache[file_path] = line_authors
                self.file_member_loc_cache[file_path] = file_member_loc
                return line_authors

            lines = result.stdout.splitlines()

            current_commit = None
            is_boundary = False
            current_author = "Unknown"
            current_email = "unknown@unknown"

            i = 0
            while i < len(lines):
                line = lines[i]

                # Bắt đầu một block mô tả commit của 1 dòng (40 kí tự hash + số dòng)
                if re.match(r"^[0-9a-f]{40}\s", line):
                    parts = line.split()
                    current_commit = parts[0]
                    # Nếu commit bắt đầu bằng '^', nó là boundary (ngoài phạm vi 6 tháng)
                    is_boundary = current_commit.startswith("^")

                elif line.startswith("author "):
                    current_author = line[7:].strip()
                elif line.startswith("author-mail "):
                    # Format: author-mail <email@example.com>
                    raw_email = line[12:].strip()
                    current_email = raw_email.strip("<>")
                elif line.startswith("boundary"):
                    is_boundary = True
                elif line.startswith("\t"):
                    # Kết thúc block của một dòng mã
                    line_no = len(line_authors) + 1

                    if is_boundary:
                        line_authors[line_no] = {
                            "author": current_author,
                            "email": current_email,
                            "boundary": True,
                        }
                    else:
                        line_authors[line_no] = {
                            "author": current_author,
                            "email": current_email,
                            "boundary": False,
                        }
                        # Cộng dồn LOC theo email (khóa chính)
                        if current_email not in self.member_loc:
                            self.member_loc[current_email] = 0
                        self.member_loc[current_email] += 1
                        if current_email not in file_member_loc:
                            file_member_loc[current_email] = 0
                        file_member_loc[current_email] += 1
                        # Lưu mapping email → tên hiển thị (lấy tên gần nhất)
                        self.member_names[current_email] = current_author

                    # Reset data for next line
                    is_boundary = False
                i += 1

        except Exception as e:
            logging.getLogger(__name__).warning(
                f"Error parsing Git blame for {file_path}: {e}"
            )

        self.file_authors_cache[file_path] = line_authors
        self.file_member_loc_cache[file_path] = file_member_loc
        return line_authors

    def get_author_info(self, file_path, line_no):
        """
        Trả về dictionary chứa {"author": string, "email": string, "boundary": boolean} của 1 dòng mã.
        Nếu code ngoài 3 tháng hoặc không có thông tin, boundary = True.
        """
        rel_path = os.path.relpath(file_path, self.target_dir)
        # Fix cho trường hợp file path đã tương đối rồi thì để nguyên
        if not file_path.startswith("/"):
            rel_path = file_path

        authors = self.parse_blame(rel_path)
        return authors.get(
            line_no, {"author": "Unknown", "email": "unknown@unknown", "boundary": True}
        )

    def get_all_member_loc(self):
        """Trả về tổng số dòng code (trong 3 tháng) của từng member, keyed by email."""
        return self.member_loc

    def get_file_member_loc(self, file_path):
        """Trả về LOC theo member cho một file cụ thể, chỉ tính non-boundary lines."""
        rel_path = os.path.relpath(file_path, self.target_dir)
        if not file_path.startswith("/"):
            rel_path = file_path

        if rel_path not in self.file_member_loc_cache:
            self.parse_blame(rel_path)
        return self.file_member_loc_cache.get(rel_path, {})

    def get_all_member_names(self):
        """Trả về mapping email → display name."""
        return self.member_names
