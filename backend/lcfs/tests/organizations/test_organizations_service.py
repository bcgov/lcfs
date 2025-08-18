import pytest
from unittest.mock import AsyncMock, MagicMock
import unittest
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.organizations.schema import (
    OrganizationSummaryResponseSchema,
    OrganizationCreateSchema,
    OrganizationUpdateSchema,
    OrganizationAddressSchema,
)
from lcfs.db.models.organization.OrganizationStatus import (
    OrganizationStatus,
    OrgStatusEnum,
)
from lcfs.web.api.base import PaginationRequestSchema, FilterModel
from unittest.mock import patch


def create_mock_org_status(status_enum: OrgStatusEnum):
    mock_status = MagicMock(spec=OrganizationStatus)
    mock_status.organization_status_id = 1
    mock_status.status = status_enum
    mock_status.description = f"{status_enum.value} status"
    return mock_status


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
            "status": create_mock_org_status(OrgStatusEnum.Registered),
        },
        {
            "organization_id": 2,
            "name": "Test Org 2",
            "operating_name": "Test Operating 2",
            "total_balance": 2000,
            "reserved_balance": 200,
            "status": create_mock_org_status(OrgStatusEnum.Unregistered),
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
            "status": create_mock_org_status(OrgStatusEnum.Registered),
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
            "status": create_mock_org_status(OrgStatusEnum.Registered),
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


@pytest.mark.anyio
async def test_create_organization_with_early_issuance(
    organizations_service, mock_repo
):
    """Test creating an organization with the early issuance flag."""
    create_data = OrganizationCreateSchema(
        name="Test Org",
        operating_name="Test Op Org",
        email="test@test.com",
        phone="1234567890",
        edrms_record="12345",
        organization_status_id=1,
        organization_type_id=1,
        address=OrganizationAddressSchema(
            name="Test Org",
            street_address="123 Main St",
            city="Anytown",
            postalCode_zipCode="12345",
            provinceState="BC",
            country="Canada",
        ),
        attorney_address=OrganizationAddressSchema(
            name="Test Org",
            street_address="456 Law St",
            city="Legaltown",
            postalCode_zipCode="67890",
            provinceState="BC",
            country="Canada",
        ),
        has_early_issuance=True,
    )

    mock_repo.create_organization = AsyncMock(return_value=MagicMock(organization_id=1))
    mock_repo.update_early_issuance_by_year = AsyncMock()

    with patch(
        "lcfs.utils.constants.LCFS_Constants.get_current_compliance_year",
        return_value="2023",
    ), patch(
        "lcfs.web.api.organizations.services.FastAPICache.clear", new_callable=AsyncMock
    ):
        await organizations_service.create_organization(create_data, user=MagicMock())

    mock_repo.update_early_issuance_by_year.assert_called_once_with(
        1, "2023", True, unittest.mock.ANY
    )


@pytest.mark.anyio
async def test_update_organization_with_early_issuance_change(
    organizations_service, mock_repo
):
    """Test updating an organization's early issuance flag."""
    update_data = OrganizationUpdateSchema(
        has_early_issuance=True,
        address={
            "name": "Test Org",
            "streetAddress": "123 Main St",
            "city": "Anytown",
            "postalcodeZipcode": "12345",
            "provinceState": "BC",
            "country": "Canada",
        },
        attorney_address={
            "name": "Test Org",
            "streetAddress": "456 Law St",
            "city": "Legaltown",
            "postalcodeZipcode": "67890",
            "provinceState": "BC",
            "country": "Canada",
        },
    )
    organization_id = 1

    mock_repo.get_organization = AsyncMock(
        return_value=MagicMock(
            organization_address_id=1, organization_attorney_address_id=1
        )
    )
    mock_repo.get_organization_address = AsyncMock(return_value=MagicMock())
    mock_repo.get_organization_attorney_address = AsyncMock(return_value=MagicMock())
    mock_repo.get_current_year_early_issuance = AsyncMock(return_value=False)
    mock_repo.update_early_issuance_by_year = AsyncMock()
    mock_repo.update_organization = AsyncMock()

    with patch(
        "lcfs.utils.constants.LCFS_Constants.get_current_compliance_year",
        return_value="2023",
    ):
        await organizations_service.update_organization(
            organization_id, update_data, user=MagicMock()
        )

    mock_repo.update_early_issuance_by_year.assert_called_once_with(
        organization_id, "2023", True, unittest.mock.ANY
    )


@pytest.mark.anyio
async def test_apply_organization_filters_with_early_issuance(organizations_service):
    """Test applying organization filters with early issuance."""
    pagination = PaginationRequestSchema(
        filters=[
            FilterModel(
                field="has_early_issuance",
                filter=1,
                type="equals",
                filter_type="number",
            )
        ]
    )
    conditions = []

    # Mock the get_early_issuance_field method
    organizations_service.repo.get_early_issuance_field = MagicMock(
        return_value=MagicMock()
    )

    # Mock the apply_filter_conditions to avoid comparison errors
    with patch(
        "lcfs.web.api.organizations.services.apply_filter_conditions"
    ) as mock_apply_filter:
        mock_apply_filter.return_value = MagicMock()
        organizations_service.apply_organization_filters(pagination, conditions)

        # Verify that apply_filter_conditions was called
        mock_apply_filter.assert_called_once()

        # Verify that conditions were modified
        assert len(conditions) == 1


@pytest.mark.anyio
async def test_apply_organization_filters_with_registration_status_boolean(
    organizations_service,
):
    """Test applying organization filters with registration_status as boolean."""
    pagination = PaginationRequestSchema(
        filters=[
            FilterModel(
                field="registration_status",
                filter=True,
                type="equals",
                filter_type="text",
            )
        ]
    )
    conditions = []

    # Mock the get_field_for_filter function
    with patch(
        "lcfs.web.api.organizations.services.get_field_for_filter"
    ) as mock_get_field:
        mock_field = MagicMock()
        mock_get_field.return_value = mock_field

        organizations_service.apply_organization_filters(pagination, conditions)

        # Verify that get_field_for_filter was called with OrganizationStatus
        mock_get_field.assert_called_once()
        # Verify that conditions were modified
        assert len(conditions) == 1


@pytest.mark.anyio
async def test_apply_organization_filters_with_registration_status_string(
    organizations_service,
):
    """Test applying organization filters with registration_status as string."""
    pagination = PaginationRequestSchema(
        filters=[
            FilterModel(
                field="registration_status",
                filter="true",
                type="equals",
                filter_type="text",
            )
        ]
    )
    conditions = []

    # Mock the get_field_for_filter function
    with patch(
        "lcfs.web.api.organizations.services.get_field_for_filter"
    ) as mock_get_field:
        mock_field = MagicMock()
        mock_get_field.return_value = mock_field

        organizations_service.apply_organization_filters(pagination, conditions)

        # Verify that get_field_for_filter was called with OrganizationStatus
        mock_get_field.assert_called_once()
        # Verify that conditions were modified for string "true"
        assert len(conditions) == 1


@pytest.mark.anyio
async def test_apply_organization_filters_with_registration_status_false_string(
    organizations_service,
):
    """Test applying organization filters with registration_status as string 'false'."""
    pagination = PaginationRequestSchema(
        filters=[
            FilterModel(
                field="registration_status",
                filter="false",
                type="equals",
                filter_type="text",
            )
        ]
    )
    conditions = []

    # Mock the get_field_for_filter function
    with patch(
        "lcfs.web.api.organizations.services.get_field_for_filter"
    ) as mock_get_field:
        mock_field = MagicMock()
        mock_get_field.return_value = mock_field

        organizations_service.apply_organization_filters(pagination, conditions)

        # Verify that get_field_for_filter was called with OrganizationStatus
        mock_get_field.assert_called_once()
        # Verify that conditions were modified for string "false"
        assert len(conditions) == 1
