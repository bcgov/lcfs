from __future__ import annotations

from typing import Optional
from typing import Type

import httpx
from pydantic import BaseModel

from lcfs.services.ai_analytics.providers.base import LocalLLMClient, StructuredLlmError
from lcfs.settings import Settings


class OllamaClient(LocalLLMClient):
    provider_name = "ollama"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model_name = settings.ai_analytics_llm_model or ""
        self._client = httpx.AsyncClient(
            base_url=settings.ai_analytics_llm_base_url,
            timeout=settings.ai_analytics_request_timeout_seconds,
            headers=(
                {"Authorization": f"Bearer {settings.ai_analytics_llm_api_key}"}
                if settings.ai_analytics_llm_api_key
                else None
            ),
        )

    async def generate_json(
        self,
        prompt: str,
        response_model: Type[BaseModel],
    ) -> BaseModel:
        last_error: Optional[Exception] = None
        for _ in range(self.settings.ai_analytics_max_retries + 1):
            try:
                response = await self._client.post(
                    "/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                response.raise_for_status()
                body = response.json()
                raw_text = body.get("response", "")
                return self.validate_json_response(raw_text, response_model)
            except (httpx.HTTPError, StructuredLlmError, ValueError) as exc:
                last_error = exc
        raise StructuredLlmError(f"Ollama structured generation failed: {last_error}")
