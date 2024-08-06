import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.web.api.organizations.schema import OrganizationListSchema, OrganizationStatusEnum, OrganizationSummaryResponseSchema, OrganizationTypeEnum


@pytest.mark.anyio
async def test_export_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("export_organizations")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Content-Type"] == "application/vnd.ms-excel"


@pytest.mark.anyio
async def test_export_unauthorized_access(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Analyst"])
    url = fastapi_app.url_path_for("export_organizations")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_organization_by_id_idir_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organization", organization_id=1)
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_organization_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organization", organization_id=100)
    response = await client.get(url)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_organization_by_id_bceid_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_organization", organization_id=1)
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_create_organization_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("create_organization")
    payload = {
        "name": "Test Organizationa",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_update_organization_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("update_organization", organization_id=1)
    payload = {
        "name": "Test Organizationa",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }
    response = await client.put(url, json=payload)

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_update_organization_failure(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("update_organization", organization_id=100)
    payload = {
        "name": "Test Organizationa",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }
    response = await client.put(url, json=payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_organizations_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organizations")
    response = await client.post(
        url, json={"page": 1, "size": 5, "sortOrders": [], "filters": []}
    )

    data = OrganizationListSchema(**response.json())
    assert data.pagination.size == 5
    assert data.pagination.page == 1
    assert len(data.organizations) > 0
    assert data.organizations[0].org_type.org_type == OrganizationTypeEnum.FUEL_SUPPLIER
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_get_organization_statuses_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organization_statuses")
    response = await client.get(url)    
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_get_organization_types_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organization_types")
    response = await client.get(url)    
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_get_organization_names(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organization_names")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all("name" in org for org in data)

@pytest.mark.anyio
async def test_get_externally_registered_organizations(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_externally_registered_organizations")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    for org in data:
        org_model = OrganizationSummaryResponseSchema(**org)
        assert org_model.organization_id is not None
        assert org_model.org_status.status == OrganizationStatusEnum.REGISTERED

@pytest.mark.anyio
async def test_get_balances(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    organization_id = 1  # Assuming this organization exists
    url = fastapi_app.url_path_for("get_balances", organization_id=organization_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data.organization_id == organization_id
    assert data.name is not None
    assert data.total_balance >= 0
    assert data.reserved_balance >= 0

@pytest.mark.anyio
async def test_get_current_balances(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_balances")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data.name is not None
    assert data.total_balance >= 0
    assert data.reserved_balance >= 0

@pytest.mark.anyio
async def test_create_organization_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("create_organization")
    payload = {
        "name": "Test Organization",
        "operatingName": "Test Operating name",
        "email": "test@example.com",
        "phone": "1234567890",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 1,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Address",
            "streetAddress": "123 Test St",
            "city": "Test City",
            "provinceState": "Test Province",
            "country": "Test Country",
            "postalcodeZipcode": "12345"
        },
        "attorneyAddress": {
            "name": "Test Attorney Address",
            "streetAddress": "456 Attorney St",
            "city": "Attorney City",
            "provinceState": "Attorney Province",
            "country": "Attorney Country",
            "postalcodeZipcode": "67890"
        }
    }
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.anyio
async def test_get_balances_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    organization_id = 1
    url = fastapi_app.url_path_for("get_balances", organization_id=organization_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN
