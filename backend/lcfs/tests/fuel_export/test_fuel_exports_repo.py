import pytest
from sqlalchemy.exc import SQLAlchemyError
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance import FuelExport
from lcfs.web.exception.exceptions import DatabaseException


# get_fuel_export_table_options
@pytest.mark.anyio
async def test_get_fuel_export_table_options_success(mock_db, fuel_export_repo):
    mock_result = MagicMock()
    expected_data = []
    mock_result.all.return_value = expected_data

    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_fuel_export_table_options("2024")

    mock_db.execute.assert_called_once()
    mock_result.all.assert_called_once()
    assert result == expected_data


# get_fuel_export_list
@pytest.mark.anyio
async def test_get_fuel_export_list_success(fuel_export_repo, mock_db):
    compliance_report_id = 1
    expected_result = [FuelExport(fuel_export_id=1), FuelExport(fuel_export_id=2)]

    # Mock the group UUID query
    group_uuid_result = MagicMock()
    group_uuid_result.scalar.return_value = "test-uuid"
    mock_db.execute.return_value = group_uuid_result

    # Mock the effective fuel exports query
    async def mock_get_effective_exports(*args, **kwargs):
        return expected_result

    fuel_export_repo.get_effective_fuel_exports = mock_get_effective_exports

    result = await fuel_export_repo.get_fuel_export_list(compliance_report_id)

    assert result == expected_result
    assert mock_db.execute.call_count == 1


@pytest.mark.anyio
async def test_get_fuel_export_list_no_results(fuel_export_repo, mock_db):
    compliance_report_id = 999

    # Mock the group UUID query returning None
    group_uuid_result = MagicMock()
    group_uuid_result.scalar.return_value = None
    mock_db.execute.return_value = group_uuid_result

    result = await fuel_export_repo.get_fuel_export_list(compliance_report_id)

    assert result == []
    assert mock_db.execute.call_count == 1


@pytest.mark.anyio
async def test_get_fuel_export_list_db_exception(fuel_export_repo, mock_db):
    compliance_report_id = 1
    mock_db.execute.side_effect = SQLAlchemyError("DB error")

    with pytest.raises(DatabaseException):
        await fuel_export_repo.get_fuel_export_list(compliance_report_id)

    mock_db.execute.assert_called_once()


# get_fuel_exports_paginated
@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success(fuel_export_repo, mock_db):
    from lcfs.web.api.base import PaginationRequestSchema

    compliance_report_id = 1
    expected_exports = [FuelExport(fuel_export_id=1), FuelExport(fuel_export_id=2)]

    # Mock the group UUID query
    group_uuid_result = MagicMock()
    group_uuid_result.scalar.return_value = "test-uuid"
    mock_db.execute.return_value = group_uuid_result

    # Mock the effective fuel exports query
    async def mock_get_effective_exports(*args, **kwargs):
        return expected_exports

    fuel_export_repo.get_effective_fuel_exports = mock_get_effective_exports

    pagination = PaginationRequestSchema(page=1, size=10)
    result, total = await fuel_export_repo.get_fuel_exports_paginated(
        pagination, compliance_report_id
    )

    assert result == expected_exports[:10]
    assert total == len(expected_exports)
    assert mock_db.execute.call_count == 1


# get_fuel_export_by_id
@pytest.mark.anyio
async def test_get_fuel_export_by_id_success(fuel_export_repo, mock_db):
    fuel_export_id = 1
    expected_fuel_export = FuelExport(fuel_export_id=fuel_export_id)

    mock_result = MagicMock()
    mock_result.unique.return_value.scalar_one_or_none.return_value = (
        expected_fuel_export
    )
    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_fuel_export_by_id(fuel_export_id)

    mock_db.execute.assert_called_once()
    mock_result.unique.assert_called_once()
    mock_result.unique.return_value.scalar_one_or_none.assert_called_once()
    assert result == expected_fuel_export


# Version control related tests
@pytest.mark.anyio
async def test_get_latest_fuel_export_by_group_uuid_success(fuel_export_repo, mock_db):
    group_uuid = "test-uuid"
    expected_export = FuelExport(group_uuid=group_uuid, version=1)

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = expected_export
    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_latest_fuel_export_by_group_uuid(group_uuid)

    assert result == expected_export
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_effective_fuel_exports_success(fuel_export_repo, mock_db):
    group_uuid = "test-uuid"
    expected_exports = [FuelExport(group_uuid=group_uuid, version=1)]

    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = (
        expected_exports
    )
    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_effective_fuel_exports(group_uuid, 1)

    assert result == expected_exports
    mock_db.execute.assert_called_once()


# CRUD operations
@pytest.mark.anyio
async def test_create_fuel_export_success(fuel_export_repo, mock_db):
    fuel_export = FuelExport(
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )

    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await fuel_export_repo.create_fuel_export(fuel_export)

    assert result == fuel_export
    mock_db.add.assert_called_once_with(fuel_export)
    assert mock_db.flush.await_count == 1
    assert mock_db.refresh.await_count == 1


@pytest.mark.anyio
async def test_update_fuel_export_success(fuel_export_repo, mock_db):
    fuel_export = FuelExport(
        fuel_export_id=1,
        group_uuid="test-uuid",
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )
    updated_fuel_export = FuelExport(fuel_export_id=1)

    mock_db.merge = AsyncMock(return_value=updated_fuel_export)
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()

    result = await fuel_export_repo.update_fuel_export(fuel_export)

    assert result == updated_fuel_export
    mock_db.merge.assert_called_once_with(fuel_export)
    mock_db.flush.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(
        updated_fuel_export,
        [
            "fuel_category",
            "fuel_type",
            "provision_of_the_act",
            "end_use_type",
        ],
    )
