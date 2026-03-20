from lcfs.services.ai_analytics.chart_builder import ChartBuilder
from lcfs.services.ai_analytics.types import QueryDimension, QueryExecutionResult, QueryMetric, QueryPlan


def test_chart_builder_creates_line_chart_option():
    builder = ChartBuilder()
    plan = QueryPlan(
        question="Show trend of credits by year",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        dimensions=[QueryDimension(name="year")],
        candidate_chart_type="line",
        explanation="test",
        confidence=0.8,
    )
    result = QueryExecutionResult(
        columns=["year", "value"],
        column_types={"year": "int", "value": "int"},
        rows=[{"year": 2022, "value": 10}, {"year": 2023, "value": 15}],
        row_count=2,
        execution_ms=5.0,
        sample_preview=[],
    )

    chart = builder.build(plan, result)

    assert chart.chart_type == "line"
    assert chart.option["xAxis"]["data"] == [2022, 2023]


def test_chart_builder_falls_back_for_single_value_results():
    builder = ChartBuilder()
    plan = QueryPlan(
        question="Show total credits",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        candidate_chart_type="bar",
        explanation="test",
        confidence=0.8,
    )
    result = QueryExecutionResult(
        columns=["value"],
        column_types={"value": "int"},
        rows=[{"value": 10}],
        row_count=1,
        execution_ms=5.0,
        sample_preview=[],
    )

    chart = builder.build(plan, result)

    assert chart.chart_type == "table"
