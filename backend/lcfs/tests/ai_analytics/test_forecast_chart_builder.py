from lcfs.services.ai_analytics.forecasting.forecast_chart_builder import ForecastChartBuilder
from lcfs.services.ai_analytics.forecasting.forecast_types import ForecastExecutionResult, ForecastModelInfo


def test_forecast_chart_builder_creates_historical_and_forecast_series():
    builder = ForecastChartBuilder()
    result = ForecastExecutionResult(
        historical_rows=[{"ds": "2024-01-01", "y": 10.0}, {"ds": "2024-02-01", "y": 12.0}],
        forecast_rows=[{"ds": "2024-03-01", "y": 13.0}, {"ds": "2024-04-01", "y": 14.0}],
        model_info=ForecastModelInfo(model_name="forecast_model"),
    )

    chart = builder.build("Credits forecast", result)

    assert chart.chart_type == "line"
    assert len(chart.option["series"]) == 2
