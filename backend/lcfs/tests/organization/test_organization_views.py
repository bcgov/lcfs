import pytest
from datetime import date
from lcfs.db.models.user.Role import RoleEnum
from httpx import AsyncClient
from fastapi import FastAPI

from lcfs.web.api.organization.services import OrganizationService
from lcfs.web.api.user.services import UserServices
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.organization.validation import OrganizationValidation

from lcfs.web.api.compliance_report.services import ComplianceReportServices


@pytest.mark.anyio
async def test_get_org_users_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_organization_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    mock_organization_services.get_organization_users_list.return_value = {
        "pagination": {"total": 0, "page": 1, "size": 5, "totalPages": 1},
        "users": [],
    }

    fastapi_app.dependency_overrides[OrganizationService] = (
        lambda: mock_organization_services
    )

    params = {"status": "Active"}
    payload = {"page": 1, "size": 10, "sort_orders": [], "filters": []}
    url = fastapi_app.url_path_for("get_org_users", organization_id=1)

    response = await client.post(
        url,
        params=params,
        json=payload,
    )

    assert response.status_code == 200

    data = response.json()

    assert "users" in data
    assert isinstance(data["users"], list)


@pytest.mark.anyio
async def test_get_user_by_id_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_user_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    user_id = 1
    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_user_by_id", organization_id=organization_id, user_id=user_id
    )

    mock_user_services.get_user_by_id.return_value = {
        "user_profile_id": user_id,
        "keycloak_username": "testuser",
        "keycloak_email": "testuser@example.com",
        "is_active": True,
    }

    fastapi_app.dependency_overrides[UserServices] = lambda: mock_user_services

    response = await client.get(url)

    assert response.status_code == 200

    data = response.json()

    assert "userProfileId" in data
    assert data["userProfileId"] == user_id
    assert data["keycloakUsername"] == "testuser"
    assert data["keycloakEmail"] == "testuser@example.com"


@pytest.mark.anyio
async def test_create_user_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_user_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for("create_user", organization_id=1)

    payload = {
        "title": "testuser",
        "keycloak_username": "testuser",
        "keycloak_email": "testuser@example.com",
        "first_name": "test",
        "last_name": "test",
        "is_active": True,
    }

    mock_user_services.create_user.return_value = "User created successfully"

    fastapi_app.dependency_overrides[UserServices] = lambda: mock_user_services

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 201


@pytest.mark.anyio
async def test_get_transactions_paginated_for_org_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_organization_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    mock_organization_services.get_transactions_paginated.return_value = {
        "transactions": [],
        "pagination": {"total": 0, "page": 1, "size": 5, "totalPages": 1},
    }

    fastapi_app.dependency_overrides[OrganizationService] = (
        lambda: mock_organization_services
    )

    payload = {"page": 1, "size": 10, "sort_orders": [], "filters": []}
    url = fastapi_app.url_path_for("get_transactions_paginated_for_org")

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 200


@pytest.mark.anyio
async def test_export_transactions_for_org_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_transactions_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    mock_transactions_services.export_transactions.return_value = {"streaming": True}

    fastapi_app.dependency_overrides[TransactionsService] = (
        lambda: mock_transactions_services
    )

    params = {"format": "xls"}
    url = fastapi_app.url_path_for("export_transactions_for_org")

    response = await client.get(
        url,
        params=params,
    )

    assert response.status_code == 200


@pytest.mark.anyio
async def test_create_transfer_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_transfer_services,
    mock_organization_validation,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    organization_id = 1
    url = fastapi_app.url_path_for("create_transfer", organization_id=organization_id)

    payload = {"from_organization_id": 1, "to_organization_id": 2}

    mock_organization_validation.create_transfer.return_value = None
    mock_transfer_services.create_transfer.return_value = {
        "transfer_id": 1,
        "from_organization": {"organization_id": 1, "name": "org1"},
        "to_organization": {"organization_id": 2, "name": "org2"},
        "agreement_date": date.today(),
        "quantity": 1,
        "price_per_unit": 1,
        "current_status": {"transfer_status_id": 1, "status": "status"},
    }

    fastapi_app.dependency_overrides[OrganizationValidation] = (
        lambda: mock_organization_validation
    )
    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 201


@pytest.mark.anyio
async def test_update_transfer_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_transfer_services,
    mock_organization_validation,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for("update_transfer", organization_id=1, transfer_id=1)

    payload = {"from_organization_id": 1, "to_organization_id": 2}

    mock_organization_validation.update_transfer.return_value = None
    mock_transfer_services.update_transfer.return_value = {
        "transfer_id": 1,
        "from_organization": {"organization_id": 1, "name": "org1"},
        "to_organization": {"organization_id": 2, "name": "org2"},
        "agreement_date": date.today(),
        "quantity": 1,
        "price_per_unit": 1,
        "current_status": {"transfer_status_id": 1, "status": "status"},
    }

    fastapi_app.dependency_overrides[OrganizationValidation] = (
        lambda: mock_organization_validation
    )
    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services

    response = await client.put(
        url,
        json=payload,
    )

    assert response.status_code == 201

    # data = response.json()

    # assert "id" in data
    # assert data["transfer_type"] == "typeB"
    # assert data["amount"] == 2000


@pytest.mark.anyio
async def test_create_compliance_report_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_compliance_report_services,
    mock_organization_validation,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "create_compliance_report", organization_id=organization_id
    )

    payload = {"compliance_period": "2024", "organization_id": 1, "status": "status"}

    mock_organization_validation.create_compliance_report.return_value = None
    mock_compliance_report_services.create_compliance_report.return_value = {
        "compliance_report_id": 1,
        "compliance_period_id": 1,
        "compliance_period": {"compliance_period_id": 1, "description": "2024"},
        "organization_id": 1,
        "organization": {"organization_id": 1, "name": "org1"},
        "current_status_id": 1,
        "current_status": {"compliance_report_status_id": 1, "status": "status"},
        "summary": {"summary_id": 1, "is_locked": False},
    }

    fastapi_app.dependency_overrides[OrganizationValidation] = (
        lambda: mock_organization_validation
    )
    fastapi_app.dependency_overrides[ComplianceReportServices] = (
        lambda: mock_compliance_report_services
    )

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 201


@pytest.mark.anyio
async def test_get_compliance_reports_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_compliance_report_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for("get_compliance_reports", organization_id=1)

    mock_compliance_report_services.get_compliance_reports_paginated.return_value = {
        "pagination": {"total": 1, "page": 1, "size": 10, "totalPages": 1},
        "reports": [],
    }

    fastapi_app.dependency_overrides[ComplianceReportServices] = (
        lambda: mock_compliance_report_services
    )

    payload = {"page": 1, "size": 10, "sort_orders": [], "filters": []}

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_all_org_reported_years_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_compliance_report_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for("get_all_org_reported_years", organization_id=1)

    mock_compliance_report_services.get_all_org_reported_years.return_value = [
        {"compliance_period_id": 1, "description": "2024"}
    ]

    fastapi_app.dependency_overrides[ComplianceReportServices] = (
        lambda: mock_compliance_report_services
    )

    response = await client.get(url)

    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_compliance_report_services,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id",
        organization_id=1,
        report_id=1,
    )

    mock_compliance_report_services.get_compliance_report_by_id.return_value = {
        "compliance_report_id": 1,
        "compliance_period_id": 1,
        "compliance_period": {"compliance_period_id": 1, "description": "2024"},
        "organization_id": 1,
        "organization": {"organization_id": 1, "name": "org1"},
        "current_status_id": 1,
        "current_status": {"compliance_report_status_id": 1, "status": "status"},
        "summary": {"summary_id": 1, "is_locked": False},
    }

    fastapi_app.dependency_overrides[ComplianceReportServices] = (
        lambda: mock_compliance_report_services
    )

    response = await client.get(url)

    assert response.status_code == 200