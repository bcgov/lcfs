from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models import Organization
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
    InitiativeAgreementStatus,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementCreateSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementUpdateSchema,
)
from lcfs.web.api.initiative_agreement.services import (
    InitiativeAgreementServices,
)
from lcfs.web.api.internal_comment.services import InternalCommentService


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_initiative_agreement_by_id = AsyncMock()
    repo.get_initiative_agreement_status_by_name = AsyncMock()
    repo.create_initiative_agreement = AsyncMock()
    repo.update_initiative_agreement = AsyncMock()
    repo.add_initiative_agreement_history = AsyncMock()
    repo.update_initiative_agreement_history = AsyncMock()
    repo.refresh_initiative_agreement = AsyncMock()
    return repo


@pytest.fixture
def mock_org_service():
    service = MagicMock()
    service.adjust_balance = AsyncMock()
    return service


@pytest.fixture
def mock_internal_comment_service():
    service = MagicMock(spec=InternalCommentService)
    service.create_internal_comment = AsyncMock()
    return service


@pytest.fixture
def mock_request(mock_user_profile):
    mock_user_profile.role_names = [RoleEnum.DIRECTOR]
    request = MagicMock()
    request.user = mock_user_profile
    return request


@pytest.fixture
def service(mock_repo, mock_org_service, mock_internal_comment_service, mock_request):
    return InitiativeAgreementServices(
        repo=mock_repo,
        org_service=mock_org_service,
        internal_comment_service=mock_internal_comment_service,
        request=mock_request,
    )


@pytest.mark.anyio
async def test_get_initiative_agreement(service, mock_repo):
    mock_agreement = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=150,
        to_organization_id=3,
        to_organization=Organization(name="name", organization_id=3),
        current_status=InitiativeAgreementStatus(
            status="Status", initiative_agreement_status_id=1
        ),
        create_date=datetime.now(),
    )
    mock_repo.get_initiative_agreement_by_id.return_value = mock_agreement

    result = await service.get_initiative_agreement(1)

    assert isinstance(result, InitiativeAgreementSchema)
    mock_repo.get_initiative_agreement_by_id.assert_called_once_with(1)


@pytest.mark.anyio
async def test_create_initiative_agreement(service, mock_repo, mock_request):
    mock_status = MagicMock(status=InitiativeAgreementStatusEnum.Recommended)
    mock_repo.get_initiative_agreement_status_by_name.return_value = mock_status
    mock_repo.create_initiative_agreement.return_value = MagicMock(
        spec=InitiativeAgreement
    )

    create_data = InitiativeAgreementCreateSchema(
        compliance_units=150,
        current_status="Recommended",
        transaction_effective_date=datetime.now().date(),
        to_organization_id=3,
        gov_comment="Initial setup of the initiative agreement.",
        internal_comment=None,
    )

    result = await service.create_initiative_agreement(create_data)

    assert isinstance(result, InitiativeAgreement)
    mock_repo.create_initiative_agreement.assert_called_once()


@pytest.mark.anyio
async def test_update_initiative_agreement(service, mock_repo, mock_request):
    mock_agreement = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=150,
        to_organization_id=3,
        to_organization=Organization(name="name", organization_id=3),
        current_status=InitiativeAgreementStatus(
            status="Status", initiative_agreement_status_id=1
        ),
        create_date=datetime.now(),
    )
    mock_status = MagicMock(status=InitiativeAgreementStatusEnum.Approved)
    mock_repo.get_initiative_agreement_by_id.return_value = mock_agreement
    mock_repo.get_initiative_agreement_status_by_name.return_value = mock_status
    mock_repo.update_initiative_agreement.return_value = mock_agreement

    update_data = InitiativeAgreementUpdateSchema(
        initiative_agreement_id=1,
        compliance_units=150,
        current_status="Approved",
        transaction_effective_date=datetime.now().date(),
        to_organization_id=3,
        gov_comment="Updated initiative agreement.",
    )

    result = await service.update_initiative_agreement(update_data)

    assert isinstance(result, InitiativeAgreementSchema)
    mock_repo.update_initiative_agreement.assert_called_once()


@pytest.mark.anyio
async def test_director_approve_initiative_agreement(
    service, mock_repo, mock_org_service, mock_request
):
    mock_agreement = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=150,
        to_organization_id=3,
        to_organization=Organization(name="name", organization_id=3),
        current_status=InitiativeAgreementStatus(
            status="Status", initiative_agreement_status_id=1
        ),
        create_date=datetime.now(),
    )

    await service.director_approve_initiative_agreement(mock_agreement)

    mock_org_service.adjust_balance.assert_called_once()
    mock_repo.refresh_initiative_agreement.assert_called_once_with(mock_agreement)


@pytest.mark.anyio
async def test_non_director_approve_initiative_agreement(
    service, mock_repo, mock_org_service, mock_request
):
    service.request.user.role_names = [RoleEnum.SUPPLIER]

    mock_agreement = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=150,
        to_organization_id=3,
        to_organization=Organization(name="name", organization_id=3),
        current_status=InitiativeAgreementStatus(
            status="Status", initiative_agreement_status_id=1
        ),
        create_date=datetime.now(),
    )

    mock_request.user.user_roles = []

    with pytest.raises(HTTPException):
        await service.director_approve_initiative_agreement(mock_agreement)
