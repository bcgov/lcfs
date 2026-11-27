import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.initiative_agreement import (
    DesignatedAction,
    DesignatedActionHistory,
    DesignatedActionStatus,
    EvidenceRequirement,
    EvidenceSubmission,
    EvidenceSubmissionStatus,
    InitiativeAgreement,
    InitiativeAgreementLifecycleStatus,
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_ANALYST_ASSIGNED,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_AGREEMENT,
    RECORD_KIND_LEGACY_AWARD,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)

# The eleven statuses transaction_status_view is allowed to expose. Any new
# value here breaks GET /api/transactions/statuses/, which validates every row
# against TransactionStatusEnum.
LEGACY_TRANSACTION_STATUSES = {
    "Draft",
    "Recommended",
    "Sent",
    "Submitted",
    "Approved",
    "Recorded",
    "Refused",
    "Deleted",
    "Declined",
    "Rescinded",
    "Assessed",
}

NEW_TABLES = (
    "initiative_agreement_lifecycle_status",
    "designated_action",
    "designated_action_status",
    "designated_action_history",
    "evidence_requirement",
    "evidence_submission",
    "evidence_submission_status",
    "designated_action_internal_comment",
    "da_eoc_submission",
    "da_eoc_submission_history",
    "da_eoc_submission_document_association",
)


async def _lifecycle_status_id(dbsession, status):
    result = await dbsession.execute(
        select(InitiativeAgreementLifecycleStatus).where(
            InitiativeAgreementLifecycleStatus.status == status
        )
    )
    return result.scalars().first().initiative_agreement_lifecycle_status_id


async def _action_status_id(dbsession, status):
    result = await dbsession.execute(
        select(DesignatedActionStatus).where(DesignatedActionStatus.status == status)
    )
    return result.scalars().first().designated_action_status_id


async def _submission_status_id(dbsession, status):
    result = await dbsession.execute(
        select(EvidenceSubmissionStatus).where(
            EvidenceSubmissionStatus.status == status
        )
    )
    return result.scalars().first().evidence_submission_status_id


async def _create_agreement(dbsession, **overrides):
    """An agreement-management record: lifecycle status set, no award status."""
    defaults = {
        "to_organization_id": 1,
        "record_kind": RECORD_KIND_AGREEMENT,
        "lifecycle_status_id": await _lifecycle_status_id(dbsession, "Underway"),
    }
    defaults.update(overrides)
    agreement = InitiativeAgreement(**defaults)
    dbsession.add(agreement)
    await dbsession.flush()
    return agreement


async def _create_designated_action(dbsession, agreement, **overrides):
    defaults = {
        "initiative_agreement_id": agreement.initiative_agreement_id,
        "action_number": 1,
        "name": "Environmental, Regulatory & Permitting",
        "current_status_id": await _action_status_id(dbsession, "Not started"),
    }
    defaults.update(overrides)
    action = DesignatedAction(**defaults)
    dbsession.add(action)
    await dbsession.flush()
    return action


# ---------------------------------------------------------------------------
# Lookup seeds and the transaction_status_view regression
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_agreement_lifecycle_statuses_seeded(dbsession):
    result = await dbsession.execute(select(InitiativeAgreementLifecycleStatus))
    rows = result.scalars().all()
    assert {row.status for row in rows} == {
        "Draft",
        "Underway",
        "Change order draft",
        "Completed",
        "Terminated",
    }
    assert all(row.display_order is not None for row in rows)


@pytest.mark.anyio
async def test_award_status_table_holds_only_transaction_statuses(dbsession):
    """The award status table must not gain agreement lifecycle values."""
    result = await dbsession.execute(select(InitiativeAgreementStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert statuses == {
        InitiativeAgreementStatusEnum.Draft,
        InitiativeAgreementStatusEnum.Recommended,
        InitiativeAgreementStatusEnum.Approved,
        InitiativeAgreementStatusEnum.Deleted,
    }


@pytest.mark.anyio
async def test_lifecycle_statuses_absent_from_transaction_status_view(dbsession):
    """
    Regression: seeding lifecycle values into initiative_agreement_status put
    them into transaction_status_view, which is validated against
    TransactionStatusEnum, breaking GET /api/transactions/statuses/.
    """
    result = await dbsession.execute(text("SELECT status FROM transaction_status_view"))
    view_statuses = {row[0] for row in result.all()}

    assert not view_statuses - LEGACY_TRANSACTION_STATUSES, (
        "transaction_status_view exposes values TransactionStatusEnum cannot "
        f"validate: {sorted(view_statuses - LEGACY_TRANSACTION_STATUSES)}"
    )
    for lifecycle_only in ("Underway", "Completed", "Terminated"):
        assert lifecycle_only not in view_statuses


@pytest.mark.anyio
async def test_award_statuses_have_display_order(dbsession):
    result = await dbsession.execute(select(InitiativeAgreementStatus))
    assert all(row.display_order is not None for row in result.scalars().all())


@pytest.mark.anyio
async def test_designated_action_statuses_seeded(dbsession):
    result = await dbsession.execute(select(DesignatedActionStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert statuses == {
        "Not started",
        "Submission received",
        "Underway",
        "Information requested",
        "Recommended to manager",
        "Not recommended",
        "Recommended to director",
        "Approved",
        "Issued (legacy)",
        "Returned",
        "Rejected",
        "Cancelled",
    }


@pytest.mark.anyio
async def test_evidence_submission_statuses_seeded(dbsession):
    result = await dbsession.execute(select(EvidenceSubmissionStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert statuses == {"Submitted", "Under review", "Accepted", "Rejected"}


@pytest.mark.anyio
async def test_audit_triggers_present_on_new_tables(dbsession):
    result = await dbsession.execute(
        text(
            """
            SELECT c.relname
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            WHERE NOT t.tgisinternal AND t.tgname LIKE 'audit_%'
            """
        )
    )
    audited = {row[0] for row in result.all()}
    missing = set(NEW_TABLES) - audited
    assert not missing, f"tables without row-level audit triggers: {sorted(missing)}"


# ---------------------------------------------------------------------------
# initiative_agreement
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_agreement_management_columns_roundtrip(dbsession):
    agreement = await _create_agreement(
        dbsession,
        ia_code="IA-26TST1",
        title="Sustainable Aviation Fuel Production Facility",
        project_description="Agreement brief text",
        contact_name="Test Contact",
        contact_email="contact@example.com",
        contact_phone="604-555-0100",
        total_credits_allocated=30234,
        total_credits_issued=1850,
    )
    await dbsession.refresh(agreement)

    result = await dbsession.execute(
        select(InitiativeAgreement)
        .options(selectinload(InitiativeAgreement.lifecycle_status))
        .where(InitiativeAgreement.ia_code == "IA-26TST1")
    )
    fetched = result.scalars().first()
    assert fetched is not None
    assert fetched.title == "Sustainable Aviation Fuel Production Facility"
    assert fetched.total_credits_allocated == 30234
    assert fetched.agreement_type == "Initiative Agreement"
    assert fetched.record_kind == RECORD_KIND_AGREEMENT
    assert fetched.lifecycle_status.status == "Underway"
    # Agreement records carry no award status, which also keeps them out of
    # mv_transaction_aggregate's inner join on initiative_agreement_status.
    assert fetched.current_status_id is None


@pytest.mark.anyio
async def test_record_kind_defaults_to_legacy_award(dbsession):
    """
    Legacy award rows must stay discriminable: the agreement grid filters on
    record_kind, and every pre-existing row is backfilled to legacy_award.
    """
    agreement = InitiativeAgreement(to_organization_id=1, compliance_units=500)
    dbsession.add(agreement)
    await dbsession.flush()
    await dbsession.refresh(agreement)
    assert agreement.record_kind == RECORD_KIND_LEGACY_AWARD
    assert agreement.lifecycle_status_id is None


@pytest.mark.anyio
async def test_agreement_ia_code_unique(dbsession):
    await _create_agreement(dbsession, ia_code="IA-26DUP1")
    with pytest.raises(IntegrityError):
        await _create_agreement(dbsession, ia_code="IA-26DUP1")


# ---------------------------------------------------------------------------
# designated_action
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_designated_action_defaults_and_versioning(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(
        dbsession, agreement, credit_allocation=1850
    )
    await dbsession.refresh(action)

    assert action.version == 0
    assert action.group_uuid
    assert action.action_type == ActionTypeEnum.CREATE
    assert action.credit_allocation == 1850
    assert action.recommended_credits is None
    assert action.determination is None
    assert action.assigned_analyst_id is None
    assert action.transaction_id is None


@pytest.mark.anyio
async def test_designated_action_group_uuid_has_server_default(dbsession):
    """Consolidation inserts by raw SQL, where the mixin default does not run."""
    agreement = await _create_agreement(dbsession)
    status_id = await _action_status_id(dbsession, "Issued (legacy)")
    await dbsession.execute(
        text(
            """
            INSERT INTO designated_action
                (initiative_agreement_id, action_number, name,
                 current_status_id, credit_allocation)
            VALUES (:ia, 1, 'Legacy award', :status, 1000)
            """
        ),
        {"ia": agreement.initiative_agreement_id, "status": status_id},
    )
    result = await dbsession.execute(
        select(DesignatedAction).where(
            DesignatedAction.initiative_agreement_id
            == agreement.initiative_agreement_id
        )
    )
    action = result.scalars().first()
    assert action.group_uuid, "group_uuid must be populated without the ORM"
    assert action.version == 0


@pytest.mark.anyio
async def test_designated_action_number_unique_per_version(dbsession):
    agreement = await _create_agreement(dbsession)
    await _create_designated_action(dbsession, agreement)
    with pytest.raises(IntegrityError):
        await _create_designated_action(dbsession, agreement)


@pytest.mark.anyio
async def test_designated_action_amendment_allows_new_version(dbsession):
    agreement = await _create_agreement(dbsession)
    original = await _create_designated_action(dbsession, agreement)
    amendment = await _create_designated_action(
        dbsession,
        agreement,
        version=1,
        group_uuid=original.group_uuid,
        action_type=ActionTypeEnum.UPDATE,
    )

    result = await dbsession.execute(
        select(DesignatedAction).where(
            DesignatedAction.group_uuid == original.group_uuid
        )
    )
    rows = result.scalars().all()
    assert len(rows) == 2
    assert {row.version for row in rows} == {0, 1}
    assert amendment.action_number == original.action_number


@pytest.mark.anyio
async def test_one_designated_action_per_transaction(dbsession):
    """
    Guards concurrent double-issuance: two approvals both seeing
    transaction_id IS NULL must not both attach the same transaction.
    """
    transaction_id = (
        await dbsession.execute(text("SELECT transaction_id FROM transaction LIMIT 1"))
    ).scalar()
    if transaction_id is None:
        pytest.skip("no seeded transaction to attach")

    agreement = await _create_agreement(dbsession)
    await _create_designated_action(
        dbsession, agreement, action_number=1, transaction_id=transaction_id
    )
    with pytest.raises(IntegrityError):
        await _create_designated_action(
            dbsession, agreement, action_number=2, transaction_id=transaction_id
        )


@pytest.mark.anyio
async def test_designated_action_history_roundtrip(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    event = DesignatedActionHistory(
        designated_action_id=action.designated_action_id,
        designated_action_group_uuid=action.group_uuid,
        event=EVENT_ANALYST_ASSIGNED,
        user_profile_id=1,
        display_name="Test User",
        snapshot={"assigned_analyst_id": 1},
    )
    dbsession.add(event)
    await dbsession.flush()
    await dbsession.refresh(event)

    assert event.designated_action_history_id is not None
    assert event.snapshot == {"assigned_analyst_id": 1}
    assert event.status_id is None
    assert event.designated_action_group_uuid == action.group_uuid


# ---------------------------------------------------------------------------
# evidence
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_evidence_requirement_soft_delete_default(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        description="Provide the executed environmental permit",
        missing_information="Provide the signed copy for stage two",
    )
    dbsession.add(requirement)
    await dbsession.flush()
    await dbsession.refresh(requirement)

    assert requirement.is_active is True
    assert requirement.missing_information == "Provide the signed copy for stage two"
    assert not hasattr(action, "missing_information")
    # Requirements are amended by is_active, not versioned.
    assert not hasattr(requirement, "group_uuid")


@pytest.mark.anyio
async def test_evidence_submissions_append_only_history(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    submitted_id = await _submission_status_id(dbsession, "Submitted")
    accepted_id = await _submission_status_id(dbsession, "Accepted")

    for status_id in (submitted_id, accepted_id):
        dbsession.add(
            EvidenceSubmission(
                designated_action_id=action.designated_action_id,
                current_status_id=status_id,
                submitted_by="Legacy Submitter",
            )
        )
    await dbsession.flush()

    result = await dbsession.execute(
        select(EvidenceSubmission).where(
            EvidenceSubmission.designated_action_id == action.designated_action_id
        )
    )
    submissions = result.scalars().all()
    assert len(submissions) == 2
    await dbsession.refresh(submissions[0])
    assert submissions[0].cover_letter_received is False


@pytest.mark.anyio
async def test_da_eoc_sub_status_history_uses_latest_event_including_clear(dbsession):
    from lcfs.db.models.initiative_agreement.DaEocSubmission import (
        DaEocSubmission,
        DaEocSubmissionHistory,
        EVENT_SUB_STATUS_CHANGE,
        current_sub_status_query,
    )

    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    submission = DaEocSubmission(
        designated_action_id=action.designated_action_id, organization_id=1
    )
    dbsession.add(submission)
    await dbsession.flush()
    submission_id = submission.da_eoc_submission_id
    assert (
        await dbsession.execute(current_sub_status_query(submission_id))
    ).scalar() is None

    async def add_event(event, sub_status=None):
        dbsession.add(
            DaEocSubmissionHistory(
                da_eoc_submission_id=submission_id, event=event, sub_status=sub_status
            )
        )
        await dbsession.flush()

    await add_event(EVENT_SUB_STATUS_CHANGE, "Assigned")
    await add_event("DETAILS_EDITED")
    assert (
        await dbsession.execute(current_sub_status_query(submission_id))
    ).scalar() == "Assigned"
    await add_event(EVENT_SUB_STATUS_CHANGE, "Under Review")
    assert (
        await dbsession.execute(current_sub_status_query(submission_id))
    ).scalar() == "Under Review"
    await add_event(
        EVENT_SUB_STATUS_CHANGE
    )  # Explicit clear must not revive older states.
    assert (
        await dbsession.execute(current_sub_status_query(submission_id))
    ).scalar() is None
    await add_event(EVENT_SUB_STATUS_CHANGE, "Information requested")
    assert (
        await dbsession.execute(current_sub_status_query(submission_id))
    ).scalar() == "Information requested"

    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            await add_event(EVENT_SUB_STATUS_CHANGE, "Unknown")
    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            await add_event("DETAILS_EDITED", "Assigned")


@pytest.mark.anyio
async def test_da_eoc_submission_integrity_and_attachment_links(dbsession):
    """Exercise database constraints and parent/document deletion semantics."""
    from lcfs.db.models.document.Document import Document
    from lcfs.db.models.initiative_agreement.DaEocSubmission import (
        DaEocSubmission,
        da_eoc_submission_document_association,
    )

    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    submission = DaEocSubmission(
        designated_action_id=action.designated_action_id,
        organization_id=1,
        summary_of_work_completed="<p>Completed</p>",
    )
    second = DaEocSubmission(
        designated_action_id=action.designated_action_id,
        organization_id=1,
        status="Submitted",
    )
    dbsession.add_all([submission, second])
    await dbsession.flush()
    assert submission.status == "Draft"
    assert submission.da_eoc_submission_id != second.da_eoc_submission_id

    documents = [
        Document(
            file_key=f"test-5499-{n}",
            file_name=f"{n}.txt",
            file_size=1,
            mime_type="text/plain",
        )
        for n in range(2)
    ]
    dbsession.add_all(documents)
    await dbsession.flush()
    await dbsession.execute(
        da_eoc_submission_document_association.insert(),
        [
            {
                "da_eoc_submission_id": submission.da_eoc_submission_id,
                "document_id": d.document_id,
            }
            for d in documents
        ],
    )
    count = await dbsession.scalar(
        select(text("count(*)"))
        .select_from(da_eoc_submission_document_association)
        .where(
            da_eoc_submission_document_association.c.da_eoc_submission_id
            == submission.da_eoc_submission_id
        )
    )
    assert count == 2

    for values in (
        {
            "designated_action_id": action.designated_action_id,
            "organization_id": 1,
            "status": "Invalid",
        },
        {"designated_action_id": -1, "organization_id": 1},
        {"designated_action_id": action.designated_action_id, "organization_id": -1},
    ):
        with pytest.raises(IntegrityError):
            async with dbsession.begin_nested():
                dbsession.add(DaEocSubmission(**values))
                await dbsession.flush()

    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            await dbsession.execute(
                text("DELETE FROM designated_action WHERE designated_action_id = :id"),
                {"id": action.designated_action_id},
            )

    # Database cascade removes links, not documents.
    await dbsession.execute(
        text("DELETE FROM da_eoc_submission WHERE da_eoc_submission_id = :id"),
        {"id": submission.da_eoc_submission_id},
    )
    assert (
        await dbsession.scalar(
            select(text("count(*)"))
            .select_from(da_eoc_submission_document_association)
            .where(
                da_eoc_submission_document_association.c.da_eoc_submission_id
                == submission.da_eoc_submission_id
            )
        )
        == 0
    )
    for document in documents:
        assert await dbsession.get(Document, document.document_id) is not None
