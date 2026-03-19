from __future__ import annotations

from lcfs.services.ai_analytics.providers.base import LocalLLMClient
from lcfs.services.ai_analytics.providers.ollama import OllamaClient
from lcfs.services.ai_analytics.providers.openclaw import OpenClawClient
from lcfs.settings import Settings


def build_local_llm_client(settings: Settings) -> LocalLLMClient:
    if settings.ai_analytics_mode == "local_llm_direct":
        provider = settings.ai_analytics_llm_provider.lower()
        if provider == "ollama":
            return OllamaClient(settings)
        raise ValueError(f"Unsupported local LLM provider: {settings.ai_analytics_llm_provider}")
    if settings.ai_analytics_mode == "openclaw_local":
        return OpenClawClient(settings)
    raise ValueError("No local model client is configured for heuristic-only mode.")
