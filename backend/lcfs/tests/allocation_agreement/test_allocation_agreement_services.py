import pytest
from unittest.mock import MagicMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
)
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.dtos import ChangelogAllocationAgreementsDTO

# Reusable test data
DEFAULT_UUID = "12345678-1234-5678-1234-567812345678"


@pytest.fixture
def allocation_agreement_schema():
    """Create a standard allocation agreement schema for tests"""
    return AllocationAgreementCreateSchema(
        compliance_report_id=1,
        group_uuid=DEFAULT_UUID,
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_category="Diesel",
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=100,
        q1_quantity=None,
        q2_quantity=None,
        q3_quantity=None,
        q4_quantity=None,
        units="L",
    )


@pytest.fixture
def quarterly_allocation_agreement_schema():
    """Create an allocation agreement schema with quarterly fields for early issuance testing"""
    return AllocationAgreementCreateSchema(
        compliance_report_id=1,
        group_uuid=DEFAULT_UUID,
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_category="Diesel",
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=None,  # Should be None for quarterly reports
        q1_quantity=25,
        q2_quantity=30,
        q3_quantity=20,
        q4_quantity=25,
        units="L",
    )


@pytest.fixture
def service(mock_repo_full, mock_fuel_repo_full):
    """Create a service with mocked repositories for testing."""
    return AllocationAgreementServices(
        repo=mock_repo_full, fuel_repo=mock_fuel_repo_full
    )


@pytest.fixture
def compliance_service(mock_compliance_repo, mock_snapshot_services):
    return ComplianceReportServices(
        request=None,
        repo=mock_compliance_repo,
        snapshot_services=mock_snapshot_services,
    )


@pytest.mark.anyio
async def test_create_allocation_agreement(
    service, mock_repo_full, allocation_agreement_schema, mock_allocation_agreement_full
):
    """Test creation of new allocation agreement with versioning"""

    # Create a properly structured mock for the return value using the fixture
    mock_allocation_agreement = mock_allocation_agreement_full(
        {
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
            "quantity": 100,
        }
    )

    mock_repo_full.create_allocation_agreement.return_value = mock_allocation_agreement

    result = await service.create_allocation_agreement(allocation_agreement_schema)

    assert result.version == 0
    assert result.action_type == ActionTypeEnum.CREATE.value
    mock_repo_full.create_allocation_agreement.assert_called_once()


@pytest.mark.anyio
async def test_create_allocation_agreement_with_quarterly_fields(
    service,
    mock_repo_full,
    quarterly_allocation_agreement_schema,
    mock_allocation_agreement_full,
):
    """Test creation of allocation agreement with quarterly fields for early issuance"""

    # Create a mock that includes quarterly fields
    mock_allocation_agreement = mock_allocation_agreement_full(
        {
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
            "quantity": None,
            "q1_quantity": 25,
            "q2_quantity": 30,
            "q3_quantity": 20,
            "q4_quantity": 25,
        }
    )

    mock_repo_full.create_allocation_agreement.return_value = mock_allocation_agreement

    result = await service.create_allocation_agreement(
        quarterly_allocation_agreement_schema
    )

    assert result.version == 0
    assert result.action_type == ActionTypeEnum.CREATE.value
    assert result.quantity is None
    assert result.q1_quantity == 25
    assert result.q2_quantity == 30
    assert result.q3_quantity == 20
    assert result.q4_quantity == 25
    mock_repo_full.create_allocation_agreement.assert_called_once()


@pytest.mark.anyio
async def test_update_allocation_agreement(
    service, mock_repo_full, mock_allocation_agreement_full
):
    """Test update with version increment"""

    update_data = AllocationAgreementCreateSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,
        group_uuid=DEFAULT_UUID,
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="Updated Address",  # Changed field
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_category="Diesel",
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=100,
        units="L",
        version=1,
    )

    # Create existing record with same compliance_report_id as update_data
    existing = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 1,
            "group_uuid": DEFAULT_UUID,
            "version": 1,
            "action_type": ActionTypeEnum.CREATE,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 2",
            "postal_address": "Original Address",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-5678",
            "ci_of_fuel": 100.21,
            "quantity": 100,
            "units": "L",
            "fuel_type_other": None,
        }
    )

    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.return_value = existing

    # Create mock for the updated agreement
    mock_updated = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 1,
            "group_uuid": DEFAULT_UUID,
            "version": 2,
            "action_type": ActionTypeEnum.UPDATE,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 2",
            "postal_address": "Updated Address",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-5678",
            "ci_of_fuel": 100.21,
            "quantity": 100,
            "units": "L",
            "fuel_type_other": None,
        }
    )

    mock_repo_full.update_allocation_agreement.return_value = mock_updated

    # Execute the service method
    result = await service.update_allocation_agreement(update_data)

    # Verify the result
    assert result.version == 2
    assert result.action_type == ActionTypeEnum.UPDATE.value
    assert result.postal_address == "Updated Address"

    # Verify that update_allocation_agreement was called with expected arguments
    mock_repo_full.update_allocation_agreement.assert_called_once()
    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.assert_called_once_with(
        DEFAULT_UUID
    )


@pytest.mark.anyio
async def test_update_allocation_agreement_quarterly_fields(
    service, mock_repo_full, mock_allocation_agreement_full
):
    """Test update with quarterly fields modification"""

    update_data = AllocationAgreementCreateSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,
        group_uuid=DEFAULT_UUID,
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_category="Diesel",
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=None,
        q1_quantity=50,  # Updated quantity
        q2_quantity=30,
        q3_quantity=20,
        q4_quantity=25,
        units="L",
        version=1,
    )

    # Create existing record
    existing = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 1,
            "group_uuid": DEFAULT_UUID,
            "version": 1,
            "action_type": ActionTypeEnum.CREATE,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 2",
            "postal_address": "789 Stellar Lane Floor 10",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-5678",
            "ci_of_fuel": 100.21,
            "quantity": None,
            "q1_quantity": 25,  # Original value
            "q2_quantity": 30,
            "q3_quantity": 20,
            "q4_quantity": 25,
            "units": "L",
            "fuel_type_other": None,
        }
    )

    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.return_value = existing

    # Create mock for the updated agreement
    mock_updated = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 1,
            "group_uuid": DEFAULT_UUID,
            "version": 2,
            "action_type": ActionTypeEnum.UPDATE,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 2",
            "postal_address": "789 Stellar Lane Floor 10",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-5678",
            "ci_of_fuel": 100.21,
            "quantity": None,
            "q1_quantity": 50,  # Updated value
            "q2_quantity": 30,
            "q3_quantity": 20,
            "q4_quantity": 25,
            "units": "L",
            "fuel_type_other": None,
        }
    )

    mock_repo_full.update_allocation_agreement.return_value = mock_updated

    # Execute the service method
    result = await service.update_allocation_agreement(update_data)

    # Verify the result
    assert result.version == 2
    assert result.action_type == ActionTypeEnum.UPDATE.value
    assert result.q1_quantity == 50
    assert result.q2_quantity == 30
    assert result.q3_quantity == 20
    assert result.q4_quantity == 25

    # Verify that update_allocation_agreement was called
    mock_repo_full.update_allocation_agreement.assert_called_once()
    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.assert_called_once_with(
        DEFAULT_UUID
    )


@pytest.mark.anyio
async def test_get_changelog_data(
    compliance_service, mock_compliance_repo, mock_changelog_records
):
    """Test processing of changelog data with records in multiple groups"""
    # Setup test data

    compliance_report_group_uuid = 1
    data_type = "allocation_agreements"
    config = {
        "model": AllocationAgreement,
        "dto": ChangelogAllocationAgreementsDTO,
        "id_field": "allocation_agreement_id",
        "relationships": [
            ("allocation_agreements", "allocation_transaction_type"),
            ("allocation_agreements", "fuel_type"),
            ("allocation_agreements", "fuel_category"),
            ("allocation_agreements", "fuel_code"),
            ("allocation_agreements", "provision_of_the_act"),
        ],
    }

    # Setup the mock repo to return our test data (should be ComplianceReport models, not DTOs)
    # Create a mock ComplianceReport that will pass validation
    mock_report = MagicMock()
    mock_report.nickname = "changelog"
    mock_report.version = 1
    mock_report.compliance_report_id = 1
    mock_report.allocation_agreements = []
    
    # Set up the mock to be detected as a mock object to skip validation
    mock_report._mock_name = "mock_report"
    
    mock_compliance_repo.get_changelog_data.return_value = [mock_report]

    # Create a mock user for the test
    mock_user = MagicMock()
    mock_user.user_profile_id = 1
    mock_user.keycloak_username = "test.user"
    mock_user.role_names = []
    
    # Mock user_roles for is_government_user function
    mock_user_role = MagicMock()
    mock_user_role.role = MagicMock()
    mock_user_role.role.is_government_role = False
    mock_user.user_roles = [mock_user_role]

    # Call the method being tested
    result = await compliance_service.get_changelog_data(
        compliance_report_group_uuid, data_type, mock_user
    )

    # Verify the repo method was called with the correct parameters
    mock_compliance_repo.get_changelog_data.assert_called_once_with(
        compliance_report_group_uuid, config, mock_user  # Pass the user parameter
    )

    # Verify the changelog records in the result
    assert len(result) == 2


@pytest.mark.anyio
async def test_get_changelog_data_empty(
    compliance_service, mock_compliance_repo, mock_model_to_dict
):
    """Test handling of empty changelog data"""
    # Setup
    compliance_report_group_uuid = 1
    data_type = "allocation_agreements"

    # Use the mock_model_to_dict fixture
    compliance_service._model_to_dict = mock_model_to_dict

    # No changelog records
    mock_compliance_repo.get_changelog_data.return_value = []

    # Create a mock user for the test
    mock_user = MagicMock()
    mock_user.user_profile_id = 1
    mock_user.keycloak_username = "test.user"
    mock_user.role_names = []
    
    # Mock user_roles for is_government_user function
    mock_user_role = MagicMock()
    mock_user_role.role = MagicMock()
    mock_user_role.role.is_government_role = False
    mock_user.user_roles = [mock_user_role]

    # Call the method
    result = await compliance_service.get_changelog_data(
        compliance_report_group_uuid, data_type, mock_user
    )

    # Verify results
    assert len(result) == 0


@pytest.mark.anyio
async def test_delete_allocation_agreement(
    service, mock_repo_full, allocation_agreement_schema, mock_allocation_agreement_full
):
    """Test deletion of an allocation agreement"""
    # Setup test data
    group_uuid = DEFAULT_UUID
    delete_data = allocation_agreement_schema

    # Setup existing record with CREATE action - using the fixture
    existing = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 1,
            "group_uuid": group_uuid,
            "version": 1,
            "action_type": ActionTypeEnum.CREATE,
            "compliance_report_id": 12, # if same compliance report id then it'll do physical delete if not creates a new record with action type DELETE
            "transaction_partner": "LCFS Org 2",
            "postal_address": "789 Stellar Lane Floor 10",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-5678",
            "ci_of_fuel": 100.21,
            "quantity": 100,
            "units": "L",
            "fuel_type_other": None,
            "setup_table": True,  # Important: set this to True to create the __table__ mock
        }
    )

    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.return_value = existing

    # Create a mock for the newly created deletion record
    mock_deleted = mock_allocation_agreement_full(
        {
            "allocation_agreement_id": 2,
            "group_uuid": group_uuid,
            "version": 2,
            "action_type": ActionTypeEnum.DELETE,
        }
    )

    mock_repo_full.create_allocation_agreement.return_value = mock_deleted

    # Execute the service method
    result = await service.delete_allocation_agreement(delete_data)

    # Assertions
    assert result.message == "Marked as deleted."
    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.assert_called_once_with(
        group_uuid
    )
    mock_repo_full.create_allocation_agreement.assert_called_once()

    # Verify the correct parameters were passed to create_allocation_agreement
    args = mock_repo_full.create_allocation_agreement.call_args[0][0]
    assert args.compliance_report_id == 1  # Should match the input data
    assert args.action_type == ActionTypeEnum.DELETE


@pytest.mark.anyio
async def test_delete_already_deleted_allocation_agreement(
    service, mock_repo_full, allocation_agreement_schema, mock_allocation_agreement_full
):
    """Test attempting to delete an already deleted allocation agreement"""
    group_uuid = DEFAULT_UUID
    delete_data = allocation_agreement_schema

    # Setup existing record with DELETE action
    existing = mock_allocation_agreement_full(
        {
            "group_uuid": group_uuid,
            "version": 1,
            "action_type": ActionTypeEnum.DELETE,  # Already deleted
        }
    )

    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.return_value = existing

    # Execute the service method
    result = await service.delete_allocation_agreement(delete_data)

    # Assertions
    assert (
        result.message == "Marked as deleted."
    )  # The service now always returns "Marked as deleted."
    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.assert_called_once_with(
        group_uuid
    )
    # Verify create_allocation_agreement was not called
    mock_repo_full.create_allocation_agreement.assert_not_called()


@pytest.mark.anyio
async def test_convert_to_model_quarterly_fields(service, mock_fuel_repo_full):
    """Test conversion of schema to model includes quarterly fields"""
    
    schema = AllocationAgreementCreateSchema(
        compliance_report_id=1,
        allocation_transaction_type="Allocated from",
        transaction_partner="Test Partner",
        postal_address="Test Address",
        transaction_partner_email="test@example.com",
        transaction_partner_phone="123-456-7890",
        fuel_type="Biodiesel",
        fuel_category="Diesel",
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=None,
        q1_quantity=10,
        q2_quantity=20,
        q3_quantity=30,
        q4_quantity=40,
        fuel_code=None,
    )

    result = await service.convert_to_model(schema)

    # Verify quarterly fields are preserved
    assert result.quantity is None
    assert result.q1_quantity == 10
    assert result.q2_quantity == 20
    assert result.q3_quantity == 30
    assert result.q4_quantity == 40
