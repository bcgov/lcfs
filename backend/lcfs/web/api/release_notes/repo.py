from typing import List, Optional
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.release_note.ReleaseNoteOverride import ReleaseNoteOverride
from lcfs.web.core.decorators import repo_handler


class ReleaseNoteOverrideRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_all(self) -> List[ReleaseNoteOverride]:
        result = await self.db.execute(select(ReleaseNoteOverride))
        return result.scalars().all()

    @repo_handler
    async def get_by_version(self, version: str) -> Optional[ReleaseNoteOverride]:
        result = await self.db.execute(
            select(ReleaseNoteOverride).where(ReleaseNoteOverride.version == version)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def upsert(self, version: str, data: dict) -> ReleaseNoteOverride:
        """
        Updates the override for the given version, or creates one if it
        doesn't exist yet. The auto-generated release note record for this
        version is never touched by this operation.
        """
        override = await self.get_by_version(version)

        if override:
            for key, value in data.items():
                setattr(override, key, value)
        else:
            override = ReleaseNoteOverride(version=version, **data)
            self.db.add(override)

        await self.db.flush()
        await self.db.refresh(override)
        return override

    @repo_handler
    async def delete_by_version(self, version: str) -> bool:
        """
        Removes the System Admin override for a version, reverting display
        back to the auto-generated content. Returns True if an override was
        found and deleted, False if there was nothing to reset.
        """
        override = await self.get_by_version(version)
        if not override:
            return False

        await self.db.delete(override)
        await self.db.flush()
        return True
