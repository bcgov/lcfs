import math
import pytest

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
)
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices

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
        }
    )

    mock_repo_full.create_allocation_agreement.return_value = mock_allocation_agreement

    result = await service.create_allocation_agreement(allocation_agreement_schema)

    assert result.version == 0
    assert result.action_type == ActionTypeEnum.CREATE.value
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
async def test_get_changelog_data(
    compliance_service, mock_compliance_repo, mock_changelog_records, mock_model_to_dict
):
    """Test processing of changelog data with records in multiple groups"""
    # Setup test data
    pagination = PaginationResponseSchema(page=1, size=10, total=0, total_pages=0)
    compliance_report_id = 1

    # Use the mock_changelog_records fixture
    changelog_records = mock_changelog_records
    total_count = len(changelog_records)

    # Use the mock_model_to_dict fixture
    compliance_service._model_to_dict = mock_model_to_dict

    # Setup the mock repo to return our test data
    mock_compliance_repo.get_changelog_data.return_value = (
        changelog_records,
        total_count,
    )

    # Call the method being tested
    result = await compliance_service.get_changelog_data(
        pagination, compliance_report_id, AllocationAgreement
    )

    # Verify the repo method was called with the correct parameters
    mock_compliance_repo.get_changelog_data.assert_called_once_with(
        pagination, compliance_report_id, AllocationAgreement
    )

    # Verify the pagination info in the result
    assert result["pagination"].total == total_count
    assert result["pagination"].page == pagination.page
    assert result["pagination"].size == pagination.size
    assert result["pagination"].total_pages == math.ceil(total_count / pagination.size)

    # Verify the changelog records in the result
    assert len(result["changelog"]) == 3

    # Verify diff was calculated for records in group1
    group1_records = [r for r in result["changelog"] if r.group_uuid == "group1"]
    assert len(group1_records) == 2

    # Both records should have the diff field set
    for record in group1_records:
        assert hasattr(record, "diff")
        # The diff should mark 'quantity' as different
        assert record.diff.get("quantity") is True
        # The diff should not mark 'units' as different
        assert record.diff.get("units", False) is False

    # Verify the older record was marked as updated
    record1_result = next(r for r in group1_records if r.version == 1)
    assert hasattr(record1_result, "updated")
    assert record1_result.updated is True

    # Verify the newer record was not marked as updated
    record2_result = next(r for r in group1_records if r.version == 2)
    assert not getattr(record2_result, "updated", False)

    # Verify the record in group2 doesn't have diff or updated attributes
    group2_record = next(r for r in result["changelog"] if r.group_uuid == "group2")
    assert not hasattr(group2_record, "diff")
    assert not hasattr(group2_record, "updated")


@pytest.mark.anyio
async def test_get_changelog_data_empty(
    compliance_service, mock_compliance_repo, mock_model_to_dict
):
    """Test handling of empty changelog data"""
    # Setup
    pagination = PaginationResponseSchema(page=1, size=10, total=0, total_pages=0)
    compliance_report_id = 1

    # Use the mock_model_to_dict fixture
    compliance_service._model_to_dict = mock_model_to_dict

    # No changelog records
    mock_compliance_repo.get_changelog_data.return_value = ([], 0)

    # Call the method
    result = await compliance_service.get_changelog_data(
        pagination, compliance_report_id, AllocationAgreement
    )

    # Verify results
    assert result["pagination"].total == 0
    assert result["pagination"].total_pages == 0
    assert len(result["changelog"]) == 0


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
            "compliance_report_id": 1,
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
    assert args.compliance_report_id == 1
    assert args.group_uuid == group_uuid
    assert args.version == 2
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
    assert result.message == "Already deleted."
    mock_repo_full.get_latest_allocation_agreement_by_group_uuid.assert_called_once_with(
        group_uuid
    )
    # Verify create_allocation_agreement was not called
    mock_repo_full.create_allocation_agreement.assert_not_called()
