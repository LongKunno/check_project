import importlib

import dotenv


def test_ai_service_defaults_to_gpt_5_4(monkeypatch):
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)

    import src.engine.ai_service as ai_service_module

    importlib.reload(ai_service_module)
    service = ai_service_module.AiService()

    assert service.model == "gpt-5.4"


def test_ai_service_prefers_ai_model_env(monkeypatch):
    monkeypatch.setenv("AI_MODEL", "test-model")

    import src.engine.ai_service as ai_service_module

    importlib.reload(ai_service_module)
    service = ai_service_module.AiService()

    assert service.model == "test-model"
