from pydantic import BaseModel

import pytest

from lcfs.services.ai_analytics.providers.base import StructuredLlmError
from lcfs.services.ai_analytics.service import AiAnalyticsService
from lcfs.services.ai_analytics.types import LlmAnalysisPayload, LlmPlanPayload


class FakePlanClient:
    provider_name = "ollama"
    model_name = "llama3.1:8b"

    async def generate_json(self, prompt, response_model):
        if response_model is LlmPlanPayload:
            return LlmPlanPayload(
                intent="aggregation",
                metrics=["credits"],
                dimensions=["compliance period"],
                entities=["public.mv_credit_ledger"],
                chart_type="bar",
                explanation="Local model chose the credit ledger view.",
                confidence=0.91,
                ambiguities=[],
            )
        return LlmAnalysisPayload(
            summary="Local model grounded the summary on the returned rows.",
            findings=["2023 has the highest returned value."],
            caveats=[],
            suggested_title="Credits by compliance period",
        )


class BrokenPlanClient:
    provider_name = "ollama"
    model_name = "llama3.1:8b"

    async def generate_json(self, prompt, response_model):
        raise StructuredLlmError("Invalid JSON")


@pytest.mark.anyio
async def test_service_uses_local_llm_for_plan(dbsession):
    service = AiAnalyticsService(dbsession)
    service.local_llm_client = FakePlanClient()
    service.execution_mode = "local_llm_direct"

    plan = await service.plan(
        "Show total credits by compliance period",
        session_id="runtime-test-1",
    )

    assert plan.explanation == "Local model chose the credit ledger view."
    assert plan.candidate_entities[0] == "public.mv_credit_ledger"


@pytest.mark.anyio
async def test_service_falls_back_to_heuristic_when_llm_plan_fails(dbsession):
    service = AiAnalyticsService(dbsession)
    service.local_llm_client = BrokenPlanClient()
    service.execution_mode = "local_llm_direct"

    plan = await service.plan(
        "Show trend of report processing time by year",
        session_id="runtime-test-2",
    )

    assert any("heuristic planning was used" in warning for warning in plan.warnings)
    assert plan.candidate_chart_type == "line"
