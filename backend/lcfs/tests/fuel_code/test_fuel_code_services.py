from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from lcfs.web.api.fuel_code.schema import FuelCodeGroupDetailSchema
from lcfs.web.api.fuel_code.services import FuelCodeServices


@pytest.fixture
def repo():
    return AsyncMock()


@pytest.fixture
def service(repo):
    return FuelCodeServices(repo=repo, notification_service=AsyncMock())


def _fuel_code(**overrides):
    base = dict(
        fuel_code_id=100,
        fuel_status_id=3,
        prefix_id=1,
        fuel_suffix="100.2",
        company="Fuel Producer Ltd.",
        contact_name="Taylor Smith",
        contact_email="taylor@example.com",
        carbon_intensity=47.12,
        edrms="EDRMS-100",
        last_updated=datetime(2026, 6, 1, tzinfo=timezone.utc),
        application_date=date(2026, 1, 10),
        approval_date=date(2026, 2, 10),
        effective_date=date(2026, 3, 1),
        expiration_date=None,
        fuel_type_id=1,
        feedstock="Canola oil",
        feedstock_location="Saskatchewan, Canada",
        feedstock_misc=None,
        co_processed="No",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_province_state="BC",
        fuel_production_facility_country="Canada",
        facility_nameplate_capacity=1000000,
        facility_nameplate_capacity_unit="Litres",
        former_company=None,
        notes="Approved pathway",
        fuel_code_status=SimpleNamespace(fuel_code_status_id=3, status="Approved"),
        fuel_code_prefix=SimpleNamespace(fuel_code_prefix_id=1, prefix="C-BCLCF-"),
        fuel_type=None,
        feedstock_fuel_transport_modes=[],
        finished_fuel_transport_modes=[],
        group_uuid="group-100",
        version=2,
        action_type="UPDATE",
        is_notes_required=False,
        can_edit_ci=True,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _iteration(fuel_code_id, suffix, status="Approved", carbon_intensity=47.12):
    return SimpleNamespace(
        fuel_code_id=fuel_code_id,
        fuel_code_prefix_id=1,
        prefix="C-BCLCF-",
        fuel_suffix=suffix,
        fuel_code_status_id=3,
        status=status,
        fuel_type_id=1,
        fuel_type="Diesel",
        company="Fuel Producer Ltd.",
        contact_name="Taylor Smith",
        contact_email="taylor@example.com",
        carbon_intensity=carbon_intensity,
        edrms=f"EDRMS-{fuel_code_id}",
        last_updated=datetime(2026, 6, 1, tzinfo=timezone.utc),
        application_date=datetime(2026, 1, 10, tzinfo=timezone.utc),
        approval_date=datetime(2026, 2, 10, tzinfo=timezone.utc),
        create_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2026, 3, 1, tzinfo=timezone.utc),
        expiration_date=None,
        feedstock="Canola oil",
        feedstock_location="Saskatchewan, Canada",
    )


@pytest.mark.anyio
async def test_get_fuel_code_group_detail_returns_iterations_and_volume(service, repo):
    repo.get_fuel_code_group_detail.return_value = (
        _fuel_code(),
        [
            _iteration(100, "100.2", carbon_intensity=47.12),
            _iteration(99, "100.1", carbon_intensity=48.55),
        ],
        [
            SimpleNamespace(year="2025", total_volume=1234, total_compliance_units=56.5),
            SimpleNamespace(year="2026", total_volume=None, total_compliance_units=None),
        ],
    )

    result = await service.get_fuel_code_group_detail(100)

    assert isinstance(result, FuelCodeGroupDetailSchema)
    assert result.latest_iteration.fuel_code_id == 100
    assert result.latest_iteration.fuel_suffix == "100.2"
    assert [row.fuel_suffix for row in result.iterations] == ["100.2", "100.1"]
    assert result.volume_over_time[0].year == "2025"
    assert result.volume_over_time[0].total_volume == 1234.0
    assert result.volume_over_time[1].total_volume == 0.0
    assert result.compliance_units_over_time[0].year == "2025"
    assert result.compliance_units_over_time[0].total_compliance_units == 56.5
    assert result.compliance_units_over_time[1].total_compliance_units == 0.0
    repo.get_fuel_code_group_detail.assert_awaited_once_with(100)


@pytest.mark.anyio
async def test_get_fuel_code_group_detail_raises_404_when_missing(service, repo):
    repo.get_fuel_code_group_detail.return_value = (None, [], [])

    with pytest.raises(HTTPException) as exc:
        await service.get_fuel_code_group_detail(999)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Fuel code 999 not found"
