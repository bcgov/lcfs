import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.initiative_agreement import (
    DesignatedAction,
    DesignatedActionStatus,
    EvidenceRequirement,
    EvidenceSubmission,
    EvidenceSubmissionStatus,
    InitiativeAgreement,
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)


async def _get_agreement_status_id(dbsession, status):
    result = await dbsession.execute(
        select(InitiativeAgreementStatus).where(
            InitiativeAgreementStatus.status == status
        )
    )
    return result.scalars().first().initiative_agreement_status_id


async def _get_designated_action_status_id(dbsession, status):
    result = await dbsession.execute(
        select(DesignatedActionStatus).where(DesignatedActionStatus.status == status)
    )
    return result.scalars().first().designated_action_status_id


async def _get_submission_status_id(dbsession, status):
    result = await dbsession.execute(
        select(EvidenceSubmissionStatus).where(
            EvidenceSubmissionStatus.status == status
        )
    )
    return result.scalars().first().evidence_submission_status_id


async def _create_agreement(dbsession, **overrides):
    agreement = InitiativeAgreement(
        to_organization_id=1,
        current_status_id=await _get_agreement_status_id(
            dbsession, InitiativeAgreementStatusEnum.Underway
        ),
        **overrides,
    )
    dbsession.add(agreement)
    await dbsession.flush()
    return agreement


async def _create_designated_action(dbsession, agreement, **overrides):
    defaults = {
        "initiative_agreement_id": agreement.initiative_agreement_id,
        "action_number": 1,
        "name": "Environmental, Regulatory & Permitting",
        "current_status_id": await _get_designated_action_status_id(
            dbsession, "Not started"
        ),
    }
    defaults.update(overrides)
    action = DesignatedAction(**defaults)
    dbsession.add(action)
    await dbsession.flush()
    return action


@pytest.mark.anyio
async def test_agreement_management_statuses_seeded(dbsession):
    result = await dbsession.execute(select(InitiativeAgreementStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert {
        InitiativeAgreementStatusEnum.Underway,
        InitiativeAgreementStatusEnum.Completed,
        InitiativeAgreementStatusEnum.Terminated,
    } <= statuses
    # The award-era workflow statuses must remain untouched for the
    # outgoing transaction flow.
    assert {
        InitiativeAgreementStatusEnum.Draft,
        InitiativeAgreementStatusEnum.Recommended,
        InitiativeAgreementStatusEnum.Approved,
        InitiativeAgreementStatusEnum.Deleted,
    } <= statuses


@pytest.mark.anyio
async def test_designated_action_statuses_seeded(dbsession):
    result = await dbsession.execute(select(DesignatedActionStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert statuses == {"Not started", "In progress", "Complete"}


@pytest.mark.anyio
async def test_evidence_submission_statuses_seeded(dbsession):
    result = await dbsession.execute(select(EvidenceSubmissionStatus))
    statuses = {row.status for row in result.scalars().all()}
    assert statuses == {"Submitted", "Under review", "Accepted", "Rejected"}


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
        select(InitiativeAgreement).where(InitiativeAgreement.ia_code == "IA-26TST1")
    )
    fetched = result.scalars().first()
    assert fetched is not None
    assert fetched.title == "Sustainable Aviation Fuel Production Facility"
    assert fetched.contact_name == "Test Contact"
    assert fetched.total_credits_allocated == 30234
    assert fetched.total_credits_issued == 1850
    # Server defaults
    assert fetched.agreement_type == "Initiative Agreement"


@pytest.mark.anyio
async def test_agreement_ia_code_unique(dbsession):
    await _create_agreement(dbsession, ia_code="IA-26DUP1")
    with pytest.raises(IntegrityError):
        await _create_agreement(dbsession, ia_code="IA-26DUP1")


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
    assert action.determination is None
    assert action.assigned_analyst_id is None


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
async def test_evidence_requirement_soft_delete_default(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        description="Provide the executed environmental permit",
        analyst_review="Long-form analyst findings",
    )
    dbsession.add(requirement)
    await dbsession.flush()
    await dbsession.refresh(requirement)

    assert requirement.is_active is True
    assert requirement.version == 0
    assert requirement.group_uuid


@pytest.mark.anyio
async def test_evidence_submissions_append_only_history(dbsession):
    agreement = await _create_agreement(dbsession)
    action = await _create_designated_action(dbsession, agreement)
    submitted_id = await _get_submission_status_id(dbsession, "Submitted")
    accepted_id = await _get_submission_status_id(dbsession, "Accepted")

    for status_id in (submitted_id, accepted_id):
        submission = EvidenceSubmission(
            designated_action_id=action.designated_action_id,
            current_status_id=status_id,
            submitted_by="Legacy Submitter",
        )
        dbsession.add(submission)
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
