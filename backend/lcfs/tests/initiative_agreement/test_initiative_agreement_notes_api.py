"""Initiative agreement notes (#5486)."""

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import delete, func, select

from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    InitiativeAgreement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementNote import (
    InitiativeAgreementNote,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _lifecycle_status_id,
    _seed_agreement,
    _two_org_ids,
)

IDIR_DIRECTOR = [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT]


async def _agreement(dbsession, code, **overrides):
    org_id, _ = await _two_org_ids(dbsession)
    return await _seed_agreement(dbsession, org_id, code, **overrides)


def _url(fastapi_app, name, agreement, **params):
    return fastapi_app.url_path_for(
        name, initiative_agreement_id=agreement.initiative_agreement_id, **params
    )


async def _add(client, fastapi_app, agreement, note_text="<p>A note.</p>", **extra):
    return await client.post(
        _url(fastapi_app, "create_note", agreement),
        json={"noteText": note_text, **extra},
    )


# --- API ----------------------------------------------------------------


@pytest.mark.anyio
async def test_notes_are_numbered_in_sequence_and_listed_by_number(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    next_number = await client.get(_url(fastapi_app, "get_next_note_number", agreement))
    assert next_number.status_code == status.HTTP_200_OK
    assert next_number.json() == 1

    first = await _add(client, fastapi_app, agreement, "<p>First</p>")
    # Out of sequence by choice, then back to the default.
    tenth = await _add(client, fastapi_app, agreement, "<p>Tenth</p>", noteNumber=10)
    after = await client.get(_url(fastapi_app, "get_next_note_number", agreement))
    second = await _add(client, fastapi_app, agreement, "<p>Second</p>", noteNumber=2)

    assert first.status_code == status.HTTP_201_CREATED
    assert first.json()["noteNumber"] == 1
    assert tenth.json()["noteNumber"] == 10
    assert after.json() == 11
    assert second.json()["noteNumber"] == 2

    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    assert listed.status_code == status.HTTP_200_OK
    assert [(n["noteNumber"], n["noteText"]) for n in listed.json()] == [
        (1, "<p>First</p>"),
        (2, "<p>Second</p>"),
        (10, "<p>Tenth</p>"),
    ]


@pytest.mark.anyio
async def test_note_number_is_unique_per_agreement_but_reusable_elsewhere(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE2")
    other = await _agreement(dbsession, "IA-26NOTE3")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    await _add(client, fastapi_app, agreement, noteNumber=3)

    duplicate = await _add(client, fastapi_app, agreement, noteNumber=3)
    elsewhere = await _add(client, fastapi_app, other, noteNumber=3)

    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
    assert "Note number 3 is already in use" in duplicate.json()["detail"]
    assert elsewhere.status_code == status.HTTP_201_CREATED
    # Notes only appear on their own agreement.
    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    assert len(listed.json()) == 1


async def _usernames(dbsession):
    """Keycloak usernames of two distinct seeded users: (editor, other)."""
    rows = (
        await dbsession.execute(
            select(UserProfile.user_profile_id, UserProfile.keycloak_username)
            .where(UserProfile.keycloak_username.is_not(None))
            .order_by(UserProfile.user_profile_id)
            .limit(2)
        )
    ).all()
    return rows[0], rows[1]


@pytest.mark.anyio
async def test_last_edited_is_the_saving_user_and_moves_on_each_real_edit(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE4")
    (me_id, me), (other_id, other) = await _usernames(dbsession)
    earlier = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    note = InitiativeAgreementNote(
        initiative_agreement_id=agreement.initiative_agreement_id,
        note_number=1,
        note_text="<p>Original</p>",
        create_user=other,
        update_user=other,
        update_date=earlier,
    )
    dbsession.add(note)
    await dbsession.flush()
    set_mock_user(
        fastapi_app,
        IDIR_IA_ANALYST,
        {"user_profile_id": me_id, "keycloak_username": me},
    )
    url = _url(
        fastapi_app,
        "update_note",
        agreement,
        note_id=note.initiative_agreement_note_id,
    )

    created = await _add(client, fastapi_app, agreement, noteNumber=2)
    assert created.json()["lastEditedBy"]["userProfileId"] == me_id
    assert created.json()["lastEditedDate"]

    # Saving without a change leaves the last editor alone.
    unchanged = await client.put(
        url, json={"noteNumber": 1, "noteText": "<p>Original</p>"}
    )
    assert unchanged.json()["lastEditedBy"]["userProfileId"] == other_id
    assert datetime.fromisoformat(unchanged.json()["lastEditedDate"]) == earlier

    edited = await client.put(url, json={"noteNumber": 1, "noteText": "<p>Changed</p>"})

    assert edited.status_code == status.HTTP_200_OK
    assert edited.json()["noteText"] == "<p>Changed</p>"
    assert edited.json()["lastEditedBy"]["userProfileId"] == me_id
    assert datetime.fromisoformat(edited.json()["lastEditedDate"]) > earlier


@pytest.mark.anyio
async def test_decimal_note_numbers_slot_between_notes_and_serialize_as_numbers(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE15")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    await _add(client, fastapi_app, agreement, "<p>One</p>", noteNumber=1)
    await _add(client, fastapi_app, agreement, "<p>Two</p>", noteNumber=2)

    between = await _add(
        client, fastapi_app, agreement, "<p>Between</p>", noteNumber=1.1
    )
    too_precise = await _add(client, fastapi_app, agreement, noteNumber=1.234)
    zero = await _add(client, fastapi_app, agreement, noteNumber=0)
    listed = await client.get(_url(fastapi_app, "get_notes", agreement))

    assert between.json()["noteNumber"] == 1.1
    assert too_precise.status_code == 422
    assert zero.status_code == 422
    assert [n["noteNumber"] for n in listed.json()] == [1, 1.1, 2]


@pytest.mark.anyio
async def test_edit_can_renumber_but_not_onto_another_note(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE5")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    first = (await _add(client, fastapi_app, agreement)).json()
    await _add(client, fastapi_app, agreement)
    url = _url(
        fastapi_app,
        "update_note",
        agreement,
        note_id=first["initiativeAgreementNoteId"],
    )

    same_number = await client.put(
        url, json={"noteNumber": 1, "noteText": "<p>Same</p>"}
    )
    clash = await client.put(url, json={"noteNumber": 2, "noteText": "<p>Clash</p>"})
    moved = await client.put(url, json={"noteNumber": 7, "noteText": "<p>Moved</p>"})

    assert same_number.status_code == status.HTTP_200_OK
    assert clash.status_code == status.HTTP_400_BAD_REQUEST
    assert moved.json()["noteNumber"] == 7


@pytest.mark.anyio
async def test_delete_removes_the_note_and_frees_its_number(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE6")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    note = (await _add(client, fastapi_app, agreement, noteNumber=4)).json()

    deleted = await client.delete(
        _url(
            fastapi_app,
            "delete_note",
            agreement,
            note_id=note["initiativeAgreementNoteId"],
        )
    )
    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    reused = await _add(client, fastapi_app, agreement, noteNumber=4)

    assert deleted.status_code == status.HTTP_204_NO_CONTENT
    assert listed.json() == []
    assert reused.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_empty_notes_are_refused(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE8")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    blank = await _add(client, fastapi_app, agreement, "<p><br></p>")
    spaces = await _add(client, fastapi_app, agreement, "<p>&nbsp; </p>")
    bad_number = await _add(client, fastapi_app, agreement, noteNumber=0)

    assert blank.status_code == status.HTTP_400_BAD_REQUEST
    assert spaces.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_number.status_code == 422


@pytest.mark.anyio
async def test_long_and_short_notes_round_trip_untruncated(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE9")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    long_note = "".join(
        f"<p>Paragraph {i}. " + "word " * 120 + "</p>" for i in range(8)
    )

    short = await _add(client, fastapi_app, agreement, "<p>One sentence.</p>")
    long = await _add(client, fastapi_app, agreement, long_note)

    assert short.json()["noteText"] == "<p>One sentence.</p>"
    assert long.status_code == status.HTTP_201_CREATED
    assert long.json()["noteText"] == long_note


@pytest.mark.anyio
async def test_disallowed_markup_is_sanitized_before_persistence(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The client sanitizes before display, but an API caller can send
    whatever it likes, so the server must strip disallowed markup too."""
    agreement = await _agreement(dbsession, "IA-26NOTE17")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    added = await _add(
        client,
        fastapi_app,
        agreement,
        "<p>Safe<script>alert('xss')</script></p><img src=x onerror=alert(1)>",
    )

    assert added.status_code == status.HTTP_201_CREATED
    assert added.json()["noteText"] == "<p>Safe</p>"

    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    assert listed.json()[0]["noteText"] == "<p>Safe</p>"


@pytest.mark.anyio
async def test_directors_read_but_cannot_change_notes(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE10")
    note = InitiativeAgreementNote(
        initiative_agreement_id=agreement.initiative_agreement_id,
        note_number=1,
        note_text="<p>Existing</p>",
    )
    dbsession.add(note)
    await dbsession.flush()
    note_id = note.initiative_agreement_note_id
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    created = await _add(client, fastapi_app, agreement)
    edited = await client.put(
        _url(fastapi_app, "update_note", agreement, note_id=note_id),
        json={"noteNumber": 1, "noteText": "<p>x</p>"},
    )
    deleted = await client.delete(
        _url(fastapi_app, "delete_note", agreement, note_id=note_id)
    )

    assert listed.status_code == status.HTTP_200_OK
    assert len(listed.json()) == 1
    assert created.status_code == status.HTTP_403_FORBIDDEN
    assert edited.status_code == status.HTTP_403_FORBIDDEN
    assert deleted.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_proponents_cannot_see_or_touch_notes(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE11")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    listed = await client.get(_url(fastapi_app, "get_notes", agreement))
    created = await _add(client, fastapi_app, agreement)

    assert listed.status_code == status.HTTP_403_FORBIDDEN
    assert created.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_notes_are_kept_on_a_draft_and_a_missing_agreement_is_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A draft is government's own preparation (#5553), so its notes are
    written while it is prepared."""
    draft = await _agreement(
        dbsession,
        "IA-26NOTE12",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, "Draft"),
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    on_draft = await _add(client, fastapi_app, draft)
    missing = await client.get("/api/initiative-agreements/999999/notes")

    assert on_draft.status_code == status.HTTP_201_CREATED, on_draft.text
    assert missing.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_a_note_cannot_be_reached_through_another_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _agreement(dbsession, "IA-26NOTE13")
    other = await _agreement(dbsession, "IA-26NOTE14")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    note = (await _add(client, fastapi_app, agreement)).json()
    note_id = note["initiativeAgreementNoteId"]

    edited = await client.put(
        _url(fastapi_app, "update_note", other, note_id=note_id),
        json={"noteNumber": 1, "noteText": "<p>x</p>"},
    )
    deleted = await client.delete(
        _url(fastapi_app, "delete_note", other, note_id=note_id)
    )

    assert edited.status_code == status.HTTP_404_NOT_FOUND
    assert deleted.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_deleting_an_agreement_deletes_its_notes(dbsession):
    agreement = await _agreement(dbsession, "IA-26NOTE16")
    dbsession.add(
        InitiativeAgreementNote(
            initiative_agreement_id=agreement.initiative_agreement_id,
            note_number=1,
            note_text="<p>Gone with the agreement</p>",
        )
    )
    await dbsession.flush()

    await dbsession.execute(
        delete(InitiativeAgreement).where(
            InitiativeAgreement.initiative_agreement_id
            == agreement.initiative_agreement_id
        )
    )

    remaining = await dbsession.scalar(
        select(func.count()).select_from(InitiativeAgreementNote)
    )
    assert remaining == 0
