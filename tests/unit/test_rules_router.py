from src.api.routers.rules import SaveRulesRequest


def test_save_rules_request_custom_weights_are_not_shared_between_instances():
    first = SaveRulesRequest(target="repo-1")
    second = SaveRulesRequest(target="repo-2")

    first.custom_weights["HIGH_COMPLEXITY"] = -3.0

    assert second.custom_weights == {}
