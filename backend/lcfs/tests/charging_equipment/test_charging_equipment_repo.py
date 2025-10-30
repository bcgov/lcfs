import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import DatabaseError

from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_equipment.repo import ChargingEquipmentRepository
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentFilterSchema,
    ChargingEquipmentStatusEnum,
)


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    db = AsyncMock()
    # Configure sync/async methods to match AsyncSession behavior
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def repo(mock_db):
    """Create repository instance with mocked database."""
    return ChargingEquipmentRepository(mock_db)


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_success(
    repo, mock_db, valid_charging_equipment
):
    """Test successfully getting charging equipment by ID."""
    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = valid_charging_equipment
    mock_db.execute.return_value = mock_result

    # Call the repository method
    result = await repo.get_charging_equipment_by_id(1)

    # Verify the result
    assert result == valid_charging_equipment
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_not_found(repo, mock_db):
    """Test getting charging equipment by ID when not found."""
    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    # Call the repository method
    result = await repo.get_charging_equipment_by_id(999)

    # Verify the result
    assert result is None
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_charging_equipment_list_success(
    repo, mock_db, valid_charging_equipment
):
    """Test getting paginated list of charging equipment."""
    # Setup pagination and filters
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[])
    filters = ChargingEquipmentFilterSchema(status=[ChargingEquipmentStatusEnum.DRAFT])

    # Mock the database query results
    mock_items_result = MagicMock()
    mock_items_result.scalars.return_value.all.return_value = [valid_charging_equipment]

    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    mock_db.execute.side_effect = [mock_count_result, mock_items_result]

    # Call the repository method
    items, total_count = await repo.get_charging_equipment_list(1, pagination, filters)

    # Verify the results
    assert len(items) == 1
    assert items[0] == valid_charging_equipment
    assert total_count == 1
    assert mock_db.execute.call_count == 2


@pytest.mark.anyio
async def test_create_charging_equipment_success(
    repo, mock_db, mock_equipment_status, mock_end_use_type
):
    """Test successfully creating charging equipment."""
    # Mock the status query
    mock_status_result = MagicMock()
    mock_status_result.scalar_one.return_value = mock_equipment_status

    # Mock the end use types query
    mock_end_use_result = MagicMock()
    mock_end_use_result.scalars.return_value.all.return_value = [mock_end_use_type]

    mock_db.execute.side_effect = [mock_status_result, mock_end_use_result]
    mock_db.refresh = AsyncMock()

    # Equipment data
    equipment_data = {
        "charging_site_id": 1,
        "serial_number": "TEST123",
        "manufacturer": "Tesla",
        "model": "Supercharger",
        "level_of_equipment_id": 1,
        "intended_use_ids": [1],
    }

    # Call the repository method
    result = await repo.create_charging_equipment(equipment_data)

    # Verify the result
    assert isinstance(result, ChargingEquipment)
    assert result.serial_number == "TEST123"
    assert result.manufacturer == "Tesla"
    mock_db.add.assert_called_once()
    mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_update_charging_equipment_success(
    repo, mock_db, valid_charging_equipment
):
    """Test successfully updating charging equipment."""
    # Mock getting existing equipment
    with patch.object(
        repo, "get_charging_equipment_by_id", return_value=valid_charging_equipment
    ):
        # Update data
        update_data = {"manufacturer": "ChargePoint", "model": "Express Plus"}

        # Call the repository method
        result = await repo.update_charging_equipment(1, update_data)

        # Verify the result
        assert result == valid_charging_equipment
        assert result.manufacturer == "ChargePoint"
        assert result.model == "Express Plus"
        mock_db.flush.assert_called_once()
        assert mock_db.refresh.call_count == 2
        mock_db.refresh.assert_any_call(valid_charging_equipment)
        mock_db.refresh.assert_any_call(
            valid_charging_equipment, attribute_names=["charging_site"]
        )


@pytest.mark.anyio
async def test_bulk_update_status_success(repo, mock_db, mock_equipment_status):
    """Test bulk updating status of multiple equipment."""
    # Mock the status query
    mock_status_result = MagicMock()
    mock_status_result.scalar_one_or_none.return_value = mock_equipment_status

    # Mock the update query result
    mock_update_result = MagicMock()
    mock_update_result.rowcount = 2

    mock_db.execute.side_effect = [mock_status_result, mock_update_result]

    # Call the repository method
    affected_count = await repo.bulk_update_status([1, 2], "Submitted", 1)

    # Verify the result
    assert affected_count == 2
    assert mock_db.execute.call_count == 2
    mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_bulk_update_status_invalid_status(repo, mock_db):
    """Test bulk updating with invalid status raises error."""
    # Mock the status query returning None
    mock_status_result = MagicMock()
    mock_status_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_status_result

    # Call the repository method and expect ValueError
    with pytest.raises(ValueError, match="Invalid status: InvalidStatus"):
        await repo.bulk_update_status([1, 2], "InvalidStatus", 1)


@pytest.mark.anyio
async def test_delete_charging_equipment_success(
    repo, mock_db, valid_charging_equipment
):
    """Test successfully deleting charging equipment in Draft status."""
    # Ensure the equipment is in Draft status
    valid_charging_equipment.status.status = "Draft"
    valid_charging_equipment.charging_site.organization_id = 1

    # Mock getting existing equipment
    with patch.object(
        repo, "get_charging_equipment_by_id", return_value=valid_charging_equipment
    ):
        # Call the repository method
        result = await repo.delete_charging_equipment(1, 1)

        # Verify the result
        assert result is True
        mock_db.delete.assert_called_once_with(valid_charging_equipment)
        mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_delete_charging_equipment_wrong_status(
    repo, mock_db, valid_charging_equipment
):
    """Test deleting charging equipment in non-Draft status raises error."""
    # Set equipment to non-Draft status
    valid_charging_equipment.status.status = "Validated"
    valid_charging_equipment.charging_site.organization_id = 1

    # Mock getting existing equipment
    with patch.object(
        repo, "get_charging_equipment_by_id", return_value=valid_charging_equipment
    ):
        # Call the repository method and expect ValueError
        with pytest.raises(ValueError, match="Only Draft equipment can be deleted"):
            await repo.delete_charging_equipment(1, 1)


@pytest.mark.anyio
async def test_delete_charging_equipment_wrong_organization(
    repo, mock_db, valid_charging_equipment
):
    """Test deleting charging equipment from wrong organization raises error."""
    # Set equipment to different organization
    valid_charging_equipment.status.status = "Draft"
    valid_charging_equipment.charging_site.organization_id = 2

    # Mock getting existing equipment
    with patch.object(
        repo, "get_charging_equipment_by_id", return_value=valid_charging_equipment
    ):
        # Call the repository method and expect ValueError
        with pytest.raises(ValueError, match="Unauthorized to delete this equipment"):
            await repo.delete_charging_equipment(1, 1)


@pytest.mark.anyio
async def test_get_statuses_success(repo, mock_db, mock_equipment_status):
    """Test getting all equipment statuses."""
    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_equipment_status]
    mock_db.execute.return_value = mock_result

    # Call the repository method
    result = await repo.get_statuses()

    # Verify the result
    assert len(result) == 1
    assert result[0] == mock_equipment_status
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_levels_of_equipment_success(repo, mock_db, mock_level_of_equipment):
    """Test getting all levels of equipment."""
    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_level_of_equipment]
    mock_db.execute.return_value = mock_result

    # Call the repository method
    result = await repo.get_levels_of_equipment()

    # Verify the result
    assert len(result) == 1
    assert result[0] == mock_level_of_equipment
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_end_use_types_success(repo, mock_db, mock_end_use_type):
    """Test getting all end use types."""
    # Mock the database query result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_end_use_type]
    mock_db.execute.return_value = mock_result

    # Call the repository method
    result = await repo.get_end_use_types()

    # Verify the result
    assert len(result) == 1
    assert result[0] == mock_end_use_type
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_auto_validate_submitted_fse_for_report_success(repo, mock_db):
    """Test auto-validation of submitted FSE records for a compliance report."""
    # Mock status query result
    mock_submitted_status = MagicMock(spec=ChargingEquipmentStatus)
    mock_submitted_status.status = "Submitted"
    mock_submitted_status.charging_equipment_status_id = 3

    mock_validated_status = MagicMock(spec=ChargingEquipmentStatus)
    mock_validated_status.status = "Validated"
    mock_validated_status.charging_equipment_status_id = 4

    mock_status_result = MagicMock()
    mock_status_result.scalars.return_value.all.return_value = [
        mock_submitted_status,
        mock_validated_status,
    ]

    # Mock equipment query result (2 equipment IDs in Submitted status)
    mock_equipment_result = MagicMock()
    mock_equipment_result.all.return_value = [(101,), (102,)]

    # Mock update result
    mock_update_result = MagicMock()
    mock_update_result.rowcount = 2

    # Configure db.execute to return different results for different calls
    mock_db.execute.side_effect = [
        mock_status_result,
        mock_equipment_result,
        mock_update_result,
    ]

    # Call the repository method
    result = await repo.auto_validate_submitted_fse_for_report(compliance_report_id=1)

    # Verify the result
    assert result == 2
    assert mock_db.execute.call_count == 3
    mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_auto_validate_submitted_fse_for_report_no_equipment_found(repo, mock_db):
    """Test auto-validation when no equipment in Submitted status is found."""
    # Mock status query result
    mock_submitted_status = MagicMock(spec=ChargingEquipmentStatus)
    mock_submitted_status.status = "Submitted"
    mock_submitted_status.charging_equipment_status_id = 3

    mock_validated_status = MagicMock(spec=ChargingEquipmentStatus)
    mock_validated_status.status = "Validated"
    mock_validated_status.charging_equipment_status_id = 4

    mock_status_result = MagicMock()
    mock_status_result.scalars.return_value.all.return_value = [
        mock_submitted_status,
        mock_validated_status,
    ]

    # Mock equipment query result (no equipment found)
    mock_equipment_result = MagicMock()
    mock_equipment_result.all.return_value = []

    # Configure db.execute to return different results for different calls
    mock_db.execute.side_effect = [mock_status_result, mock_equipment_result]

    # Call the repository method
    result = await repo.auto_validate_submitted_fse_for_report(compliance_report_id=1)

    # Verify the result
    assert result == 0
    assert mock_db.execute.call_count == 2
    # flush should not be called since no updates were made
    mock_db.flush.assert_not_called()
