import pytest

from lcfs.services.ai_analytics.providers.local_endpoint_validator import (
    validate_private_ai_url,
)
from lcfs.settings import Settings


def test_private_endpoint_validator_allows_localhost():
    settings = Settings(
        ai_analytics_mode="heuristic_only",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,ollama",
    )

    validate_private_ai_url(
        "http://localhost:11434",
        settings,
        "LCFS_AI_ANALYTICS_LLM_BASE_URL",
    )


def test_private_endpoint_validator_rejects_public_host():
    settings = Settings(
        ai_analytics_mode="heuristic_only",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,ollama",
    )

    with pytest.raises(ValueError):
        validate_private_ai_url(
            "https://api.openai.com/v1",
            settings,
            "LCFS_AI_ANALYTICS_LLM_BASE_URL",
        )
