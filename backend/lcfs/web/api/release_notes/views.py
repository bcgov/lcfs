import structlog
from typing import List
from fastapi import APIRouter, Depends, Request, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.release_notes.schema import (
    ReleaseNoteOverrideSchema,
    ReleaseNoteUpdateSchema,
)
from lcfs.web.api.release_notes.services import ReleaseNotesService
from lcfs.web.core.decorators import view_handler

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get(
    "/overrides",
    response_model=List[ReleaseNoteOverrideSchema],
    status_code=status.HTTP_200_OK,
)
async def get_release_note_overrides(
    service: ReleaseNotesService = Depends(),
):
    """
    Returns all System Admin edits (overrides) for auto-generated release
    notes in this environment. No auth required: the release notes page is
    public and every viewer needs these overrides to render edited content.
    """
    return await service.get_overrides()


@router.put(
    "/{version}",
    response_model=ReleaseNoteOverrideSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SYSTEM_ADMIN])
async def update_release_note(
    request: Request,
    version: str,
    data: ReleaseNoteUpdateSchema,
    service: ReleaseNotesService = Depends(),
):
    """
    Creates or updates the System Admin edit for a release note version.
    Only System Admin users can perform this action. This never modifies
    the auto-generated release-notes.json; it stores an override that the
    frontend displays instead of the auto-generated content for this
    version, in this environment.
    """
    return await service.update_override(version, data)


@router.delete(
    "/{version}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler([RoleEnum.SYSTEM_ADMIN])
async def reset_release_note(
    request: Request,
    version: str,
    service: ReleaseNotesService = Depends(),
):
    """
    Removes the System Admin override for a release note version, reverting
    it back to the auto-generated content. Only System Admin users can
    perform this action. The auto-generated release-notes.json is never
    modified, so this simply deletes the stored override for this
    environment.
    """
    await service.reset_override(version)
