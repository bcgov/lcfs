import pytest

from lcfs.settings import Settings


def test_settings_fail_closed_for_public_local_llm_url():
    with pytest.raises(ValueError):
        Settings(
            ai_analytics_mode="local_llm_direct",
            ai_analytics_llm_base_url="https://api.openai.com/v1",
            ai_analytics_llm_model="llama3.1:8b",
        )


def test_settings_allow_private_openclaw_url():
    settings = Settings(
        ai_analytics_mode="openclaw_local",
        ai_analytics_openclaw_base_url="http://openclaw:8080",
        ai_analytics_openclaw_model="local-planner",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,openclaw",
    )

    assert settings.ai_analytics_mode == "openclaw_local"


def test_settings_fail_closed_for_public_mindsdb_url():
    with pytest.raises(ValueError):
        Settings(
            ai_analytics_mode="heuristic_only",
            ai_analytics_enable_mindsdb=True,
            ai_analytics_mindsdb_base_url="https://mindsdb-cloud.example.com",
        )
