"""End-to-end tests for #4565: multi-select organization types and
per-organization available roles.

Relies on the pytest seed: organization 1 is a fuel supplier, so the
association seeder grants it Transfer + Compliance Reporting; its users hold
only the base Supplier role. User 4 belongs to organization 1.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.models.user.Role import RoleEnum


ORG_UPDATE_BASE = {
    "name": "LCFS Org 1",
    "operatingName": "LCFS Org 1",
    "email": "tfrs@gov.bc.ca",
    "phone": "000-555-1234",
    "edrmsRecord": "12345",
    "organizationStatusId": 2,
    "hasEarlyIssuance": False,
}


def org_user_payload(**overrides):
    payload = {
        "title": "Tester",
        "keycloakUsername": "org1-user",
        "keycloakEmail": "org1-user@test.com",
        "email": "org1-user@test.com",
        "firstName": "Org",
        "lastName": "User",
        "isActive": True,
        "roles": ["supplier"],
    }
    payload.update(overrides)
    return payload


@pytest.mark.anyio
async def test_create_org_returns_types_and_available_roles(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    payload = {
        "name": "Multi Type Org",
        "operatingName": "Multi Type Org",
        "email": "multi@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS-MT",
        "organizationStatusId": 2,
        "organizationTypeIds": [2, 1],  # aggregator + fuel supplier
        "availableRoles": ["Transfer", "Compliance Reporting"],
        "hasEarlyIssuance": False,
        "address": {
            "name": "Multi Type Org",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Multi Type Org",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }
    response = await client.post("/api/organizations/create", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    org_id = response.json()["organizationId"]

    get_response = await client.get(f"/api/organizations/{org_id}")
    assert get_response.status_code == status.HTTP_200_OK
    data = get_response.json()

    type_keys = {t["orgType"] for t in data["orgTypes"]}
    assert type_keys == {"fuel_supplier", "aggregator"}
    # Primary type (lowest display order = fuel supplier) is dual-written
    assert data["organizationTypeId"] == 1
    assert set(data["availableRoles"]) == {"Transfer", "Compliance Reporting"}


@pytest.mark.anyio
async def test_create_org_user_with_unavailable_role_rejected(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS])
    payload = org_user_payload(roles=["supplier", "ci applicant"])
    response = await client.post("/api/organization/1/users", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "CI Applicant" in response.json()["detail"]


@pytest.mark.anyio
async def test_create_org_user_with_available_roles_succeeds(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS])
    payload = org_user_payload(
        keycloakUsername="org1-user-ok",
        keycloakEmail="org1-user-ok@test.com",
        roles=["supplier", "transfer", "compliance reporting", "manage users"],
    )
    response = await client.post("/api/organization/1/users", json=payload)
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_update_org_user_with_unavailable_role_rejected(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    # Seeded user 5 (LCFS1_bat) belongs to organization 1
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.MANAGE_USERS])
    payload = org_user_payload(
        keycloakUsername="LCFS1_bat",
        keycloakEmail="tfrs@gov.bc.ca",
        roles=["supplier", "ia proponent"],
    )
    response = await client.put("/api/organization/1/users/5", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "IA Proponent" in response.json()["detail"]


@pytest.mark.anyio
async def test_withdrawing_role_removes_it_from_org_users(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.MANAGE_USERS])

    # Give seeded org-1 user 5 the Transfer role (available via seed defaults)
    grant = await client.put(
        "/api/organization/1/users/5",
        json=org_user_payload(
            keycloakUsername="LCFS1_bat",
            keycloakEmail="tfrs@gov.bc.ca",
            roles=["supplier", "transfer"],
        ),
    )
    assert grant.status_code == status.HTTP_200_OK

    # IDIR withdraws Transfer from the organization
    org_update = {
        **ORG_UPDATE_BASE,
        "organizationTypeIds": [1],
        "availableRoles": ["Compliance Reporting"],
    }
    response = await client.put("/api/organizations/1", json=org_update)
    assert response.status_code == status.HTTP_200_OK

    # The role is gone from the user automatically
    roles_response = await client.get("/api/users/5/roles")
    assert roles_response.status_code == status.HTTP_200_OK
    role_names = {r["name"] for r in roles_response.json()}
    assert "Transfer" not in role_names
    assert "Supplier" in role_names

    # And the org no longer offers it
    org_response = await client.get("/api/organizations/1")
    assert set(org_response.json()["availableRoles"]) == {"Compliance Reporting"}
