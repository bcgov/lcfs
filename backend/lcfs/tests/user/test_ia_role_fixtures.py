import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
@pytest.mark.parametrize("ia_role", [RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER])
async def test_mock_ia_idir_user_is_a_government_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, ia_role
):
    """
    An IDIR IA role must carry GOVERNMENT in the test harness, as it does in
    production. Without it a mock IA Analyst has no GOVERNMENT role while
    still carrying an organization, so any endpoint that branches on
    government-versus-supplier treats them as a BCeID org user and every IA
    permission test asserts against a user that cannot exist.
    """
    set_mock_user(fastapi_app, [ia_role])

    response = await client.get(fastapi_app.url_path_for("get_current_user"))

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    role_names = {role["name"] for role in data["roles"]}
    assert ia_role.value in role_names
    assert RoleEnum.GOVERNMENT.value in role_names
    assert data["isGovernmentUser"] is True


@pytest.mark.anyio
@pytest.mark.parametrize("bceid_role", [RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER])
async def test_mock_ia_bceid_user_is_a_supplier(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, bceid_role
):
    set_mock_user(fastapi_app, [bceid_role])

    response = await client.get(fastapi_app.url_path_for("get_current_user"))

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    role_names = {role["name"] for role in data["roles"]}
    assert bceid_role.value in role_names
    assert RoleEnum.SUPPLIER.value in role_names
    assert data["isGovernmentUser"] is False
