import pytest
from unittest.mock import AsyncMock

from httpx import AsyncClient
from fastapi import FastAPI

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.release_notes.services import ReleaseNotesService
from lcfs.web.api.release_notes.schema import ReleaseNoteOverrideSchema

# Every role except SYSTEM_ADMIN must be denied edit access to release notes
UNAUTHORIZED_ROLES = [role for role in RoleEnum if role is not RoleEnum.SYSTEM_ADMIN]

SAMPLE_OVERRIDE_DATA = {
    "version": "1.3.6",
    "summary": "Admin-corrected summary text.",
    "sections": {
        "features": ["Corrected feature description"],
        "fixes": [],
        "security": [],
        "breaking": [],
        "dependencies": [],
        "other": [],
    },
    "update_date": None,
    "update_user": None,
}


def make_override_schema(**overrides):
    return ReleaseNoteOverrideSchema(**{**SAMPLE_OVERRIDE_DATA, **overrides})


# ---------------------------------------------------------------------------
# GET /release-notes/overrides  (public endpoint, no auth required)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_overrides_returns_list_without_authentication(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_release_notes_service,
):
    mock_release_notes_service.get_overrides = AsyncMock(
        return_value=[make_override_schema()]
    )
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("get_release_note_overrides")
    response = await client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["version"] == "1.3.6"
    assert data[0]["summary"] == "Admin-corrected summary text."


@pytest.mark.anyio
async def test_get_overrides_returns_empty_list_when_none_exist(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_release_notes_service,
):
    mock_release_notes_service.get_overrides = AsyncMock(return_value=[])
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("get_release_note_overrides")
    response = await client.get(url)

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# PUT /release-notes/{version}  (System Admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_release_note_success_for_system_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_release_notes_service,
):
    set_mock_user(fastapi_app, [RoleEnum.SYSTEM_ADMIN])
    mock_release_notes_service.update_override = AsyncMock(
        return_value=make_override_schema()
    )
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("update_release_note", version="1.3.6")
    response = await client.put(
        url,
        json={
            "summary": "Admin-corrected summary text.",
            "sections": {
                "features": ["Corrected feature description"],
                "fixes": [],
                "security": [],
                "breaking": [],
                "dependencies": [],
                "other": [],
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == "Admin-corrected summary text."
    mock_release_notes_service.update_override.assert_called_once()


@pytest.mark.anyio
@pytest.mark.parametrize("role", UNAUTHORIZED_ROLES)
async def test_update_release_note_forbidden_for_non_system_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_release_notes_service,
    role,
):
    set_mock_user(fastapi_app, [role])
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("update_release_note", version="1.3.6")
    response = await client.put(
        url,
        json={"summary": "Should not be allowed", "sections": None},
    )

    assert response.status_code == 403
    mock_release_notes_service.update_override.assert_not_called()


# ---------------------------------------------------------------------------
# DELETE /release-notes/{version}  (System Admin only)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_reset_release_note_success_for_system_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_release_notes_service,
):
    set_mock_user(fastapi_app, [RoleEnum.SYSTEM_ADMIN])
    mock_release_notes_service.reset_override = AsyncMock(return_value=True)
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("reset_release_note", version="1.3.6")
    response = await client.delete(url)

    assert response.status_code == 204
    mock_release_notes_service.reset_override.assert_called_once_with("1.3.6")


@pytest.mark.anyio
@pytest.mark.parametrize("role", UNAUTHORIZED_ROLES)
async def test_reset_release_note_forbidden_for_non_system_admin(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_release_notes_service,
    role,
):
    set_mock_user(fastapi_app, [role])
    fastapi_app.dependency_overrides[ReleaseNotesService] = (
        lambda: mock_release_notes_service
    )

    url = fastapi_app.url_path_for("reset_release_note", version="1.3.6")
    response = await client.delete(url)

    assert response.status_code == 403
    mock_release_notes_service.reset_override.assert_not_called()
