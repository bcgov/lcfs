import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementSchema,
    AllocationAgreementResponseSchema,
    AllocationTransactionTypeSchema,
    FuelTypeSchema,
    FuelCategorySchema,
    ProvisionOfTheActSchema,
)


def create_mock_schema(overrides: dict):
    mock_schema = AllocationAgreementSchema(
        compliance_report_id=1,
        allocation_agreement_id=None,  # Default to None for creation
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_type_other=None,
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=100,
        q1_quantity=None,
        q2_quantity=None,
        q3_quantity=None,
        q4_quantity=None,
        units="L",
        fuel_category="Diesel",
        fuel_code=None,
        deleted=None,
        group_uuid="test-group-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE.value,
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema


def create_mock_update_schema(overrides: dict):
    mock_schema = AllocationAgreementSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,  # Default to 1 for updates
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_type_other=None,
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=100,
        q1_quantity=None,
        q2_quantity=None,
        q3_quantity=None,
        q4_quantity=None,
        units="L",
        fuel_category="Diesel",
        fuel_code=None,
        deleted=None,
        group_uuid="test-group-uuid",
        version=1,
        action_type=ActionTypeEnum.UPDATE.value,
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema


def create_mock_delete_schema(overrides: dict):
    mock_schema = AllocationAgreementSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,  # Default to 1 for deletes
        allocation_transaction_type="Allocated from",
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type="Biodiesel",
        fuel_type_other=None,
        ci_of_fuel=100.21,
        provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
        quantity=100,
        units="L",
        fuel_category="Diesel",
        fuel_code=None,
        deleted=True,  # Set to True for deletes
        group_uuid="test-group-uuid",
        version=1,
        action_type=ActionTypeEnum.DELETE.value,  # Set to DELETE for deletes
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema


def create_mock_response_schema(overrides: dict):
    mock_response_schema = AllocationAgreementResponseSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,
        allocation_transaction_type=AllocationTransactionTypeSchema(
            allocation_transaction_type_id=1, type="Allocated from"
        ).type,
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type=FuelTypeSchema(
            fuel_type_id=1,
            fuel_type="Biodiesel",
            default_carbon_intensity=10.0,
            units="gCO2e/MJ",
            unrecognized=False,
        ).fuel_type,
        fuel_category=FuelCategorySchema(
            fuel_category_id=1, category="Diesel"
        ).category,
        fuel_type_other=None,
        ci_of_fuel=100.21,
        provision_of_the_act=ProvisionOfTheActSchema(
            provision_of_the_act_id=1,
            name="Default carbon intensity - section 19 (b) (ii)",
        ),
        quantity=100,
        units="L",
        fuel_code=None,
        group_uuid="test-group-uuid",
        version=1,
        action_type=ActionTypeEnum.CREATE.value,
        diff=None,
        updated=None,
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_response_schema, key, value)

    return mock_response_schema


def create_mock_update_response_schema(overrides: dict):
    mock_response_schema = AllocationAgreementResponseSchema(
        compliance_report_id=1,
        allocation_agreement_id=1,
        allocation_transaction_type=AllocationTransactionTypeSchema(
            allocation_transaction_type_id=1, type="Allocated from"
        ).type,
        transaction_partner="LCFS Org 2",
        postal_address="789 Stellar Lane Floor 10",
        transaction_partner_email="tfrs@gov.bc.ca",
        transaction_partner_phone="000-555-5678",
        fuel_type=FuelTypeSchema(
            fuel_type_id=1,
            fuel_type="Biodiesel",
            default_carbon_intensity=10.0,
            units="gCO2e/MJ",
            unrecognized=False,
        ).fuel_type,
        fuel_category=FuelCategorySchema(
            fuel_category_id=1, category="Diesel"
        ).category,
        fuel_type_other=None,
        ci_of_fuel=100.21,
        provision_of_the_act=ProvisionOfTheActSchema(
            provision_of_the_act_id=1,
            name="Default carbon intensity - section 19 (b) (ii)",
        ),
        quantity=100,
        units="L",
        fuel_code=None,
        group_uuid="test-group-uuid",
        version=1,
        action_type=ActionTypeEnum.UPDATE.value,
        diff=None,
        updated=None,
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_response_schema, key, value)

    return mock_response_schema


@pytest.fixture
def create_mock_allocation_agreement():
    def _create_mock_allocation_agreement(data=None):
        if data is None:
            data = {}

        # Create base mock agreement with all required fields
        mock_agreement = MagicMock(spec=AllocationAgreement)
        mock_agreement.allocation_agreement_id = data.get("allocation_agreement_id", 1)
        mock_agreement.group_uuid = data.get("group_uuid", "group-1")
        mock_agreement.version = data.get("version", 1)
        mock_agreement.action_type = data.get("action_type", ActionTypeEnum.CREATE)
        mock_agreement.transaction_partner = data.get(
            "transaction_partner", "LCFS Org 2"
        )
        mock_agreement.postal_address = data.get(
            "postal_address", "789 Stellar Lane Floor 10"
        )
        mock_agreement.transaction_partner_email = data.get(
            "transaction_partner_email", "tfrs@gov.bc.ca"
        )
        mock_agreement.transaction_partner_phone = data.get(
            "transaction_partner_phone", "000-555-5678"
        )
        mock_agreement.fuel_type_other = data.get("fuel_type_other", None)
        mock_agreement.ci_of_fuel = data.get("ci_of_fuel", 100.21)
        mock_agreement.quantity = data.get("quantity", 100)
        mock_agreement.q1_quantity = data.get("q1_quantity", None)
        mock_agreement.q2_quantity = data.get("q2_quantity", None)
        mock_agreement.q3_quantity = data.get("q3_quantity", None)
        mock_agreement.q4_quantity = data.get("q4_quantity", None)
        mock_agreement.units = data.get("units", "L")
        mock_agreement.compliance_report_id = data.get("compliance_report_id", 1)

        # Mock related entities
        mock_transaction_type = MagicMock()
        mock_transaction_type.type = data.get(
            "allocation_transaction_type", "Allocated from"
        )
        mock_agreement.allocation_transaction_type = mock_transaction_type

        mock_fuel_type = MagicMock()
        mock_fuel_type.fuel_type = data.get("fuel_type", "Biodiesel")
        mock_agreement.fuel_type = mock_fuel_type

        mock_fuel_category = MagicMock()
        mock_fuel_category.category = data.get("fuel_category", "Diesel")
        mock_agreement.fuel_category = mock_fuel_category

        mock_provision = MagicMock()
        mock_provision.name = data.get(
            "provision_of_the_act", "Default carbon intensity - section 19 (b) (ii)"
        )
        mock_agreement.provision_of_the_act = mock_provision

        mock_agreement.fuel_code = data.get("fuel_code", None)

        return mock_agreement

    return _create_mock_allocation_agreement


@pytest.fixture
def mock_allocation_type():
    """Create a standard mock allocation transaction type"""
    allocation_type = MagicMock()
    allocation_type.allocation_transaction_type_id = 1
    allocation_type.type = "Allocated from"
    allocation_type.allocation_transaction_type = "Allocated from"
    return allocation_type


@pytest.fixture
def mock_fuel_type():
    """Create a standard mock fuel type"""
    fuel_type = MagicMock()
    fuel_type.fuel_type_id = 1
    fuel_type.fuel_type = "Biodiesel"
    return fuel_type


@pytest.fixture
def mock_fuel_category():
    """Create a standard mock fuel category"""
    category = MagicMock()
    category.fuel_category_id = 1
    category.category = "Diesel"
    category.fuel_category = "Diesel"
    return category


@pytest.fixture
def mock_provision():
    """Create a standard mock provision of the act"""
    provision = MagicMock()
    provision.provision_of_the_act_id = 1
    provision.name = "Default carbon intensity - section 19 (b) (ii)"
    provision.provision_of_the_act = "Default carbon intensity - section 19 (b) (ii)"
    return provision


@pytest.fixture
def mock_allocation_agreement_full(
    mock_allocation_type, mock_fuel_type, mock_fuel_category, mock_provision
):
    """Create a fully configured mock allocation agreement with all nested objects"""

    def _create_mock_agreement(data=None):
        if data is None:
            data = {}

        # Create base mock agreement with all required fields
        mock_agreement = MagicMock(spec=AllocationAgreement)
        mock_agreement.allocation_agreement_id = data.get("allocation_agreement_id", 1)
        mock_agreement.group_uuid = data.get("group_uuid", "group-1")
        mock_agreement.version = data.get("version", 1)
        mock_agreement.action_type = data.get("action_type", ActionTypeEnum.CREATE)
        mock_agreement.transaction_partner = data.get(
            "transaction_partner", "LCFS Org 2"
        )
        mock_agreement.postal_address = data.get(
            "postal_address", "789 Stellar Lane Floor 10"
        )
        mock_agreement.transaction_partner_email = data.get(
            "transaction_partner_email", "tfrs@gov.bc.ca"
        )
        mock_agreement.transaction_partner_phone = data.get(
            "transaction_partner_phone", "000-555-5678"
        )
        mock_agreement.fuel_type_other = data.get("fuel_type_other", None)
        mock_agreement.ci_of_fuel = data.get("ci_of_fuel", 100.21)
        mock_agreement.quantity = data.get("quantity", None)  # Don't default to 100 for quarterly reports
        mock_agreement.q1_quantity = data.get("q1_quantity", None)
        mock_agreement.q2_quantity = data.get("q2_quantity", None)
        mock_agreement.q3_quantity = data.get("q3_quantity", None)
        mock_agreement.q4_quantity = data.get("q4_quantity", None)
        mock_agreement.units = data.get("units", "L")
        mock_agreement.compliance_report_id = data.get("compliance_report_id", 1)

        # Set up nested objects with proper configuration
        mock_agreement.allocation_transaction_type = mock_allocation_type
        mock_agreement.fuel_type = mock_fuel_type
        mock_agreement.fuel_category = mock_fuel_category
        mock_agreement.provision_of_the_act = mock_provision
        mock_agreement.fuel_code = data.get("fuel_code", None)

        # Set up __table__ for delete operations if needed
        if data.get("setup_table", False):
            mock_agreement.__table__ = MagicMock()
            mock_agreement.__table__.columns.keys.return_value = [
                "compliance_report_id",
                "transaction_partner",
                "postal_address",
                "transaction_partner_email",
                "transaction_partner_phone",
                "ci_of_fuel",
                "quantity",
                "units",
                "fuel_type_other",
                "id",
                "allocation_agreement_id",
                "deleted",
                "group_uuid",
                "user_type",
                "version",
                "action_type",
            ]

        return mock_agreement

    return _create_mock_agreement


@pytest.fixture
def mock_repo_full(mock_allocation_type):
    """Create a fully configured repo mock with standard return values"""
    repo = MagicMock()
    repo.create_allocation_agreement = AsyncMock()
    repo.update_allocation_agreement = AsyncMock()
    repo.delete_allocation_agreement = AsyncMock()
    repo.get_latest_allocation_agreement_by_group_uuid = AsyncMock()
    repo.get_effective_allocation_agreements = AsyncMock()
    repo.get_allocation_transaction_type_by_name = AsyncMock(
        return_value=mock_allocation_type
    )
    return repo


@pytest.fixture
def mock_fuel_repo_full(mock_fuel_type, mock_fuel_category, mock_provision):
    """Create a fully configured fuel repo mock with standard return values"""
    repo = MagicMock()
    repo.get_fuel_type_by_name = AsyncMock(return_value=mock_fuel_type)
    repo.get_fuel_category_by = AsyncMock(return_value=mock_fuel_category)
    repo.get_provision_of_the_act_by_name = AsyncMock(return_value=mock_provision)
    repo.get_fuel_code_by_name = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_model_to_dict():
    """Create a standard mock for _model_to_dict method"""

    def _mock_model_to_dict(model):
        return {k: v for k, v in model.__dict__.items() if not k.startswith("_")}

    return _mock_model_to_dict


@pytest.fixture
def mock_compliance_repo():
    """Create a mock compliance report repository"""
    repo = MagicMock()
    repo.get_changelog_data = AsyncMock()
    return repo


@pytest.fixture
def mock_snapshot_services():
    """Create a mock snapshot services"""
    services = MagicMock()
    return services


@pytest.fixture
def mock_changelog_records():
    """Create mock changelog records for testing"""

    class MockRecord:
        def __init__(self, group_uuid, version, quantity, units):
            self.group_uuid = group_uuid
            self.version = version
            self.quantity = quantity
            self.units = units
            self.__dict__ = {
                "group_uuid": group_uuid,
                "version": version,
                "quantity": quantity,
                "units": units,
            }

        def __repr__(self):
            return f"MockRecord(group_uuid={self.group_uuid}, version={self.version})"

    # Create standard test records
    record1 = MockRecord("group1", 1, 100, "L")
    record2 = MockRecord("group1", 2, 200, "L")  # Changed quantity
    record3 = MockRecord("group2", 1, 300, "L")

    return [record1, record2, record3]
