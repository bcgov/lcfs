from typing import Any, Dict, List, Optional

from pydantic import Field

from lcfs.web.api.base import BaseSchema


class ForecastDatasetSpec(BaseSchema):
    entity_name: str
    metric_column: str
    time_column: str
    granularity: str
    grouping_columns: List[str] = Field(default_factory=list)
    sql: str


class ForecastModelInfo(BaseSchema):
    model_name: str
    reused: bool = False
    trained: bool = False
    healthy: bool = True


class MindsdbPredictionRow(BaseSchema):
    ds: str
    y: float
    group_value: Optional[str] = None
    lower: Optional[float] = None
    upper: Optional[float] = None


class ForecastExecutionResult(BaseSchema):
    historical_rows: List[Dict[str, Any]] = Field(default_factory=list)
    forecast_rows: List[Dict[str, Any]] = Field(default_factory=list)
    combined_series: List[Dict[str, Any]] = Field(default_factory=list)
    model_info: ForecastModelInfo
    assumptions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
