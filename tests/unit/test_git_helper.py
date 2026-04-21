import importlib

import pytest
from git import GitCommandError


def test_clone_repository_uses_configured_member_recent_months(monkeypatch, tmp_path):
    import src.api.git_helper as git_helper_module

    importlib.reload(git_helper_module)

    observed = {}

    def fake_clone_from(clone_url, dest_dir, **kwargs):
        observed["clone_url"] = clone_url
        observed["dest_dir"] = dest_dir
        observed["kwargs"] = kwargs

    monkeypatch.setattr(git_helper_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(git_helper_module.Repo, "clone_from", fake_clone_from)

    result = git_helper_module.GitHelper.clone_repository(
        "https://example.com/org/repo.git",
        str(tmp_path / "repo"),
    )

    assert result is True
    assert observed["kwargs"]["shallow_since"] == "6 months"


def test_clone_repository_uses_auth_header_env_without_putting_credentials_in_url(
    monkeypatch, tmp_path
):
    import src.api.git_helper as git_helper_module

    importlib.reload(git_helper_module)

    observed = {}

    def fake_clone_from(clone_url, dest_dir, **kwargs):
        observed["clone_url"] = clone_url
        observed["dest_dir"] = dest_dir
        observed["kwargs"] = kwargs

    monkeypatch.setattr(git_helper_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(git_helper_module.Repo, "clone_from", fake_clone_from)

    result = git_helper_module.GitHelper.clone_repository(
        "https://example.com/org/repo.git",
        str(tmp_path / "repo"),
        username="demo-user",
        token="demo-token",
    )

    env = observed["kwargs"]["env"]

    assert result is True
    assert observed["clone_url"] == "https://example.com/org/repo.git"
    assert env["GIT_TERMINAL_PROMPT"] == "0"
    assert env["GIT_CONFIG_COUNT"] == "1"
    assert env["GIT_CONFIG_KEY_0"] == "http.extraHeader"
    assert env["GIT_CONFIG_VALUE_0"].startswith("Authorization: Basic ")
    assert "demo-token" not in env["GIT_CONFIG_VALUE_0"]


def test_clone_repository_masks_credentials_in_error_message(monkeypatch, tmp_path):
    import src.api.git_helper as git_helper_module

    importlib.reload(git_helper_module)

    def fake_clone_from(_clone_url, _dest_dir, **_kwargs):
        raise GitCommandError(
            "clone",
            128,
            stderr="fatal: https://demo-user:demo-token@example.com/repo.git denied",
        )

    monkeypatch.setattr(git_helper_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(git_helper_module.Repo, "clone_from", fake_clone_from)

    with pytest.raises(Exception) as exc_info:
        git_helper_module.GitHelper.clone_repository(
            "https://example.com/org/repo.git",
            str(tmp_path / "repo"),
            username="demo-user",
            token="demo-token",
        )

    message = str(exc_info.value)
    assert "demo-token" not in message
    assert "demo-user" not in message
    assert "***" in message
