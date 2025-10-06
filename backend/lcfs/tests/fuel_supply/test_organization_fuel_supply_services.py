import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime

from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    OrganizationFuelSuppliesSchema,
    PaginationRequestSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices


@pytest.fixture
def organization_fuel_supply_service():
    """Fixture to set up FuelSupplyServices with mocked repository"""
    mock_repo = MagicMock(spec=FuelSupplyRepository)
    service = FuelSupplyServices(repo=mock_repo)
    return service, mock_repo


@pytest.mark.anyio
async def test_get_organization_fuel_supply_success(organization_fuel_supply_service):
    """Test successful retrieval of organization fuel supply data with analytics"""
    service, mock_repo = organization_fuel_supply_service

    organization_id = 1
    pagination = PaginationRequestSchema(page=1, size=10, filters=[])

    # Mock fuel supply data
    mock_fuel_supply_1 = MagicMock()
    mock_fuel_supply_1.fuel_supply_id = 1
    mock_fuel_supply_1.compliance_period = "2023"
    mock_fuel_supply_1.report_submission_date = datetime(2023, 3, 31)
    mock_fuel_supply_1.fuel_type = "Diesel"
    mock_fuel_supply_1.fuel_category = "Petroleum-based"
    mock_fuel_supply_1.provision_of_the_act = "Default carbon intensity - section 19 (b) (ii)"
    mock_fuel_supply_1.fuel_code = None
    mock_fuel_supply_1.fuel_quantity = 50000
    mock_fuel_supply_1.units = "L"
    mock_fuel_supply_1.compliance_report_id = 101

    mock_fuel_supply_2 = MagicMock()
    mock_fuel_supply_2.fuel_supply_id = 2
    mock_fuel_supply_2.compliance_period = "2023"
    mock_fuel_supply_2.report_submission_date = datetime(2023, 3, 31)
    mock_fuel_supply_2.fuel_type = "Gasoline"
    mock_fuel_supply_2.fuel_category = "Petroleum-based"
    mock_fuel_supply_2.provision_of_the_act = "Fuel code - section 19 (b) (i)"
    mock_fuel_supply_2.fuel_code = "BCLCF123.1"
    mock_fuel_supply_2.fuel_quantity = 75000
    mock_fuel_supply_2.units = "L"
    mock_fuel_supply_2.compliance_report_id = 101

    mock_fuel_supplies = [mock_fuel_supply_1, mock_fuel_supply_2]
    total_count = 2

    # Mock analytics data
    mock_analytics = {
        "total_volume": 125000,
        "total_fuel_types": 2,
        "total_reports": 1,
        "most_recent_submission": "2023-03-31",
        "total_by_fuel_type": {"Diesel": 50000, "Gasoline": 75000},
        "total_by_year": {"2023": 125000},
        "total_by_fuel_category": {"Petroleum-based": 125000},
        "total_by_provision": {
            "Default carbon intensity - section 19 (b) (ii)": 50000,
            "Fuel code - section 19 (b) (i)": 75000
        }
    }

    # Configure mock repository methods
    mock_repo.get_organization_fuel_supply_paginated = AsyncMock(
        return_value=(mock_fuel_supplies, total_count)
    )
    mock_repo.get_organization_fuel_supply_analytics = AsyncMock(
        return_value=mock_analytics
    )

    # Execute service method
    response = await service.get_organization_fuel_supply(organization_id, pagination)

    # Assertions
    assert isinstance(response, OrganizationFuelSuppliesSchema)
    assert len(response.fuel_supplies) == 2
    assert response.fuel_supplies[0].fuel_supply_id == 1
    assert response.fuel_supplies[0].fuel_type == "Diesel"
    assert response.fuel_supplies[0].fuel_quantity == 50000
    assert response.fuel_supplies[1].fuel_supply_id == 2
    assert response.fuel_supplies[1].fuel_type == "Gasoline"
    assert response.fuel_supplies[1].fuel_code == "BCLCF123.1"

    # Analytics assertions
    assert response.analytics.total_volume == 125000
    assert response.analytics.total_fuel_types == 2
    assert response.analytics.total_reports == 1
    assert response.analytics.most_recent_submission == "2023-03-31"
    assert response.analytics.total_by_fuel_type == {"Diesel": 50000, "Gasoline": 75000}
    assert response.analytics.total_by_year == {"2023": 125000}

    # Pagination assertions
    assert response.pagination.page == 1
    assert response.pagination.size == 10
    assert response.pagination.total == 2
    assert response.pagination.total_pages == 1

    # Verify repository methods were called correctly
    mock_repo.get_organization_fuel_supply_paginated.assert_awaited_once_with(
        organization_id, pagination
    )
    mock_repo.get_organization_fuel_supply_analytics.assert_awaited_once_with(
        organization_id, None
    )


@pytest.mark.anyio
async def test_get_organization_fuel_supply_with_filters(organization_fuel_supply_service):
    """Test organization fuel supply retrieval with year filter"""
    service, mock_repo = organization_fuel_supply_service

    organization_id = 1
    filters = [{"field": "compliancePeriod", "filter": "2023", "type": "text"}]
    pagination = PaginationRequestSchema(page=1, size=10, filters=filters)

    mock_fuel_supplies = []
    total_count = 0
    mock_analytics = {
        "total_volume": 0,
        "total_fuel_types": 0,
        "total_reports": 0,
        "most_recent_submission": None,
        "total_by_fuel_type": {},
        "total_by_year": {},
        "total_by_fuel_category": {},
        "total_by_provision": {}
    }

    mock_repo.get_organization_fuel_supply_paginated = AsyncMock(
        return_value=(mock_fuel_supplies, total_count)
    )
    mock_repo.get_organization_fuel_supply_analytics = AsyncMock(
        return_value=mock_analytics
    )

    response = await service.get_organization_fuel_supply(organization_id, pagination)

    assert len(response.fuel_supplies) == 0
    assert response.analytics.total_volume == 0
    assert response.pagination.total == 0
    assert response.pagination.total_pages == 0

    # Verify filters were passed to analytics
    mock_repo.get_organization_fuel_supply_analytics.assert_awaited_once_with(
        organization_id, filters
    )


@pytest.mark.anyio
async def test_get_organization_fuel_supply_pagination(organization_fuel_supply_service):
    """Test pagination calculations for organization fuel supply"""
    service, mock_repo = organization_fuel_supply_service

    organization_id = 1
    pagination = PaginationRequestSchema(page=2, size=5, filters=[])

    # Mock 13 total records, requesting page 2 with size 5
    mock_fuel_supplies = []
    for i in range(5):
        mock_supply = MagicMock()
        mock_supply.fuel_supply_id = i + 6  # Second page: items 6-10
        mock_supply.compliance_period = "2023"
        mock_supply.report_submission_date = datetime(2023, 3, 31)
        mock_supply.fuel_type = f"Fuel Type {i+6}"
        mock_supply.fuel_category = "Renewable"
        mock_supply.provision_of_the_act = "Test Provision"
        mock_supply.fuel_code = None
        mock_supply.fuel_quantity = 1000 * (i + 6)
        mock_supply.units = "L"
        mock_supply.compliance_report_id = 101
        mock_fuel_supplies.append(mock_supply)

    total_count = 13

    mock_analytics = {
        "total_volume": 13000,
        "total_fuel_types": 5,
        "total_reports": 1,
        "most_recent_submission": "2023-03-31",
        "total_by_fuel_type": {},
        "total_by_year": {"2023": 13000},
        "total_by_fuel_category": {"Renewable": 13000},
        "total_by_provision": {"Test Provision": 13000}
    }

    mock_repo.get_organization_fuel_supply_paginated = AsyncMock(
        return_value=(mock_fuel_supplies, total_count)
    )
    mock_repo.get_organization_fuel_supply_analytics = AsyncMock(
        return_value=mock_analytics
    )

    response = await service.get_organization_fuel_supply(organization_id, pagination)

    # Pagination assertions
    assert response.pagination.page == 2
    assert response.pagination.size == 5
    assert response.pagination.total == 13
    assert response.pagination.total_pages == 3  # ceil(13 / 5) = 3
    assert len(response.fuel_supplies) == 5


@pytest.mark.anyio
async def test_get_organization_fuel_supply_null_submission_date(organization_fuel_supply_service):
    """Test handling of null submission date in fuel supply data"""
    service, mock_repo = organization_fuel_supply_service

    organization_id = 1
    pagination = PaginationRequestSchema(page=1, size=10, filters=[])

    mock_fuel_supply = MagicMock()
    mock_fuel_supply.fuel_supply_id = 1
    mock_fuel_supply.compliance_period = "2023"
    mock_fuel_supply.report_submission_date = None  # Null submission date
    mock_fuel_supply.fuel_type = "Diesel"
    mock_fuel_supply.fuel_category = "Petroleum-based"
    mock_fuel_supply.provision_of_the_act = "Test Provision"
    mock_fuel_supply.fuel_code = None
    mock_fuel_supply.fuel_quantity = 50000
    mock_fuel_supply.units = "L"
    mock_fuel_supply.compliance_report_id = 101

    mock_analytics = {
        "total_volume": 50000,
        "total_fuel_types": 1,
        "total_reports": 0,
        "most_recent_submission": None,
        "total_by_fuel_type": {"Diesel": 50000},
        "total_by_year": {"2023": 50000},
        "total_by_fuel_category": {"Petroleum-based": 50000},
        "total_by_provision": {"Test Provision": 50000}
    }

    mock_repo.get_organization_fuel_supply_paginated = AsyncMock(
        return_value=([mock_fuel_supply], 1)
    )
    mock_repo.get_organization_fuel_supply_analytics = AsyncMock(
        return_value=mock_analytics
    )

    response = await service.get_organization_fuel_supply(organization_id, pagination)

    assert response.fuel_supplies[0].report_submission_date is None
    assert response.analytics.most_recent_submission is None
