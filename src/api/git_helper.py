import os
import shutil
from typing import Optional
from git import Repo, GitCommandError
import logging

logger = logging.getLogger(__name__)

class GitHelper:
    @staticmethod
    def clone_repository(repo_url: str, dest_dir: str, username: Optional[str] = None, token: Optional[str] = None) -> bool:
        """
        Clones a git repository to a destination directory.
        Handles formatting the URL with credentials if necessary.
        """
        try:
            # Format URL with credentials if provided
            clone_url = repo_url
            if username and token:
                # Basic Auth Injection into URL
                if "://" in clone_url:
                    protocol, rest = clone_url.split("://", 1)
                    # Xử lý trường hợp có username trong url rồi (ví dụ: https://admin@bitbucket.org...)
                    if "@" in rest:
                        rest = rest.split("@", 1)[1]
                    clone_url = f"{protocol}://{username}:{token}@{rest}"
                else:
                    clone_url = f"https://{username}:{token}@{clone_url}"
            
            logger.info(f"Cloning repository into {dest_dir} (Shallow clone, depth=1)...")
            
            # Khởi tạo bản sao (Shallow clone để tốc độ nhanh nhất)
            Repo.clone_from(clone_url, dest_dir, multi_options=['--depth 1'])
            
            # Xóa thư mục .git để tránh Engine quét nhầm file lịch sử / config của Git (rất nặng)
            git_dir = os.path.join(dest_dir, '.git')
            if os.path.exists(git_dir):
                shutil.rmtree(git_dir)
                logger.info("Removed .git directory to save space and prevent indexing.")
                
            return True
            
        except GitCommandError as e:
            logger.error(f"Git clone failed. Command output: {e.stderr}")
            # Lọc thông báo lỗi để không lộ token (App Password)
            error_msg = str(e.stderr).replace(token, "***") if token else str(e.stderr)
            raise Exception(f"Không thể clone repository. Vui lòng kiểm tra lại URL, Username và Token. Chi tiết: {error_msg}")
        except Exception as e:
            logger.error(f"Unexpected error during clone: {e}")
            raise Exception(f"Lỗi hệ thống khi clone repository: {str(e)}")
