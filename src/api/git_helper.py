import os
import shutil
import base64
from typing import Optional
from git import Repo, GitCommandError
import logging
import re

from src.config import get_member_recent_months

logger = logging.getLogger(__name__)


class GitHelper:
    @staticmethod
    def _append_git_config(env: dict, key: str, value: str) -> None:
        count = int(env.get("GIT_CONFIG_COUNT", "0"))
        env[f"GIT_CONFIG_KEY_{count}"] = key
        env[f"GIT_CONFIG_VALUE_{count}"] = value
        env["GIT_CONFIG_COUNT"] = str(count + 1)

    @staticmethod
    def _build_git_env(username: Optional[str], token: Optional[str]) -> dict:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        if username and token:
            basic_auth = base64.b64encode(
                f"{username}:{token}".encode("utf-8")
            ).decode("ascii")
            GitHelper._append_git_config(
                env,
                "http.extraHeader",
                f"Authorization: Basic {basic_auth}",
            )
        return env

    @staticmethod
    def _sanitize_git_error(
        message: str,
        username: Optional[str],
        token: Optional[str],
    ) -> str:
        sanitized = str(message or "")
        sanitized = re.sub(r"(?<=://)[^@\s]+(?=@)", "***", sanitized)

        for secret in (username, token):
            if not secret:
                continue
            secret = str(secret)
            replacements = {
                secret,
                base64.b64encode(secret.encode("utf-8")).decode("ascii"),
            }
            for replacement in replacements:
                if replacement:
                    sanitized = sanitized.replace(replacement, "***")

        if username and token:
            basic_auth = base64.b64encode(
                f"{username}:{token}".encode("utf-8")
            ).decode("ascii")
            sanitized = sanitized.replace(basic_auth, "***")

        return sanitized

    @staticmethod
    def _should_retry_full_clone(error: GitCommandError) -> bool:
        detail = " ".join(
            filter(
                None,
                [
                    getattr(error, "stderr", ""),
                    getattr(error, "stdout", ""),
                    str(error),
                ],
            )
        ).lower()
        shallow_signals = (
            "shallow",
            "depth",
            "dumb http transport does not support shallow capabilities",
        )
        return any(signal in detail for signal in shallow_signals)

    @staticmethod
    def clone_repository(
        repo_url: str,
        dest_dir: str,
        username: Optional[str] = None,
        token: Optional[str] = None,
        branch: Optional[str] = None,
    ) -> bool:
        """
        Clones a git repository to a destination directory.
        Sử dụng auth header qua env thay vì nhúng credentials trực tiếp vào URL.
        """
        try:
            member_recent_months = get_member_recent_months()

            logger.info(
                "Cloning repository into %s (Shallow clone, shallow-since=%s.months)...",
                dest_dir,
                member_recent_months,
            )

            # Khởi tạo bản sao với cửa sổ lịch sử đủ cho Member Scoring.
            # Thiết lập GIT_TERMINAL_PROMPT=0 để ngăn việc Git bị treo khi hỏi password tương tác
            env = GitHelper._build_git_env(username, token)

            kwargs = {
                "shallow_since": f"{member_recent_months} months",
                "env": env,
            }
            if branch:
                kwargs["branch"] = branch

            try:
                Repo.clone_from(repo_url, dest_dir, **kwargs)
                logger.info(
                    "Successfully cloned repository (branch: %s) with %s-month history. Kept .git directory for Authorship analysis.",
                    branch or "default",
                    member_recent_months,
                )
            except GitCommandError as shallow_err:
                if GitHelper._should_retry_full_clone(shallow_err):
                    logger.warning(
                        "Shallow clone failed. Falling back to full clone..."
                    )
                    # Remove the failed clone directory if it was created
                    if os.path.exists(dest_dir):
                        shutil.rmtree(dest_dir)

                    fallback_kwargs = {"env": env}
                    if branch:
                        fallback_kwargs["branch"] = branch
                    Repo.clone_from(repo_url, dest_dir, **fallback_kwargs)
                    logger.info("Successfully performed a full clone as a fallback.")
                else:
                    raise shallow_err

            return True

        except GitCommandError as e:
            error_msg = GitHelper._sanitize_git_error(
                getattr(e, "stderr", "") or str(e),
                username,
                token,
            )
            logger.error("Git clone failed. Command output: %s", error_msg)
            raise Exception(
                f"Không thể clone repository. Vui lòng kiểm tra lại URL, Username và Token. Chi tiết: {error_msg}"
            )
        except Exception as e:
            sanitized = GitHelper._sanitize_git_error(str(e), username, token)
            logger.error("Unexpected error during clone: %s", sanitized)
            raise Exception(f"Lỗi hệ thống khi clone repository: {sanitized}")
