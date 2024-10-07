import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.compliance import FuelExport


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
    expected_result = [
        FuelExport(fuel_export_id=1),
        FuelExport(fuel_export_id=2),
    ]

    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = (
        expected_result
    )
    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_fuel_export_list(compliance_report_id)

    mock_db.execute.assert_called_once()
    mock_result.unique.assert_called_once()
    mock_result.unique.return_value.scalars.assert_called_once()
    mock_result.unique.return_value.scalars.return_value.all.assert_called_once()
    assert result == expected_result


# get_fuel_exports_paginated
@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success():
    pass


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


# update_fuel_export
@pytest.mark.anyio
async def test_update_fuel_export_success(fuel_export_repo, mock_db):

    fuel_export = FuelExport(fuel_export_id=1)
    updated_fuel_export = FuelExport(fuel_export_id=1)

    mock_db.merge.return_value = updated_fuel_export
    mock_db.flush.return_value = None
    mock_db.refresh = AsyncMock()

    result = await fuel_export_repo.update_fuel_export(fuel_export)

    mock_db.merge.assert_called_once_with(fuel_export)
    mock_db.flush.assert_called_once()
    mock_db.refresh.assert_awaited_once_with(
        fuel_export,
        [
            "fuel_category",
            "fuel_type",
            "provision_of_the_act",
            "custom_fuel_type",
            "end_use_type",
        ],
    )
    assert result == updated_fuel_export


# create_fuel_export
@pytest.mark.anyio
async def test_create_fuel_export_success(fuel_export_repo, mock_db):

    fuel_export = FuelExport(fuel_export_id=1)
    refreshed_fuel_export = FuelExport(fuel_export_id=1)

    mock_db.add.return_value = None
    mock_db.flush.return_value = None
    mock_db.refresh = AsyncMock(return_value=None)

    result = await fuel_export_repo.create_fuel_export(fuel_export)

    mock_db.add.assert_called_once_with(fuel_export)
    mock_db.flush.assert_called_once()
    mock_db.refresh.assert_awaited_once_with(
        fuel_export,
        [
            "fuel_category",
            "fuel_type",
            "provision_of_the_act",
            "custom_fuel_type",
            "end_use_type",
        ],
    )
    assert result == fuel_export


# delete_fuel_export
@pytest.mark.anyio
async def test_delete_fuel_export_success(fuel_export_repo, mock_db):

    fuel_export_id = 1
    mock_db.execute.return_value = AsyncMock()
    mock_db.flush.return_value = None

    await fuel_export_repo.delete_fuel_export(fuel_export_id)

    mock_db.execute.assert_called_once()
    mock_db.flush.assert_called_once()


# get_fuel_exports
@pytest.mark.anyio
async def test_get_fuel_exports_compliance_success(fuel_export_repo, mock_db):

    report_id = 1
    is_supplemental = False
    expected_fuel_exports = [
        FuelExport(fuel_export_id=1),
        FuelExport(fuel_export_id=2),
    ]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = expected_fuel_exports
    mock_db.execute.return_value = mock_result

    result = await fuel_export_repo.get_fuel_exports(report_id, is_supplemental)

    mock_db.execute.assert_called_once()
    mock_result.scalars.assert_called_once()
    mock_result.scalars.return_value.all.assert_called_once()
    assert result == expected_fuel_exports
