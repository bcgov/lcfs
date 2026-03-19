from __future__ import annotations

import inspect
from collections import defaultdict
from datetime import datetime, timezone
from time import monotonic
from typing import Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.base import Base
from lcfs.db.models import load_all_models
from lcfs.services.ai_analytics.semantic_registry import (
    get_entity_description,
    semantic_registry_payload,
    semantic_tags_for_text,
)
from lcfs.services.ai_analytics.types import (
    SchemaCatalog,
    SchemaColumn,
    SchemaEntity,
    SchemaRelationship,
)
from lcfs.settings import settings


class SchemaCatalogService:
    """Builds a grounded schema catalog from ORM metadata and PostgreSQL metadata."""

    _cache: Optional[Tuple[float, SchemaCatalog]] = None

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_catalog(self, force_refresh: bool = False) -> SchemaCatalog:
        now = monotonic()
        if (
            not force_refresh
            and self.__class__._cache
            and now - self.__class__._cache[0]
            < settings.ai_analytics_schema_cache_ttl_seconds
        ):
            return self.__class__._cache[1]

        load_all_models()
        db_entities = await self._load_db_entities()
        orm_entities = self._load_orm_entities()

        merged = self._merge_entities(db_entities, orm_entities)
        catalog = SchemaCatalog(
            entities=sorted(
                merged.values(),
                key=lambda entity: (
                    0 if entity.preferred_for_analytics else 1,
                    entity.schema_name,
                    entity.name,
                ),
            ),
            generated_at=datetime.now(timezone.utc).isoformat(),
            semantic_registry=semantic_registry_payload(),
        )
        self.__class__._cache = (now, catalog)
        return catalog

    async def _load_db_entities(self) -> Dict[str, SchemaEntity]:
        entities: Dict[str, SchemaEntity] = {}

        entity_rows = await self.db.execute(
            text(
                """
                SELECT
                    n.nspname AS schema_name,
                    c.relname AS entity_name,
                    CASE c.relkind
                        WHEN 'v' THEN 'view'
                        WHEN 'm' THEN 'materialized_view'
                        ELSE 'table'
                    END AS entity_type
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND c.relkind IN ('r', 'v', 'm')
                """
            )
        )
        for row in entity_rows.mappings().all():
            entity = SchemaEntity(
                name=row["entity_name"],
                schema_name=row["schema_name"],
                entity_type=row["entity_type"],
                description=get_entity_description(row["entity_name"]),
                preferred_for_analytics=row["entity_name"].startswith(
                    ("vw_", "v_", "mv_")
                ),
            )
            entities[f"{entity.schema_name}.{entity.name}"] = entity

        column_rows = await self.db.execute(
            text(
                """
                SELECT
                    table_schema AS schema_name,
                    table_name AS entity_name,
                    column_name,
                    data_type,
                    udt_name,
                    is_nullable
                FROM information_schema.columns
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name, ordinal_position
                """
            )
        )
        for row in column_rows.mappings().all():
            key = f"{row['schema_name']}.{row['entity_name']}"
            entity = entities.get(key)
            if not entity:
                continue
            entity.columns.append(
                SchemaColumn(
                    name=row["column_name"],
                    data_type=row["data_type"] or row["udt_name"],
                    nullable=row["is_nullable"] == "YES",
                    semantic_tags=semantic_tags_for_text(
                        row["column_name"], entity.name, entity.description or ""
                    ),
                )
            )

        pk_rows = await self.db.execute(
            text(
                """
                SELECT
                    tc.table_schema AS schema_name,
                    tc.table_name AS entity_name,
                    kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
                """
            )
        )
        primary_keys = {
            (row["schema_name"], row["entity_name"], row["column_name"])
            for row in pk_rows.mappings().all()
        }

        fk_rows = await self.db.execute(
            text(
                """
                SELECT
                    tc.table_schema AS schema_name,
                    tc.table_name AS entity_name,
                    kcu.column_name,
                    ccu.table_schema AS foreign_schema_name,
                    ccu.table_name AS foreign_entity_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                 AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
                """
            )
        )
        fk_targets: Dict[Tuple[str, str, str], str] = {}
        relationships: Dict[str, List[SchemaRelationship]] = defaultdict(list)
        for row in fk_rows.mappings().all():
            key = (row["schema_name"], row["entity_name"], row["column_name"])
            target = f"{row['foreign_schema_name']}.{row['foreign_entity_name']}"
            fk_targets[key] = f"{target}.{row['foreign_column_name']}"
            relationships[f"{row['schema_name']}.{row['entity_name']}"].append(
                SchemaRelationship(
                    source_entity=f"{row['schema_name']}.{row['entity_name']}",
                    source_column=row["column_name"],
                    target_entity=target,
                    target_column=row["foreign_column_name"],
                )
            )

        for entity_key, entity in entities.items():
            entity.relationships.extend(relationships.get(entity_key, []))
            entity.semantic_tags = semantic_tags_for_text(
                entity.name,
                entity.description or "",
                " ".join(column.name for column in entity.columns),
            )
            for column in entity.columns:
                pk_key = (entity.schema_name, entity.name, column.name)
                if pk_key in primary_keys:
                    column.primary_key = True
                column.foreign_key_target = fk_targets.get(pk_key)

        return entities

    def _load_orm_entities(self) -> Dict[str, SchemaEntity]:
        entities: Dict[str, SchemaEntity] = {}
        for mapper in Base.registry.mappers:
            model = mapper.class_
            table = mapper.local_table
            schema_name = table.schema or "public"
            entity_type = "table"
            if table.name.startswith("vw_") or table.name.startswith("v_"):
                entity_type = "view"
            elif table.name.startswith("mv_"):
                entity_type = "materialized_view"

            entity = SchemaEntity(
                name=table.name,
                schema_name=schema_name,
                entity_type=entity_type,
                description=get_entity_description(
                    table.name, inspect.getdoc(model) or table.comment
                ),
                preferred_for_analytics=table.name.startswith(("vw_", "v_", "mv_")),
            )
            for column in table.columns:
                entity.columns.append(
                    SchemaColumn(
                        name=column.name,
                        data_type=str(column.type),
                        nullable=bool(column.nullable),
                        primary_key=bool(column.primary_key),
                        description=column.comment,
                        semantic_tags=semantic_tags_for_text(
                            column.name, column.comment or ""
                        ),
                    )
                )
            for relationship in mapper.relationships:
                if relationship.local_columns and relationship.mapper.local_table is not None:
                    local_column = next(iter(relationship.local_columns)).name
                    entity.relationships.append(
                        SchemaRelationship(
                            source_entity=f"{schema_name}.{table.name}",
                            source_column=local_column,
                            target_entity=(
                                f"{relationship.mapper.local_table.schema or 'public'}."
                                f"{relationship.mapper.local_table.name}"
                            ),
                            target_column=relationship.mapper.primary_key[0].name,
                            relationship_type=relationship.direction.name.lower(),
                        )
                    )
            entity.semantic_tags = semantic_tags_for_text(
                entity.name,
                entity.description or "",
                " ".join(column.name for column in entity.columns),
            )
            entities[f"{schema_name}.{table.name}"] = entity
        return entities

    def _merge_entities(
        self,
        db_entities: Dict[str, SchemaEntity],
        orm_entities: Dict[str, SchemaEntity],
    ) -> Dict[str, SchemaEntity]:
        merged = dict(db_entities)
        for key, orm_entity in orm_entities.items():
            if key not in merged:
                merged[key] = orm_entity
                continue

            existing = merged[key]
            if not existing.description:
                existing.description = orm_entity.description
            existing.preferred_for_analytics = (
                existing.preferred_for_analytics or orm_entity.preferred_for_analytics
            )

            existing_relationships = {
                (
                    relationship.source_entity,
                    relationship.source_column,
                    relationship.target_entity,
                    relationship.target_column,
                )
                for relationship in existing.relationships
            }
            for relationship in orm_entity.relationships:
                relationship_key = (
                    relationship.source_entity,
                    relationship.source_column,
                    relationship.target_entity,
                    relationship.target_column,
                )
                if relationship_key not in existing_relationships:
                    existing.relationships.append(relationship)

            existing_columns = {column.name: column for column in existing.columns}
            for orm_column in orm_entity.columns:
                current = existing_columns.get(orm_column.name)
                if current is None:
                    existing.columns.append(orm_column)
                    continue
                current.description = current.description or orm_column.description
                current.primary_key = current.primary_key or orm_column.primary_key
                current.semantic_tags = sorted(
                    set(current.semantic_tags).union(orm_column.semantic_tags)
                )

            existing.semantic_tags = sorted(
                set(existing.semantic_tags).union(orm_entity.semantic_tags)
            )
        return merged
