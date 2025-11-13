from datetime import date

from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import HTTPException

from lcfs.db.models import LevelOfEquipment, Organization
from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.final_supply_equipment.schema import (
    LevelOfEquipmentSchema,
    FinalSupplyEquipmentsSchema,
)
from lcfs.web.api.final_supply_equipment.services import FinalSupplyEquipmentServices
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.api.fuel_supply.schema import EndUseTypeSchema


@pytest.fixture
def mock_request():
    """
    Return a mock request with a user/organization attached.
    """
    user = MagicMock()
    user.organization = MagicMock()
    user.organization.organization_code = "TESTORG"

    request = MagicMock()
    request.user = user
    return request


@pytest.fixture
def mock_repo():
    """
    Return an AsyncMock for the FinalSupplyEquipmentRepository.
    """
    return AsyncMock()


@pytest.fixture
def mock_comp_report_repo():
    """
    Return an AsyncMock for the ComplianceReportRepository.
    """
    return AsyncMock()


@pytest.fixture
def mock_org_repo():
    """
    Return an AsyncMock for the OrganizationRepository.
    """
    return AsyncMock()


@pytest.fixture
def service(mock_request, mock_repo, mock_comp_report_repo, mock_org_repo):
    """
    Instantiate the service class with mocked dependencies.
    """
    return FinalSupplyEquipmentServices(
        repo=mock_repo,
        compliance_report_repo=mock_comp_report_repo,
        organization_repo=mock_org_repo,
    )


@pytest.fixture(autouse=True)
def mock_roles(fastapi_app, set_mock_user):
    """
    Global fixture to mock user roles for each test.
    Even though we aren't calling FastAPI endpoints,
    this keeps consistency with your overall test setup.
    """
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])


@pytest.mark.anyio
async def test_get_fse_options_success(service, mock_repo, mock_request):
    """
    Test get_fse_options returns expected data from repo call.
    """
    # Mock return value: 5-tuple of intended_use_types, levels_of_equipment, ...
    mock_repo.get_fse_options.return_value = (
        [
            EndUseTypeSchema(type="end_use_1", end_use_type_id=1),
            EndUseTypeSchema(type="end_use_2", end_use_type_id=2),
        ],
        [
            LevelOfEquipmentSchema(
                name="Level1", level_of_equipment_id=1, display_order=1
            ),
            LevelOfEquipmentSchema(
                name="Level2", level_of_equipment_id=2, display_order=2
            ),
        ],
        [EndUserTypeSchema(type_name="end_user_1", end_user_type_id=1)],
        [MagicMock(value="port1"), MagicMock(value="port2")],
        ["OrgA", "OrgB"],
    )

    result = await service.get_fse_options(mock_request.user)
    assert "intended_use_types" in result
    assert "levels_of_equipment" in result
    assert "intended_user_types" in result
    assert "ports" in result
    assert "organization_names" in result

    mock_repo.get_fse_options.assert_awaited_once_with(mock_request.user.organization)


@pytest.mark.anyio
async def test_get_fse_options_exception(service, mock_repo, mock_request):
    """
    Test get_fse_options raises HTTP 400 if repo call fails.
    """
    mock_repo.get_fse_options.side_effect = Exception("Repo Error")

    with pytest.raises(HTTPException, match="Error retrieving FSE options") as exc:
        await service.get_fse_options(mock_request.user)

    assert exc.value.status_code == 400


@pytest.mark.anyio
async def test_convert_to_fse_model(
    service, mock_repo, valid_final_supply_equipment_create_schema
):
    """
    Test that convert_to_fse_model properly maps to FinalSupplyEquipment instance.
    """
    # Mock level/user lookups
    mock_repo.get_level_of_equipment_by_name.return_value = LevelOfEquipment(
        name="Level2"
    )
    mock_repo.get_intended_use_by_name.side_effect = [
        MagicMock(type="Public"),
        MagicMock(type="Fleet"),
    ]
    mock_repo.get_intended_user_by_name.side_effect = [
        MagicMock(type_name="General Public"),
        MagicMock(type_name="VIP"),
    ]

    valid_final_supply_equipment_create_schema.intended_use_types = ["Public", "Fleet"]
    valid_final_supply_equipment_create_schema.intended_user_types = [
        "General Public",
        "VIP",
    ]

    fse_model = await service.convert_to_fse_model(
        valid_final_supply_equipment_create_schema
    )
    assert isinstance(fse_model, FinalSupplyEquipment)
    assert fse_model.serial_nbr == "SER123"
    assert fse_model.level_of_equipment.name == "Level2"
    assert len(fse_model.intended_use_types) == 2
    assert len(fse_model.intended_user_types) == 2


@pytest.mark.anyio
async def test_get_fse_list_success(service, mock_repo, valid_final_supply_equipment):
    """
    Test get_fse_list returns the correct schema with FSE data.
    """
    mock_repo.get_fse_list.return_value = [
        valid_final_supply_equipment,
        valid_final_supply_equipment,
    ]

    result = await service.get_fse_list(compliance_report_id=999)
    assert len(result.final_supply_equipments) == 2
    mock_repo.get_fse_list.assert_awaited_once_with(999)


@pytest.mark.anyio
async def test_get_final_supply_equipments_paginated(
    service, mock_repo, valid_final_supply_equipment
):
    """
    Test that paginated retrieval returns expected data and pagination info.
    """
    mock_repo.get_fse_paginated.return_value = (
        [valid_final_supply_equipment, valid_final_supply_equipment],
        10,
    )

    PaginationRequest = MagicMock(page=1, size=5)  # Simple mock input

    result = await service.get_final_supply_equipments_paginated(PaginationRequest, 999)
    assert len(result.final_supply_equipments) == 2
    assert result.pagination.page == 1
    assert result.pagination.size == 5
    assert result.pagination.total == 10
    assert result.pagination.total_pages == 2  # ceil(10 / 5)

    mock_repo.get_fse_paginated.assert_awaited_once_with(PaginationRequest, 999)


@pytest.mark.anyio
async def test_update_final_supply_equipment_success(
    service,
    mock_repo,
    valid_final_supply_equipment_schema,
    valid_final_supply_equipment_create_schema,
    valid_final_supply_equipment,
):
    """
    Test updating an existing FSE with valid data.
    """
    existing_fse = MagicMock()
    existing_fse.level_of_equipment.name = "OldLevel"
    mock_repo.get_final_supply_equipment_by_id.return_value = existing_fse
    mock_repo.get_level_of_equipment_by_name.return_value = MagicMock(name="NewLevel")
    mock_repo.update_final_supply_equipment.return_value = valid_final_supply_equipment

    updated_fse = await service.update_final_supply_equipment(
        valid_final_supply_equipment_create_schema
    )
    assert updated_fse is not None
    mock_repo.get_final_supply_equipment_by_id.assert_awaited_once_with(1)
    mock_repo.update_final_supply_equipment.assert_awaited_once()


@pytest.mark.anyio
async def test_update_final_supply_equipment_not_found(
    service, mock_repo, valid_final_supply_equipment_create_schema
):
    """
    Test updating an FSE that does not exist raises ValueError.
    """
    mock_repo.get_final_supply_equipment_by_id.return_value = None

    with pytest.raises(ValueError, match="final supply equipment not found"):
        await service.update_final_supply_equipment(
            valid_final_supply_equipment_create_schema
        )


@pytest.mark.anyio
async def test_create_final_supply_equipment_success(
    service,
    mock_repo,
    mock_org_repo,
    mock_request,
    valid_final_supply_equipment,
    valid_final_supply_equipment_schema,
    valid_final_supply_equipment_create_schema,
):
    """
    Test creating a new FSE with valid data.
    """
    mock_repo.get_current_seq_by_org_and_postal_code.return_value = 0
    organization_id = 10
    mock_repo.create_final_supply_equipment.return_value = valid_final_supply_equipment
    mock_repo.increment_seq_by_org_and_postal_code.return_value = None
    mock_org_repo.get_organization.return_value = MagicMock(spec=Organization)

    new_fse = await service.create_final_supply_equipment(
        valid_final_supply_equipment_create_schema, organization_id
    )
    assert new_fse is not None
    mock_repo.create_final_supply_equipment.assert_awaited_once()
    mock_repo.increment_seq_by_org_and_postal_code.assert_awaited_once()
    mock_org_repo.get_organization.assert_awaited_once_with(organization_id)


@pytest.mark.anyio
async def test_delete_final_supply_equipment_success(service, mock_repo):
    """
    Test successful deletion of an FSE.
    """
    mock_repo.delete_final_supply_equipment.return_value = "Deleted"
    result = await service.delete_final_supply_equipment(999)
    assert result == "Deleted"
    mock_repo.delete_final_supply_equipment.assert_awaited_once_with(999)


@pytest.mark.anyio
async def test_generate_registration_number_success(service, mock_repo, mock_request):
    """
    Test generating a registration number with a valid postal code.
    """
    mock_repo.get_current_seq_by_org_and_postal_code.return_value = 1
    reg_num = await service.generate_registration_number("TESTORG", "A1A 1A1")
    # Format => ORGCODE-A1A1A1-002 (for next_number = 2)
    assert reg_num.startswith("TESTORG-A1A1A1-")
    seq_str = reg_num.split("-")[-1]
    assert seq_str == "002"  # Because current seq was 1, next is 2


@pytest.mark.anyio
async def test_generate_registration_number_invalid_postal(service, mock_request):
    """
    Test invalid postal code raises HTTP 400.
    """
    with pytest.raises(ValueError, match="Invalid Canadian postal code format"):
        await service.generate_registration_number(mock_request.user, "12345")


@pytest.mark.anyio
async def test_generate_registration_number_exceeds_limit(
    service, mock_repo, mock_request
):
    """
    Test exceeding maximum registration numbers raises ValueError.
    """
    mock_repo.get_current_seq_by_org_and_postal_code.return_value = 999

    with pytest.raises(
        ValueError,
        match="Exceeded maximum registration numbers for the given postal code",
    ):
        await service.generate_registration_number(mock_request.user, "A1A 1A1")


@pytest.mark.anyio
async def test_search_manufacturers_success(service, mock_repo):
    """
    Test successful search for manufacturers.
    """
    mock_repo.search_manufacturers.return_value = ["Maker1", "Maker2"]
    results = await service.search_manufacturers("mak")
    assert results == ["Maker1", "Maker2"]
    mock_repo.search_manufacturers.assert_awaited_once_with("mak")


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success(service, mock_comp_report_repo):
    """
    Test fetching existing compliance report.
    """
    mock_comp_report_repo.get_compliance_report_schema_by_id.return_value = MagicMock(
        id=123
    )
    report = await service.get_compliance_report_by_id(123)
    assert report.id == 123
    mock_comp_report_repo.get_compliance_report_schema_by_id.assert_awaited_once_with(
        123
    )


@pytest.mark.anyio
async def test_get_compliance_report_by_id_not_found(service, mock_comp_report_repo):
    """
    Test 404 is raised for missing compliance report.
    """
    mock_comp_report_repo.get_compliance_report_schema_by_id.return_value = None
    with pytest.raises(HTTPException, match="Compliance report not found") as exc:
        await service.get_compliance_report_by_id(99999)
    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_copy_fse_between_reports(
    service,
    mock_repo,
    mock_comp_report_repo,
    mock_org_repo,
    valid_final_supply_equipment,
):
    """
    Tests copying FSE's from one report to another
    """

    mock_repo.get_fse_list.return_value = [valid_final_supply_equipment]
    mock_repo.create_final_supply_equipment.return_value = valid_final_supply_equipment
    mock_repo.get_current_seq_by_org_and_postal_code.return_value = 1
    mock_org_repo.get_organization.return_value = MagicMock(spec=Organization)

    await service.copy_to_report(1, 2, 1)

    mock_repo.get_fse_list.assert_awaited_once()
    mock_repo.create_final_supply_equipment.assert_awaited_once()
    mock_repo.increment_seq_by_org_and_postal_code.assert_awaited_once()
    mock_org_repo.get_organization.assert_awaited_once_with(1)


@pytest.mark.anyio
async def test_get_fse_reporting_list_paginated_success(
    service, mock_repo, mock_comp_report_repo
):
    """Test successful retrieval of paginated FSE reporting list"""
    mock_data = [
        {
            "charging_equipment_id": 1,
            "serial_number": "SER123",
            "manufacturer": "TestMfg",
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
            "compliance_report_id": 10,
            "compliance_report_group_uuid": "uuid-1234",
            "charging_site_id": 1,
            "site_name": "Test Site",
            "city": "Test City",
            "postal_code": "V1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "level_of_equipment": "Level 2",
        }
    ]
    mock_repo.get_fse_reporting_list_paginated.return_value = (mock_data, 1)
    mock_comp_report_repo.get_compliance_report_by_id.return_value = MagicMock(
        compliance_report_group_uuid="uuid-1234"
    )
    
    pagination = MagicMock(page=1, size=10, filters=[])
    result = await service.get_fse_reporting_list_paginated(1, pagination, 10, "current")
    
    assert "finalSupplyEquipments" in result
    assert "pagination" in result
    assert result["pagination"].total == 1
    mock_repo.get_fse_reporting_list_paginated.assert_awaited_once_with(1, pagination, "uuid-1234", "current")


@pytest.mark.anyio
async def test_create_fse_reporting_batch_success(
    service, mock_repo
):
    """Test successful creation of FSE reporting batch"""
    mock_repo.create_fse_reporting_batch.return_value = {"message": "Success"}
    
    data = [
        MagicMock(model_dump=lambda: {
            "charging_equipment_id": 1,
            "compliance_report_id": 10,
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
        })
    ]
    
    result = await service.create_fse_reporting_batch(data)
    
    assert result["message"] == "Success"
    mock_repo.create_fse_reporting_batch.assert_awaited_once()


@pytest.mark.anyio
async def test_update_fse_reporting_success(
    service, mock_repo
):
    """Test successful update of FSE reporting"""
    mock_repo.update_fse_reporting.return_value = {"id": 1, "kwh_usage": 1500.0}
    
    data = MagicMock(model_dump=lambda: {"kwh_usage": 1500.0})
    result = await service.update_fse_reporting(1, data)
    
    assert result["id"] == 1
    assert result["kwh_usage"] == 1500.0
    mock_repo.update_fse_reporting.assert_awaited_once_with(1, {"kwh_usage": 1500.0})


@pytest.mark.anyio
async def test_delete_fse_reporting_success(
    service, mock_repo
):
    """Test successful deletion of FSE reporting"""
    mock_repo.delete_fse_reporting.return_value = None
    
    await service.delete_fse_reporting(1)
    
    mock_repo.delete_fse_reporting.assert_awaited_once_with(1)


@pytest.mark.anyio
async def test_delete_fse_reporting_batch_success(
    service, mock_repo
):
    """Test successful batch deletion of FSE reporting"""
    mock_repo.delete_fse_reporting_batch.return_value = 2
    
    result = await service.delete_fse_reporting_batch([1, 2])
    
    assert "message" in result
    assert "2 FSE reporting records deleted successfully" in result["message"]
    mock_repo.delete_fse_reporting_batch.assert_awaited_once_with([1, 2])


@pytest.mark.anyio
async def test_set_default_dates_fse_reporting_success(
    service, mock_repo
):
    """Test successful setting of default dates for FSE reporting"""
    mock_repo.bulk_update_reporting_dates.return_value = 3
    
    data = MagicMock(
        equipment_ids=[1, 2, 3],
        supply_from_date="2024-01-01",
        supply_to_date="2024-12-31"
    )
    
    result = await service.set_default_dates_fse_reporting(data, 5)
    
    assert result["updated"] == 3
    mock_repo.bulk_update_reporting_dates.assert_awaited_once_with(data)


@pytest.mark.anyio
async def test_set_default_dates_fse_reporting_empty_equipment_ids(
    service, mock_repo
):
    """Test setting default dates with empty equipment IDs"""
    data = MagicMock(equipment_ids=[])
    
    result = await service.set_default_dates_fse_reporting(data, 5)
    
    assert result["created"] == 0
    assert result["updated"] == 0
    mock_repo.bulk_update_reporting_dates.assert_not_awaited()


@pytest.mark.anyio
async def test_set_default_dates_fse_reporting_missing_dates(
    service, mock_repo
):
    """Test setting default dates with missing supply dates"""
    data = MagicMock(
        equipment_ids=[1, 2],
        supply_from_date=None,
        supply_to_date="2024-12-31"
    )
    
    with pytest.raises(HTTPException) as exc_info:
        await service.set_default_dates_fse_reporting(data, 5)
    
    assert exc_info.value.status_code == 400
    assert "Supply from and to dates are required" in exc_info.value.detail
