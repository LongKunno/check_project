from types import SimpleNamespace


def test_authorship_tracker_uses_configured_recent_months(monkeypatch, tmp_path):
    import src.engine.authorship as authorship_module

    (tmp_path / ".git").mkdir()
    observed = {}

    blame_output = "\n".join(
        [
            "a" * 40 + " 1 1 1",
            "author Example Dev",
            "author-mail <dev@example.com>",
            "\tprint('hello')",
        ]
    )

    def fake_run(args, cwd, capture_output, text, check):
        observed["args"] = args
        return SimpleNamespace(returncode=0, stdout=blame_output)

    monkeypatch.setattr(authorship_module, "get_member_recent_months", lambda: 6)
    monkeypatch.setattr(authorship_module.subprocess, "run", fake_run)

    tracker = authorship_module.AuthorshipTracker(str(tmp_path))
    author_info = tracker.get_author_info("main.py", 1)

    assert f"--since=6.months" in observed["args"]
    assert author_info["email"] == "dev@example.com"
    assert author_info["boundary"] is False
    assert tracker.get_file_member_loc("main.py") == {"dev@example.com": 1}
