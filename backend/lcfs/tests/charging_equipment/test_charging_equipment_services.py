import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_equipment.repo import ChargingEquipmentRepository
from lcfs.web.api.charging_equipment.services import ChargingEquipmentServices
from lcfs.web.api.charging_equipment.schema import ChargingEquipmentFilterSchema


@pytest.fixture
def mock_user():
    """Create a mock user."""
    user = MagicMock(spec=UserProfile)
    user.organization_id = 1
    user.is_government = False
    return user


@pytest.fixture
def mock_government_user():
    """Create a mock government user."""
    user = MagicMock(spec=UserProfile)
    user.organization_id = None
    user.is_government = True
    return user


@pytest.fixture
def mock_repo():
    """Create a mock repository."""
    return AsyncMock(spec=ChargingEquipmentRepository)


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def mock_cache():
    """Create a mock cache."""
    return AsyncMock()


@pytest.fixture
def service(mock_repo, mock_db_session, mock_cache):
    """Create service instance with mocked dependencies."""
    service = ChargingEquipmentServices(repo=mock_repo)
    # Inject mocked session and cache to align with tests
    service.db = mock_db_session
    service.cache = mock_cache
    return service


@pytest.fixture(autouse=True)
def mock_roles(fastapi_app, set_mock_user):
    """Global fixture to mock user roles for each test."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])


@pytest.mark.anyio
async def test_get_charging_equipment_list_supplier_success(
    service, mock_repo, mock_user, valid_charging_equipment
):
    """Test getting equipment list as supplier user."""
    # Setup pagination and mock response
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[])
    mock_repo.get_charging_equipment_list.return_value = ([valid_charging_equipment], 1)

    # Call the service method
    result = await service.get_charging_equipment_list(mock_user, pagination)

    # Verify the result
    assert result.pagination.total == 1
    assert len(result.items) == 1
    assert (
        result.items[0].charging_equipment_id
        == valid_charging_equipment.charging_equipment_id
    )

    # Verify repo was called with correct organization_id
    mock_repo.get_charging_equipment_list.assert_called_once_with(
        mock_user.organization_id, pagination, None, False
    )


@pytest.mark.anyio
async def test_get_charging_equipment_list_government_with_org_filter(
    service, mock_repo, mock_government_user, valid_charging_equipment
):
    """Test getting equipment list as government user with organization filter."""
    # Setup pagination and filters
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[])
    filters = ChargingEquipmentFilterSchema(organization_id=2)
    mock_repo.get_charging_equipment_list.return_value = ([valid_charging_equipment], 1)

    # Call the service method
    result = await service.get_charging_equipment_list(
        mock_government_user, pagination, filters
    )

    # Verify the result
    assert result.pagination.total == 1
    assert len(result.items) == 1

    # Verify repo was called with filtered organization_id and exclude_draft=True for government users
    mock_repo.get_charging_equipment_list.assert_called_once_with(
        2, pagination, filters, True
    )


@pytest.mark.anyio
async def test_get_charging_equipment_list_government_no_org_filter_success(
    service, mock_repo, mock_government_user, valid_charging_equipment
):
    """Test getting equipment list as government user without organization filter succeeds."""
    # Setup pagination without organization filter
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[])
    mock_repo.get_charging_equipment_list.return_value = ([valid_charging_equipment], 1)

    # Call the service method
    result = await service.get_charging_equipment_list(mock_government_user, pagination)

    # Verify the result
    assert result.pagination.total == 1
    assert len(result.items) == 1

    # Government users without an org filter should query all organizations (organization_id None) and exclude_draft=True
    mock_repo.get_charging_equipment_list.assert_called_once_with(
        None, pagination, None, True
    )


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_success(
    service, mock_repo, mock_user, valid_charging_equipment
):
    """Test getting equipment by ID successfully."""
    # Mock the repository response
    mock_repo.get_charging_equipment_by_id.return_value = valid_charging_equipment

    # Call the service method
    result = await service.get_charging_equipment_by_id(mock_user, 1)

    # Verify the result
    assert (
        result.charging_equipment_id == valid_charging_equipment.charging_equipment_id
    )
    assert result.serial_number == valid_charging_equipment.serial_number
    mock_repo.get_charging_equipment_by_id.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_not_found(service, mock_repo, mock_user):
    """Test getting equipment by ID when not found."""
    # Mock the repository response
    mock_repo.get_charging_equipment_by_id.return_value = None

    # Call the service method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.get_charging_equipment_by_id(mock_user, 999)

    assert exc_info.value.status_code == 404
    assert "Charging equipment not found" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_unauthorized(
    service, mock_repo, mock_user, valid_charging_equipment
):
    """Test getting equipment by ID with unauthorized access."""
    # Set equipment to different organization
    valid_charging_equipment.charging_site.organization_id = 2
    mock_repo.get_charging_equipment_by_id.return_value = valid_charging_equipment

    # Call the service method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.get_charging_equipment_by_id(mock_user, 1)

    assert exc_info.value.status_code == 403
    assert "Not authorized to view this equipment" in str(exc_info.value.detail)


@pytest.mark.anyio
@patch("lcfs.web.api.charging_equipment.services.add_notification_msg")
async def test_create_charging_equipment_success(
    mock_notification,
    service,
    mock_repo,
    mock_user,
    valid_charging_equipment,
    valid_charging_equipment_create_schema,
):
    """Test creating charging equipment successfully."""
    # Mock the repository responses
    mock_repo.create_charging_equipment.return_value = valid_charging_equipment
    mock_repo.get_charging_equipment_by_id.return_value = valid_charging_equipment

    # Call the service method
    result = await service.create_charging_equipment(
        mock_user, valid_charging_equipment_create_schema
    )

    # Verify the result
    assert (
        result.charging_equipment_id == valid_charging_equipment.charging_equipment_id
    )
    mock_repo.create_charging_equipment.assert_called_once()
    mock_notification.assert_called_once()


@pytest.mark.anyio
@patch("lcfs.web.api.charging_equipment.services.add_notification_msg")
async def test_update_charging_equipment_success(
    mock_notification,
    service,
    mock_repo,
    mock_user,
    valid_charging_equipment,
    valid_charging_equipment_update_schema,
):
    """Test updating charging equipment successfully."""
    # Mock the repository responses
    mock_repo.get_charging_equipment_by_id.return_value = valid_charging_equipment
    mock_repo.update_charging_equipment.return_value = valid_charging_equipment

    # Call the service method
    result = await service.update_charging_equipment(
        mock_user, 1, valid_charging_equipment_update_schema
    )

    # Verify the result
    assert (
        result.charging_equipment_id == valid_charging_equipment.charging_equipment_id
    )
    mock_repo.update_charging_equipment.assert_called_once()
    mock_notification.assert_called_once()


@pytest.mark.anyio
async def test_update_charging_equipment_not_found(
    service, mock_repo, mock_user, valid_charging_equipment_update_schema
):
    """Test updating equipment that doesn't exist."""
    # Mock the repository response
    mock_repo.get_charging_equipment_by_id.return_value = None

    # Call the service method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.update_charging_equipment(
            mock_user, 999, valid_charging_equipment_update_schema
        )

    assert exc_info.value.status_code == 404
    assert "Charging equipment not found" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_update_charging_equipment_wrong_status(
    service,
    mock_repo,
    mock_user,
    valid_charging_equipment,
    valid_charging_equipment_update_schema,
):
    """Test updating equipment in wrong status."""
    # Set equipment to Decommissioned status
    valid_charging_equipment.status.status = "Decommissioned"
    mock_repo.get_charging_equipment_by_id.return_value = valid_charging_equipment

    # Call the service method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.update_charging_equipment(
            mock_user, 1, valid_charging_equipment_update_schema
        )

    assert exc_info.value.status_code == 400
    assert "Cannot edit equipment in Decommissioned status" in str(
        exc_info.value.detail
    )


@pytest.mark.anyio
@patch("lcfs.web.api.charging_equipment.services.add_notification_msg")
async def test_bulk_submit_equipment_success(
    mock_notification, service, mock_repo, mock_user
):
    """Test bulk submitting equipment successfully."""
    # Mock the repository responses
    mock_repo.get_equipment_status_map.return_value = {1: "Draft", 2: "Updated"}
    mock_repo.bulk_update_status.return_value = 2

    # Call the service method
    result = await service.bulk_submit_equipment(mock_user, [1, 2])

    # Verify the result
    assert result.success is True
    assert result.affected_count == 2
    assert "Successfully submitted 2 equipment" in result.message

    mock_repo.bulk_update_status.assert_called_once_with(
        [1, 2], "Submitted", mock_user.organization_id
    )
    mock_notification.assert_called_once()


@pytest.mark.anyio
async def test_bulk_submit_equipment_no_changes(service, mock_repo, mock_user):
    """Test bulk submitting equipment with no changes."""
    # Mock the repository responses
    mock_repo.get_equipment_status_map.return_value = {1: "Submitted", 2: "Validated"}
    mock_repo.bulk_update_status.return_value = 0

    # Call the service method
    result = await service.bulk_submit_equipment(mock_user, [1, 2])

    # Verify the result
    assert result.success is False
    assert result.affected_count == 0
    assert "No equipment could be submitted" in result.message


@pytest.mark.anyio
@patch("lcfs.web.api.charging_equipment.services.add_notification_msg")
async def test_bulk_decommission_equipment_success(
    mock_notification, service, mock_repo, mock_user
):
    """Test bulk decommissioning equipment successfully."""
    # Mock the repository response
    mock_repo.get_equipment_status_map.return_value = {
        1: "Validated",
        2: "Validated",
        3: "Validated",
    }
    mock_repo.bulk_update_status.return_value = 3

    # Call the service method
    result = await service.bulk_decommission_equipment(mock_user, [1, 2, 3])

    # Verify the result
    assert result.success is True
    assert result.affected_count == 3
    assert "Successfully decommissioned 3 equipment" in result.message

    mock_repo.bulk_update_status.assert_called_once_with(
        [1, 2, 3], "Decommissioned", mock_user.organization_id
    )
    mock_notification.assert_called_once()


@pytest.mark.anyio
async def test_bulk_actions_government_user_forbidden(
    service, mock_repo, mock_government_user
):
    """Test bulk actions with government user are forbidden."""
    # Call submit method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.bulk_submit_equipment(mock_government_user, [1, 2])

    assert exc_info.value.status_code == 403
    assert "Only suppliers can submit equipment" in str(exc_info.value.detail)

    # Call decommission method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.bulk_decommission_equipment(mock_government_user, [1, 2])

    assert exc_info.value.status_code == 403
    assert "Only suppliers can decommission equipment" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_auto_submit_equipment_for_report_updates_sites(service, mock_repo):
    mock_repo.auto_submit_draft_updated_fse_for_report.return_value = (2, [1, 2])
    with patch.object(
        service, "_update_charging_sites_status", new=AsyncMock()
    ) as mock_update_sites:
        count = await service.auto_submit_equipment_for_report(99, 7)

    assert count == 2
    mock_repo.auto_submit_draft_updated_fse_for_report.assert_called_once_with(99)
    mock_update_sites.assert_called_once_with(
        [1, 2], ["Draft", "Updated"], "Submitted", 7
    )


@pytest.mark.anyio
async def test_auto_validate_equipment_for_report_updates_sites(service, mock_repo):
    mock_repo.auto_validate_submitted_fse_for_report.return_value = (1, [10])
    with patch.object(
        service, "_update_charging_sites_status", new=AsyncMock()
    ) as mock_update_sites:
        count = await service.auto_validate_equipment_for_report(55, 3)

    assert count == 1
    mock_repo.auto_validate_submitted_fse_for_report.assert_called_once_with(55)
    mock_update_sites.assert_called_once_with(
        [10], ["Submitted", "Draft", "Updated"], "Validated", 3
    )



@pytest.mark.anyio
@patch("lcfs.web.api.charging_equipment.services.add_notification_msg")
async def test_delete_charging_equipment_success(
    mock_notification, service, mock_repo, mock_user
):
    """Test deleting charging equipment successfully."""
    # Mock the repository response
    mock_repo.delete_charging_equipment.return_value = True

    # Call the service method
    result = await service.delete_charging_equipment(mock_user, 1)

    # Verify the result
    assert result is True
    mock_repo.delete_charging_equipment.assert_called_once_with(
        1, mock_user.organization_id
    )
    mock_notification.assert_called_once()


@pytest.mark.anyio
async def test_delete_charging_equipment_not_found(service, mock_repo, mock_user):
    """Test deleting equipment that doesn't exist or can't be deleted."""
    # Mock the repository response
    mock_repo.delete_charging_equipment.return_value = False

    # Call the service method and expect HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.delete_charging_equipment(mock_user, 999)

    assert exc_info.value.status_code == 404
    assert "Equipment not found or cannot be deleted" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_get_equipment_statuses(service, mock_repo, mock_equipment_status):
    """Test getting equipment statuses."""
    # Mock the repository response
    mock_repo.get_statuses.return_value = [mock_equipment_status]

    # Call the service method
    result = await service.get_equipment_statuses()

    # Verify the result
    assert len(result) == 1
    assert result[0]["statusId"] == mock_equipment_status.charging_equipment_status_id
    assert result[0]["status"] == mock_equipment_status.status


@pytest.mark.anyio
async def test_get_levels_of_equipment(service, mock_repo, mock_level_of_equipment):
    """Test getting levels of equipment."""
    # Mock the repository response
    mock_repo.get_levels_of_equipment.return_value = [mock_level_of_equipment]

    # Call the service method
    result = await service.get_levels_of_equipment()

    # Verify the result
    assert len(result) == 1
    assert (
        result[0]["levelOfEquipmentId"]
        == mock_level_of_equipment.level_of_equipment_id
    )
    assert result[0]["name"] == mock_level_of_equipment.name


@pytest.mark.anyio
async def test_get_end_use_types(service, mock_repo, mock_end_use_type):
    """Test getting end use types."""
    # Mock the repository response
    mock_repo.get_end_use_types.return_value = [mock_end_use_type]

    # Call the service method
    result = await service.get_end_use_types()

    # Verify the result
    assert len(result) == 1
    assert result[0]["endUseTypeId"] == mock_end_use_type.end_use_type_id
    assert result[0]["type"] == mock_end_use_type.type
