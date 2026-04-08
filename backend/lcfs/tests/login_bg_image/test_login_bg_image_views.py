import pytest
from unittest.mock import AsyncMock
from io import BytesIO

from httpx import AsyncClient
from fastapi import FastAPI

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.login_bg_image.services import LoginBgImageService
from lcfs.web.api.login_bg_image.schema import LoginBgImageSchema

SAMPLE_SCHEMA_DATA = {
    "login_bg_image_id": 1,
    "image_key": "login-backgrounds/abc-uuid",
    "file_name": "photo.jpg",
    "display_name": "Mountain Sunrise",
    "caption": "Rockies, BC",
    "is_active": True,
    "create_date": None,
    "update_date": None,
    "create_user": None,
    "update_user": None,
}


def make_schema(**overrides):
    return LoginBgImageSchema(**{**SAMPLE_SCHEMA_DATA, **overrides})


# ---------------------------------------------------------------------------
# GET /login-bg-images/active  (public endpoint)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_active_image_returns_active(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_login_bg_image_service,
):
    mock_login_bg_image_service.get_active = AsyncMock(
        return_value=make_schema(is_active=True)
    )
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("get_active_image")
    response = await client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert data["loginBgImageId"] == 1
    assert data["isActive"] is True
    assert data["displayName"] == "Mountain Sunrise"


@pytest.mark.anyio
async def test_get_active_image_returns_null_when_none(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_login_bg_image_service,
):
    mock_login_bg_image_service.get_active = AsyncMock(return_value=None)
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("get_active_image")
    response = await client.get(url)

    assert response.status_code == 200
    assert response.json() is None


# ---------------------------------------------------------------------------
# GET /login-bg-images/  (admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_all_images_returns_list(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])
    mock_login_bg_image_service.get_all = AsyncMock(
        return_value=[make_schema(is_active=True), make_schema(login_bg_image_id=2, is_active=False)]
    )
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("get_all_images")
    response = await client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2


@pytest.mark.anyio
async def test_get_all_images_forbidden_for_non_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("get_all_images")
    response = await client.get(url)

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# POST /login-bg-images/  (admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_upload_image_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])
    mock_login_bg_image_service.upload = AsyncMock(return_value=make_schema(is_active=False))
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("upload_image")
    response = await client.post(
        url,
        files={"file": ("photo.jpg", BytesIO(b"fake-image-data"), "image/jpeg")},
        data={"display_name": "Mountain Sunrise", "caption": "Rockies, BC"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["displayName"] == "Mountain Sunrise"
    mock_login_bg_image_service.upload.assert_called_once()


@pytest.mark.anyio
async def test_upload_image_forbidden_for_non_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("upload_image")
    response = await client.post(
        url,
        files={"file": ("photo.jpg", BytesIO(b"data"), "image/jpeg")},
        data={"display_name": "Test"},
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# PUT /login-bg-images/{image_id}  (admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_image_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])
    updated = make_schema(display_name="Updated Name", caption="New caption")
    mock_login_bg_image_service.update = AsyncMock(return_value=updated)
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("update_image", image_id=1)
    response = await client.put(
        url,
        json={"display_name": "Updated Name", "caption": "New caption"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "Updated Name"


# ---------------------------------------------------------------------------
# PUT /login-bg-images/{image_id}/activate  (admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_activate_image_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])
    mock_login_bg_image_service.activate = AsyncMock(
        return_value=make_schema(is_active=True)
    )
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("activate_image", image_id=1)
    response = await client.put(url)

    assert response.status_code == 200
    assert response.json()["isActive"] is True
    mock_login_bg_image_service.activate.assert_called_once_with(1)


# ---------------------------------------------------------------------------
# DELETE /login-bg-images/{image_id}  (admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_image_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])
    mock_login_bg_image_service.delete = AsyncMock(return_value=None)
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("delete_image", image_id=1)
    response = await client.delete(url)

    assert response.status_code == 200
    mock_login_bg_image_service.delete.assert_called_once_with(1)


@pytest.mark.anyio
async def test_delete_image_forbidden_for_non_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_login_bg_image_service,
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    fastapi_app.dependency_overrides[LoginBgImageService] = (
        lambda: mock_login_bg_image_service
    )

    url = fastapi_app.url_path_for("delete_image", image_id=1)
    response = await client.delete(url)

    assert response.status_code == 403
