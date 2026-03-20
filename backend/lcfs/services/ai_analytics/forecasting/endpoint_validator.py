from lcfs.services.ai_analytics.providers.local_endpoint_validator import (
    validate_private_ai_url,
)


def validate_mindsdb_url(url: str, settings) -> None:
    validate_private_ai_url(url, settings, "LCFS_AI_ANALYTICS_MINDSDB_BASE_URL")
