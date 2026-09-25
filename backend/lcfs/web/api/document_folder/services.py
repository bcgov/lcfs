import structlog
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import Depends, HTTPException, Request

from lcfs.db.models.document import DocumentFolder
from lcfs.web.api.document_folder.constants import (
    FOLDER_ENABLED_PARENT_TYPES,
    max_folder_depth,
)
from lcfs.web.api.document_folder.repo import DocumentFolderRepository
from lcfs.web.api.document_folder.schema import (
    DeletedFolderDocumentSchema,
    DeletedFolderSchema,
    DeletedDocumentSchema,
    DeletedDocumentsSchema,
    DocumentFolderTreeSchema,
    FolderCreateSchema,
    FolderDocumentSchema,
    FolderItemsMoveSchema,
    FolderNodeSchema,
    FolderSchema,
    FolderUpdateSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = structlog.get_logger(__name__)


class DocumentFolderServices:
    def __init__(
        self,
        repo: DocumentFolderRepository = Depends(DocumentFolderRepository),
        request: Request = None,
    ) -> None:
        self.repo = repo
        self.request = request

    # ------------------------------------------------------------------
    # Invariants. Every mutation funnels through these; the allow-list is
    # the isolation guarantee and is checked at the view layer as well.
    # ------------------------------------------------------------------
    @staticmethod
    def ensure_parent_type_enabled(parent_type: str) -> None:
        if parent_type not in FOLDER_ENABLED_PARENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Folders are not enabled for parent type '{parent_type}'.",
            )

    async def _get_scoped_folder(
        self,
        folder_id: int,
        parent_type: str,
        parent_id: int,
        include_deleted: bool = False,
    ) -> DocumentFolder:
        folder = await self.repo.get_folder(folder_id)
        if (
            folder is None
            or folder.parent_type != parent_type
            or folder.parent_id != parent_id
            or (folder.deleted_date is not None and not include_deleted)
        ):
            # A folder belonging to another parent — or sitting in the bin
            # — is indistinguishable from a missing one on purpose.
            raise DataNotFoundException(f"Folder {folder_id} not found")
        return folder

    @staticmethod
    def _subtree_ids(root_id: int, folders: List[DocumentFolder]) -> List[int]:
        """*root_id* and every folder beneath it, deleted rows included."""
        children_of: Dict[Optional[int], List[int]] = {}
        for f in folders:
            children_of.setdefault(f.parent_folder_id, []).append(f.folder_id)
        subtree = [root_id]
        frontier = [root_id]
        while frontier:
            for child_id in children_of.get(frontier.pop(), []):
                subtree.append(child_id)
                frontier.append(child_id)
        return subtree

    async def _walk_depth_and_cycles(
        self,
        new_parent_id: Optional[int],
        parent_type: str,
        parent_id: int,
        moving_folder_id: Optional[int] = None,
    ) -> int:
        """Return the depth of the new parent chain; reject cycles.

        Depth 0 means the root; a folder placed there sits at depth 1.
        """
        cap = max_folder_depth(parent_type)
        depth = 0
        current = new_parent_id
        while current is not None:
            if moving_folder_id is not None and current == moving_folder_id:
                raise HTTPException(
                    status_code=400,
                    detail="A folder cannot be moved into itself or a descendant.",
                )
            folder = await self._get_scoped_folder(current, parent_type, parent_id)
            depth += 1
            if depth > cap:
                break
            current = folder.parent_folder_id
        if depth >= cap:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Folders cannot be nested here."
                    if cap == 1
                    else f"Folders may nest at most {cap} levels deep."
                ),
            )
        return depth

    # ------------------------------------------------------------------
    # Deletion. Nothing is ever destroyed: removing a document stamps it
    # and it moves to the bin, where it stays. The shared hard-delete path
    # is never called for these parents.
    # ------------------------------------------------------------------
    @service_handler
    async def soft_delete_document(
        self, parent_type: str, parent_id: int, document_id: int, user
    ) -> None:
        document = await self.repo.get_document_for_parent(document_id, parent_id)
        if document is None:
            raise DataNotFoundException(f"Document {document_id} not found")
        if document.deleted_date is not None:
            # Already in the bin; deleting twice is not an error, but it
            # must not overwrite who removed it or when.
            return
        username = getattr(user, "keycloak_username", None)
        document.deleted_date = datetime.now(timezone.utc)
        document.deleted_by = username
        document.update_user = username
        # The placement row stays, so restoring returns it to its folder.
        await self.repo.db.flush()
        logger.info(
            "document_soft_deleted",
            document_id=document_id,
            parent_type=parent_type,
            parent_id=parent_id,
            by=username,
        )

    @service_handler
    async def restore_document(
        self, parent_type: str, parent_id: int, document_id: int, user=None
    ) -> None:
        document = await self.repo.get_document_for_parent(document_id, parent_id)
        if document is None:
            raise DataNotFoundException(f"Document {document_id} not found")
        if document.deleted_date is None:
            return
        placement = await self.repo.get_placement(document_id)
        if placement is not None:
            folder = await self.repo.get_folder(placement.folder_id)
            if (
                folder is None
                or folder.parent_type != parent_type
                or folder.parent_id != parent_id
            ):
                # Belongs to another parent, or the row is simply gone.
                await self.repo.set_placements([document_id], None)
            elif folder.deleted_date is not None:
                # Its folder is in the bin. Restore the folder itself and
                # the chain above it as empty shells, so the file returns
                # where it lived instead of landing at the root — the same
                # rule restoring a folder follows. Nothing else in those
                # folders comes back.
                folders = await self.repo.get_all_folders_including_deleted(
                    parent_type, parent_id
                )
                await self._restore_ancestor_path(folder, folders)
                folder.name = await self._free_sibling_name(
                    folder, folder.parent_folder_id, folders
                )
                folder.deleted_date = None
                folder.deleted_by = None
                folder.deleted_group_uuid = None
        username = getattr(user, "keycloak_username", None)
        document.deleted_date = None
        document.deleted_by = None
        document.deleted_group_uuid = None
        document.update_user = username or document.update_user
        await self.repo.db.flush()
        logger.info(
            "document_restored",
            document_id=document_id,
            parent_type=parent_type,
            parent_id=parent_id,
            by=username,
        )

    async def _free_sibling_name(
        self,
        folder: DocumentFolder,
        parent_folder_id: Optional[int],
        folders: List[DocumentFolder],
    ) -> str:
        """A name for *folder* that no live sibling already holds.

        Sibling names are unique among live folders, and while a folder sat
        in the bin someone may well have made a new one with its name.
        Refusing the restore would leave no way forward at all, so the
        returned folder is suffixed instead.
        """
        taken = {
            f.name.lower()
            for f in folders
            if f.deleted_date is None
            and f.parent_folder_id == parent_folder_id
            and f.folder_id != folder.folder_id
        }
        if folder.name.lower() not in taken:
            return folder.name
        candidate = f"{folder.name} (restored)"
        suffix = 2
        while candidate.lower() in taken:
            candidate = f"{folder.name} (restored {suffix})"
            suffix += 1
        return candidate

    async def _restore_ancestor_path(
        self, folder: DocumentFolder, folders: List[DocumentFolder]
    ) -> None:
        """Bring back whichever ancestors of *folder* are in the bin.

        Only the chain itself: each comes back as an empty shell, and its
        own files and other children stay binned. Without this the thing
        being restored has no address, and dropping it at the root would
        lose the place it is being restored to.
        """
        by_id = {f.folder_id: f for f in folders}
        binned = []
        cursor = by_id.get(folder.parent_folder_id) if folder.parent_folder_id else None
        seen: Set[int] = set()
        while cursor is not None and cursor.folder_id not in seen:
            seen.add(cursor.folder_id)
            if cursor.deleted_date is not None:
                binned.append(cursor)
            cursor = (
                by_id.get(cursor.parent_folder_id) if cursor.parent_folder_id else None
            )

        # Outermost first, so a folder's parent is live before its own name
        # is checked against that parent's living children.
        for shell in reversed(binned):
            shell.name = await self._free_sibling_name(
                shell, shell.parent_folder_id, folders
            )
            shell.deleted_date = None
            shell.deleted_by = None
            shell.deleted_group_uuid = None

    @service_handler
    async def restore_folder(
        self, parent_type: str, parent_id: int, folder_id: int, user=None
    ) -> None:
        """Bring a folder back where it was, with what was inside it.

        Two rules decide what comes back:

        *Its own subtree, from its own deletion.* Rows beneath the folder
        that share its deleted_group_uuid are restored. A subfolder that
        someone had removed separately, before this delete, keeps its own
        group and stays in the bin — restoring a parent must not quietly
        undo a decision nobody revisited.

        *Its ancestors, as empty shells.* If a parent was removed too, the
        folder has no address without it, so the chain back to the root is
        restored — but only the chain. The ancestors' own files and their
        other children stay in the bin, each restorable on its own terms.
        A folder is a container, not data; bringing back an empty one to
        hold something costs nobody anything, while bringing back its
        contents would restore what nobody asked for.
        """
        folder = await self._get_scoped_folder(
            folder_id, parent_type, parent_id, include_deleted=True
        )
        if folder.deleted_date is None:
            return

        folders = await self.repo.get_all_folders_including_deleted(
            parent_type, parent_id
        )
        by_id = {f.folder_id: f for f in folders}
        group_uuid = folder.deleted_group_uuid

        # The subtree, limited to rows that went down with this one.
        restoring = [
            by_id[fid]
            for fid in self._subtree_ids(folder_id, folders)
            if fid in by_id
            and by_id[fid].deleted_date is not None
            and by_id[fid].deleted_group_uuid == group_uuid
        ]

        await self._restore_ancestor_path(folder, folders)

        for restored in restoring:
            restored.name = await self._free_sibling_name(
                restored, restored.parent_folder_id, folders
            )
            restored.deleted_date = None
            restored.deleted_by = None
            restored.deleted_group_uuid = None

        documents = await self.repo.get_deleted_documents_in_folders(
            [f.folder_id for f in restoring], group_uuid
        )
        for document in documents:
            document.deleted_date = None
            document.deleted_by = None
            document.deleted_group_uuid = None

        await self.repo.db.flush()
        logger.info(
            "folder_restored",
            folder_id=folder_id,
            parent_type=parent_type,
            parent_id=parent_id,
            folders_restored=len(restoring),
            documents_restored=len(documents),
            by=getattr(user, "keycloak_username", None),
        )

    @service_handler
    async def get_deleted_documents(
        self, parent_type: str, parent_id: int, limit: int = 50, offset: int = 0
    ) -> DeletedDocumentsSchema:
        documents, total = await self.repo.get_deleted_documents(
            parent_id, limit=limit, offset=offset
        )
        all_folders_for_names = await self.repo.get_all_folders_including_deleted(
            parent_type, parent_id
        )
        names = await self.repo.get_user_display_names(
            [d.deleted_by for d in documents]
            + [f.deleted_by for f in all_folders_for_names if f.deleted_date]
        )

        # One row per thing somebody deleted: the root folder of each
        # delete, with everything the restore would bring back counted
        # and listed across its subtree. A folder whose parent went to
        # the bin in the same delete belongs to its parent's row. A root
        # with no file beneath it gets no row: nothing was lost with it,
        # and it comes back by itself when something beneath it is
        # restored.
        folders = await self.repo.get_all_folders_including_deleted(
            parent_type, parent_id
        )
        by_id = {f.folder_id: f for f in folders}
        binned = [f for f in folders if f.deleted_date is not None]
        folder_rows = []
        listed_folder_ids = set()
        for folder in binned:
            group = folder.deleted_group_uuid
            if not group:
                continue
            parent = by_id.get(folder.parent_folder_id)
            if parent is not None and parent.deleted_group_uuid == group:
                # Rides with its parent's row.
                continue
            subtree = [
                fid
                for fid in self._subtree_ids(folder.folder_id, folders)
                if fid in by_id and by_id[fid].deleted_group_uuid == group
            ]
            docs = await self.repo.get_deleted_documents_in_folders(subtree, group)
            if not docs:
                continue
            listed_folder_ids.update(subtree)
            placements = await self.repo.get_placements(subtree)

            def relative_path(document_id):
                # Folders between this row's folder and the file.
                names = []
                cursor = by_id.get(placements.get(document_id))
                while cursor is not None and cursor.folder_id != folder.folder_id:
                    names.append(cursor.name)
                    cursor = by_id.get(cursor.parent_folder_id)
                return " / ".join(reversed(names))

            preview = sorted(
                (
                    DeletedFolderDocumentSchema(
                        document_id=d.document_id,
                        file_name=d.display_name or d.file_name,
                        file_size=d.file_size,
                        relative_path=relative_path(d.document_id),
                    )
                    for d in docs
                ),
                key=lambda row: (row.relative_path, row.file_name.lower()),
            )
            # Outermost first, so the panel can show where it returns to.
            path = []
            cursor = (
                by_id.get(folder.parent_folder_id) if folder.parent_folder_id else None
            )
            seen = set()
            while cursor is not None and cursor.folder_id not in seen:
                seen.add(cursor.folder_id)
                path.append(cursor.name)
                cursor = (
                    by_id.get(cursor.parent_folder_id)
                    if cursor.parent_folder_id
                    else None
                )
            folder_rows.append(
                DeletedFolderSchema(
                    folder_id=folder.folder_id,
                    name=folder.name,
                    path=list(reversed(path)),
                    document_count=len(preview),
                    documents=preview,
                    deleted_date=folder.deleted_date,
                    deleted_by=folder.deleted_by,
                    deleted_by_name=names.get(folder.deleted_by),
                )
            )
        folder_rows.sort(key=lambda r: r.deleted_date or datetime.min, reverse=True)

        rows = []
        for document in documents:
            placement = await self.repo.get_placement(document.document_id)
            folder = None
            if placement is not None:
                candidate = await self.repo.get_folder(placement.folder_id)
                if (
                    candidate is not None
                    and candidate.parent_type == parent_type
                    and candidate.parent_id == parent_id
                ):
                    folder = candidate
            if folder is not None and folder.folder_id in listed_folder_ids:
                # It went down with its folder and comes back with it;
                # listing it separately would show the same file twice.
                continue
            rows.append(
                DeletedDocumentSchema(
                    document_id=document.document_id,
                    file_name=document.file_name,
                    file_size=document.file_size,
                    deleted_date=document.deleted_date,
                    deleted_by=document.deleted_by,
                    deleted_by_name=names.get(document.deleted_by),
                    restore_folder_id=folder.folder_id if folder else None,
                    restore_folder_name=folder.name if folder else None,
                )
            )
        return DeletedDocumentsSchema(
            documents=rows, folders=folder_rows, total=total + len(folder_rows)
        )

    # ------------------------------------------------------------------
    # Tree
    # ------------------------------------------------------------------
    @service_handler
    async def get_tree(
        self, parent_type: str, parent_id: int
    ) -> DocumentFolderTreeSchema:
        folders = await self.repo.get_folders(parent_type, parent_id)
        documents = await self.repo.get_parent_documents(parent_id)
        placements = await self.repo.get_placements([f.folder_id for f in folders])
        org_codes = await self.repo.get_uploading_organization_codes(
            [d.create_user for d in documents]
        )

        docs_by_folder: Dict[int, List[FolderDocumentSchema]] = {}
        root_documents: List[FolderDocumentSchema] = []
        for document in documents:
            payload = FolderDocumentSchema(
                document_id=document.document_id,
                file_name=document.file_name,
                display_name=document.display_name,
                file_size=document.file_size,
                create_date=document.create_date,
                create_user=document.create_user,
                uploading_organization_code=org_codes.get(document.create_user),
            )
            folder_id = placements.get(document.document_id)
            if folder_id is None:
                root_documents.append(payload)
            else:
                docs_by_folder.setdefault(folder_id, []).append(payload)

        nodes: Dict[int, FolderNodeSchema] = {}
        for folder in folders:
            documents_in_folder = docs_by_folder.get(folder.folder_id, [])
            nodes[folder.folder_id] = FolderNodeSchema(
                folder_id=folder.folder_id,
                name=folder.name,
                parent_folder_id=folder.parent_folder_id,
                sort_order=folder.sort_order,
                is_system=folder.is_system,
                document_count=len(documents_in_folder),
                documents=documents_in_folder,
            )
        roots: List[FolderNodeSchema] = []
        for folder in folders:
            node = nodes[folder.folder_id]
            if folder.parent_folder_id and folder.parent_folder_id in nodes:
                nodes[folder.parent_folder_id].children.append(node)
            else:
                roots.append(node)

        # Counts roll up so a collapsed branch still shows its size.
        def rollup(node: FolderNodeSchema) -> int:
            node.document_count += sum(rollup(child) for child in node.children)
            return node.document_count

        for root in roots:
            rollup(root)
        return DocumentFolderTreeSchema(folders=roots, root_documents=root_documents)

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------
    @service_handler
    async def create_folder(
        self, parent_type: str, parent_id: int, data: FolderCreateSchema
    ) -> FolderSchema:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Folder name is required.")
        await self._walk_depth_and_cycles(data.parent_folder_id, parent_type, parent_id)
        username = getattr(
            getattr(self.request, "user", None), "keycloak_username", None
        )
        folder = await self.repo.add_folder(
            DocumentFolder(
                parent_type=parent_type,
                parent_id=parent_id,
                parent_folder_id=data.parent_folder_id,
                name=name,
                create_user=username,
                update_user=username,
            )
        )
        return FolderSchema.model_validate(folder)

    @service_handler
    async def update_folder(
        self,
        parent_type: str,
        parent_id: int,
        folder_id: int,
        data: FolderUpdateSchema,
    ) -> FolderSchema:
        folder = await self._get_scoped_folder(folder_id, parent_type, parent_id)
        if folder.is_system:
            raise HTTPException(
                status_code=400, detail="System folders cannot be modified."
            )
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="Folder name is required.")
            folder.name = name
        if data.move_to_root:
            folder.parent_folder_id = None
        elif data.parent_folder_id is not None:
            await self._walk_depth_and_cycles(
                data.parent_folder_id,
                parent_type,
                parent_id,
                moving_folder_id=folder_id,
            )
            folder.parent_folder_id = data.parent_folder_id
        if data.sort_order is not None:
            folder.sort_order = data.sort_order
        await self.repo.db.flush()
        return FolderSchema.model_validate(folder)

    @service_handler
    async def delete_folder(
        self, parent_type: str, parent_id: int, folder_id: int, strategy: str, user=None
    ) -> None:
        folder = await self._get_scoped_folder(folder_id, parent_type, parent_id)
        if folder.is_system:
            raise HTTPException(
                status_code=400, detail="System folders cannot be deleted."
            )
        if strategy == "reparent":
            # Contents move up one level; only the folder disappears.
            await self.repo.reparent_contents(folder_id, folder.parent_folder_id)
            await self.repo.delete_folders([folder_id])
        elif strategy == "cascade":
            # The subtree and everything filed in it go to the bin
            # together, sharing one group so a restore can bring back
            # exactly what went down. Placement rows are left alone —
            # they are the only record of where each file lived.
            all_folders = await self.repo.get_all_folders_including_deleted(
                parent_type, parent_id
            )
            subtree = self._subtree_ids(folder_id, all_folders)
            documents = await self.repo.get_documents_in_folders(subtree)

            group_uuid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            username = getattr(user, "keycloak_username", None)
            by_id = {f.folder_id: f for f in all_folders}
            for fid in subtree:
                folder = by_id.get(fid)
                if folder is None or folder.deleted_date is not None:
                    # Already in the bin from an earlier delete. Leaving it
                    # on its own group is what keeps restoring this folder
                    # from resurrecting it.
                    continue
                folder.deleted_date = now
                folder.deleted_by = username
                folder.deleted_group_uuid = group_uuid
            for document in documents:
                document.deleted_date = now
                document.deleted_by = username
                document.deleted_group_uuid = group_uuid
                document.update_user = username
            await self.repo.db.flush()
            logger.info(
                "folder_cascade_deleted",
                folder_id=folder_id,
                parent_type=parent_type,
                parent_id=parent_id,
                group_uuid=group_uuid,
                documents_deleted=len(documents),
                by=username,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="strategy must be 'reparent' or 'cascade'.",
            )

    @service_handler
    async def move_items(
        self, parent_type: str, parent_id: int, data: FolderItemsMoveSchema
    ) -> None:
        if not data.document_ids:
            return
        if data.folder_id is not None:
            await self._get_scoped_folder(data.folder_id, parent_type, parent_id)
        associated = await self.repo.get_associated_document_ids(parent_id)
        strays = [d for d in data.document_ids if d not in associated]
        if strays:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Documents must belong to this record before they can "
                    f"be placed in its folders: {strays}"
                ),
            )
        await self.repo.set_placements(data.document_ids, data.folder_id)
