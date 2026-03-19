import pytest
from fastapi import FastAPI, status

from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
async def test_ai_analytics_catalog_endpoint(
    client,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    response = await client.post("/api/ai-analytics/schema/catalog", json={})

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert "entities" in payload
    assert any(entity["name"] == "v_compliance_report" for entity in payload["entities"])


@pytest.mark.anyio
async def test_ai_analytics_plan_endpoint(
    client,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    response = await client.post(
        "/api/ai-analytics/query/plan",
        json={
            "question": "Show trend of report processing time by year",
            "sessionId": "session-1",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["candidateChartType"] == "line"
    assert payload["executionMode"] in {
        "heuristic_only",
        "local_llm_direct",
        "openclaw_local",
    }
