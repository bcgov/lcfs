from unittest import mock

from unittest.mock import AsyncMock, patch

import pytest
from datetime import date

from lcfs.db.models.compliance.ComplianceReport import (
    SupplementalInitiatorType,
    ComplianceReport,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from httpx import AsyncClient
from fastapi import FastAPI

from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.organization.services import OrganizationService
from lcfs.web.api.user.services import UserServices
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.organization.validation import OrganizationValidation

from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.schema import ChainedComplianceReportSchema


@pytest.mark.anyio
async def test_get_org_users_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_organization_services,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

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
    set_mock_user,
    mock_user_services,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

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
    set_mock_user,
    mock_user_services,
):
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS])

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
    mock_user_services.create_user.assert_awaited_once()
    assert mock_user_services.create_user.call_args[0][0].organization_id == 1


_CREATE_USER_PAYLOAD = {
    "title": "testuser",
    "keycloak_username": "testuser",
    "keycloak_email": "testuser@example.com",
    "first_name": "test",
    "last_name": "test",
    "is_active": True,
    "roles": ["supplier", "manage_users", "signing_authority"],
}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles",
    [
        [RoleEnum.SUPPLIER],
        [RoleEnum.READ_ONLY],
        [RoleEnum.COMPLIANCE_REPORTING],
        [RoleEnum.SIGNING_AUTHORITY, RoleEnum.TRANSFER],
    ],
)
async def test_create_user_without_manage_users_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_user_services,
    roles,
):
    """Only Manage Users holders can create users in their organization."""
    set_mock_user(fastapi_app, roles, {"organization_id": 1})
    fastapi_app.dependency_overrides[UserServices] = lambda: mock_user_services

    url = fastapi_app.url_path_for("create_user", organization_id=1)
    response = await client.post(url, json=_CREATE_USER_PAYLOAD)

    assert response.status_code == 403
    mock_user_services.create_user.assert_not_awaited()


@pytest.mark.anyio
async def test_create_user_manage_users_other_org_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_user_services,
):
    """Manage Users cannot create users in a different organization."""
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 99})
    fastapi_app.dependency_overrides[UserServices] = lambda: mock_user_services

    url = fastapi_app.url_path_for("create_user", organization_id=1)
    response = await client.post(url, json=_CREATE_USER_PAYLOAD)

    assert response.status_code == 403
    mock_user_services.create_user.assert_not_awaited()


@pytest.mark.anyio
async def test_get_transactions_paginated_for_org_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_organization_services,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

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
    set_mock_user,
    mock_transactions_services,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_transactions_services.export_transactions.return_value = {"streaming": True}

    fastapi_app.dependency_overrides[TransactionsService] = (
        lambda: mock_transactions_services
    )

    params = {"format": "xls"}
    url = fastapi_app.url_path_for("export_transactions_for_org")

    response = await client.post(
        url,
        params=params,
    )

    assert response.status_code == 200


@pytest.mark.anyio
async def test_create_transfer_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_transfer_services,
    mock_organization_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

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
    set_mock_user,
    mock_transfer_services,
    mock_organization_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

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

    data = response.json()

    assert "transferId" in data
    assert data["transferId"] == 1


@pytest.mark.anyio
async def test_create_compliance_report_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_compliance_report_services,
    mock_organization_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

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
        "organization": {
            "organization_id": 1,
            "organization_code": "ABC123",
            "name": "org1",
        },
        "current_status_id": 1,
        "current_status": {"compliance_report_status_id": 1, "status": "status"},
        "summary": {
            "summary_id": 1,
            "is_locked": False,
            "line_11_fossil_derived_base_fuel_total": 0.0,
            "line_21_non_compliance_penalty_payable": 0.0,
        },
        "compliance_report_group_uuid": "uuid",
        "version": 0,
        "supplemental_initiator": SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
        "has_supplemental": False,
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
    set_mock_user,
    mock_compliance_report_services,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

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
    set_mock_user,
    mock_compliance_report_services,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

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
    set_mock_user,
    mock_compliance_report_services,
    compliance_report_base_schema,
):
    # Mock user setup
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    # Define the URL for the endpoint
    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id",
        organization_id=1,
        report_id=1,
    )

    # Mock the compliance report service's method
    mock_compliance_report_services.get_compliance_report_by_id.return_value = ChainedComplianceReportSchema(
        report={
            "compliance_report_id": 1,
            "compliance_period_id": 1,
            "compliance_period": {"compliance_period_id": 1, "description": "2024"},
            "organization_id": 1,
            "organization": {
                "organization_id": 1,
                "organization_code": "ABC123",
                "name": "org1",
            },
            "current_status_id": 1,
            "current_status": {"compliance_report_status_id": 1, "status": "status"},
            "summary": {
                "summary_id": 1,
                "is_locked": False,
                "line_11_fossil_derived_base_fuel_total": 0.0,
                "line_21_non_compliance_penalty_payable": 0.0,
            },
            "compliance_report_group_uuid": "uuid",
            "version": 0,
            "supplemental_initiator": SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
            "has_supplemental": False,
        },
        chain=[],
        isNewest=True,
    )

    # Make the chain call return the same serialisable object
    mock_compliance_report_services.get_compliance_report_chain.return_value = (
        mock_compliance_report_services.get_compliance_report_by_id.return_value
    )

    mock_compliance_report_validation = AsyncMock()
    mock_compliance_report_validation.validate_organization_access.return_value = (
        ComplianceReport()
    )
    mock_compliance_report_validation.validate_compliance_report_access.return_value = (
        None
    )

    # Override dependencies in the FastAPI app
    fastapi_app.dependency_overrides[ComplianceReportServices] = (
        lambda: mock_compliance_report_services
    )
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )

    # Make the request
    response = await client.get(url)

    # Assertions
    assert response.status_code == 200
    mock_compliance_report_services.get_compliance_report_chain.assert_awaited_once_with(
        1, mock.ANY
    )
    mock_compliance_report_validation.validate_organization_access.assert_awaited_once_with(
        1
    )
    mock_compliance_report_validation.validate_compliance_report_access.assert_awaited_once_with(
        mock.ANY
    )


_UPDATE_USER_PAYLOAD = {
    "title": "Mr",
    "keycloak_username": "testuser",
    "keycloak_email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
    "is_active": True,
    "phone": None,
    "mobile_phone": None,
    "organization_id": 1,
    "role_names": [],
}

_USER_RESPONSE = {
    "user_profile_id": 42,
    "keycloak_username": "testuser",
    "keycloak_email": "testuser@example.com",
    "is_active": True,
    "first_name": "Test",
    "last_name": "User",
    "title": "Mr",
    "phone": None,
    "mobile_phone": None,
    "organization_id": 1,
    "roles": [],
}


@pytest.mark.anyio
async def test_update_user_supplier_own_org_succeeds(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_user_services,
):
    """A supplier with MANAGE_USERS can update a user in their own org."""
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 1})

    mock_user_services.update_user_and_notify.return_value = {
        **_USER_RESPONSE,
        "account_change_email_sent": True,
    }
    fastapi_app.dependency_overrides[UserServices] = lambda: mock_user_services

    url = fastapi_app.url_path_for("update_user", organization_id=1, user_id=42)
    response = await client.put(url, json=_UPDATE_USER_PAYLOAD)

    assert response.status_code == 200
    assert response.json()["userProfileId"] == 42
    assert response.json()["accountChangeEmailSent"] is True
    mock_user_services.update_user_and_notify.assert_awaited_once()


@pytest.mark.anyio
async def test_update_user_supplier_other_org_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """A supplier with MANAGE_USERS cannot update a user in a different org."""
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 99})

    url = fastapi_app.url_path_for("update_user", organization_id=1, user_id=42)
    response = await client.put(url, json=_UPDATE_USER_PAYLOAD)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_update_user_supplier_no_organization_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """A supplier with no organization object set cannot update users."""
    # Use org_id=0 so that the mock auth creates an org with id=0,
    # which doesn't match organization_id=1 in the URL.
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 0})

    url = fastapi_app.url_path_for("update_user", organization_id=1, user_id=42)
    response = await client.put(url, json=_UPDATE_USER_PAYLOAD)

    assert response.status_code == 403


async def _org_user(add_models):
    """A user profile in organization 1 that has not signed in yet."""
    user = UserProfile(
        keycloak_username="org.member",
        keycloak_email="org.member@example.com",
        email="org.member@example.com",
        first_name="Org",
        last_name="Member",
        title="Analyst",
        is_active=True,
        organization_id=1,
    )
    await add_models([user])
    return user


def _org_user_payload(user, **changes):
    return {
        "title": user.title,
        "keycloak_username": user.keycloak_username,
        "keycloak_email": user.keycloak_email,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": True,
        "roles": [],
        **changes,
    }


@pytest.mark.anyio
@pytest.mark.parametrize(
    "changes",
    [
        {"keycloak_username": "someone.else"},
        {"keycloak_email": "someone.else@example.com"},
    ],
)
async def test_update_user_supplier_cannot_change_login_identity(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
    dbsession,
    changes,
):
    """Manage Users cannot change a same-org user's login username or email."""
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 1})
    user = await _org_user(add_models)

    url = fastapi_app.url_path_for(
        "update_user", organization_id=1, user_id=user.user_profile_id
    )
    response = await client.put(url, json=_org_user_payload(user, **changes))

    assert response.status_code == 403
    await dbsession.refresh(user)
    assert user.keycloak_username == "org.member"
    assert user.keycloak_email == "org.member@example.com"


@pytest.mark.anyio
async def test_update_user_supplier_keeps_login_identity_on_edit(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
    dbsession,
):
    """Resubmitting the stored identity (any case) still saves other fields."""
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS], {"organization_id": 1})
    user = await _org_user(add_models)

    url = fastapi_app.url_path_for(
        "update_user", organization_id=1, user_id=user.user_profile_id
    )
    payload = _org_user_payload(
        user,
        keycloak_username="Org.Member",
        first_name="Renamed",
    )
    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        response = await client.put(url, json=payload)

    assert response.status_code == 200
    await dbsession.refresh(user)
    assert user.first_name == "Renamed"
    assert user.keycloak_username == "org.member"
