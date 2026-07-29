from typing import List
from fastapi import Depends

from lcfs.web.api.release_notes.repo import ReleaseNoteOverrideRepository
from lcfs.web.api.release_notes.schema import (
    ReleaseNoteOverrideSchema,
    ReleaseNoteUpdateSchema,
)
from lcfs.web.core.decorators import service_handler


class ReleaseNotesService:
    def __init__(self, repo: ReleaseNoteOverrideRepository = Depends()):
        self.repo = repo

    @service_handler
    async def get_overrides(self) -> List[ReleaseNoteOverrideSchema]:
        """
        Returns every System Admin edit currently stored for this environment.
        The frontend merges these on top of the static, auto-generated
        release-notes.json so every viewer sees the corrected content.
        """
        overrides = await self.repo.get_all()
        return [ReleaseNoteOverrideSchema.model_validate(o) for o in overrides]

    @service_handler
    async def update_override(
        self, version: str, data: ReleaseNoteUpdateSchema
    ) -> ReleaseNoteOverrideSchema:
        """
        Creates or updates the override for a release version. Does not
        modify the auto-generated release-notes.json in any way; the
        auto-generation process and its output remain the source of truth
        for content that has not been edited.
        """
        payload = data.model_dump()
        override = await self.repo.upsert(version, payload)
        return ReleaseNoteOverrideSchema.model_validate(override)

    @service_handler
    async def reset_override(self, version: str) -> bool:
        """
        Deletes the System Admin override for a version, reverting display
        back to the original auto-generated content. The auto-generated
        release-notes.json entry itself was never touched, so this is a
        non-destructive, fully reversible action.
        """
        return await self.repo.delete_by_version(version)
