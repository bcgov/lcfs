from __future__ import annotations

from time import perf_counter
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.services.ai_analytics.types import GeneratedSql, QueryExecutionResult


class QueryExecutor:
    """Executes validated analytics queries."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute(self, generated_sql: GeneratedSql) -> QueryExecutionResult:
        started_at = perf_counter()
        result = await self.db.execute(text(generated_sql.sql))
        rows = [dict(row) for row in result.mappings().all()]
        execution_ms = round((perf_counter() - started_at) * 1000, 2)
        column_types = self._infer_column_types(rows)
        columns = list(rows[0].keys()) if rows else []
        return QueryExecutionResult(
            columns=columns,
            column_types=column_types,
            rows=rows,
            row_count=len(rows),
            execution_ms=execution_ms,
            sample_preview=rows[:5],
        )

    def _infer_column_types(self, rows: list[Dict[str, Any]]) -> Dict[str, str]:
        if not rows:
            return {}
        inferred: Dict[str, str] = {}
        for key in rows[0].keys():
            sample = next((row.get(key) for row in rows if row.get(key) is not None), None)
            inferred[key] = type(sample).__name__ if sample is not None else "unknown"
        return inferred
