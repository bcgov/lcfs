"""Tests for the CI application repository layer."""

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.models.ci_application import (
    CIApplication,
    CIApplicationHistory,
    CIApplicationStatus,
)
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.web.api.base import FilterModel, PaginationRequestSchema, SortOrder
from lcfs.web.api.ci_application.repo import CIApplicationRepository


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def repo(mock_db):
    r = CIApplicationRepository()
    r.db = mock_db
    return r


def _make_status(name="Draft", ident=1):
    return CIApplicationStatus(
        ci_application_status_id=ident,
        status=name,
        description=f"{name} description",
        display_order=ident,
    )


def _make_uom(uom_id=1, name="Litres"):
    return UnitOfMeasure(uom_id=uom_id, name=name, description=name)


def _make_application(
    ci_application_id=10,
    organization_id=1,
    status_id=1,
    facility_country="Argentina",
    facility_nameplate_capacity=1000,
):
    ci = CIApplication(
        ci_application_id=ci_application_id,
        organization_id=organization_id,
        status_id=status_id,
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country=facility_country,
        facility_iso="AR",
        facility_nameplate_capacity=facility_nameplate_capacity,
        facility_nameplate_capacity_unit_id=1,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
        group_uuid="abc",
        version=0,
    )
    ci.update_date = datetime(2026, 5, 1, tzinfo=timezone.utc)
    ci.create_date = datetime(2026, 4, 1, tzinfo=timezone.utc)
    return ci


# ---------------------------------------------------------------------------
# Lookup queries
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_statuses_returns_ordered(repo, mock_db):
    statuses = [_make_status("Draft", 1), _make_status("Submitted", 2)]
    result = MagicMock()
    result.scalars.return_value.all.return_value = statuses
    mock_db.execute.return_value = result

    items = await repo.get_statuses()
    assert items == statuses
    mock_db.execute.assert_awaited_once()


@pytest.mark.anyio
async def test_get_status_by_name_found(repo, mock_db):
    status = _make_status("Draft", 1)
    result = MagicMock()
    result.scalar_one_or_none.return_value = status
    mock_db.execute.return_value = result

    found = await repo.get_status_by_name("Draft")
    assert found is status


@pytest.mark.anyio
async def test_get_status_by_name_missing(repo, mock_db):
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = result

    assert await repo.get_status_by_name("Nope") is None


@pytest.mark.anyio
async def test_get_units_of_measure(repo, mock_db):
    uoms = [_make_uom(1, "Litres"), _make_uom(2, "Kilograms")]
    result = MagicMock()
    result.scalars.return_value.all.return_value = uoms
    mock_db.execute.return_value = result

    items = await repo.get_units_of_measure()
    assert items == uoms


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_by_id_found(repo, mock_db):
    ci = _make_application()
    result = MagicMock()
    result.scalar_one_or_none.return_value = ci
    mock_db.execute.return_value = result

    out = await repo.get_by_id(10)
    assert out is ci


@pytest.mark.anyio
async def test_get_by_id_missing_returns_none(repo, mock_db):
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = result

    assert await repo.get_by_id(99) is None


@pytest.mark.anyio
async def test_create_persists_and_refreshes(repo, mock_db):
    ci = _make_application(ci_application_id=None)
    out = await repo.create(ci)
    mock_db.add.assert_called_once_with(ci)
    mock_db.flush.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()
    assert out is ci


@pytest.mark.anyio
async def test_update_flushes_and_refreshes(repo, mock_db):
    ci = _make_application()
    out = await repo.update(ci)
    mock_db.flush.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()
    assert out is ci


@pytest.mark.anyio
async def test_delete_calls_session_delete(repo, mock_db):
    ci = _make_application()
    await repo.delete(ci)
    mock_db.delete.assert_awaited_once_with(ci)
    mock_db.flush.assert_awaited_once()


@pytest.mark.anyio
async def test_add_history_creates_record(repo, mock_db):
    ci = _make_application()
    history = await repo.add_history(ci, snapshot={"facility_country": "Argentina"})
    assert isinstance(history, CIApplicationHistory)
    assert history.ci_application_id == ci.ci_application_id
    assert history.status_id == ci.status_id
    assert history.ci_application_snapshot == {"facility_country": "Argentina"}
    mock_db.add.assert_called_once()
    mock_db.flush.assert_awaited_once()


# ---------------------------------------------------------------------------
# Pagination & filtering
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_paginated_returns_items_and_total(repo, mock_db):
    apps = [_make_application(ci_application_id=1), _make_application(ci_application_id=2)]

    count_result = MagicMock()
    count_result.scalar_one.return_value = 2
    items_result = MagicMock()
    items_result.scalars.return_value.all.return_value = apps

    mock_db.execute.side_effect = [count_result, items_result]

    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
    items, total = await repo.list_paginated(pagination, organization_id=None)

    assert total == 2
    assert items == apps
    # one count query + one items query
    assert mock_db.execute.await_count == 2


@pytest.mark.anyio
async def test_list_paginated_scopes_to_organization(repo, mock_db):
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    items_result = MagicMock()
    items_result.scalars.return_value.all.return_value = []
    mock_db.execute.side_effect = [count_result, items_result]

    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
    items, total = await repo.list_paginated(pagination, organization_id=42)

    assert total == 0
    assert items == []


@pytest.mark.anyio
async def test_list_paginated_applies_filters_and_sorting(repo, mock_db):
    """Confirms filter / sort args are accepted and reach the SQL builder."""
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1
    items_result = MagicMock()
    items_result.scalars.return_value.all.return_value = [_make_application()]
    mock_db.execute.side_effect = [count_result, items_result]

    pagination = PaginationRequestSchema(
        page=1,
        size=5,
        sort_orders=[SortOrder(field="facility_country", direction="asc")],
        filters=[
            FilterModel(
                filter_type="text",
                type="contains",
                filter="Argentina",
                field="facility_country",
            )
        ],
    )

    items, total = await repo.list_paginated(pagination, organization_id=None)
    assert total == 1
    assert len(items) == 1


def test_total_pages_helper():
    assert CIApplicationRepository.total_pages(0, 10) == 0
    assert CIApplicationRepository.total_pages(15, 10) == 2
    assert CIApplicationRepository.total_pages(20, 10) == 2
    assert CIApplicationRepository.total_pages(21, 10) == 3
    # zero size guarded
    assert CIApplicationRepository.total_pages(10, 0) == 0


# ---------------------------------------------------------------------------
# Step 5 — Comment thread (history-table-backed)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_add_comment_persists_with_snapshot(repo, mock_db):
    ci = _make_application()
    history = await repo.add_comment(
        ci,
        text="Hello",
        author_username="jzimmerman",
        author_display_name="Jonathan Zimmerman",
        is_government=False,
    )
    assert isinstance(history, CIApplicationHistory)
    snap = history.ci_application_snapshot
    assert snap["type"] == "comment"
    assert snap["text"] == "Hello"
    assert snap["author_username"] == "jzimmerman"
    assert snap["is_government"] is False
    mock_db.add.assert_called_once()
    mock_db.flush.assert_awaited_once()


@pytest.mark.anyio
async def test_list_comments_filters_non_comment_history(repo, mock_db):
    h1 = CIApplicationHistory(
        ci_application_id=10,
        ci_application_snapshot={
            "type": "comment",
            "text": "first",
            "author_username": "u1",
            "author_display_name": "User One",
            "is_government": False,
        },
        group_uuid="abc",
        version=0,
    )
    h1.ci_application_history_id = 1
    h2 = CIApplicationHistory(  # status-change row, not a comment
        ci_application_id=10,
        ci_application_snapshot=None,
        group_uuid="abc",
        version=0,
    )
    h2.ci_application_history_id = 2
    h3 = CIApplicationHistory(  # snapshot exists but is not a comment marker
        ci_application_id=10,
        ci_application_snapshot={"type": "decision"},
        group_uuid="abc",
        version=0,
    )
    h3.ci_application_history_id = 3

    result = MagicMock()
    result.scalars.return_value.all.return_value = [h1, h2, h3]
    mock_db.execute.return_value = result

    items = await repo.list_comments(10)
    assert [c.ci_application_history_id for c in items] == [1]
