from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from lcfs.db.models.initiative_agreement import (
    DesignatedAction,
    DesignatedActionStatus,
    InitiativeAgreement,
    InitiativeAgreementLifecycleStatus,
    InitiativeAgreementNote,
    InitiativeAgreementNoteDesignatedAction,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices


async def _create_agreement(dbsession):
    status = await dbsession.scalar(
        select(InitiativeAgreementLifecycleStatus).where(
            InitiativeAgreementLifecycleStatus.status == "Underway"
        )
    )
    agreement = InitiativeAgreement(
        to_organization_id=1,
        record_kind="agreement",
        lifecycle_status_id=status.initiative_agreement_lifecycle_status_id,
    )
    dbsession.add(agreement)
    await dbsession.flush()
    return agreement


async def _create_action(dbsession, agreement, version=0, group_uuid=None):
    status = await dbsession.scalar(
        select(DesignatedActionStatus).where(
            DesignatedActionStatus.status == "Not started"
        )
    )
    action_values = dict(
        initiative_agreement_id=agreement.initiative_agreement_id,
        action_number=1,
        name="Test designated action",
        current_status_id=status.designated_action_status_id,
        version=version,
    )
    if group_uuid is not None:
        action_values["group_uuid"] = group_uuid
    action = DesignatedAction(**action_values)
    dbsession.add(action)
    await dbsession.flush()
    return action


def _service(dbsession):
    return InitiativeAgreementServices(repo=InitiativeAgreementRepository(dbsession))


@pytest.mark.anyio
async def test_note_numbers_autoincrement_and_sort_numerically(dbsession):
    agreement = await _create_agreement(dbsession)
    service = _service(dbsession)

    first = await service.create_initiative_agreement_note(
        agreement.initiative_agreement_id,
        "<p>First</p>",
        user=SimpleNamespace(keycloak_username="test-user"),
    )
    second = await service.create_initiative_agreement_note(
        agreement.initiative_agreement_id, "<p>Second</p>"
    )
    await service.create_initiative_agreement_note(
        agreement.initiative_agreement_id, "<p>Between</p>", Decimal("1.1")
    )
    await service.create_initiative_agreement_note(
        agreement.initiative_agreement_id, "<p>Tenth</p>", Decimal("10")
    )

    numbers = list(
        (
            await dbsession.scalars(
                select(InitiativeAgreementNote.note_number)
                .where(
                    InitiativeAgreementNote.initiative_agreement_id
                    == agreement.initiative_agreement_id
                )
                .order_by(InitiativeAgreementNote.note_number)
            )
        ).all()
    )
    assert first.note_number == Decimal("1")
    assert second.note_number == Decimal("2")
    assert first.create_user == "test-user"
    assert numbers == [
        Decimal("1"),
        Decimal("1.1"),
        Decimal("2"),
        Decimal("10"),
    ]


@pytest.mark.anyio
async def test_note_number_override_and_uniqueness_are_per_agreement(dbsession):
    first_agreement = await _create_agreement(dbsession)
    second_agreement = await _create_agreement(dbsession)
    service = _service(dbsession)

    first_note = await service.create_initiative_agreement_note(
        first_agreement.initiative_agreement_id,
        "<p>Inserted between notes</p>",
        Decimal("1.1"),
    )
    second_note = await service.create_initiative_agreement_note(
        second_agreement.initiative_agreement_id,
        "<p>Same number, different agreement</p>",
        Decimal("1.1"),
    )

    assert first_note.note_number == second_note.note_number == Decimal("1.1")
    with pytest.raises(HTTPException) as error:
        await service.create_initiative_agreement_note(
            first_agreement.initiative_agreement_id,
            "<p>Duplicate</p>",
            Decimal("1.1"),
        )
    assert error.value.status_code == 400
    assert error.value.detail == (
        "Note number 1.1 is already in use for this initiative agreement."
    )


@pytest.mark.anyio
async def test_note_da_link_follows_action_version_group(dbsession):
    agreement = await _create_agreement(dbsession)
    original = await _create_action(dbsession, agreement)
    service = _service(dbsession)

    note = await service.create_initiative_agreement_note(
        agreement.initiative_agreement_id,
        "<p>Action note</p>",
        designated_action_ids=[original.designated_action_id],
    )
    amendment = await _create_action(
        dbsession, agreement, version=1, group_uuid=original.group_uuid
    )
    link = await dbsession.get(
        InitiativeAgreementNoteDesignatedAction,
        (note.initiative_agreement_note_id, original.designated_action_id),
    )
    grouped_actions = list(
        (
            await dbsession.scalars(
                select(DesignatedAction).where(
                    DesignatedAction.group_uuid == link.designated_action_group_uuid
                )
            )
        ).all()
    )

    assert link.designated_action_id == original.designated_action_id
    assert {action.designated_action_id for action in grouped_actions} == {
        original.designated_action_id,
        amendment.designated_action_id,
    }


@pytest.mark.anyio
async def test_note_da_link_rejects_an_action_from_another_agreement(dbsession):
    first_agreement = await _create_agreement(dbsession)
    second_agreement = await _create_agreement(dbsession)
    other_action = await _create_action(dbsession, second_agreement)

    with pytest.raises(HTTPException) as error:
        await _service(dbsession).create_initiative_agreement_note(
            first_agreement.initiative_agreement_id,
            "<p>Invalid link</p>",
            designated_action_ids=[other_action.designated_action_id],
        )
    assert error.value.status_code == 400
    assert error.value.detail == (
        "Every designated action must belong to this initiative agreement."
    )


@pytest.mark.anyio
async def test_database_rejects_cross_agreement_note_da_link(dbsession):
    first_agreement = await _create_agreement(dbsession)
    second_agreement = await _create_agreement(dbsession)
    other_action = await _create_action(dbsession, second_agreement)
    note = await _service(dbsession).create_initiative_agreement_note(
        first_agreement.initiative_agreement_id, "<p>Note</p>"
    )
    dbsession.add(
        InitiativeAgreementNoteDesignatedAction(
            initiative_agreement_note_id=note.initiative_agreement_note_id,
            initiative_agreement_id=first_agreement.initiative_agreement_id,
            designated_action_id=other_action.designated_action_id,
            designated_action_group_uuid=other_action.group_uuid,
        )
    )

    with pytest.raises(IntegrityError):
        await dbsession.flush()


@pytest.mark.anyio
async def test_deleting_note_cascades_to_da_links(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_action(dbsession, agreement)
    note = await _service(dbsession).create_initiative_agreement_note(
        agreement.initiative_agreement_id,
        "<p>Note</p>",
        designated_action_ids=[action.designated_action_id],
    )

    await dbsession.delete(note)
    await dbsession.flush()

    links = await dbsession.scalars(
        select(InitiativeAgreementNoteDesignatedAction).where(
            InitiativeAgreementNoteDesignatedAction.initiative_agreement_note_id
            == note.initiative_agreement_note_id
        )
    )
    assert links.all() == []


@pytest.mark.anyio
async def test_deleting_action_cascades_to_note_links(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_action(dbsession, agreement)
    note = await _service(dbsession).create_initiative_agreement_note(
        agreement.initiative_agreement_id,
        "<p>Note</p>",
        designated_action_ids=[action.designated_action_id],
    )

    await dbsession.delete(action)
    await dbsession.flush()

    assert await dbsession.get(
        InitiativeAgreementNote, note.initiative_agreement_note_id
    )
    links = await dbsession.scalars(
        select(InitiativeAgreementNoteDesignatedAction).where(
            InitiativeAgreementNoteDesignatedAction.initiative_agreement_note_id
            == note.initiative_agreement_note_id
        )
    )
    assert links.all() == []


@pytest.mark.anyio
async def test_deleting_agreement_cascades_to_notes(dbsession):
    agreement = await _create_agreement(dbsession)
    note = await _service(dbsession).create_initiative_agreement_note(
        agreement.initiative_agreement_id, "<p>Note</p>"
    )

    await dbsession.delete(agreement)
    await dbsession.flush()

    remaining_note_id = await dbsession.scalar(
        select(InitiativeAgreementNote.initiative_agreement_note_id).where(
            InitiativeAgreementNote.initiative_agreement_note_id
            == note.initiative_agreement_note_id
        )
    )
    assert remaining_note_id is None
