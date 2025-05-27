import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.organizations.schema import OrganizationSummaryResponseSchema


@pytest.fixture
def mock_repo():
    return MagicMock()


@pytest.fixture
def mock_redis_service():
    return MagicMock()


@pytest.fixture
def mock_transaction_repo():
    return MagicMock()


@pytest.fixture
def organizations_service(mock_repo, mock_redis_service, mock_transaction_repo):
    service = OrganizationsService()
    service.repo = mock_repo
    service.redis_balance_service = mock_redis_service
    service.transaction_repo = mock_transaction_repo
    return service


@pytest.mark.anyio
async def test_get_organization_names_with_statuses(organizations_service, mock_repo):
    """Test get_organization_names with specific statuses parameter"""

    # Mock data that would be returned from the repository
    mock_org_data = [
        {
            "organization_id": 1,
            "name": "Test Org 1",
            "operating_name": "Test Operating 1",
            "total_balance": 1000,
            "reserved_balance": 100,
        },
        {
            "organization_id": 2,
            "name": "Test Org 2",
            "operating_name": "Test Operating 2",
            "total_balance": 2000,
            "reserved_balance": 200,
        },
    ]

    # Mock the repository method
    mock_repo.get_organization_names = AsyncMock(return_value=mock_org_data)

    # Test with specific statuses
    statuses = ["Registered", "Unregistered"]
    result = await organizations_service.get_organization_names(
        order_by=("name", "asc"), statuses=statuses
    )

    # Verify the repository was called with the right conditions
    mock_repo.get_organization_names.assert_called_once()
    call_args = mock_repo.get_organization_names.call_args
    conditions = call_args[0][0]  # First positional argument
    order_by = call_args[0][1]  # Second positional argument

    # Verify that status filtering conditions were created
    assert len(conditions) == 1
    assert order_by == ("name", "asc")

    # Verify the result structure
    assert len(result) == 2
    assert all(isinstance(org, OrganizationSummaryResponseSchema) for org in result)
    assert result[0].organization_id == 1
    assert result[0].name == "Test Org 1"
    assert result[1].organization_id == 2
    assert result[1].name == "Test Org 2"


@pytest.mark.anyio
async def test_get_organization_names_registered_status(
    organizations_service, mock_repo
):
    """Test get_organization_names with registered status"""

    mock_org_data = [
        {
            "organization_id": 1,
            "name": "Registered Org",
            "operating_name": "Registered Operating",
            "total_balance": 1000,
            "reserved_balance": 100,
        }
    ]

    mock_repo.get_organization_names = AsyncMock(return_value=mock_org_data)

    # Test with registered status
    result = await organizations_service.get_organization_names(
        order_by=("name", "asc"), statuses=["Registered"]
    )

    # Verify the repository was called
    mock_repo.get_organization_names.assert_called_once()
    call_args = mock_repo.get_organization_names.call_args
    conditions = call_args[0][0]

    # Should have one condition for registered status
    assert len(conditions) == 1

    # Verify result
    assert len(result) == 1
    assert result[0].name == "Registered Org"


@pytest.mark.anyio
async def test_get_organization_names_no_statuses_filter(
    organizations_service, mock_repo
):
    """Test get_organization_names with no statuses (all organizations)"""

    mock_org_data = [
        {
            "organization_id": 1,
            "name": "Any Status Org",
            "operating_name": "Any Operating",
            "total_balance": 1000,
            "reserved_balance": 100,
        }
    ]

    mock_repo.get_organization_names = AsyncMock(return_value=mock_org_data)

    # Test with no filtering
    result = await organizations_service.get_organization_names(
        order_by=("name", "asc"), statuses=None
    )

    # Verify the repository was called
    mock_repo.get_organization_names.assert_called_once()
    call_args = mock_repo.get_organization_names.call_args
    conditions = call_args[0][0]

    # Should have no conditions (empty list)
    assert len(conditions) == 0

    # Verify result
    assert len(result) == 1
    assert result[0].name == "Any Status Org"


@pytest.mark.anyio
async def test_get_organization_names_invalid_statuses(
    organizations_service, mock_repo
):
    """Test get_organization_names filters out invalid statuses"""

    mock_org_data = []
    mock_repo.get_organization_names = AsyncMock(return_value=mock_org_data)

    # Test with invalid statuses mixed with valid ones
    statuses = ["Registered", "InvalidStatus", "Unregistered", "AnotherInvalid"]
    result = await organizations_service.get_organization_names(
        order_by=("name", "asc"), statuses=statuses
    )

    # Should still call the repo (invalid statuses are filtered out in the service)
    mock_repo.get_organization_names.assert_called_once()

    # Result should be valid even with invalid statuses passed
    assert isinstance(result, list)
