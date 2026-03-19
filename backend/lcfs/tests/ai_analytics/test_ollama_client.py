import httpx
import pytest

from lcfs.services.ai_analytics.providers.base import StructuredLlmError
from lcfs.services.ai_analytics.providers.ollama import OllamaClient
from lcfs.services.ai_analytics.types import LlmPlanPayload
from lcfs.settings import Settings


@pytest.mark.anyio
async def test_ollama_client_parses_valid_json():
    async def handler(request):
        return httpx.Response(
            200,
            json={
                "response": """
                {
                  "intent": "aggregation",
                  "metrics": ["credits"],
                  "dimensions": ["compliance period"],
                  "filters": [],
                  "timeframe": null,
                  "entities": ["public.mv_credit_ledger"],
                  "chart_type": "bar",
                  "explanation": "Use the local model plan.",
                  "confidence": 0.9,
                  "ambiguities": []
                }
                """
            },
        )

    settings = Settings(
        ai_analytics_mode="local_llm_direct",
        ai_analytics_llm_base_url="http://ollama:11434",
        ai_analytics_llm_model="llama3.1:8b",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,ollama",
    )
    client = OllamaClient(settings)
    client._client = httpx.AsyncClient(
        base_url=settings.ai_analytics_llm_base_url,
        transport=httpx.MockTransport(handler),
    )

    payload = await client.generate_json("plan", LlmPlanPayload)

    assert payload.chart_type == "bar"


@pytest.mark.anyio
async def test_ollama_client_raises_on_invalid_json():
    async def handler(request):
        return httpx.Response(200, json={"response": "not-json"})

    settings = Settings(
        ai_analytics_mode="local_llm_direct",
        ai_analytics_llm_base_url="http://ollama:11434",
        ai_analytics_llm_model="llama3.1:8b",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,ollama",
    )
    client = OllamaClient(settings)
    client._client = httpx.AsyncClient(
        base_url=settings.ai_analytics_llm_base_url,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(StructuredLlmError):
        await client.generate_json("plan", LlmPlanPayload)
