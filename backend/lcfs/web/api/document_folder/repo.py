from typing import Dict, List, Optional, Sequence, Set, Tuple

from fastapi import Depends
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.document import Document, DocumentFolder, DocumentFolderItem
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.web.core.decorators import repo_handler


class DocumentFolderRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_folders(
        self, parent_type: str, parent_id: int
    ) -> List[DocumentFolder]:
        result = await self.db.execute(
            select(DocumentFolder)
            .where(
                DocumentFolder.parent_type == parent_type,
                DocumentFolder.parent_id == parent_id,
            )
            .order_by(DocumentFolder.sort_order, DocumentFolder.name)
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_folder(self, folder_id: int) -> Optional[DocumentFolder]:
        return await self.db.get(DocumentFolder, folder_id)

    @repo_handler
    async def add_folder(self, folder: DocumentFolder) -> DocumentFolder:
        self.db.add(folder)
        await self.db.flush()
        await self.db.refresh(folder)
        return folder

    @repo_handler
    async def delete_folders(self, folder_ids: Sequence[int]) -> None:
        if not folder_ids:
            return
        await self.db.execute(
            delete(DocumentFolder).where(DocumentFolder.folder_id.in_(folder_ids))
        )
        await self.db.flush()

    @repo_handler
    async def get_parent_documents(self, parent_id: int) -> List[Document]:
        """Documents associated with the designated action."""
        result = await self.db.execute(
            select(Document)
            .join(
                designated_action_document_association,
                designated_action_document_association.c.document_id
                == Document.document_id,
            )
            .where(
                designated_action_document_association.c.designated_action_id
                == parent_id,
                Document.deleted_date.is_(None),
            )
            .order_by(Document.file_name)
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_deleted_documents(
        self, parent_id: int, limit: int = 50, offset: int = 0
    ) -> Tuple[List[Document], int]:
        """The bin for one parent, newest deletion first.

        Paginated from the start: nothing is ever purged, so this list
        only grows and the screen will need paging eventually even though
        it does not today.
        """
        base = (
            select(Document)
            .join(
                designated_action_document_association,
                designated_action_document_association.c.document_id
                == Document.document_id,
            )
            .where(
                designated_action_document_association.c.designated_action_id
                == parent_id,
                Document.deleted_date.isnot(None),
            )
        )
        total = (
            await self.db.execute(
                select(func.count()).select_from(
                    base.with_only_columns(Document.document_id).subquery()
                )
            )
        ).scalar_one()
        result = await self.db.execute(
            base.order_by(desc(Document.deleted_date)).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    @repo_handler
    async def get_document_for_parent(
        self, document_id: int, parent_id: int
    ) -> Optional[Document]:
        """A document, but only if it belongs to this parent."""
        result = await self.db.execute(
            select(Document)
            .join(
                designated_action_document_association,
                designated_action_document_association.c.document_id
                == Document.document_id,
            )
            .where(
                Document.document_id == document_id,
                designated_action_document_association.c.designated_action_id
                == parent_id,
            )
            .execution_options(populate_existing=True)
        )
        return result.scalars().first()

    @repo_handler
    async def get_placement(self, document_id: int) -> Optional[DocumentFolderItem]:
        result = await self.db.execute(
            select(DocumentFolderItem).where(
                DocumentFolderItem.document_id == document_id
            )
        )
        return result.scalars().first()

    @repo_handler
    async def get_user_display_names(self, usernames) -> Dict[str, str]:
        """Resolve usernames to names for display in the bin."""
        names = [u for u in set(usernames) if u]
        if not names:
            return {}
        result = await self.db.execute(
            select(
                UserProfile.keycloak_username,
                UserProfile.first_name,
                UserProfile.last_name,
            ).where(UserProfile.keycloak_username.in_(names))
        )
        resolved = {}
        for username, first_name, last_name in result.all():
            full = " ".join(p for p in (first_name, last_name) if p).strip()
            resolved[username] = full or None
        return resolved

    @repo_handler
    async def get_associated_document_ids(self, parent_id: int) -> Set[int]:
        result = await self.db.execute(
            select(designated_action_document_association.c.document_id).where(
                designated_action_document_association.c.designated_action_id
                == parent_id
            )
        )
        return set(result.scalars().all())

    @repo_handler
    async def get_placements(self, folder_ids: Sequence[int]) -> Dict[int, int]:
        """document_id -> folder_id for the given folders."""
        if not folder_ids:
            return {}
        result = await self.db.execute(
            select(DocumentFolderItem.document_id, DocumentFolderItem.folder_id).where(
                DocumentFolderItem.folder_id.in_(folder_ids)
            )
        )
        return {document_id: folder_id for document_id, folder_id in result.all()}

    @repo_handler
    async def set_placements(
        self, document_ids: Sequence[int], folder_id: Optional[int]
    ) -> None:
        """Place documents in a folder, or at the root when folder_id is None."""
        if not document_ids:
            return
        await self.db.execute(
            delete(DocumentFolderItem).where(
                DocumentFolderItem.document_id.in_(document_ids)
            )
        )
        if folder_id is not None:
            for document_id in document_ids:
                self.db.add(
                    DocumentFolderItem(document_id=document_id, folder_id=folder_id)
                )
        await self.db.flush()

    @repo_handler
    async def reparent_contents(
        self, folder_id: int, new_parent_folder_id: Optional[int]
    ) -> None:
        """Move a folder's direct children and items up to its parent."""
        result = await self.db.execute(
            select(DocumentFolder).where(DocumentFolder.parent_folder_id == folder_id)
        )
        for child in result.scalars().all():
            child.parent_folder_id = new_parent_folder_id

        items = (
            (
                await self.db.execute(
                    select(DocumentFolderItem).where(
                        DocumentFolderItem.folder_id == folder_id
                    )
                )
            )
            .scalars()
            .all()
        )
        for item in items:
            if new_parent_folder_id is None:
                await self.db.delete(item)
            else:
                item.folder_id = new_parent_folder_id
        await self.db.flush()
