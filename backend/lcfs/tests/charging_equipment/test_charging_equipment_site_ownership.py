"""
Charging equipment can only be created at, or moved to, a charging site of the
caller's organization. Another organization's site reads as missing (404) and
nothing is created or moved.

These run against the database through the API.
"""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select

from lcfs.db.models import Organization
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingEquipmentStatus,
    ChargingSite,
    ChargingSiteStatus,
    LevelOfEquipment,
)
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.user.Role import RoleEnum


async def _scalar(dbsession, stmt):
    return (await dbsession.execute(stmt)).scalar_one()


async def _site(dbsession, add_models, organization_id, code):
    site = ChargingSite(
        organization_id=organization_id,
        status_id=await _scalar(
            dbsession,
            select(ChargingSiteStatus.charging_site_status_id).where(
                ChargingSiteStatus.status == "Draft"
            ),
        ),
        site_code=code,
        site_name=f"Site ownership {code}",
        street_address="1 Test Street",
        city="Victoria",
        postal_code="V8V 1A1",
    )
    await add_models([site])
    return site


@pytest.fixture
async def sites(dbsession, add_models):
    own_org, other_org = (
        (
            await dbsession.execute(
                select(Organization.organization_id)
                .order_by(Organization.organization_id)
                .limit(2)
            )
        )
        .scalars()
        .all()
    )

    own_site = await _site(dbsession, add_models, own_org, "OWNA")
    own_second_site = await _site(dbsession, add_models, own_org, "OWNB")
    other_site = await _site(dbsession, add_models, other_org, "OTHA")

    level_id = await _scalar(
        dbsession, select(LevelOfEquipment.level_of_equipment_id).limit(1)
    )
    equipment = ChargingEquipment(
        charging_site_id=own_site.charging_site_id,
        status_id=await _scalar(
            dbsession,
            select(ChargingEquipmentStatus.charging_equipment_status_id).where(
                ChargingEquipmentStatus.status == "Draft"
            ),
        ),
        equipment_number="001",
        serial_number="SN-SITE-OWN-001",
        manufacturer="Test manufacturer",
        level_of_equipment_id=level_id,
        latitude=48.4,
        longitude=-123.3,
    )
    await add_models([equipment])

    return SimpleNamespace(
        own_org=own_org,
        own_site=own_site,
        own_second_site=own_second_site,
        other_site=other_site,
        equipment=equipment,
        level_id=level_id,
        use_id=await _scalar(dbsession, select(EndUseType.end_use_type_id).limit(1)),
        user_id=await _scalar(dbsession, select(EndUserType.end_user_type_id).limit(1)),
    )


@pytest.fixture
def as_supplier(fastapi_app: FastAPI, set_mock_user, sites):
    def _sign_in():
        set_mock_user(
            fastapi_app,
            [RoleEnum.COMPLIANCE_REPORTING],
            {"organization_id": sites.own_org},
        )

    return _sign_in


def _create_body(sites, charging_site_id, serial):
    return {
        "chargingSiteId": charging_site_id,
        "serialNumber": serial,
        "manufacturer": "Test manufacturer",
        "levelOfEquipmentId": sites.level_id,
        "intendedUseIds": [sites.use_id],
        "intendedUserIds": [sites.user_id],
        "latitude": 48.4,
        "longitude": -123.3,
    }


async def _equipment_count_at(dbsession, charging_site_id):
    return await _scalar(
        dbsession,
        select(func.count()).where(
            ChargingEquipment.charging_site_id == charging_site_id
        ),
    )


async def _site_of(dbsession, charging_equipment_id):
    return await _scalar(
        dbsession,
        select(ChargingEquipment.charging_site_id).where(
            ChargingEquipment.charging_equipment_id == charging_equipment_id
        ),
    )


@pytest.mark.anyio
async def test_create_at_other_org_site_returns_404(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, sites, as_supplier
):
    as_supplier()

    url = fastapi_app.url_path_for("create_charging_equipment")
    response = await client.post(
        url,
        json=_create_body(sites, sites.other_site.charging_site_id, "SN-CROSS-ORG"),
    )

    assert response.status_code == 404
    assert await _equipment_count_at(dbsession, sites.other_site.charging_site_id) == 0


@pytest.mark.anyio
async def test_create_at_unknown_site_returns_404(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, sites, as_supplier
):
    as_supplier()

    url = fastapi_app.url_path_for("create_charging_equipment")
    response = await client.post(url, json=_create_body(sites, 987654321, "SN-NO-SITE"))

    assert response.status_code == 404


@pytest.mark.anyio
async def test_create_at_own_site_still_works(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, sites, as_supplier
):
    as_supplier()

    url = fastapi_app.url_path_for("create_charging_equipment")
    response = await client.post(
        url,
        json=_create_body(sites, sites.own_site.charging_site_id, "SN-OWN-NEW"),
    )

    assert response.status_code == 201
    assert response.json()["chargingSiteId"] == sites.own_site.charging_site_id


@pytest.mark.anyio
async def test_move_to_other_org_site_returns_404_and_keeps_site(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, sites, as_supplier
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "update_charging_equipment",
        charging_equipment_id=sites.equipment.charging_equipment_id,
    )
    response = await client.put(
        url, json={"chargingSiteId": sites.other_site.charging_site_id}
    )

    assert response.status_code == 404
    assert (
        await _site_of(dbsession, sites.equipment.charging_equipment_id)
        == sites.own_site.charging_site_id
    )


@pytest.mark.anyio
async def test_move_to_own_site_still_works(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, sites, as_supplier
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "update_charging_equipment",
        charging_equipment_id=sites.equipment.charging_equipment_id,
    )
    response = await client.put(
        url, json={"chargingSiteId": sites.own_second_site.charging_site_id}
    )

    assert response.status_code == 200
    assert (
        await _site_of(dbsession, sites.equipment.charging_equipment_id)
        == sites.own_second_site.charging_site_id
    )
