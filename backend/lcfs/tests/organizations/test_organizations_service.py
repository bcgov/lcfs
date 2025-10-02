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
    mock_repo.get_organization_type = AsyncMock(
        return_value=MagicMock(is_bceid_user=True)
    )

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
        organization_type_id=1,
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
    mock_repo.get_organization_type = AsyncMock(
        return_value=MagicMock(is_bceid_user=True)
    )

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


@pytest.mark.anyio
async def test_get_available_forms_success(organizations_service):
    """Test successful retrieval of available forms"""
    from lcfs.web.api.organizations.schema import AvailableFormsSchema
    from types import SimpleNamespace

    # Mock forms data
    mock_forms = [
        SimpleNamespace(
            form_id=1, name="Form A", slug="form-a", description="Form A description"
        ),
        SimpleNamespace(
            form_id=2, name="Form B", slug="form-b", description="Form B description"
        ),
    ]

    organizations_service.repo.get_available_forms_for_link_keys = AsyncMock(
        return_value=mock_forms
    )

    # Test the method
    result = await organizations_service.get_available_forms()

    assert isinstance(result, AvailableFormsSchema)
    assert len(result.forms) == 2
    assert 1 in result.forms
    assert 2 in result.forms
    assert result.forms[1]["name"] == "Form A"
    assert result.forms[1]["slug"] == "form-a"
    assert result.forms[2]["name"] == "Form B"
    assert result.forms[2]["slug"] == "form-b"

    organizations_service.repo.get_available_forms_for_link_keys.assert_called_once()


# Link Key Service Tests
@pytest.mark.anyio
async def test_get_organization_link_keys_success(organizations_service):
    """Test successful retrieval of organization link keys"""
    from lcfs.web.api.organizations.schema import OrganizationLinkKeysListSchema

    organization_id = 1

    mock_organization = MagicMock()
    mock_organization.organization_id = 1
    mock_organization.name = "Test Organization"

    mock_link_key = MagicMock()
    mock_link_key.link_key_id = 1
    mock_link_key.organization_id = 1
    mock_link_key.form_id = 1
    mock_link_key.form_name = "Test Form"
    mock_link_key.form_slug = "test-form"
    mock_link_key.link_key = "test-key-123"
    mock_link_key.create_date = "2024-01-01"
    mock_link_key.update_date = "2024-01-01"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_organization_link_keys = AsyncMock(
        return_value=[mock_link_key]
    )

    # Test the method
    result = await organizations_service.get_organization_link_keys(organization_id)

    assert isinstance(result, OrganizationLinkKeysListSchema)
    assert result.organization_id == organization_id
    assert result.organization_name == "Test Organization"
    assert len(result.link_keys) == 1
    assert result.link_keys[0].link_key_id == 1
    assert result.link_keys[0].form_name == "Test Form"
    assert result.link_keys[0].link_key == "test-key-123"

    organizations_service.repo.get_organization.assert_called_once_with(organization_id)
    organizations_service.repo.get_organization_link_keys.assert_called_once_with(
        organization_id
    )


@pytest.mark.anyio
async def test_get_organization_link_keys_organization_not_found(organizations_service):
    """Test get_organization_link_keys when organization doesn't exist"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 999

    organizations_service.repo.get_organization = AsyncMock(return_value=None)

    # Test the method - should raise DataNotFoundException
    with pytest.raises(DataNotFoundException, match="Organization not found"):
        await organizations_service.get_organization_link_keys(organization_id)

    organizations_service.repo.get_organization.assert_called_once_with(organization_id)
    organizations_service.repo.get_organization_link_keys.assert_not_called()


@pytest.mark.anyio
async def test_generate_link_key_success(organizations_service):
    """Test successful link key generation"""
    from lcfs.web.api.organizations.schema import LinkKeyOperationResponseSchema

    organization_id = 1
    form_id = 1
    user = MagicMock()

    mock_organization = MagicMock()
    mock_organization.organization_id = 1
    mock_organization.name = "Test Organization"

    mock_form = MagicMock()
    mock_form.form_id = 1
    mock_form.name = "Test Form"
    mock_form.slug = "test-form"
    mock_form.description = "A test form"
    mock_form.allows_anonymous = True

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=mock_form)
    organizations_service.repo.get_link_key_by_form_id = AsyncMock(
        return_value=None  # No existing key
    )

    # Mock the created link key
    created_link_key = MagicMock()
    created_link_key.link_key = "generated-key-456"
    organizations_service.repo.create_link_key = AsyncMock(
        return_value=created_link_key
    )

    with patch(
        "lcfs.web.api.organizations.services.generate_secure_link_key"
    ) as mock_gen_key:
        mock_gen_key.return_value = "generated-key-456"

        # Test the method
        result = await organizations_service.generate_link_key(
            organization_id, form_id, user
        )

    assert isinstance(result, LinkKeyOperationResponseSchema)
    assert result.link_key == "generated-key-456"
    assert result.form_id == form_id
    assert result.form_name == "Test Form"
    assert result.form_slug == "test-form"

    organizations_service.repo.get_organization.assert_called_once_with(organization_id)
    organizations_service.repo.get_form_by_id.assert_called_once_with(form_id)
    organizations_service.repo.get_link_key_by_form_id.assert_called_once_with(
        organization_id, form_id
    )
    organizations_service.repo.create_link_key.assert_called_once()


@pytest.mark.anyio
async def test_generate_link_key_already_exists(organizations_service):
    """Test generate_link_key when link key already exists"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 1
    form_id = 1

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    mock_form = MagicMock()
    mock_form.allows_anonymous = True
    mock_form.name = "Test Form"

    mock_link_key = MagicMock()

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=mock_form)
    organizations_service.repo.get_link_key_by_form_id = AsyncMock(
        return_value=mock_link_key  # Existing key
    )

    # Test the method - should raise ValueError
    with pytest.raises(ValueError, match="Link key already exists"):
        await organizations_service.generate_link_key(organization_id, form_id)

    organizations_service.repo.create_link_key.assert_not_called()


@pytest.mark.anyio
async def test_generate_link_key_form_not_found(organizations_service):
    """Test generate_link_key when form does not exist"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 1
    form_id = 999

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=None)

    with pytest.raises(DataNotFoundException, match="Form with ID 999 not found"):
        await organizations_service.generate_link_key(organization_id, form_id)

    organizations_service.repo.create_link_key.assert_not_called()


@pytest.mark.anyio
async def test_generate_link_key_form_not_anonymous(organizations_service):
    """Test generate_link_key when form does not allow anonymous"""
    organization_id = 1
    form_id = 2

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    mock_form = MagicMock()
    mock_form.allows_anonymous = False
    mock_form.name = "Private Form"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=mock_form)

    with pytest.raises(ValueError, match="Form does not support anonymous access"):
        await organizations_service.generate_link_key(organization_id, form_id)

    organizations_service.repo.create_link_key.assert_not_called()


@pytest.mark.anyio
async def test_regenerate_link_key_success(organizations_service):
    """Test successful link key regeneration"""
    from lcfs.web.api.organizations.schema import LinkKeyOperationResponseSchema

    organization_id = 1
    form_id = 1
    user = MagicMock()

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    mock_form = MagicMock()
    mock_form.name = "Test Form"
    mock_form.slug = "test-form"

    mock_link_key = MagicMock()
    mock_link_key.link_key = "old-key"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=mock_form)
    organizations_service.repo.get_link_key_by_form_id = AsyncMock(
        return_value=mock_link_key
    )

    # Mock the updated link key
    updated_link_key = MagicMock()
    updated_link_key.link_key = "regenerated-key-789"
    organizations_service.repo.update_link_key = AsyncMock(
        return_value=updated_link_key
    )

    with patch(
        "lcfs.web.api.organizations.services.generate_secure_link_key"
    ) as mock_gen_key:
        mock_gen_key.return_value = "regenerated-key-789"

        # Test the method
        result = await organizations_service.regenerate_link_key(
            organization_id, form_id, user
        )

    assert isinstance(result, LinkKeyOperationResponseSchema)
    assert result.link_key == "regenerated-key-789"
    assert result.form_id == form_id
    assert result.form_name == "Test Form"
    assert result.form_slug == "test-form"

    organizations_service.repo.get_organization.assert_called_once_with(organization_id)
    organizations_service.repo.get_form_by_id.assert_called_once_with(form_id)
    organizations_service.repo.get_link_key_by_form_id.assert_called_once_with(
        organization_id, form_id
    )
    organizations_service.repo.update_link_key.assert_called_once()


@pytest.mark.anyio
async def test_regenerate_link_key_no_existing_key(organizations_service):
    """Test regenerate_link_key when no existing link key found"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 1
    form_id = 1

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    mock_form = MagicMock()
    mock_form.name = "Test Form"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=mock_form)
    organizations_service.repo.get_link_key_by_form_id = AsyncMock(
        return_value=None  # No existing key
    )

    # Test the method - should raise DataNotFoundException
    with pytest.raises(DataNotFoundException, match="No link key found"):
        await organizations_service.regenerate_link_key(organization_id, form_id)

    organizations_service.repo.update_link_key.assert_not_called()


@pytest.mark.anyio
async def test_regenerate_link_key_form_not_found(organizations_service):
    """Test regenerate_link_key when form does not exist"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 1
    form_id = 123

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.get_form_by_id = AsyncMock(return_value=None)

    with pytest.raises(DataNotFoundException, match="Form with ID 123 not found"):
        await organizations_service.regenerate_link_key(organization_id, form_id)


@pytest.mark.anyio
async def test_validate_link_key_success(organizations_service):
    """Test successful link key validation"""
    from lcfs.web.api.organizations.schema import LinkKeyValidationSchema

    link_key_value = "valid-key-123"

    mock_organization = MagicMock()
    mock_organization.name = "Test Organization"

    # Mock link key record with organization
    mock_link_key_record = MagicMock()
    mock_link_key_record.organization_id = 1
    mock_link_key_record.form_id = 1
    mock_link_key_record.form_name = "Test Form"
    mock_link_key_record.form_slug = "test-form"
    mock_link_key_record.organization = mock_organization

    organizations_service.repo.get_link_key_by_key = AsyncMock(
        return_value=mock_link_key_record
    )

    # Test the method
    result = await organizations_service.validate_link_key(link_key_value)

    assert isinstance(result, LinkKeyValidationSchema)
    assert result.organization_id == 1
    assert result.form_id == 1
    assert result.form_name == "Test Form"
    assert result.form_slug == "test-form"
    assert result.organization_name == "Test Organization"
    assert result.is_valid is True

    organizations_service.repo.get_link_key_by_key.assert_called_once_with(
        link_key_value
    )


@pytest.mark.anyio
async def test_validate_link_key_invalid(organizations_service):
    """Test link key validation with invalid key"""
    from lcfs.web.api.organizations.schema import LinkKeyValidationSchema

    link_key_value = "invalid-key-123"

    organizations_service.repo.get_link_key_by_key = AsyncMock(return_value=None)

    # Test the method
    result = await organizations_service.validate_link_key(link_key_value)

    assert isinstance(result, LinkKeyValidationSchema)
    assert result.organization_id == 0
    assert result.form_id == 0
    assert result.form_name == "Unknown"
    assert result.form_slug == "unknown"
    assert result.organization_name == ""
    assert result.is_valid is False

    organizations_service.repo.get_link_key_by_key.assert_called_once_with(
        link_key_value
    )


# Company Overview Service Tests
@pytest.mark.anyio
async def test_update_organization_company_overview_success(organizations_service):
    """Test successful company overview update"""
    organization_id = 1
    company_overview_data = {
        "company_details": "Updated company details",
        "company_representation_agreements": "Updated agreements",
        "company_acting_as_aggregator": "Updated aggregator info",
        "company_additional_notes": "Updated notes",
    }
    user = MagicMock()
    user.keycloak_username = "test_user"

    mock_organization = MagicMock()
    mock_organization.organization_id = organization_id
    mock_organization.company_details = "Old details"
    mock_organization.company_representation_agreements = "Old agreements"
    mock_organization.company_acting_as_aggregator = "Old aggregator"
    mock_organization.company_additional_notes = "Old notes"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.update_organization = AsyncMock(
        return_value=mock_organization
    )

    # Test the method
    result = await organizations_service.update_organization_company_overview(
        organization_id, company_overview_data, user
    )

    # Verify organization was fetched
    organizations_service.repo.get_organization.assert_called_once_with(organization_id)

    # Verify fields were updated
    assert mock_organization.company_details == "Updated company details"
    assert (
        mock_organization.company_representation_agreements == "Updated agreements"
    )
    assert mock_organization.company_acting_as_aggregator == "Updated aggregator info"
    assert mock_organization.company_additional_notes == "Updated notes"
    assert mock_organization.update_user == "test_user"

    # Verify organization was saved
    organizations_service.repo.update_organization.assert_called_once_with(
        mock_organization
    )

    # Verify result is returned
    assert result == mock_organization


@pytest.mark.anyio
async def test_update_organization_company_overview_organization_not_found(
    organizations_service,
):
    """Test company overview update when organization doesn't exist"""
    from lcfs.web.exception.exceptions import DataNotFoundException

    organization_id = 999
    company_overview_data = {"company_details": "Test"}

    organizations_service.repo.get_organization = AsyncMock(return_value=None)

    # Test the method - should raise DataNotFoundException
    with pytest.raises(DataNotFoundException, match="Organization not found"):
        await organizations_service.update_organization_company_overview(
            organization_id, company_overview_data
        )

    organizations_service.repo.get_organization.assert_called_once_with(organization_id)
    organizations_service.repo.update_organization.assert_not_called()


@pytest.mark.anyio
async def test_update_organization_company_overview_partial_update(
    organizations_service,
):
    """Test updating only some company overview fields"""
    organization_id = 1
    # Only update company_details and company_additional_notes
    company_overview_data = {
        "company_details": "New details",
        "company_additional_notes": "New notes",
    }
    user = MagicMock()
    user.keycloak_username = "test_user"

    mock_organization = MagicMock()
    mock_organization.organization_id = organization_id
    mock_organization.company_details = "Old details"
    mock_organization.company_representation_agreements = "Old agreements"
    mock_organization.company_acting_as_aggregator = "Old aggregator"
    mock_organization.company_additional_notes = "Old notes"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.update_organization = AsyncMock(
        return_value=mock_organization
    )

    # Test the method
    result = await organizations_service.update_organization_company_overview(
        organization_id, company_overview_data, user
    )

    # Verify only specified fields were updated
    assert mock_organization.company_details == "New details"
    assert mock_organization.company_additional_notes == "New notes"
    # These should remain unchanged
    assert mock_organization.company_representation_agreements == "Old agreements"
    assert mock_organization.company_acting_as_aggregator == "Old aggregator"

    organizations_service.repo.update_organization.assert_called_once()


@pytest.mark.anyio
async def test_update_organization_company_overview_with_none_values(
    organizations_service,
):
    """Test updating company overview with None values (clearing fields)"""
    organization_id = 1
    company_overview_data = {
        "company_details": None,
        "company_representation_agreements": None,
    }
    user = MagicMock()
    user.keycloak_username = "test_user"

    mock_organization = MagicMock()
    mock_organization.organization_id = organization_id
    mock_organization.company_details = "Old details"
    mock_organization.company_representation_agreements = "Old agreements"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.update_organization = AsyncMock(
        return_value=mock_organization
    )

    # Test the method
    result = await organizations_service.update_organization_company_overview(
        organization_id, company_overview_data, user
    )

    # Verify fields were set to None
    assert mock_organization.company_details is None
    assert mock_organization.company_representation_agreements is None

    organizations_service.repo.update_organization.assert_called_once()


@pytest.mark.anyio
async def test_update_organization_company_overview_ignores_invalid_fields(
    organizations_service,
):
    """Test that invalid fields are ignored during company overview update"""
    organization_id = 1
    company_overview_data = {
        "company_details": "New details",
        "invalid_field": "Should be ignored",
        "another_invalid": "Also ignored",
    }
    user = MagicMock()

    mock_organization = MagicMock()
    mock_organization.organization_id = organization_id
    mock_organization.company_details = "Old details"

    organizations_service.repo.get_organization = AsyncMock(
        return_value=mock_organization
    )
    organizations_service.repo.update_organization = AsyncMock(
        return_value=mock_organization
    )

    # Test the method
    result = await organizations_service.update_organization_company_overview(
        organization_id, company_overview_data, user
    )

    # Verify valid field was updated
    assert mock_organization.company_details == "New details"

    # Verify invalid fields were not set (would raise AttributeError if attempted)
    assert not hasattr(mock_organization, "invalid_field")
    assert not hasattr(mock_organization, "another_invalid")

    organizations_service.repo.update_organization.assert_called_once()
