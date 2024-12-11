import pytest
from unittest.mock import AsyncMock, MagicMock, Mock
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.base import UserTypeEnum
from lcfs.db.models.compliance import OtherUses
from lcfs.db.models.fuel import ProvisionOfTheAct, FuelCode
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.tests.other_uses.conftest import create_mock_entity


@pytest.fixture
def mock_query_result():
    # Setup mock for database query result chain
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.all = MagicMock(return_value=[MagicMock(spec=OtherUses)])
    return mock_result


@pytest.fixture
def mock_db_session(mock_query_result):
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=mock_query_result)
    return session


@pytest.fixture
def other_uses_repo(mock_db_session):
    repo = OtherUsesRepository(db=mock_db_session)
    repo.fuel_code_repo = MagicMock()
    repo.fuel_code_repo.get_fuel_categories = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_fuel_types = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_expected_use_types = AsyncMock(return_value=[])

    # Mock for local get_formatted_fuel_types method
    async def mock_get_formatted_fuel_types():
        mock_result = await mock_db_session.execute(AsyncMock())
        return mock_result.unique().scalars().all()

    repo.get_formatted_fuel_types = AsyncMock(side_effect=mock_get_formatted_fuel_types)

    return repo


@pytest.mark.anyio
async def test_get_table_options(other_uses_repo):
    # Mock the database session
    mock_db_session = AsyncMock()

    # Mock the return value of the `execute` calls
    mock_fuel_categories = [
        MagicMock(fuel_category_id=1, category="Petroleum-based"),
    ]
    mock_fuel_types = [
        MagicMock(
            fuel_type_id=1,
            fuel_type="Gasoline",
            default_carbon_intensity=12.34,
            units="L",
            unrecognized=False,
            fuel_instances=[
                MagicMock(
                    fuel_category=MagicMock(
                        fuel_category_id=1, category="Petroleum-based"
                    )
                )
            ],
            fuel_codes=[
                MagicMock(fuel_code_id=1, fuel_code="FC123", carbon_intensity=10.5)
            ],
            provision_1=MagicMock(provision_of_the_act_id=1, name="Provision A"),
            provision_2=None,
        )
    ]
    mock_expected_uses = [MagicMock(expected_use_id=1, name="Transportation")]
    mock_provisions_of_the_act = [
        MagicMock(provision_of_the_act_id=1, name="Provision A")
    ]
    mock_fuel_codes = [MagicMock(fuel_code_id=1, fuel_code="FuelCode123")]

    def mock_execute_side_effect(*args, **kwargs):
        query = args[0]  # Extract the query object

        # Match the ProvisionOfTheAct table
        if ProvisionOfTheAct.__tablename__ in str(query):
            return AsyncMock(scalars=MagicMock(all=lambda: mock_provisions_of_the_act))

        # Match the FuelCode table
        elif FuelCode.__tablename__ in str(query):
            return AsyncMock(scalars=MagicMock(all=lambda: mock_fuel_codes))

        # If no match, raise an informative error
        raise ValueError(f"Unexpected query: {query}")

    mock_db_session.execute.side_effect = mock_execute_side_effect

    # Create async mock for the fuel_code_repo's methods
    mock_fuel_code_repo = AsyncMock()
    mock_fuel_code_repo.get_fuel_categories = AsyncMock(
        return_value=mock_fuel_categories
    )
    mock_fuel_code_repo.get_formatted_fuel_types = AsyncMock(
        return_value=mock_fuel_types
    )
    mock_fuel_code_repo.get_expected_use_types = AsyncMock(
        return_value=mock_expected_uses
    )

    # Mock the repository's fuel_code_repo dependency
    other_uses_repo.fuel_code_repo = mock_fuel_code_repo
    other_uses_repo.db = (
        mock_db_session  # Assign the mock database session to the repository
    )

    # Execute the method under test
    result = await other_uses_repo.get_table_options()

    # Assertions
    assert isinstance(result, dict)
    assert "fuel_categories" in result
    assert "fuel_types" in result
    assert "units_of_measure" in result
    assert "expected_uses" in result
    assert "provisions_of_the_act" in result
    assert "fuel_codes" in result


@pytest.mark.anyio
async def test_get_other_uses(other_uses_repo, mock_db_session):
    compliance_report_id = 1
    mock_compliance_report_uuid = "mock_group_uuid"

    # Mock the first db.execute call for fetching compliance report group UUID
    mock_first_execute = MagicMock()
    mock_first_execute.scalar.return_value = mock_compliance_report_uuid

    # Mock related entities for other uses
    mock_fuel_type = MagicMock()
    mock_fuel_type.fuel_type = "Gasoline"

    mock_fuel_category = MagicMock()
    mock_fuel_category.category = "Petroleum-based"

    mock_expected_use = MagicMock()
    mock_expected_use.name = "Transportation"

    mock_provision_of_the_act = MagicMock()
    mock_provision_of_the_act.name = "Provision A"

    mock_fuel_code = MagicMock()
    mock_fuel_code.fuel_code = "FuelCode123"

    # Mock an instance of OtherUses
    mock_other_use = MagicMock()
    mock_other_use.other_uses_id = 1
    mock_other_use.compliance_report_id = compliance_report_id
    mock_other_use.quantity_supplied = 1000
    mock_other_use.fuel_type = mock_fuel_type
    mock_other_use.fuel_category = mock_fuel_category
    mock_other_use.expected_use = mock_expected_use
    mock_other_use.provision_of_the_act = mock_provision_of_the_act
    mock_other_use.fuel_code = mock_fuel_code
    mock_other_use.units = "L"
    mock_other_use.ci_of_fuel = 10.5
    mock_other_use.rationale = "Test rationale"
    mock_other_use.group_uuid = mock_compliance_report_uuid
    mock_other_use.version = 1
    mock_other_use.user_type = "Supplier"
    mock_other_use.action_type = "Create"

    mock_result_other_uses = [mock_other_use]

    # Mock the second db.execute call for fetching other uses
    mock_second_execute = MagicMock()
    mock_second_execute.unique.return_value.scalars.return_value.all.return_value = (
        mock_result_other_uses
    )

    # Assign side effects to return these mocked execute calls in sequence
    mock_db_session.execute = AsyncMock(
        side_effect=[mock_first_execute, mock_second_execute]
    )

    # Call the repository method
    result = await other_uses_repo.get_other_uses(compliance_report_id)

    # Assertions
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0].fuel_type == "Gasoline"
    assert result[0].fuel_category == "Petroleum-based"
    assert result[0].expected_use == "Transportation"
    assert result[0].provision_of_the_act == "Provision A"
    assert result[0].fuel_code == "FuelCode123"
    assert result[0].units == "L"
    assert result[0].ci_of_fuel == 10.5
    assert result[0].rationale == "Test rationale"


@pytest.mark.anyio
async def test_get_latest_other_uses_by_group_uuid(other_uses_repo, mock_db_session):
    group_uuid = "test-group-uuid"
    mock_other_use_gov = MagicMock(spec=OtherUses)
    mock_other_use_gov.user_type = UserTypeEnum.GOVERNMENT
    mock_other_use_gov.version = 2

    # Setup mock result chain
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.first = MagicMock(return_value=mock_other_use_gov)

    # Configure mock db session
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    other_uses_repo.db = mock_db_session

    result = await other_uses_repo.get_latest_other_uses_by_group_uuid(group_uuid)

    assert result.user_type == UserTypeEnum.GOVERNMENT
    assert result.version == 2

@pytest.mark.anyio
async def test_get_other_use_version_by_user(other_uses_repo, mock_db_session):
    group_uuid = "test-group-uuid"
    version = 2
    user_type = UserTypeEnum.SUPPLIER

    mock_other_use = MagicMock(spec=OtherUses)
    mock_other_use.group_uuid = group_uuid
    mock_other_use.version = version
    mock_other_use.user_type = user_type

    mock_db_session.execute.return_value.scalars.return_value.first.return_value = (
        mock_other_use
    )

    result = await other_uses_repo.get_other_use_version_by_user(
        group_uuid, version, user_type
    )

    assert result.group_uuid == group_uuid
    assert result.version == version
    assert result.user_type == user_type


@pytest.mark.anyio
async def test_update_other_use(other_uses_repo, mock_db_session):
    updated_other_use = create_mock_entity({})
    updated_other_use.quantity_supplied = 2000
    updated_other_use.fuel_type.fuel_type = "Diesel"
    updated_other_use.rationale = "Updated rationale"

    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()
    mock_db_session.merge.return_value = updated_other_use

    result = await other_uses_repo.update_other_use(updated_other_use)

    # Assertions
    assert isinstance(result, OtherUses)
    assert mock_db_session.flush.call_count == 1
