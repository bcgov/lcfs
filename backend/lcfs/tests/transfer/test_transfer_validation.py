import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.transfer.validation import TransferValidation


def _make_request(role_names):
    request = MagicMock()
    request.user = MagicMock()
    request.user.role_names = role_names
    return request


def _make_validation():
    org_repo = MagicMock()
    org_repo.is_registered_for_transfer = AsyncMock(return_value=True)
    return TransferValidation(request=None, org_repo=org_repo)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles",
    [
        pytest.param([RoleEnum.SUPPLIER], id="supplier"),
        pytest.param([RoleEnum.ANALYST], id="analyst"),
        pytest.param([], id="no-roles"),
    ],
)
async def test_government_update_transfer_rejects_non_government(roles):
    validation = _make_validation()
    request = _make_request(roles)
    transfer = TransferCreateSchema(
        from_organization_id=1,
        to_organization_id=2,
        current_status=TransferStatusEnum.Recommended,
    )

    with pytest.raises(HTTPException) as exc_info:
        await validation.government_update_transfer(request, transfer)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_government_update_transfer_allows_government_role():
    validation = _make_validation()
    request = _make_request([RoleEnum.GOVERNMENT])
    transfer = TransferCreateSchema(
        from_organization_id=1,
        to_organization_id=2,
        current_status=TransferStatusEnum.Recommended,
    )

    await validation.government_update_transfer(request, transfer)
