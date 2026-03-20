import httpx
import pytest

from lcfs.services.ai_analytics.forecasting.mindsdb_client import MindsdbClient
from lcfs.settings import Settings


@pytest.mark.anyio
async def test_mindsdb_client_predicts_with_mocked_local_endpoint(monkeypatch):
    async def handler(request):
        if "SHOW MODELS" in request.content.decode():
            return httpx.Response(200, json={"data": []})
        if "CREATE MODEL" in request.content.decode():
            return httpx.Response(200, json={"data": []})
        return httpx.Response(200, json={"data": [{"ds": "2025-01-01", "y": 10.0}]})

    test_settings = Settings(
        ai_analytics_mode="heuristic_only",
        ai_analytics_enable_mindsdb=True,
        ai_analytics_mindsdb_base_url="http://mindsdb:47334",
        ai_analytics_mindsdb_allowed_internal_hosts="localhost,127.0.0.1,mindsdb",
    )
    monkeypatch.setattr(
        "lcfs.services.ai_analytics.forecasting.mindsdb_client.settings",
        test_settings,
    )
    client = MindsdbClient()
    client.client = httpx.AsyncClient(
        base_url=test_settings.ai_analytics_mindsdb_base_url,
        transport=httpx.MockTransport(handler),
    )

    model_info = await client.create_or_retrain_model(
        "forecast_test",
        "SELECT ds, y FROM training_data",
        6,
    )
    predictions = await client.predict("forecast_test", 6)

    assert model_info.model_name == "forecast_test"
    assert predictions[0].y == 10.0
