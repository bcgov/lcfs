"""BCeID callers may mutate only evidence items they created."""

from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import HTTPException
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.document_folder.services import DocumentFolderServices
from lcfs.web.api.document_folder.schema import (
    FolderCreateSchema,
    FolderUpdateSchema,
    FolderItemsMoveSchema,
)


@pytest.fixture
def portal_service():
    repo = MagicMock()
    repo.lock_parent = AsyncMock()
    repo.db.flush = AsyncMock()
    repo.get_folder = AsyncMock(
        return_value=NS(
            folder_id=1,
            parent_type="designatedAction",
            parent_id=3,
            create_user="government",
            deleted_date=None,
            is_system=False,
            parent_folder_id=None,
        )
    )
    repo.get_document_for_parent = AsyncMock(
        return_value=NS(document_id=9, create_user="government", deleted_date=None)
    )
    repo.get_associated_document_ids = AsyncMock(return_value={9})
    repo.set_placements = AsyncMock()
    user = NS(role_names=[RoleEnum.IA_PROPONENT], keycloak_username="proponent")
    return DocumentFolderServices(repo=repo, request=NS(user=user))


@pytest.mark.anyio
@pytest.mark.parametrize(
    "operation", ["rename", "delete", "restore", "nest", "move_target"]
)
async def test_portal_cannot_manage_government_folder(portal_service, operation):
    service = portal_service
    with pytest.raises(HTTPException) as exc:
        if operation == "rename":
            await service.update_folder(
                "designatedAction", 3, 1, FolderUpdateSchema(name="Changed")
            )
        elif operation == "delete":
            await service.delete_folder("designatedAction", 3, 1, service.request.user)
        elif operation == "restore":
            await service.restore_folder("designatedAction", 3, 1, service.request.user)
        elif operation == "nest":
            await service.create_folder(
                "designatedAction",
                3,
                FolderCreateSchema(name="Child", parent_folder_id=1),
            )
        else:
            await service.move_items(
                "designatedAction",
                3,
                FolderItemsMoveSchema(document_ids=[9], folder_id=1),
            )
    assert exc.value.status_code == 403
    service.repo.set_placements.assert_not_called()


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["delete", "restore", "move"])
async def test_portal_cannot_manage_government_document(portal_service, operation):
    service = portal_service
    document = service.repo.get_document_for_parent.return_value
    if operation == "restore":
        document.deleted_date = "binned"
        document.deleted_by = "proponent"
    with pytest.raises(HTTPException) as exc:
        if operation == "delete":
            await service.soft_delete_document(
                "designatedAction", 3, 9, service.request.user
            )
        elif operation == "restore":
            await service.restore_document(
                "designatedAction", 3, 9, service.request.user
            )
        else:
            await service.move_items(
                "designatedAction", 3, FolderItemsMoveSchema(document_ids=[9])
            )
    assert exc.value.status_code == 403
    service.repo.set_placements.assert_not_called()


@pytest.mark.anyio
async def test_owner_can_move_owned_document(portal_service):
    portal_service.repo.get_document_for_parent.return_value.create_user = "proponent"
    await portal_service.move_items(
        "designatedAction", 3, FolderItemsMoveSchema(document_ids=[9])
    )
    portal_service.repo.set_placements.assert_awaited_once_with([9], None)


@pytest.mark.anyio
async def test_idir_keeps_existing_management_access(portal_service):
    portal_service.request.user.role_names = [RoleEnum.GOVERNMENT]
    await portal_service.move_items(
        "designatedAction", 3, FolderItemsMoveSchema(document_ids=[9])
    )
    portal_service.repo.set_placements.assert_awaited_once_with([9], None)


@pytest.mark.anyio
async def test_portal_cannot_rename_government_document(portal_service, monkeypatch):
    from lcfs.web.api.document import views

    monkeypatch.setattr(views, "validate_parent_access", AsyncMock())
    documents = NS(
        _get_document_for_parent=AsyncMock(return_value=NS(create_user="government")),
        rename_file=AsyncMock(),
    )
    with pytest.raises(HTTPException) as exc:
        await views.rename_file.__wrapped__(
            request=portal_service.request,
            parent_type="designatedAction",
            parent_id=3,
            document_id=9,
            data=NS(display_name="Changed"),
            document_service=documents,
        )
    assert exc.value.status_code == 403
    documents.rename_file.assert_not_awaited()


@pytest.mark.anyio
async def test_owned_folder_cannot_move_government_contents(portal_service):
    folder = portal_service.repo.get_folder.return_value
    folder.create_user = "proponent"
    portal_service.repo.get_all_folders_including_deleted = AsyncMock(
        return_value=[folder]
    )
    portal_service.repo.get_documents_in_folders = AsyncMock(
        return_value=[NS(create_user="government")]
    )
    with pytest.raises(HTTPException) as exc:
        await portal_service.update_folder(
            "designatedAction", 3, 1, FolderUpdateSchema(name="Changed")
        )
    assert exc.value.status_code == 403
