from __future__ import annotations

from typing import Any, Dict, List

from lcfs.services.ai_analytics.types import (
    AnalysisOutput,
    ChartSpec,
    QueryExecutionResult,
    QueryPlan,
)


class ChartBuilder:
    """Builds ECharts-ready options from query results."""

    def build(self, plan: QueryPlan, result: QueryExecutionResult) -> ChartSpec:
        chart_type = plan.candidate_chart_type
        title = self._build_title(plan)
        rows = result.rows

        if not rows or chart_type == "table":
            return ChartSpec(
                chart_type="table",
                title=title,
                option={"title": {"text": title}, "series": []},
                rationale="A table fallback was selected because the result is sparse or not chart-friendly.",
            )

        if chart_type == "pie":
            return ChartSpec(
                chart_type="pie",
                title=title,
                option=self._build_pie_option(title, rows),
                rationale="Pie was selected for composition/share style questions.",
            )
        if chart_type == "line":
            return ChartSpec(
                chart_type="line",
                title=title,
                option=self._build_xy_option(title, rows, "line"),
                rationale="Line was selected for trend/time-series analysis.",
            )
        if chart_type == "scatter":
            return ChartSpec(
                chart_type="scatter",
                title=title,
                option=self._build_xy_option(title, rows, "scatter"),
                rationale="Scatter was selected because the question requested point comparison.",
            )

        stacked = len(result.columns) > 2 and len(plan.dimensions) > 1
        return ChartSpec(
            chart_type="stacked_bar" if stacked else "bar",
            title=title,
            option=self._build_xy_option(title, rows, "bar", stacked=stacked),
            rationale="Bar was selected for grouped comparison across categories.",
        )

    def _build_title(self, plan: QueryPlan) -> str:
        if plan.metrics and plan.dimensions:
            return f"{plan.metrics[0].name.title()} by {plan.dimensions[0].name.title()}"
        if plan.metrics:
            return plan.metrics[0].name.title()
        return "Analytics Result"

    def _build_pie_option(self, title: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        label_key, value_key = list(rows[0].keys())[:2]
        return {
            "title": {"text": title},
            "tooltip": {"trigger": "item"},
            "legend": {"top": "bottom"},
            "series": [
                {
                    "type": "pie",
                    "radius": "60%",
                    "data": [
                        {"name": row[label_key], "value": row[value_key]} for row in rows
                    ],
                }
            ],
        }

    def _build_xy_option(
        self,
        title: str,
        rows: List[Dict[str, Any]],
        series_type: str,
        stacked: bool = False,
    ) -> Dict[str, Any]:
        keys = list(rows[0].keys())
        x_key = keys[0]
        if len(keys) == 2:
            y_key = keys[1]
            return {
                "title": {"text": title},
                "tooltip": {"trigger": "axis"},
                "xAxis": {"type": "category", "data": [row[x_key] for row in rows]},
                "yAxis": {"type": "value"},
                "series": [
                    {
                        "name": y_key,
                        "type": series_type,
                        "stack": "total" if stacked else None,
                        "data": [row[y_key] for row in rows],
                    }
                ],
            }

        series_key = keys[1]
        value_key = keys[-1]
        categories = []
        series_map: Dict[Any, Dict[str, Any]] = {}
        for row in rows:
            category = row[x_key]
            if category not in categories:
                categories.append(category)
            group_name = row[series_key]
            if group_name not in series_map:
                series_map[group_name] = {
                    "name": group_name,
                    "type": series_type,
                    "stack": "total" if stacked else None,
                    "data": [],
                }
            series_map[group_name]["data"].append(row[value_key])
        return {
            "title": {"text": title},
            "tooltip": {"trigger": "axis"},
            "legend": {"top": 20},
            "xAxis": {"type": "category", "data": categories},
            "yAxis": {"type": "value"},
            "series": list(series_map.values()),
        }


class ResultAnalyzer:
    """Produces grounded natural-language summaries from query results."""

    def analyze(self, plan: QueryPlan, result: QueryExecutionResult) -> AnalysisOutput:
        if not result.rows:
            return AnalysisOutput(
                summary="No rows matched the grounded query, so there is nothing to summarize yet.",
                key_findings=[],
                caveats=["Try narrowing the question or choosing a different metric or period."],
                title="No data returned",
            )

        rows = result.rows
        columns = result.columns
        key_findings: List[str] = []
        caveats: List[str] = []
        title = plan.metrics[0].name.title() if plan.metrics else "Analytics Result"

        if len(columns) >= 2:
            first_dimension = columns[0]
            value_column = columns[-1]
            ranked = [
                row for row in rows if isinstance(row.get(value_column), (int, float))
            ]
            if ranked:
                top = max(ranked, key=lambda row: row[value_column])
                key_findings.append(
                    f"Highest {value_column.replace('_', ' ')} is {top[value_column]} for {top[first_dimension]}."
                )
                if len(ranked) > 1:
                    bottom = min(ranked, key=lambda row: row[value_column])
                    key_findings.append(
                        f"Lowest {value_column.replace('_', ' ')} is {bottom[value_column]} for {bottom[first_dimension]}."
                    )
            if plan.candidate_chart_type == "line" and len(ranked) > 1:
                first_value = ranked[0][value_column]
                last_value = ranked[-1][value_column]
                direction = "up" if last_value >= first_value else "down"
                key_findings.append(
                    f"The series trends {direction} from {first_value} to {last_value} across the returned periods."
                )

        summary = key_findings[0] if key_findings else "Grounded query completed successfully."
        if plan.ambiguities:
            caveats.extend(plan.ambiguities)
        return AnalysisOutput(
            summary=summary,
            key_findings=key_findings,
            caveats=caveats,
            title=title,
        )
