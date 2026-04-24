from src.engine.ai_cache import ProjectAiCacheIndex, ai_audit_cache
from src.engine.database import AuditDatabase


def _reset_ai_cache_state():
    ai_audit_cache._memory_entries.clear()
    ai_audit_cache._memory_runs.clear()
    ai_audit_cache._pending_runs.clear()
    ai_audit_cache._memory_policy = dict(ai_audit_cache.DEFAULT_POLICY)
    AuditDatabase._pool = None


def setup_function():
    _reset_ai_cache_state()


def teardown_function():
    _reset_ai_cache_state()


def test_project_ai_cache_index_normalizes_relative_paths_against_target_dir(tmp_path):
    source_dir = tmp_path / "src"
    source_dir.mkdir()
    file_path = source_dir / "module.py"
    file_path.write_text("print('ok')\n", encoding="utf-8")

    index = ProjectAiCacheIndex(
        str(tmp_path),
        [{"path": str(file_path), "loc": 1}],
    ).build()

    assert index.normalize_relative_path("src/module.py") == "src/module.py"
    assert index.get_record("src/module.py")["relative_path"] == "src/module.py"


def test_ai_audit_cache_store_lookup_and_finalize_run():
    payload = {
        "target_id": "demo-project",
        "mode": "realtime",
        "model": "gpt-5.4-mini",
        "prompt_version": ai_audit_cache.prompt_version("validation"),
        "rules_version": "rules-v1",
        "custom_rules_hash": "custom-v1",
        "relative_file": "src/demo.py",
        "file_sha256": "file-hash",
        "line": 12,
        "rule_id": "RULE_1",
        "snippet_hash": "snippet-hash",
        "normalized_reason": "Issue",
    }
    ai_audit_cache.start_run("job-1", "demo-project")
    ai_audit_cache.store_entry(
        entry_type="validation",
        payload=payload,
        result_json={
            "index": 0,
            "is_false_positive": False,
            "explanation": "cached",
            "confidence": 0.92,
        },
        source_input_tokens=18,
        source_output_tokens=7,
        source_estimated_cost=0.0042,
    )

    lookup = ai_audit_cache.lookup_entry(entry_type="validation", payload=payload)
    ai_audit_cache.record_hit("job-1", "validation", lookup)
    ai_audit_cache.record_miss("job-1", "validation", 2)
    ai_audit_cache.record_write("job-1", "validation", 1)

    summary = ai_audit_cache.finalize_run("job-1", target_id="demo-project")

    assert lookup["result_json"]["explanation"] == "cached"
    assert summary["hits"] == 1
    assert summary["misses"] == 2
    assert summary["writes"] == 1
    assert summary["saved_input_tokens"] == 18
    assert summary["saved_output_tokens"] == 7
    assert summary["saved_cost_usd"] == 0.0042
    assert ai_audit_cache._memory_runs["job-1"]["target_id"] == "demo-project"


def test_ai_audit_cache_save_policy_and_clear_cache():
    payload = {
        "target_id": "demo-project",
        "mode": "realtime",
        "model": "gpt-5.4-mini",
        "prompt_version": ai_audit_cache.prompt_version("validation"),
        "rules_version": "rules-v1",
        "custom_rules_hash": "custom-v1",
        "relative_file": "src/demo.py",
        "file_sha256": "file-hash",
        "line": 12,
        "rule_id": "RULE_1",
        "snippet_hash": "snippet-hash",
        "normalized_reason": "Issue",
    }
    policy = ai_audit_cache.save_policy(
        {
            "enabled": True,
            "validation_enabled": True,
            "deep_audit_enabled": False,
            "cross_check_enabled": True,
            "retention_days": 14,
        }
    )
    ai_audit_cache.store_entry(
        entry_type="validation",
        payload=payload,
        result_json={"ok": True},
    )

    cleared = ai_audit_cache.clear_cache()

    assert policy["retention_days"] == 14
    assert cleared["entries_count"] == 0
    assert cleared["enabled"] is True
    assert cleared["deep_audit_enabled"] is False
