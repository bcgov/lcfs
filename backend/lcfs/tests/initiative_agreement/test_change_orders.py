"""Change order drafts on initiative agreement packages (#5555).

Most of the flow is driven through the services, because one test can mock
only one API user (Starlette freezes middleware after the first request) and
a change order involves several: an analyst prepares it, the organization
keeps reading the accepted package, and the Director accepts. Each API test
checks one user's view of a package the services put in place.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException, status
from httpx import AsyncClient
from sqlalchemy import func, select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.initiative_agreement.ChangeOrderVersion import (
    DesignatedActionVersion,
    EvidenceRequirementVersion,
    InitiativeAgreementNoteVersion,
    InitiativeAgreementVersion,
)
from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CHANGE_ORDER,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementChangeOrder import (
    InitiativeAgreementChangeOrder,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleHistory import (
    InitiativeAgreementLifecycleHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementNote import (
    InitiativeAgreementNote,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import _seed_action
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    PAGINATION_BODY,
    _lifecycle_status_id,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_credit_columns import (
    _seed_transaction,
)
from lcfs.utils.dates import PACIFIC_TZ
from lcfs.web.api.dashboard.services import _in_effect
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.schema import (
    AgreementUpdateSchema,
    DesignatedActionCreateSchema,
    DesignatedActionUpdateSchema,
    DesignatedActionWorkflowSchema,
    EvidenceRequirementCreateSchema,
    EvidenceRequirementUpdateSchema,
    InitiativeAgreementNoteCreateSchema,
    InitiativeAgreementNoteUpdateSchema,
)
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices

IDIR_IA_ANALYST = [RoleEnum.IA_ANALYST, RoleEnum.GOVERNMENT]
IDIR_IA_MANAGER = [RoleEnum.IA_MANAGER, RoleEnum.GOVERNMENT]
IDIR_DIRECTOR = [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT]
CHANGE_ORDER_DRAFT = "Change order draft"


def _user(*roles, name):
    first, last = name.split(" ", 1)
    return SimpleNamespace(
        role_names=list(roles),
        keycloak_username=first.lower(),
        user_profile_id=None,
        first_name=first,
        last_name=last,
        organization=None,
    )


ANALYST = _user(RoleEnum.GOVERNMENT, RoleEnum.IA_ANALYST, name="Ana Analyst")
MANAGER = _user(RoleEnum.GOVERNMENT, RoleEnum.IA_MANAGER, name="Max Manager")
DIRECTOR = _user(RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR, name="Dee Director")
PROPONENT = _user(RoleEnum.SUPPLIER, RoleEnum.IA_PROPONENT, name="Pat Proponent")


async def _async_value(value):
    return value


def _service(dbsession, user=None) -> InitiativeAgreementServices:
    """The service as a request by `user` would build it; no user reads as
    an organization (the accepted package)."""
    return InitiativeAgreementServices(
        repo=InitiativeAgreementRepository(dbsession),
        org_service=SimpleNamespace(
            get_organization=lambda organization_id: _async_value(None)
        ),
        internal_comment_service=None,
        notfn_service=None,
        request=SimpleNamespace(user=user) if user is not None else None,
    )


async def _package(dbsession, code):
    """An underway agreement with two actions, one requirement and a note."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, code, title="Original title")
    first = await _seed_action(dbsession, agreement, 1, "Build the plant", 1000)
    second = await _seed_action(dbsession, agreement, 2, "Commission it", 500)
    requirement = EvidenceRequirement(
        designated_action_id=first.designated_action_id,
        requirement_number=1,
        title="Permit",
        description="Copy of the permit",
    )
    note = InitiativeAgreementNote(
        initiative_agreement_id=agreement.initiative_agreement_id,
        note_number=Decimal(1),
        note_text="<p>Original note</p>",
    )
    dbsession.add_all([requirement, note])
    await dbsession.flush()
    return SimpleNamespace(
        org_id=org_id,
        agreement=agreement,
        first=first,
        second=second,
        requirement=requirement,
        note=note,
    )


async def _versions(dbsession, model, column, record_id):
    rows = await dbsession.execute(
        select(model).where(getattr(model, column) == record_id).order_by(model.version)
    )
    return list(rows.scalars().all())


async def _version_count(dbsession, model):
    return await dbsession.scalar(select(func.count()).select_from(model))


async def _start(dbsession, package, user=ANALYST):
    return await _service(dbsession, user).start_change_order(
        package.agreement.initiative_agreement_id, user
    )


async def _edit_first_action(dbsession, package, user=ANALYST, **changes):
    return await _service(dbsession, user).update_designated_action(
        package.first.designated_action_id,
        DesignatedActionUpdateSchema(
            **{"name": "Build the bigger plant", "credit_allocation": 1500, **changes}
        ),
        user,
    )


async def _accept(dbsession, package, accepted_date=None, user=DIRECTOR):
    return await _service(dbsession, user).accept_change_order(
        package.agreement.initiative_agreement_id,
        accepted_date or date(2026, 1, 15),
        user,
    )


# --- Starting ---------------------------------------------------------------


@pytest.mark.anyio
async def test_starting_a_change_order_puts_an_underway_agreement_in_draft(dbsession):
    package = await _package(dbsession, "IA-26CO1")

    profile = await _start(dbsession, package)

    assert profile.lifecycle_status.status == CHANGE_ORDER_DRAFT
    assert profile.change_order.change_order_number == 1
    assert profile.change_order.status == "Draft"
    assert profile.change_order.origin == "IDIR"
    assert profile.change_order.started_by_display_name == "Ana Analyst"
    # An analyst can start one but neither accept nor discard it.
    assert profile.change_order_actions == []
    history = (
        (
            await dbsession.execute(
                select(InitiativeAgreementLifecycleHistory).where(
                    InitiativeAgreementLifecycleHistory.initiative_agreement_id
                    == package.agreement.initiative_agreement_id
                )
            )
        )
        .scalars()
        .all()
    )
    assert [h.display_name for h in history] == ["Ana Analyst"]


@pytest.mark.anyio
async def test_the_director_may_accept_or_discard_and_a_manager_may_discard(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO2")
    await _start(dbsession, package, user=MANAGER)
    agreement_id = package.agreement.initiative_agreement_id

    director_view = await _service(
        dbsession, DIRECTOR
    ).get_initiative_agreement_profile(agreement_id)
    manager_view = await _service(dbsession, MANAGER).get_initiative_agreement_profile(
        agreement_id
    )

    assert director_view.change_order_actions == ["accept", "discard"]
    assert manager_view.change_order_actions == ["discard"]


@pytest.mark.anyio
@pytest.mark.parametrize("lifecycle", ["Completed", "Terminated", "Draft"])
async def test_a_change_order_starts_only_on_an_underway_agreement(
    dbsession, lifecycle
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id,
        f"IA-26CO3{lifecycle[0]}",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, lifecycle),
    )
    service = _service(dbsession, ANALYST)

    with pytest.raises(HTTPException) as error:
        await service.change_orders.start(agreement.initiative_agreement_id, ANALYST)

    assert error.value.status_code == 400


@pytest.mark.anyio
async def test_only_one_change_order_is_open_at_a_time(dbsession):
    package = await _package(dbsession, "IA-26CO4")
    await _start(dbsession, package)

    with pytest.raises(HTTPException) as error:
        await _start(dbsession, package)

    assert error.value.status_code == 400
    open_orders = await dbsession.scalar(
        select(func.count()).where(
            InitiativeAgreementChangeOrder.initiative_agreement_id
            == package.agreement.initiative_agreement_id
        )
    )
    assert open_orders == 1


# --- Versioning ---------------------------------------------------------------


@pytest.mark.anyio
async def test_an_edit_in_a_change_order_is_a_pending_version_of_that_record_only(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO5")
    await _start(dbsession, package)

    edited = await _edit_first_action(dbsession, package)

    # IDIR sees the action as the change order would leave it ...
    assert edited.name == "Build the bigger plant"
    assert edited.credit_allocation == 1500
    assert edited.change_order_state == "edited"
    # ... while the live row keeps the accepted values.
    await dbsession.refresh(package.first)
    assert package.first.name == "Build the plant"
    assert package.first.credit_allocation == 1000
    pending = await _versions(
        dbsession,
        DesignatedActionVersion,
        "designated_action_id",
        package.first.designated_action_id,
    )
    assert [(v.version, v.action_type, v.name) for v in pending] == [
        (1, ActionTypeEnum.UPDATE, "Build the bigger plant")
    ]
    # Nothing else in the package is versioned or copied.
    for model, column, record in (
        (DesignatedActionVersion, "designated_action_id", package.second),
        (
            EvidenceRequirementVersion,
            "evidence_requirement_id",
            package.requirement,
        ),
        (InitiativeAgreementNoteVersion, "initiative_agreement_note_id", package.note),
        (
            InitiativeAgreementVersion,
            "initiative_agreement_id",
            package.agreement,
        ),
    ):
        assert await _versions(dbsession, model, column, getattr(record, column)) == []
    actions = await dbsession.scalar(
        select(func.count()).where(
            DesignatedAction.initiative_agreement_id
            == package.agreement.initiative_agreement_id
        )
    )
    assert actions == 2


@pytest.mark.anyio
async def test_editing_a_record_back_to_its_accepted_values_leaves_no_version(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO6")
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)

    reverted = await _edit_first_action(
        dbsession, package, name="Build the plant", credit_allocation=1000
    )

    assert reverted.change_order_state is None
    assert (
        await _versions(
            dbsession,
            DesignatedActionVersion,
            "designated_action_id",
            package.first.designated_action_id,
        )
        == []
    )


@pytest.mark.anyio
async def test_the_organization_keeps_the_accepted_package_during_a_change_order(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO7")
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)
    analyst = _service(dbsession, ANALYST)
    agreement_id = package.agreement.initiative_agreement_id
    await analyst.update_agreement(
        agreement_id, AgreementUpdateSchema(title="Amended title"), ANALYST
    )
    await analyst.create_designated_action(
        agreement_id, DesignatedActionCreateSchema(name="New action"), ANALYST
    )

    organization_view = await _service(
        dbsession, PROPONENT
    ).get_initiative_agreement_profile(agreement_id)
    idir_view = await analyst.get_initiative_agreement_profile(agreement_id)

    assert organization_view.lifecycle_status.status == "Underway"
    assert organization_view.title == "Original title"
    assert organization_view.change_order is None
    assert organization_view.change_order_actions == []
    assert [
        (a.name, a.credit_allocation) for a in organization_view.designated_actions
    ] == [
        ("Build the plant", 1000),
        ("Commission it", 500),
    ]
    assert all(
        a.change_order_state is None for a in organization_view.designated_actions
    )

    assert idir_view.lifecycle_status.status == CHANGE_ORDER_DRAFT
    assert idir_view.title == "Amended title"
    assert idir_view.change_order_state == "edited"
    assert [
        (a.name, a.credit_allocation, a.change_order_state)
        for a in idir_view.designated_actions
    ] == [
        ("Build the bigger plant", 1500, "edited"),
        ("Commission it", 500, None),
        ("New action", 0, "added"),
    ]
    # The agreement row itself is untouched until acceptance.
    await dbsession.refresh(package.agreement)
    assert package.agreement.title == "Original title"


# --- Acceptance -----------------------------------------------------------------


@pytest.mark.anyio
async def test_acceptance_makes_the_versions_current_and_keeps_the_originals(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO8")
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)
    back_dated = date(2025, 12, 1)

    profile = await _accept(dbsession, package, back_dated)

    assert profile.lifecycle_status.status == "Underway"
    assert profile.change_order is None
    await dbsession.refresh(package.first)
    assert package.first.name == "Build the bigger plant"
    assert package.first.credit_allocation == 1500
    assert package.first.version == 1
    assert package.first.action_type == ActionTypeEnum.UPDATE

    versions = await _versions(
        dbsession,
        DesignatedActionVersion,
        "designated_action_id",
        package.first.designated_action_id,
    )
    assert [(v.version, v.name, v.credit_allocation) for v in versions] == [
        (0, "Build the plant", 1000),
        (1, "Build the bigger plant", 1500),
    ]
    assert versions[0].change_order_id is None

    change_order = await dbsession.get(
        InitiativeAgreementChangeOrder, versions[1].change_order_id
    )
    assert change_order.status == "Accepted"
    # The effective date is stored apart from when it was recorded.
    assert change_order.accepted_date == back_dated
    assert change_order.accepted_at.astimezone(PACIFIC_TZ).date() != back_dated
    assert (datetime.now(timezone.utc) - change_order.accepted_at) < timedelta(
        minutes=5
    )
    assert change_order.accepted_by_display_name == "Dee Director"

    events = (
        (
            await dbsession.execute(
                select(DesignatedActionHistory).where(
                    DesignatedActionHistory.designated_action_id
                    == package.first.designated_action_id,
                    DesignatedActionHistory.event == EVENT_CHANGE_ORDER,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1
    assert events[0].snapshot["accepted_date"] == "2025-12-01"
    assert events[0].snapshot["changed"]["credit_allocation"] == {
        "from": 1000,
        "to": 1500,
    }


@pytest.mark.anyio
async def test_previous_versions_stay_available_to_idir(dbsession):
    package = await _package(dbsession, "IA-26CO9")
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)
    await _accept(dbsession, package)
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package, name="Build the biggest plant")

    versions = await _service(dbsession, ANALYST).get_record_versions(
        "designated-action", package.first.designated_action_id, ANALYST
    )

    assert [
        (v.version, v.values["name"], v.is_current, v.is_pending) for v in versions
    ] == [
        (0, "Build the plant", False, False),
        (1, "Build the bigger plant", True, False),
        (2, "Build the biggest plant", False, True),
    ]
    assert versions[1].change_order_number == 1
    assert versions[1].accepted_date == date(2026, 1, 15)
    assert versions[2].change_order_number == 2


@pytest.mark.anyio
async def test_only_the_director_accepts(dbsession):
    package = await _package(dbsession, "IA-26CO10")
    await _start(dbsession, package)

    for user in (ANALYST, MANAGER):
        with pytest.raises(HTTPException) as error:
            await _accept(dbsession, package, user=user)
        assert error.value.status_code == 403


@pytest.mark.anyio
async def test_the_accepted_date_cannot_be_in_the_future(dbsession):
    package = await _package(dbsession, "IA-26CO11")
    await _start(dbsession, package)
    tomorrow = datetime.now(PACIFIC_TZ).date() + timedelta(days=1)

    with pytest.raises(HTTPException) as error:
        await _accept(dbsession, package, tomorrow)

    assert error.value.status_code == 400


@pytest.mark.anyio
async def test_records_a_change_order_adds_join_the_package_only_on_acceptance(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO12")
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)
    agreement_id = package.agreement.initiative_agreement_id
    added = await analyst.create_designated_action(
        agreement_id,
        DesignatedActionCreateSchema(name="Added action", credit_allocation=250),
        ANALYST,
    )
    requirement = await analyst.create_evidence_requirement(
        added.designated_action_id,
        EvidenceRequirementCreateSchema(title="Report", description="Final report"),
        ANALYST,
    )
    note = await analyst.create_note(
        agreement_id,
        InitiativeAgreementNoteCreateSchema(note_text="<p>Added note</p>"),
        ANALYST,
    )
    organization = _service(dbsession, PROPONENT)

    assert added.change_order_state == "added"
    assert requirement.change_order_state == "added"
    assert note.change_order_state == "added"
    before = await organization.get_initiative_agreement_profile(agreement_id)
    assert "Added action" not in [a.name for a in before.designated_actions]
    # Nor does it count in the package's credit totals.
    totals, _ = await analyst.repo.get_initiative_agreements_paginated(
        _pagination("IA-26CO12")
    )
    assert totals[0][1] == 1500

    await _accept(dbsession, package)

    after = await organization.get_initiative_agreement_profile(agreement_id)
    assert "Added action" in [a.name for a in after.designated_actions]
    totals, _ = await analyst.repo.get_initiative_agreements_paginated(
        _pagination("IA-26CO12")
    )
    assert totals[0][1] == 1750
    for model, column, record_id in (
        (DesignatedActionVersion, "designated_action_id", added.designated_action_id),
        (
            EvidenceRequirementVersion,
            "evidence_requirement_id",
            requirement.evidence_requirement_id,
        ),
        (
            InitiativeAgreementNoteVersion,
            "initiative_agreement_note_id",
            note.initiative_agreement_note_id,
        ),
    ):
        versions = await _versions(dbsession, model, column, record_id)
        assert [(v.version, v.action_type) for v in versions] == [
            (0, ActionTypeEnum.CREATE)
        ]
        assert versions[0].change_order_id is not None
    added_row = await dbsession.get(DesignatedAction, added.designated_action_id)
    assert added_row.pending_change_order_id is None


def _pagination(code):
    from lcfs.web.api.base import PaginationRequestSchema

    return PaginationRequestSchema(
        page=1,
        size=10,
        sort_orders=[],
        filters=[
            {
                "field": "ia_code",
                "filter_type": "text",
                "type": "equals",
                "filter": code,
            }
        ],
    )


@pytest.mark.anyio
async def test_removals_wait_for_acceptance_and_keep_their_versions(dbsession):
    package = await _package(dbsession, "IA-26CO13")
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)
    agreement_id = package.agreement.initiative_agreement_id
    await analyst.remove_designated_action(package.second.designated_action_id, ANALYST)
    await analyst.deactivate_evidence_requirement(
        package.requirement.evidence_requirement_id, ANALYST
    )
    await analyst.delete_note(
        agreement_id, package.note.initiative_agreement_note_id, ANALYST
    )

    idir = await analyst.get_initiative_agreement_profile(agreement_id)
    organization = await _service(
        dbsession, PROPONENT
    ).get_initiative_agreement_profile(agreement_id)
    notes = await analyst.get_notes(agreement_id, ANALYST)
    assert [(a.name, a.change_order_state) for a in idir.designated_actions] == [
        ("Build the plant", None),
        ("Commission it", "removed"),
    ]
    assert [n.change_order_state for n in notes] == ["removed"]
    assert len(organization.designated_actions) == 2

    await _accept(dbsession, package)

    after = await _service(dbsession, PROPONENT).get_initiative_agreement_profile(
        agreement_id
    )
    assert [a.name for a in after.designated_actions] == ["Build the plant"]
    for record in (package.second, package.requirement, package.note):
        await dbsession.refresh(record)
    assert package.second.action_type == ActionTypeEnum.DELETE
    assert package.requirement.is_active is False
    assert package.note.is_active is False
    assert await analyst.get_notes(agreement_id, ANALYST) == []
    note_versions = await _versions(
        dbsession,
        InitiativeAgreementNoteVersion,
        "initiative_agreement_note_id",
        package.note.initiative_agreement_note_id,
    )
    assert [(v.version, v.action_type) for v in note_versions] == [
        (0, ActionTypeEnum.CREATE),
        (1, ActionTypeEnum.DELETE),
    ]
    # A removed note's number is free again.
    assert await analyst.get_next_note_number(agreement_id, ANALYST) == 1


@pytest.mark.anyio
async def test_renumbering_notes_in_a_change_order_can_swap_two_numbers(dbsession):
    package = await _package(dbsession, "IA-26CO14")
    agreement_id = package.agreement.initiative_agreement_id
    second = InitiativeAgreementNote(
        initiative_agreement_id=agreement_id,
        note_number=Decimal(2),
        note_text="<p>Second</p>",
    )
    dbsession.add(second)
    await dbsession.flush()
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)

    async def renumber(note, number, text):
        return await analyst.update_note(
            agreement_id,
            note.initiative_agreement_note_id,
            InitiativeAgreementNoteUpdateSchema(note_number=number, note_text=text),
            ANALYST,
        )

    with pytest.raises(HTTPException):
        await renumber(package.note, 2, "<p>Original note</p>")
    await renumber(package.note, 3, "<p>Original note</p>")
    await renumber(second, 1, "<p>Second</p>")
    await renumber(package.note, 2, "<p>Original note</p>")

    await _accept(dbsession, package)

    notes = await analyst.get_notes(agreement_id, ANALYST)
    assert [(float(n.note_number), n.note_text) for n in notes] == [
        (1, "<p>Second</p>"),
        (2, "<p>Original note</p>"),
    ]


@pytest.mark.anyio
async def test_requirement_wording_is_versioned_but_its_review_applies_at_once(
    dbsession,
):
    package = await _package(dbsession, "IA-26CO15")
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)

    updated = await analyst.update_evidence_requirement(
        package.requirement.evidence_requirement_id,
        EvidenceRequirementUpdateSchema(
            title="Building permit", review_outcome="Satisfactory"
        ),
        ANALYST,
    )

    assert updated.title == "Building permit"
    assert updated.change_order_state == "edited"
    await dbsession.refresh(package.requirement)
    assert package.requirement.title == "Permit"
    assert package.requirement.review_outcome == "Satisfactory"


# --- Discarding ------------------------------------------------------------------


@pytest.mark.anyio
async def test_discarding_drops_the_edits_and_retires_what_was_added(dbsession):
    package = await _package(dbsession, "IA-26CO16")
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)
    analyst = _service(dbsession, ANALYST)
    agreement_id = package.agreement.initiative_agreement_id
    added = await analyst.create_designated_action(
        agreement_id, DesignatedActionCreateSchema(name="Added action"), ANALYST
    )
    await analyst.create_note(
        agreement_id,
        InitiativeAgreementNoteCreateSchema(note_text="<p>Added note</p>"),
        ANALYST,
    )

    with pytest.raises(HTTPException) as error:
        await analyst.discard_change_order(agreement_id, ANALYST)
    assert error.value.status_code == 403

    profile = await _service(dbsession, MANAGER).discard_change_order(
        agreement_id, MANAGER
    )

    assert profile.lifecycle_status.status == "Underway"
    assert [a.name for a in profile.designated_actions] == [
        "Build the plant",
        "Commission it",
    ]
    assert (
        await _versions(
            dbsession,
            DesignatedActionVersion,
            "designated_action_id",
            package.first.designated_action_id,
        )
        == []
    )
    retired = await dbsession.get(DesignatedAction, added.designated_action_id)
    await dbsession.refresh(retired)
    assert retired.action_type == ActionTypeEnum.DELETE
    assert [n.note_text for n in await analyst.get_notes(agreement_id, ANALYST)] == [
        "<p>Original note</p>"
    ]
    change_order = (
        await dbsession.execute(
            select(InitiativeAgreementChangeOrder).where(
                InitiativeAgreementChangeOrder.initiative_agreement_id == agreement_id
            )
        )
    ).scalar_one()
    assert change_order.status == "Discarded"
    assert change_order.discarded_by_display_name == "Max Manager"
    # A new change order can start afterwards.
    restarted = await _start(dbsession, package)
    assert restarted.change_order.change_order_number == 2


# --- Permissions and guards ------------------------------------------------------


@pytest.mark.anyio
async def test_the_director_edits_only_inside_a_change_order(dbsession):
    package = await _package(dbsession, "IA-26CO17")

    with pytest.raises(HTTPException) as error:
        await _edit_first_action(dbsession, package, user=DIRECTOR)
    assert error.value.status_code == 403

    await _start(dbsession, package, user=DIRECTOR)
    edited = await _edit_first_action(dbsession, package, user=DIRECTOR)
    assert edited.change_order_state == "edited"

    with pytest.raises(HTTPException) as error:
        await _service(dbsession, DIRECTOR).update_evidence_requirement(
            package.requirement.evidence_requirement_id,
            EvidenceRequirementUpdateSchema(review_outcome="Satisfactory"),
            DIRECTOR,
        )
    assert error.value.status_code == 403


@pytest.mark.anyio
async def test_a_designated_action_is_removed_only_in_a_change_order(dbsession):
    package = await _package(dbsession, "IA-26CO18")

    with pytest.raises(HTTPException) as error:
        await _service(dbsession, ANALYST).remove_designated_action(
            package.second.designated_action_id, ANALYST
        )

    assert error.value.status_code == 400


@pytest.mark.anyio
async def test_a_change_order_cannot_take_away_issued_credits(dbsession):
    package = await _package(dbsession, "IA-26CO19")
    package.first.transaction_id = await _seed_transaction(
        dbsession, package.org_id, 800
    )
    package.first.recommended_credits = 800
    await dbsession.flush()
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)

    with pytest.raises(HTTPException) as below:
        await _edit_first_action(dbsession, package, credit_allocation=700)
    with pytest.raises(HTTPException) as removed:
        await analyst.remove_designated_action(
            package.first.designated_action_id, ANALYST
        )

    assert below.value.status_code == 400
    assert removed.value.status_code == 400
    raised = await _edit_first_action(dbsession, package, credit_allocation=900)
    assert raised.credit_allocation == 900


@pytest.mark.anyio
async def test_an_added_action_cannot_be_worked_until_accepted(dbsession):
    package = await _package(dbsession, "IA-26CO20")
    await _start(dbsession, package)
    analyst = _service(dbsession, ANALYST)
    added = await analyst.create_designated_action(
        package.agreement.initiative_agreement_id,
        DesignatedActionCreateSchema(name="Added action"),
        ANALYST,
    )

    with pytest.raises(HTTPException) as error:
        await analyst.perform_workflow_action(
            added.designated_action_id,
            DesignatedActionWorkflowSchema(action="request_information", comment="x"),
            ANALYST,
        )

    assert error.value.status_code == 400


def test_a_change_order_draft_counts_as_underway_on_the_dashboards():
    assert _in_effect({"Underway": 3, CHANGE_ORDER_DRAFT: 2, "Completed": 4}) == 5


# --- API: one user's view per test -------------------------------------------------


async def _package_in_change_order(dbsession, code):
    package = await _package(dbsession, code)
    await _start(dbsession, package)
    await _edit_first_action(dbsession, package)
    await _service(dbsession, ANALYST).create_designated_action(
        package.agreement.initiative_agreement_id,
        DesignatedActionCreateSchema(name="Added action"),
        ANALYST,
    )
    return package


def _profile_url(fastapi_app, package):
    return fastapi_app.url_path_for(
        "get_initiative_agreement_profile",
        initiative_agreement_id=package.agreement.initiative_agreement_id,
    )


@pytest.mark.anyio
async def test_bceid_reads_the_accepted_package_as_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _package_in_change_order(dbsession, "IA-26CO21")
    set_mock_user(
        fastapi_app, [RoleEnum.IA_PROPONENT], {"organization_id": package.org_id}
    )

    profile = (await client.get(_profile_url(fastapi_app, package))).json()
    grid = await client.post(
        fastapi_app.url_path_for("get_initiative_agreements"),
        json={
            **PAGINATION_BODY,
            "size": 200,
            "filters": [
                {
                    "field": "lifecycleStatus.status",
                    "filterType": "text",
                    "type": "equals",
                    "filter": "Underway",
                }
            ],
        },
    )
    statuses = await client.get(
        fastapi_app.url_path_for("get_initiative_agreement_statuses")
    )

    assert profile["lifecycleStatus"]["status"] == "Underway"
    assert profile["changeOrder"] is None
    assert [
        (a["name"], a["creditAllocation"], a["changeOrderState"])
        for a in profile["designatedActions"]
    ] == [("Build the plant", 1000, None), ("Commission it", 500, None)]
    row = next(
        r for r in grid.json()["initiativeAgreements"] if r["iaCode"] == "IA-26CO21"
    )
    assert row["lifecycleStatus"]["status"] == "Underway"
    assert CHANGE_ORDER_DRAFT not in [s["status"] for s in statuses.json()]


@pytest.mark.anyio
async def test_idir_reads_the_change_order(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _package_in_change_order(dbsession, "IA-26CO22")
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    profile = (await client.get(_profile_url(fastapi_app, package))).json()
    action_profile = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_profile",
            designated_action_id=package.first.designated_action_id,
        )
    )

    assert profile["lifecycleStatus"]["status"] == CHANGE_ORDER_DRAFT
    assert profile["changeOrder"]["changeOrderNumber"] == 1
    assert profile["changeOrderActions"] == ["accept", "discard"]
    assert [
        (a["name"], a["changeOrderState"]) for a in profile["designatedActions"]
    ] == [
        ("Build the bigger plant", "edited"),
        ("Commission it", None),
        ("Added action", "added"),
    ]
    assert action_profile.json()["creditAllocation"] == 1500
    assert action_profile.json()["changeOrderState"] == "edited"


@pytest.mark.anyio
async def test_an_analyst_starts_a_change_order_through_the_api(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _package(dbsession, "IA-26CO23")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        fastapi_app.url_path_for(
            "start_change_order",
            initiative_agreement_id=package.agreement.initiative_agreement_id,
        )
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["lifecycleStatus"]["status"] == CHANGE_ORDER_DRAFT


@pytest.mark.anyio
async def test_the_director_accepts_with_a_back_dated_accepted_date(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _package_in_change_order(dbsession, "IA-26CO24")
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(
        fastapi_app.url_path_for(
            "accept_change_order",
            initiative_agreement_id=package.agreement.initiative_agreement_id,
        ),
        json={"acceptedDate": "2025-11-03"},
    )
    change_orders = await client.get(
        fastapi_app.url_path_for(
            "get_change_orders",
            initiative_agreement_id=package.agreement.initiative_agreement_id,
        )
    )
    versions = await client.get(
        fastapi_app.url_path_for(
            "get_record_versions",
            record_type="designated-action",
            record_id=package.first.designated_action_id,
        )
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["lifecycleStatus"]["status"] == "Underway"
    assert [(a["name"], a["changeOrderState"]) for a in body["designatedActions"]] == [
        ("Build the bigger plant", None),
        ("Commission it", None),
        ("Added action", None),
    ]
    accepted = change_orders.json()[0]
    assert accepted["status"] == "Accepted"
    assert accepted["acceptedDate"] == "2025-11-03"
    assert accepted["acceptedAt"] is not None
    assert accepted["acceptedByDisplayName"] == "Test User"
    assert [
        (v["version"], v["values"]["creditAllocation"]) for v in versions.json()
    ] == [
        (0, 1000),
        (1, 1500),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles", [IDIR_IA_ANALYST, IDIR_IA_MANAGER, [RoleEnum.IA_PROPONENT]]
)
async def test_only_the_director_can_reach_the_accept_route(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, roles
):
    package = await _package_in_change_order(dbsession, "IA-26CO25")
    set_mock_user(fastapi_app, roles)

    response = await client.put(
        fastapi_app.url_path_for(
            "accept_change_order",
            initiative_agreement_id=package.agreement.initiative_agreement_id,
        ),
        json={"acceptedDate": "2025-11-03"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    agreement = await dbsession.get(
        InitiativeAgreement, package.agreement.initiative_agreement_id
    )
    await dbsession.refresh(agreement, ["lifecycle_status"])
    assert agreement.lifecycle_status.status == CHANGE_ORDER_DRAFT


@pytest.mark.anyio
async def test_versions_are_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _package_in_change_order(dbsession, "IA-26CO26")
    set_mock_user(
        fastapi_app, [RoleEnum.IA_PROPONENT], {"organization_id": package.org_id}
    )

    response = await client.get(
        fastapi_app.url_path_for(
            "get_record_versions",
            record_type="designated-action",
            record_id=package.first.designated_action_id,
        )
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
