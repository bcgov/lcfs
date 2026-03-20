from __future__ import annotations

from typing import Dict, List

from lcfs.services.ai_analytics.forecasting.forecast_types import ForecastExecutionResult
from lcfs.services.ai_analytics.types import ChartSpec


class ForecastChartBuilder:
    def build(self, title: str, result: ForecastExecutionResult) -> ChartSpec:
        historical = result.historical_rows
        forecast = result.forecast_rows
        historical_points = [(row["ds"], row["y"]) for row in historical]
        forecast_points = [(row["ds"], row["y"]) for row in forecast]
        option = {
            "title": {"text": title},
            "tooltip": {"trigger": "axis"},
            "legend": {"data": ["Historical", "Forecast"]},
            "xAxis": {
                "type": "category",
                "data": [point[0] for point in historical_points + forecast_points],
            },
            "yAxis": {"type": "value"},
            "series": [
                {
                    "name": "Historical",
                    "type": "line",
                    "data": [point[1] for point in historical_points],
                    "smooth": True,
                },
                {
                    "name": "Forecast",
                    "type": "line",
                    "data": [None] * len(historical_points)
                    + [point[1] for point in forecast_points],
                    "lineStyle": {"type": "dashed"},
                    "smooth": True,
                },
            ],
        }
        return ChartSpec(
            chart_type="line",
            title=title,
            option=option,
            rationale="Historical and forecast values are shown as distinct line segments.",
        )
