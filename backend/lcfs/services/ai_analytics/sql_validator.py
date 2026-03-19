from __future__ import annotations

import re

from lcfs.services.ai_analytics.types import GeneratedSql, SchemaCatalog


class SqlSafetyValidator:
    """Validates generated SQL before execution."""

    _dangerous_pattern = re.compile(
        r"\b(insert|update|delete|alter|drop|truncate|grant|revoke|pg_sleep|copy)\b",
        re.IGNORECASE,
    )

    def validate(self, generated_sql: GeneratedSql, catalog: SchemaCatalog) -> None:
        sql = generated_sql.sql.strip()
        upper_sql = sql.upper()

        if ";" in sql:
            raise ValueError("Only a single SQL statement is allowed.")
        if not (upper_sql.startswith("SELECT") or upper_sql.startswith("WITH")):
            raise ValueError("Only SELECT queries are allowed.")
        if self._dangerous_pattern.search(sql):
            raise ValueError("Dangerous SQL keyword or function detected.")
        if generated_sql.applied_limit and generated_sql.applied_limit > 1000:
            raise ValueError("Generated limit exceeds the configured safety threshold.")

        catalog_entities = {entity.qualified_name for entity in catalog.entities}
        if generated_sql.entity_name not in catalog_entities:
            raise ValueError("Generated SQL references an unknown entity.")

        entity = next(
            entity
            for entity in catalog.entities
            if entity.qualified_name == generated_sql.entity_name
        )
        known_columns = {column.name for column in entity.columns}
        for column in generated_sql.used_columns:
            if column == "*":
                continue
            if column not in known_columns:
                raise ValueError(f"Generated SQL references unknown column '{column}'.")
