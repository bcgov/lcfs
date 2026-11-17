import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects import postgresql

from lcfs.db.models.document import Document, DocumentFolder, DocumentFolderItem
from lcfs.db.models.initiative_agreement import DesignatedAction, InitiativeAgreement
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.tests.document_folder.test_document_folder_view import (
    _seed_da,
    _seed_document,
)
from lcfs.web.api.document_folder.repo import DocumentFolderRepository
from lcfs.web.api.document_folder.schema import (
    FolderCreateSchema,
    FolderItemsMoveSchema,
    FolderUpdateSchema,
)
from lcfs.web.api.document_folder.services import DocumentFolderServices
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.mark.anyio
@pytest.mark.parametrize("mutation", ["move_items", "create_folder"])
@pytest.mark.parametrize("delete_first", [True, False])
async def test_folder_deletion_serializes_with_contents_through_commit(
    dbsession_factory, mutation, delete_first, monkeypatch
):
    async with dbsession_factory() as setup, setup.begin():
        action = await _seed_da(setup, "IA-FOLDER-RACE")
        parent_id = action.designated_action_id
        agreement_id = action.initiative_agreement_id
        document = await _seed_document(setup, action)
        document_id = document.document_id
        folder = await DocumentFolderRepository(setup).add_folder(
            DocumentFolder(
                parent_type="designatedAction", parent_id=parent_id, name="Empty"
            )
        )
        folder_id = folder.folder_id

    ready_to_commit = asyncio.Event()
    allow_commit = asyncio.Event()
    second_lock_attempted = asyncio.Event()
    lock_parent = DocumentFolderRepository.lock_parent
    first_repo = None

    async def observe_lock(repo, action_id):
        if repo is not first_repo:
            second_lock_attempted.set()
        await lock_parent(repo, action_id)

    monkeypatch.setattr(DocumentFolderRepository, "lock_parent", observe_lock)

    async def operate(service, deleting):
        if deleting:
            await service.delete_folder("designatedAction", parent_id, folder_id)
        elif mutation == "move_items":
            await service.move_items(
                "designatedAction",
                parent_id,
                FolderItemsMoveSchema(document_ids=[document_id], folder_id=folder_id),
            )
        else:
            await service.create_folder(
                "designatedAction",
                parent_id,
                FolderCreateSchema(name="Concurrent child", parent_folder_id=folder_id),
            )

    async def first_request():
        nonlocal first_repo
        async with dbsession_factory() as session, session.begin():
            first_repo = DocumentFolderRepository(session)
            await operate(DocumentFolderServices(first_repo), delete_first)
            ready_to_commit.set()
            await allow_commit.wait()

    async def second_request():
        async with dbsession_factory() as session, session.begin():
            await operate(
                DocumentFolderServices(DocumentFolderRepository(session)),
                not delete_first,
            )

    tasks = []
    try:
        tasks.append(asyncio.create_task(first_request()))
        await asyncio.wait_for(ready_to_commit.wait(), timeout=10)
        tasks.append(asyncio.create_task(second_request()))
        await asyncio.wait_for(second_lock_attempted.wait(), timeout=10)
        # The service has returned, but its transaction still owns the lock.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(asyncio.shield(tasks[1]), timeout=0.1)
        allow_commit.set()
        await asyncio.wait_for(tasks[0], timeout=10)
        if delete_first:
            with pytest.raises(DataNotFoundException):
                await asyncio.wait_for(tasks[1], timeout=10)
        else:
            with pytest.raises(HTTPException, match="Only empty folders"):
                await asyncio.wait_for(tasks[1], timeout=10)
        async with dbsession_factory() as session:
            saved_folder = await session.get(DocumentFolder, folder_id)
            assert (saved_folder is None) == delete_first
            placement = await session.scalar(
                select(DocumentFolderItem).where(
                    DocumentFolderItem.document_id == document_id
                )
            )
            if mutation == "move_items":
                assert (placement is None) == delete_first
            else:
                children = list(
                    await session.scalars(
                        select(DocumentFolder).where(
                            DocumentFolder.parent_folder_id == folder_id
                        )
                    )
                )
                assert len(children) == (0 if delete_first else 1)
    finally:
        allow_commit.set()
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        async with dbsession_factory() as session, session.begin():
            await session.execute(
                delete(designated_action_document_association).where(
                    designated_action_document_association.c.designated_action_id
                    == parent_id
                )
            )
            await session.execute(
                delete(DocumentFolder).where(DocumentFolder.parent_id == parent_id)
            )
            await session.execute(
                delete(Document).where(Document.document_id == document_id)
            )
            await session.execute(
                delete(DesignatedAction).where(
                    DesignatedAction.designated_action_id == parent_id
                )
            )
            await session.execute(
                delete(InitiativeAgreement).where(
                    InitiativeAgreement.initiative_agreement_id == agreement_id
                )
            )


@pytest.mark.anyio
async def test_parent_lock_uses_transaction_scoped_row_lock():
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = 9
    db.execute.return_value = result

    await DocumentFolderRepository(db).lock_parent(9)

    query = db.execute.call_args.args[0]
    sql = str(query.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE OF designated_action" in sql
    assert query.compile().params["designated_action_id_1"] == 9
    db.commit.assert_not_awaited()
    db.rollback.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "method,args",
    [
        ("create_folder", [FolderCreateSchema(name="New child", parent_folder_id=1)]),
        ("update_folder", [1, FolderUpdateSchema(parent_folder_id=2)]),
        ("delete_folder", [1]),
        ("move_items", [FolderItemsMoveSchema(document_ids=[7], folder_id=1)]),
        ("restore_folder", [1]),
        ("soft_delete_document", [7, SimpleNamespace(keycloak_username="owner")]),
        ("restore_document", [7, SimpleNamespace(keycloak_username="owner")]),
        (
            "hard_delete_document",
            [7, SimpleNamespace(keycloak_username="owner"), SimpleNamespace()],
        ),
    ],
)
async def test_mutations_lock_parent_before_reading_or_changing_contents(method, args):
    repo = MagicMock()
    repo.lock_parent = AsyncMock(
        side_effect=DataNotFoundException("Parent lock unavailable")
    )
    service = DocumentFolderServices(repo)

    with pytest.raises(DataNotFoundException):
        await getattr(service, method)("designatedAction", 9, *args)

    repo.lock_parent.assert_awaited_once_with(9)
    assert len(repo.mock_calls) == 1


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
        lock_parent=AsyncMock(),
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
