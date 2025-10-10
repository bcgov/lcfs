import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.api.fuel_supply.schema import (
    OrganizationFuelSuppliesSchema,
    OrganizationFuelSupplySchema,
    FuelSupplyAnalyticsSchema,
    PaginationResponseSchema,
)


@pytest.fixture
def mock_fuel_supply_service():
    """Mock FuelSupplyServices for testing"""
    return MagicMock(spec=FuelSupplyServices)


@pytest.mark.anyio
async def test_get_organization_fuel_supply_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    """Test successful retrieval of organization fuel supply as government user"""
    # Set up government user with proper permissions
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_organization_fuel_supply",
        organization_id=organization_id
    )

    # Create mock response data
    mock_response = OrganizationFuelSuppliesSchema(
        fuel_supplies=[
            OrganizationFuelSupplySchema(
                fuel_supply_id=1,
                compliance_period="2023",
                report_submission_date="2023-03-31",
                fuel_type="Diesel",
                fuel_category="Petroleum-based",
                provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
                fuel_code=None,
                fuel_quantity=50000,
                units="L",
                compliance_report_id=101,
            ),
            OrganizationFuelSupplySchema(
                fuel_supply_id=2,
                compliance_period="2023",
                report_submission_date="2023-03-31",
                fuel_type="Gasoline",
                fuel_category="Petroleum-based",
                provision_of_the_act="Fuel code - section 19 (b) (i)",
                fuel_code="BCLCF123.1",
                fuel_quantity=75000,
                units="L",
                compliance_report_id=101,
            ),
        ],
        analytics=FuelSupplyAnalyticsSchema(
            total_volume=125000,
            total_fuel_types=2,
            total_reports=1,
            most_recent_submission="2023-03-31",
            total_by_fuel_type={"Diesel": 50000, "Gasoline": 75000},
            total_by_year={"2023": 125000},
            total_by_fuel_category={"Petroleum-based": 125000},
            total_by_provision={
                "Default carbon intensity - section 19 (b) (ii)": 50000,
                "Fuel code - section 19 (b) (i)": 75000,
            },
        ),
        pagination=PaginationResponseSchema(
            page=1,
            size=10,
            total=2,
            total_pages=1,
        ),
    )

    # Configure mock service
    mock_fuel_supply_service.get_organization_fuel_supply = AsyncMock(
        return_value=mock_response
    )

    # Override dependency
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    # Make request
    payload = {"page": 1, "size": 10, "filters": []}
    response = await client.post(url, json=payload)

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Verify fuel supplies
    assert len(data["fuelSupplies"]) == 2
    assert data["fuelSupplies"][0]["fuelSupplyId"] == 1
    assert data["fuelSupplies"][0]["fuelType"] == "Diesel"
    assert data["fuelSupplies"][0]["fuelQuantity"] == 50000
    assert data["fuelSupplies"][1]["fuelSupplyId"] == 2
    assert data["fuelSupplies"][1]["fuelCode"] == "BCLCF123.1"

    # Verify analytics
    assert data["analytics"]["totalVolume"] == 125000
    assert data["analytics"]["totalFuelTypes"] == 2
    assert data["analytics"]["totalReports"] == 1
    assert data["analytics"]["mostRecentSubmission"] == "2023-03-31"
    assert data["analytics"]["totalByFuelType"]["Diesel"] == 50000
    assert data["analytics"]["totalByYear"]["2023"] == 125000

    # Verify pagination
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["size"] == 10
    assert data["pagination"]["total"] == 2
    assert data["pagination"]["totalPages"] == 1

    # Verify service was called correctly
    mock_fuel_supply_service.get_organization_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_get_organization_fuel_supply_with_year_filter(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    """Test organization fuel supply with year filter applied"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_organization_fuel_supply",
        organization_id=organization_id
    )

    # Mock filtered response (2023 only)
    mock_response = OrganizationFuelSuppliesSchema(
        fuel_supplies=[
            OrganizationFuelSupplySchema(
                fuel_supply_id=1,
                compliance_period="2023",
                report_submission_date="2023-03-31",
                fuel_type="Diesel",
                fuel_category="Petroleum-based",
                provision_of_the_act="Default carbon intensity",
                fuel_code=None,
                fuel_quantity=50000,
                units="L",
                compliance_report_id=101,
            )
        ],
        analytics=FuelSupplyAnalyticsSchema(
            total_volume=50000,
            total_fuel_types=1,
            total_reports=1,
            most_recent_submission="2023-03-31",
            total_by_fuel_type={"Diesel": 50000},
            total_by_year={"2023": 50000},
            total_by_fuel_category={"Petroleum-based": 50000},
            total_by_provision={"Default carbon intensity": 50000},
        ),
        pagination=PaginationResponseSchema(page=1, size=10, total=1, total_pages=1),
    )

    mock_fuel_supply_service.get_organization_fuel_supply = AsyncMock(
        return_value=mock_response
    )

    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    # Make request with year filter
    payload = {
        "page": 1,
        "size": 10,
        "filters": [
            {
                "field": "compliancePeriod",
                "filter": "2023",
                "type": "text",
                "filter_type": "equals"
            }
        ],
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["fuelSupplies"]) == 1
    assert data["fuelSupplies"][0]["compliancePeriod"] == "2023"
    assert data["analytics"]["totalByYear"]["2023"] == 50000


@pytest.mark.anyio
async def test_get_organization_fuel_supply_unauthorized(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """Test that non-government users cannot access organization fuel supply"""
    # Set user with supplier role (not government)
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_organization_fuel_supply",
        organization_id=organization_id
    )

    payload = {"page": 1, "size": 10, "filters": []}
    response = await client.post(url, json=payload)

    # Should return 403 Forbidden
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_organization_fuel_supply_empty_results(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    """Test organization fuel supply with no data"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    organization_id = 999  # Organization with no fuel supply data
    url = fastapi_app.url_path_for(
        "get_organization_fuel_supply",
        organization_id=organization_id
    )

    # Mock empty response
    mock_response = OrganizationFuelSuppliesSchema(
        fuel_supplies=[],
        analytics=FuelSupplyAnalyticsSchema(
            total_volume=0,
            total_fuel_types=0,
            total_reports=0,
            most_recent_submission=None,
            total_by_fuel_type={},
            total_by_year={},
            total_by_fuel_category={},
            total_by_provision={},
        ),
        pagination=PaginationResponseSchema(page=1, size=10, total=0, total_pages=0),
    )

    mock_fuel_supply_service.get_organization_fuel_supply = AsyncMock(
        return_value=mock_response
    )

    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    payload = {"page": 1, "size": 10, "filters": []}
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["fuelSupplies"]) == 0
    assert data["analytics"]["totalVolume"] == 0
    assert data["analytics"]["totalFuelTypes"] == 0
    assert data["analytics"]["mostRecentSubmission"] is None
    assert data["pagination"]["total"] == 0


@pytest.mark.anyio
async def test_get_organization_fuel_supply_pagination(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    """Test pagination parameters for organization fuel supply"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_organization_fuel_supply",
        organization_id=organization_id
    )

    # Mock response for page 2, size 5
    mock_fuel_supplies = [
        OrganizationFuelSupplySchema(
            fuel_supply_id=i,
            compliance_period="2023",
            report_submission_date="2023-03-31",
            fuel_type=f"Fuel Type {i}",
            fuel_category="Renewable",
            provision_of_the_act="Test Provision",
            fuel_code=None,
            fuel_quantity=1000 * i,
            units="L",
            compliance_report_id=101,
        )
        for i in range(6, 11)  # Items 6-10 for page 2
    ]

    mock_response = OrganizationFuelSuppliesSchema(
        fuel_supplies=mock_fuel_supplies,
        analytics=FuelSupplyAnalyticsSchema(
            total_volume=40000,
            total_fuel_types=5,
            total_reports=1,
            most_recent_submission="2023-03-31",
            total_by_fuel_type={},
            total_by_year={"2023": 40000},
            total_by_fuel_category={"Renewable": 40000},
            total_by_provision={"Test Provision": 40000},
        ),
        pagination=PaginationResponseSchema(
            page=2,
            size=5,
            total=13,
            total_pages=3  # ceil(13/5)
        ),
    )

    mock_fuel_supply_service.get_organization_fuel_supply = AsyncMock(
        return_value=mock_response
    )

    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    # Request page 2 with size 5
    payload = {"page": 2, "size": 5, "filters": []}
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["page"] == 2
    assert data["pagination"]["size"] == 5
    assert data["pagination"]["total"] == 13
    assert data["pagination"]["totalPages"] == 3
    assert len(data["fuelSupplies"]) == 5
