import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status


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
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)
