import importlib


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

