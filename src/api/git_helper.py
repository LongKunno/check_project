import os
import shutil
import urllib.parse
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
                # URL Encode credentials to handle special characters (@, :, =, etc.)
                quoted_username = urllib.parse.quote(username)
                quoted_token = urllib.parse.quote(token)
                
                # Basic Auth Injection into URL
                if "://" in clone_url:
                    protocol, rest = clone_url.split("://", 1)
                    # Xử lý trường hợp có username trong url rồi (ví dụ: https://admin@bitbucket.org...)
                    if "@" in rest:
                        rest = rest.split("@", 1)[1]
                    clone_url = f"{protocol}://{quoted_username}:{quoted_token}@{rest}"
                else:
                    clone_url = f"https://{quoted_username}:{quoted_token}@{clone_url}"
            
            logger.info(f"Cloning repository into {dest_dir} (Shallow clone, shallow-since=6.months)...")
            
            # Khởi tạo bản sao (Dùng shallow_since thay vì depth=1 để giữ lịch sử 6 tháng cho Member Scoring)
            # Thiết lập GIT_TERMINAL_PROMPT=0 để ngăn việc Git bị treo khi hỏi password tương tác
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            
            try:
                Repo.clone_from(clone_url, dest_dir, shallow_since="6 months", env=env)
                logger.info("Successfully cloned repository with 6-month history. Kept .git directory for Authorship analysis.")
            except GitCommandError as shallow_err:
                if "error processing shallow info" in str(shallow_err.stderr):
                    logger.warning("Shallow clone failed. Falling back to full clone...")
                    # Remove the failed clone directory if it was created
                    if os.path.exists(dest_dir):
                        shutil.rmtree(dest_dir)
                    Repo.clone_from(clone_url, dest_dir, env=env)
                    logger.info("Successfully performed a full clone as a fallback.")
                else:
                    raise shallow_err
                
            return True
            
        except GitCommandError as e:
            logger.error(f"Git clone failed. Command output: {e.stderr}")
            # Lọc thông báo lỗi để không lộ token (App Password)
            error_msg = str(e.stderr).replace(token, "***") if token else str(e.stderr)
            raise Exception(f"Không thể clone repository. Vui lòng kiểm tra lại URL, Username và Token. Chi tiết: {error_msg}")
        except Exception as e:
            logger.error(f"Unexpected error during clone: {e}")
            raise Exception(f"Lỗi hệ thống khi clone repository: {str(e)}")
