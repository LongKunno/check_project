import os
import shutil
import urllib.parse
from typing import Optional
from git import Repo, GitCommandError
import logging
import re

logger = logging.getLogger(__name__)

class GitHelper:
    @staticmethod
    def _build_clone_url(repo_url: str, username: Optional[str], token: Optional[str]) -> str:
        if not (username and token):
            return repo_url
            
        quoted_username = urllib.parse.quote(username)
        quoted_token = urllib.parse.quote(token)
        
        if "://" in repo_url:
            protocol, rest = repo_url.split("://", 1)
            if "@" in rest:
                rest = rest.split("@", 1)[1]
            return f"{protocol}://{quoted_username}:{quoted_token}@{rest}"
        return f"https://{quoted_username}:{quoted_token}@{repo_url}"

    @staticmethod
    def clone_repository(repo_url: str, dest_dir: str, username: Optional[str] = None, token: Optional[str] = None, branch: Optional[str] = None) -> bool:
        """
        Clones a git repository to a destination directory.
        Handles formatting the URL with credentials if necessary.
        """
        try:
            clone_url = GitHelper._build_clone_url(repo_url, username, token)
            
            logger.info(f"Cloning repository into {dest_dir} (Shallow clone, shallow-since=3.months)...")
            
            # Khởi tạo bản sao (Dùng shallow_since thay vì depth=1 để giữ lịch sử 3 tháng cho Member Scoring)
            # Thiết lập GIT_TERMINAL_PROMPT=0 để ngăn việc Git bị treo khi hỏi password tương tác
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            
            kwargs = {"shallow_since": "3 months", "env": env}
            if branch:
                kwargs["branch"] = branch
            
            try:
                Repo.clone_from(clone_url, dest_dir, **kwargs)
                logger.info(f"Successfully cloned repository (branch: {branch or 'default'}) with 3-month history. Kept .git directory for Authorship analysis.")
            except GitCommandError as shallow_err:
                if "error processing shallow info" in str(shallow_err.stderr):
                    logger.warning("Shallow clone failed. Falling back to full clone...")
                    # Remove the failed clone directory if it was created
                    if os.path.exists(dest_dir):
                        shutil.rmtree(dest_dir)
                    
                    fallback_kwargs = {"env": env}
                    if branch: fallback_kwargs["branch"] = branch
                    Repo.clone_from(clone_url, dest_dir, **fallback_kwargs)
                    logger.info("Successfully performed a full clone as a fallback.")
                else:
                    raise shallow_err
                
            return True
            
        except GitCommandError as e:
            logger.error(f"Git clone failed. Command output: {e.stderr}")
            # Lọc thông báo lỗi để không lộ token (App Password) bằng Regex an toàn
            error_msg = str(e.stderr)
            if token:
                # Xóa toàn bộ credentials format (://user:pass@)
                error_msg = re.sub(r'(?<=://)[^@]+(?=@)', '***', error_msg)
                # Fallback cho token đứng một mình, hoặc urlencdoded
                error_msg = error_msg.replace(token, "***")
            raise Exception(f"Không thể clone repository. Vui lòng kiểm tra lại URL, Username và Token. Chi tiết: {error_msg}")
        except Exception as e:
            logger.error(f"Unexpected error during clone: {e}")
            raise Exception(f"Lỗi hệ thống khi clone repository: {str(e)}")
