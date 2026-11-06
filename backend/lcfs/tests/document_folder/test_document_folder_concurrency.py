from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from lcfs.web.api.document_folder.repo import DocumentFolderRepository
from lcfs.web.api.document_folder.services import DocumentFolderServices
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.mark.anyio
async def test_scoped_document_lock_refreshes_identity_map():
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.first.return_value = None
    db.execute.return_value = result

    await DocumentFolderRepository(db).get_document_for_parent(7, 9, for_update=True)

    query = db.execute.call_args.args[0]
    sql = str(query.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE OF document" in sql
    assert "designated_action_document_association" in sql
    assert query.get_execution_options()["populate_existing"] is True


@pytest.mark.anyio
@pytest.mark.parametrize("deleted_by", ["owner", "another-user", None])
async def test_hard_delete_checks_current_ownership_after_lock(deleted_by):
    repo = SimpleNamespace(
        get_document_for_parent=AsyncMock(
            return_value=SimpleNamespace(
                create_user="owner",
                deleted_by=deleted_by,
                deleted_date=datetime.now(timezone.utc) if deleted_by else None,
            )
        ),
        db=AsyncMock(),
    )
    storage = SimpleNamespace(delete_file=AsyncMock(return_value=True))
    service = DocumentFolderServices(repo)
    user = SimpleNamespace(keycloak_username="owner")

    if deleted_by == "owner":
        await service.hard_delete_document("designatedAction", 9, 7, user, storage)
        storage.delete_file.assert_awaited_once_with(
            7, 9, "designatedAction", require_physical_delete=True
        )
    else:
        with pytest.raises(DataNotFoundException):
            await service.hard_delete_document("designatedAction", 9, 7, user, storage)
        storage.delete_file.assert_not_awaited()

    repo.get_document_for_parent.assert_awaited_once_with(7, 9, for_update=True)
    repo.db.commit.assert_not_awaited()
    repo.db.rollback.assert_not_awaited()


class CountingFolder:
    parent_reads = 0

    def __init__(self, folder_id, parent_folder_id=None, deleted=False):
        self.folder_id = folder_id
        self._parent_folder_id = parent_folder_id
        self.deleted_date = datetime.now(timezone.utc) if deleted else None
        self.name = f"Folder {folder_id}"
        self.sort_order = 0
        self.is_system = False

    @property
    def parent_folder_id(self):
        type(self).parent_reads += 1
        return self._parent_folder_id


@pytest.mark.anyio
@pytest.mark.parametrize("size", [100, 1000])
async def test_flat_tree_eligibility_does_linear_work(size):
    folders = [CountingFolder(i) for i in range(1, size + 1)]
    repo = SimpleNamespace(
        get_folders=AsyncMock(return_value=folders),
        get_all_folders_including_deleted=AsyncMock(return_value=folders),
        get_parent_documents=AsyncMock(return_value=[]),
        get_placements=AsyncMock(return_value={}),
        get_documents_in_folders=AsyncMock(return_value=[]),
        get_uploading_organization_codes=AsyncMock(return_value={}),
    )
    CountingFolder.parent_reads = 0

    tree = await DocumentFolderServices(repo).get_tree("designatedAction", 9)

    assert len(tree.folders) == size
    assert all(folder.can_delete for folder in tree.folders)
    assert CountingFolder.parent_reads <= 4 * size
