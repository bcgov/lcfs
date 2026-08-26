import structlog
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import Depends, HTTPException, Request

from lcfs.db.models.document import DocumentFolder
from lcfs.web.api.document_folder.constants import (
    FOLDER_ENABLED_PARENT_TYPES,
    MAX_FOLDER_DEPTH,
)
from lcfs.web.api.document_folder.repo import DocumentFolderRepository
from lcfs.web.api.document_folder.schema import (
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
        self, folder_id: int, parent_type: str, parent_id: int
    ) -> DocumentFolder:
        folder = await self.repo.get_folder(folder_id)
        if (
            folder is None
            or folder.parent_type != parent_type
            or folder.parent_id != parent_id
        ):
            # A folder belonging to another parent is indistinguishable
            # from a missing one on purpose.
            raise DataNotFoundException(f"Folder {folder_id} not found")
        return folder

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
            if depth > MAX_FOLDER_DEPTH:
                break
            current = folder.parent_folder_id
        if depth >= MAX_FOLDER_DEPTH:
            raise HTTPException(
                status_code=400,
                detail=f"Folders may nest at most {MAX_FOLDER_DEPTH} levels deep.",
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
        document.deleted_date = datetime.now(timezone.utc)
        document.deleted_by = getattr(user, "keycloak_username", None)
        # The placement row stays, so restoring returns it to its folder.
        await self.repo.db.flush()

    @service_handler
    async def restore_document(
        self, parent_type: str, parent_id: int, document_id: int
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
                # The folder it came from has gone. Put it at the top
                # level rather than resurrecting a folder someone removed.
                await self.repo.set_placements([document_id], None)
        document.deleted_date = None
        document.deleted_by = None
        await self.repo.db.flush()

    @service_handler
    async def get_deleted_documents(
        self, parent_type: str, parent_id: int, limit: int = 50, offset: int = 0
    ) -> DeletedDocumentsSchema:
        documents, total = await self.repo.get_deleted_documents(
            parent_id, limit=limit, offset=offset
        )
        names = await self.repo.get_user_display_names(
            [d.deleted_by for d in documents]
        )

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
        return DeletedDocumentsSchema(documents=rows, total=total)

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

        docs_by_folder: Dict[int, List[FolderDocumentSchema]] = {}
        root_documents: List[FolderDocumentSchema] = []
        for document in documents:
            payload = FolderDocumentSchema(
                document_id=document.document_id,
                file_name=document.file_name,
                file_size=document.file_size,
                create_date=document.create_date,
                create_user=document.create_user,
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
        self, parent_type: str, parent_id: int, folder_id: int, strategy: str
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
            # Removes the subtree's structure. Placement rows cascade away,
            # so the files fall to the root — file deletion itself stays
            # with the existing per-file delete flow and its ownership rule.
            subtree = [folder_id]
            frontier = [folder_id]
            all_folders = await self.repo.get_folders(parent_type, parent_id)
            children_of: Dict[Optional[int], List[int]] = {}
            for f in all_folders:
                children_of.setdefault(f.parent_folder_id, []).append(f.folder_id)
            while frontier:
                current = frontier.pop()
                for child_id in children_of.get(current, []):
                    subtree.append(child_id)
                    frontier.append(child_id)
            await self.repo.delete_folders(subtree)
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
