from typing import Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.search.entities import SEARCH_ENTITIES
from lcfs.web.api.search.entities.base import EntitySearch, SearchContext
from lcfs.web.api.search.query import parse_query

_ENTITIES = {entity.entity_type: entity for entity in SEARCH_ENTITIES}


def _db_without_rows() -> AsyncMock:
    result = MagicMock()
    result.all.return_value = []
    db = AsyncMock(spec=AsyncSession)
    db.execute.return_value = result
    return db


def _supplier_context(
    entity_type: str,
    organization_id: Optional[int],
) -> SearchContext:
    return SearchContext(
        query=parse_query(entity_type),
        organization_id=organization_id,
        is_government=False,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "entity",
    [
        _ENTITIES["report"],
        _ENTITIES["transfer"],
        _ENTITIES["ci_application"],
        _ENTITIES["initiative_agreement"],
        _ENTITIES["admin_adjustment"],
        _ENTITIES["user"],
    ],
    ids=lambda entity: entity.entity_type,
)
async def test_unbound_supplier_never_reaches_scoped_queries(entity: EntitySearch):
    db = _db_without_rows()

    results = await entity.execute(db, _supplier_context(entity.entity_type, None))

    assert results == []
    db.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_organization_search_is_government_only():
    db = _db_without_rows()

    results = await _ENTITIES["organization"].execute(
        db,
        _supplier_context("organization", 17),
    )

    assert results == []
    db.execute.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("entity_type", "expected_scope"),
    [
        ("report", "v_compliance_report.organization_id = 17"),
        ("ci_application", "ci_application.organization_id = 17"),
        (
            "initiative_agreement",
            "initiative_agreement.to_organization_id = 17",
        ),
        ("admin_adjustment", "admin_adjustment.to_organization_id = 17"),
        ("user", "user_profile.organization_id = 17"),
    ],
)
async def test_supplier_queries_include_organization_scope(
    entity_type: str,
    expected_scope: str,
):
    db = _db_without_rows()

    await _ENTITIES[entity_type].execute(db, _supplier_context(entity_type, 17))

    statement = db.execute.await_args.args[0]
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        ),
    )
    assert expected_scope in sql


@pytest.mark.anyio
async def test_supplier_transfer_scope_includes_both_participants():
    db = _db_without_rows()

    await _ENTITIES["transfer"].execute(
        db,
        _supplier_context("transfer", 17),
    )

    statement = db.execute.await_args.args[0]
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        ),
    )
    assert "transfer.from_organization_id = 17" in sql
    assert "transfer.to_organization_id = 17" in sql
