import httpx
import pytest

from lcfs.services.ai_analytics.providers.openclaw import OpenClawClient
from lcfs.services.ai_analytics.types import LlmPlanPayload
from lcfs.settings import Settings


@pytest.mark.anyio
async def test_openclaw_client_calls_local_endpoint():
    async def handler(request):
        assert request.url.path == "/orchestrate"
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
                  "explanation": "Use local openclaw orchestration.",
                  "confidence": 0.88,
                  "ambiguities": []
                }
                """
            },
        )

    settings = Settings(
        ai_analytics_mode="openclaw_local",
        ai_analytics_openclaw_base_url="http://openclaw:8080",
        ai_analytics_allowed_internal_hosts="localhost,127.0.0.1,openclaw",
    )
    client = OpenClawClient(settings)
    client._client = httpx.AsyncClient(
        base_url=settings.ai_analytics_openclaw_base_url,
        transport=httpx.MockTransport(handler),
    )

    payload = await client.generate_json("plan", LlmPlanPayload)

    assert payload.entities == ["public.mv_credit_ledger"]
