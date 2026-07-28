import pytest
from unittest.mock import AsyncMock

from lcfs.db.models.release_note.ReleaseNoteOverride import ReleaseNoteOverride
from lcfs.web.api.release_notes.schema import ReleaseNoteUpdateSchema


# ---------------------------------------------------------------------------
# get_overrides
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_overrides_returns_list(
    release_notes_service, mock_release_note_override_repo, sample_override
):
    mock_release_note_override_repo.get_all = AsyncMock(return_value=[sample_override])

    result = await release_notes_service.get_overrides()

    assert len(result) == 1
    assert result[0].version == sample_override.version
    assert result[0].summary == sample_override.summary
    mock_release_note_override_repo.get_all.assert_called_once()


@pytest.mark.anyio
async def test_get_overrides_returns_empty_when_none_exist(
    release_notes_service, mock_release_note_override_repo
):
    mock_release_note_override_repo.get_all = AsyncMock(return_value=[])

    result = await release_notes_service.get_overrides()

    assert result == []


# ---------------------------------------------------------------------------
# update_override
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_override_creates_new_override(
    release_notes_service, mock_release_note_override_repo
):
    created = ReleaseNoteOverride(
        release_note_override_id=1,
        version="2.0.0",
        summary="New admin summary",
        sections={
            "features": ["A new feature"],
            "fixes": [],
            "security": [],
            "breaking": [],
            "dependencies": [],
            "other": [],
        },
    )
    mock_release_note_override_repo.upsert = AsyncMock(return_value=created)

    data = ReleaseNoteUpdateSchema(
        summary="New admin summary",
        sections={
            "features": ["A new feature"],
            "fixes": [],
            "security": [],
            "breaking": [],
            "dependencies": [],
            "other": [],
        },
    )
    result = await release_notes_service.update_override("2.0.0", data)

    assert result.version == "2.0.0"
    assert result.summary == "New admin summary"
    mock_release_note_override_repo.upsert.assert_called_once()
    called_version, called_payload = mock_release_note_override_repo.upsert.call_args[0]
    assert called_version == "2.0.0"
    assert called_payload["summary"] == "New admin summary"


@pytest.mark.anyio
async def test_update_override_updates_existing_override(
    release_notes_service, mock_release_note_override_repo, sample_override
):
    sample_override.summary = "Edited again"
    mock_release_note_override_repo.upsert = AsyncMock(return_value=sample_override)

    data = ReleaseNoteUpdateSchema(summary="Edited again", sections=None)
    result = await release_notes_service.update_override("1.3.6", data)

    assert result.summary == "Edited again"
    mock_release_note_override_repo.upsert.assert_called_once_with(
        "1.3.6", {"summary": "Edited again", "sections": None}
    )


# ---------------------------------------------------------------------------
# reset_override
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_reset_override_deletes_existing_override(
    release_notes_service, mock_release_note_override_repo
):
    mock_release_note_override_repo.delete_by_version = AsyncMock(return_value=True)

    result = await release_notes_service.reset_override("1.3.6")

    assert result is True
    mock_release_note_override_repo.delete_by_version.assert_called_once_with("1.3.6")


@pytest.mark.anyio
async def test_reset_override_returns_false_when_nothing_to_reset(
    release_notes_service, mock_release_note_override_repo
):
    mock_release_note_override_repo.delete_by_version = AsyncMock(return_value=False)

    result = await release_notes_service.reset_override("9.9.9")

    assert result is False
    mock_release_note_override_repo.delete_by_version.assert_called_once_with("9.9.9")
