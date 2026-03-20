from lcfs.services.ai_analytics.query_planner import QueryPlanner
from lcfs.services.ai_analytics.types import QueryMetric, QueryPlan, SchemaCatalog, SchemaEntity, SessionContext


def build_catalog():
    return SchemaCatalog(
        entities=[
            SchemaEntity(
                name="vw_compliance_report_flow_metrics",
                schema_name="public",
                entity_type="view",
                description="Workflow timing metrics with lead_time_days and completion_year",
                semantic_tags=["workflow", "processing_time", "compliance_period"],
                preferred_for_analytics=True,
            )
        ],
        generated_at="2026-03-19T00:00:00Z",
    )


def test_query_planner_interprets_processing_time_trend():
    planner = QueryPlanner()

    plan = planner.create_plan(
        "Show trend of report processing time by year",
        build_catalog(),
    )

    assert plan.metrics[0].name == "processing time"
    assert plan.candidate_chart_type == "line"
    assert "public.vw_compliance_report_flow_metrics" in plan.candidate_entities


def test_query_planner_builds_follow_up_from_session_context():
    planner = QueryPlanner()
    session_context = SessionContext(
        session_id="session-1",
        last_question="Show total credits by compliance period",
        last_plan=QueryPlan(
            question="Show total credits by compliance period",
            intent="aggregation",
            metrics=[QueryMetric(name="credits", aggregation="sum")],
            dimensions=[],
            candidate_entities=["public.mv_credit_ledger"],
            candidate_chart_type="table",
            explanation="test",
            confidence=0.8,
        ),
    )

    plan = planner.create_plan("show this by year", build_catalog(), session_context)

    assert plan.follow_up_of == "Show total credits by compliance period"
    assert plan.dimensions[0].name == "compliance period"


def test_query_planner_prefers_compare_subject_as_dimension():
    planner = QueryPlanner()

    plan = planner.create_plan(
        "Compare organizations by total credits in 2024",
        build_catalog(),
    )

    assert plan.dimensions[0].name == "organizations"


def test_query_planner_extracts_organization_id_filter():
    planner = QueryPlanner()

    plan = planner.create_plan(
        "Show total credits by compliance period for org id 4",
        build_catalog(),
    )

    assert any(
        filter_item.field == "organization_id" and filter_item.value == 4
        for filter_item in plan.filters
    )
