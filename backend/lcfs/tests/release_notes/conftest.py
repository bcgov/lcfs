import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.release_note.ReleaseNoteOverride import ReleaseNoteOverride
from lcfs.web.api.release_notes.repo import ReleaseNoteOverrideRepository
from lcfs.web.api.release_notes.services import ReleaseNotesService


@pytest.fixture
def mock_release_notes_service():
    return MagicMock(spec=ReleaseNotesService)


@pytest.fixture
def mock_release_note_override_repo():
    return AsyncMock(spec=ReleaseNoteOverrideRepository)


@pytest.fixture
def sample_override():
    return ReleaseNoteOverride(
        release_note_override_id=1,
        version="1.3.6",
        summary="Admin-corrected summary text.",
        sections={
            "features": ["Corrected feature description"],
            "fixes": [],
            "security": [],
            "breaking": [],
            "dependencies": [],
            "other": [],
        },
    )


@pytest.fixture
def release_notes_service(mock_release_note_override_repo):
    service = ReleaseNotesService.__new__(ReleaseNotesService)
    service.repo = mock_release_note_override_repo
    return service
