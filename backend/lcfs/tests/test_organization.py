import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.organizations.schema import (
    OrganizationBalanceResponseSchema,
    OrganizationListSchema,
    OrganizationStatusEnum,
    OrganizationSummaryResponseSchema,
)


@pytest.mark.anyio
async def test_export_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("export_organizations")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Content-Type"] == "application/vnd.ms-excel"


@pytest.mark.anyio
async def test_export_unauthorized_access(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("export_organizations")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_organization_by_id_idir_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organization", organization_id=1)
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_organization_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organization", organization_id=100)
    response = await client.get(url)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_organization_by_id_bceid_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_organization", organization_id=1)
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_create_organization_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    # Set mock user role for organization creation
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    payload = {
        "name": "Test Organization",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,  # Fuel supplier
        "hasEarlyIssuance": False,
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

    response = await create_organization(client, fastapi_app, payload)

    assert response.status_code == status.HTTP_201_CREATED

    # Verify the response contains organization type information
    data = response.json()
    assert "organizationId" in data


@pytest.mark.anyio
async def test_create_organization_with_different_types(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    """Test creating organizations with different organization types"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    test_cases = [
        {"type_id": 1, "expected_type": "fuel_supplier", "expected_bceid": True},
        {"type_id": 2, "expected_type": "aggregator", "expected_bceid": True},
        {"type_id": 3, "expected_type": "fuel_producer", "expected_bceid": False},
        {"type_id": 4, "expected_type": "exempted_supplier", "expected_bceid": False},
        {
            "type_id": 5,
            "expected_type": "initiative_agreement_holder",
            "expected_bceid": False,
        },
    ]

    for i, test_case in enumerate(test_cases):
        payload = {
            "name": f"Test Org Type {test_case['type_id']}",
            "operatingName": f"Test Org Type {test_case['type_id']} Op",
            "email": f"test{i}@gov.bc.ca",
            "phone": f"000000000{i}",
            "edrmsRecord": f"EDRMS{i}",
            "organizationStatusId": 2,
            "organizationTypeId": test_case["type_id"],
            "hasEarlyIssuance": False,
            "address": {
                "name": f"Test Org Type {test_case['type_id']} Op",
                "streetAddress": "123 Test Street",
                "addressOther": "",
                "city": "Victoria",
                "provinceState": "BC",
                "country": "Canada",
                "postalcodeZipcode": "V8W 2C3",
            },
            "attorneyAddress": {
                "name": f"Test Org Type {test_case['type_id']} Op",
                "streetAddress": "123 Test Street",
                "addressOther": "",
                "city": "Victoria",
                "provinceState": "BC",
                "country": "Canada",
                "postalcodeZipcode": "V8W 2C3",
            },
        }

        response = await create_organization(client, fastapi_app, payload)
        assert response.status_code == status.HTTP_201_CREATED

        # Get the created organization to verify the organization type
        data = response.json()
        org_id = data["organizationId"]

        get_url = fastapi_app.url_path_for("get_organization", organization_id=org_id)
        get_response = await client.get(get_url)
        assert get_response.status_code == status.HTTP_200_OK

        org_data = get_response.json()
        assert org_data["organizationTypeId"] == test_case["type_id"]
        assert org_data["orgType"]["orgType"] == test_case["expected_type"]
        assert org_data["orgType"]["isBceidUser"] == test_case["expected_bceid"]


@pytest.mark.anyio
async def test_create_organization_invalid_type(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    """Test creating organization with invalid organization type ID"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    payload = {
        "name": "Test Invalid Type Org",
        "operatingName": "Test Invalid Type Op",
        "email": "invalid@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS999",
        "organizationStatusId": 2,
        "organizationTypeId": 999,  # Invalid organization type ID
        "hasEarlyIssuance": False,
        "address": {
            "name": "Test Invalid Type Op",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Invalid Type Op",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }

    response = await create_organization(client, fastapi_app, payload)
    # Depending on validation strategy, could be 400/422 client error or 500 server error from DB FK violation
    assert response.status_code in [
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ]


@pytest.mark.anyio
async def test_update_organization_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    # Set mock user role for organization update.
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    payload = {
        "name": "Test Organization",
        "operatingName": "Test Operating name",
        "email": "organization@gov.bc.ca",
        "phone": "1111111111",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "hasEarlyIssuance": False,
        # Include credit market fields with safe default values
        "creditTradingEnabled": False,
        "creditMarketContactName": None,
        "creditMarketContactEmail": None,
        "creditMarketContactPhone": None,
        "creditMarketIsSeller": False,
        "creditMarketIsBuyer": False,
        "creditsToSell": 0,
        "displayInCreditMarket": False,
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

    response = await update_organization(client, fastapi_app, 1, payload)

    # Debug: Print response details if it fails
    if response.status_code != status.HTTP_200_OK:
        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.content}")
        print(f"Response text: {response.text}")

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_update_organization_failure(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    # Set mock user role for organization update
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    payload = {
        "name": "Test Organizationa",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "hasEarlyIssuance": False,
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
    response = await update_organization(client, fastapi_app, 100, payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_organizations_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organizations")
    response = await client.post(
        url, json={"page": 1, "size": 5, "sortOrders": [], "filters": []}
    )

    data = OrganizationListSchema(**response.json())
    assert data.pagination.size == 5
    assert data.pagination.page == 1
    assert len(data.organizations) > 0
    assert data.organizations[0].org_type.org_type == "fuel_supplier"
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_organization_statuses_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organization_statuses")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_organization_types_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organization_types")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # At least fuel supplier should exist

    # Verify fuel supplier exists with correct properties
    fuel_supplier = next(
        (org_type for org_type in data if org_type["organizationTypeId"] == 1), None
    )
    assert fuel_supplier is not None
    assert fuel_supplier["orgType"] == "fuel_supplier"
    assert fuel_supplier["description"] == "Fuel supplier"
    assert fuel_supplier["isBceidUser"] is True

    # Verify all organization types have required fields
    for org_type in data:
        assert "organizationTypeId" in org_type
        assert "orgType" in org_type
        assert "description" in org_type
        assert "isBceidUser" in org_type
        assert isinstance(org_type["isBceidUser"], bool)


@pytest.mark.anyio
async def test_get_organization_names(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_organization_names")

    # Test without any filters
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all("name" in org for org in data)

    # Test with specific statuses
    response = await client.get(url + "?statuses=Registered&statuses=Unregistered")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert all("name" in org for org in data)

    # Test with single status
    response = await client.get(url + "?statuses=Registered")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.anyio
async def test_get_externally_registered_organizations(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    organization_id = 1  # Assuming this organization exists
    url = fastapi_app.url_path_for("get_balances", organization_id=organization_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = OrganizationBalanceResponseSchema(**response.json())
    assert data.organization_id == organization_id
    assert data.name is not None
    assert data.total_balance >= 0
    assert data.reserved_balance >= 0


@pytest.mark.anyio
async def test_get_current_balances(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_balances")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = OrganizationBalanceResponseSchema(**response.json())
    assert data.name is not None
    assert data.total_balance >= 0
    assert data.reserved_balance >= 0


@pytest.mark.anyio
async def test_create_organization_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("create_organization")
    payload = {
        "name": "Test Organization",
        "operatingName": "Test Operating name",
        "email": "test@example.com",
        "phone": "1234567890",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 1,
        "organizationTypeId": 1,
        "hasEarlyIssuance": False,
        "address": {
            "name": "Test Address",
            "streetAddress": "123 Test St",
            "city": "Test City",
            "provinceState": "Test Province",
            "country": "Test Country",
            "postalcodeZipcode": "12345",
        },
        "attorneyAddress": {
            "name": "Test Attorney Address",
            "streetAddress": "456 Attorney St",
            "city": "Attorney City",
            "provinceState": "Attorney Province",
            "country": "Attorney Country",
            "postalcodeZipcode": "67890",
        },
    }
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_balances_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    organization_id = 1
    url = fastapi_app.url_path_for("get_balances", organization_id=organization_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


async def create_organization(
    client: AsyncClient,
    fastapi_app: FastAPI,
    payload: dict,
    # role: RoleEnum = RoleEnum.GOVERNMENT
) -> object:
    """Helper function to create an organization and return the response."""
    # set_mock_user([role])
    url = fastapi_app.url_path_for("create_organization")
    response = await client.post(url, json=payload)
    return response


async def update_organization(
    client: AsyncClient, fastapi_app: FastAPI, organization_id: int, payload: dict
) -> object:
    """Helper function to update an organization and return the response."""
    url = fastapi_app.url_path_for(
        "update_organization", organization_id=organization_id
    )
    response = await client.put(url, json=payload)
    return response
