import pytest

from lcfs.services.ai_analytics.forecasting.endpoint_validator import validate_mindsdb_url
from lcfs.settings import Settings


def test_mindsdb_private_validator_allows_internal_host():
    settings = Settings(
        ai_analytics_mode="heuristic_only",
        ai_analytics_mindsdb_allowed_internal_hosts="localhost,127.0.0.1,mindsdb",
    )

    validate_mindsdb_url("http://mindsdb:47334", settings)


def test_mindsdb_private_validator_rejects_public_host():
    settings = Settings(
        ai_analytics_mode="heuristic_only",
        ai_analytics_mindsdb_allowed_internal_hosts="localhost,127.0.0.1,mindsdb",
    )

    with pytest.raises(ValueError):
        validate_mindsdb_url("https://public-forecast.example.com", settings)
