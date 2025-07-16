import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, Mock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository


@pytest.fixture
def mock_query_result():
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.all = MagicMock(return_value=[MagicMock(spec=AllocationAgreement)])
    return mock_result


@pytest.fixture
def mock_db_session(mock_query_result):
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=mock_query_result)
    return session


@pytest.fixture
def allocation_agreement_repo(mock_db_session):
    repo = AllocationAgreementRepository(db=mock_db_session)
    repo.fuel_code_repo = MagicMock()
    repo.fuel_code_repo.get_fuel_categories = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_formatted_fuel_types = AsyncMock(return_value=[])
    return repo


# Add this fixture after your other fixtures and before the tests
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


@pytest.mark.anyio
async def test_get_latest_allocation_agreement_by_group_uuid(
    allocation_agreement_repo, mock_db_session
):
    """Test retrieval of latest version with government priority"""
    group_uuid = "test-group-uuid"

    # Create mock records with different versions/user types
    mock_agreement_gov = MagicMock(spec=AllocationAgreement)
    mock_agreement_gov.version = 2
    mock_agreement_gov.action_type = ActionTypeEnum.UPDATE

    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.first = MagicMock(return_value=mock_agreement_gov)

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = (
        await allocation_agreement_repo.get_latest_allocation_agreement_by_group_uuid(
            group_uuid
        )
    )

    assert result.version == 2
    assert result.action_type == ActionTypeEnum.UPDATE


@pytest.mark.anyio
async def test_get_effective_allocation_agreements(
    allocation_agreement_repo, mock_db_session, create_mock_allocation_agreement
):
    """Test retrieval of effective records excluding deleted ones"""

    # Create mock agreement using the fixture
    mock_agreement = create_mock_allocation_agreement()

    # Setup mock result chain
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.all = MagicMock(return_value=[mock_agreement])

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await allocation_agreement_repo.get_effective_allocation_agreements(
        "test-group-uuid", 1
    )

    # Verify the result
    assert len(result) == 1
    assert result[0].allocation_agreement_id == 1
    # Compare against the enum value (string)
    assert result[0].action_type == ActionTypeEnum.CREATE.value
    # fuel_type is now a string instead of an object
    assert result[0].fuel_type == "Biodiesel"
    assert result[0].transaction_partner == "LCFS Org 2"
    assert result[0].postal_address == "789 Stellar Lane Floor 10"


@pytest.mark.anyio
async def test_create_allocation_agreement(
    allocation_agreement_repo, mock_db_session, create_mock_allocation_agreement
):
    """Test creation of versioned allocation agreement"""

    mock_agreement = create_mock_allocation_agreement(
        {
            "group_uuid": "new-group",
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        }
    )

    # Setup async mock calls
    mock_db_session.add = Mock()
    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # Execute the repository call
    result = await allocation_agreement_repo.create_allocation_agreement(mock_agreement)

    # Verify result
    assert result.version == 0
    assert result.action_type == ActionTypeEnum.CREATE.value

    # Verify that the mock methods were called with correct arguments
    mock_db_session.add.assert_called_once_with(mock_agreement)
    mock_db_session.flush.assert_awaited()
    mock_db_session.refresh.assert_awaited_once_with(
        mock_agreement,
        [
            "fuel_category",
            "fuel_type",
            "allocation_transaction_type",
            "provision_of_the_act",
            "fuel_code",
        ],
    )


@pytest.mark.anyio
async def test_update_allocation_agreement(allocation_agreement_repo, mock_db_session):
    """Test version increment on update"""

    mock_agreement = MagicMock(spec=AllocationAgreement)
    mock_agreement.group_uuid = "group-1"
    mock_agreement.version = 2
    mock_agreement.action_type = ActionTypeEnum.UPDATE

    mock_db_session.merge = AsyncMock(return_value=mock_agreement)
    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    result = await allocation_agreement_repo.update_allocation_agreement(mock_agreement)

    assert result.version == 2
    assert result.action_type == ActionTypeEnum.UPDATE
    mock_db_session.merge.assert_called_once_with(mock_agreement)
