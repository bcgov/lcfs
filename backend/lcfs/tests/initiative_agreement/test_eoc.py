"""Portal permissions, drafts and immutable submissions use #5499's records."""

from datetime import datetime, timezone, timedelta
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import HTTPException
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.initiative_agreement.DaEocSubmission import (
    DaEocSubmission,
    DaEocSubmissionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.web.api.initiative_agreement.schema import EOCSaveSchema
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices


@pytest.fixture
def service():
    agreement = NS(
        to_organization_id=4,
        lifecycle_status=None,
        ia_code="IA-1",
        to_organization=NS(name="Example"),
    )
    action = NS(
        designated_action_id=3,
        initiative_agreement=agreement,
        initiative_agreement_id=2,
        action_number=1,
        name="Equipment",
        transaction_id=None,
        update_date=datetime.now(timezone.utc),
        current_status=NS(status="Not started"),
    )
    user = NS(
        role_names=[RoleEnum.IA_SIGNER],
        user_profile_id=17,
        keycloak_username="signer",
        first_name="Alex",
        last_name="Signer",
        title="Supplier",
        email="alex@example.com",
        phone="604-555-0100",
        organization=NS(organization_id=4),
    )
    agreement.to_organization.org_address = None
    agreement.to_organization.email = "org@example.com"
    agreement.to_organization.phone = "604-555-0199"
    rows = []
    action_history = []
    repo = MagicMock()
    repo.get_designated_action_by_id = AsyncMock(return_value=action)
    repo.get_initiative_agreement_by_id = AsyncMock(return_value=agreement)
    repo.get_portal_evidence_submissions = AsyncMock(
        side_effect=lambda *args, **kwargs: rows
    )
    repo.get_current_designated_actions = AsyncMock(return_value=[action])
    repo.get_user_profile_by_id = AsyncMock(return_value=user)
    repo.get_designated_action_history = AsyncMock(
        side_effect=lambda *args, **kwargs: action_history
    )
    repo.get_evidence_requirements = AsyncMock(return_value=[])
    repo.get_eoc_document_snapshot = AsyncMock(return_value=[])
    repo.db.flush = AsyncMock()
    # A sync result: get_eoc also reads the EOC information requests (#5545).
    repo.db.execute = AsyncMock(return_value=MagicMock())

    def add(value):
        if isinstance(value, DaEocSubmission):
            value.da_eoc_submission_id = len(rows) + 1
            value.history = []
            value.documents = []
            rows.insert(0, value)
        elif isinstance(value, DaEocSubmissionHistory):
            value.da_eoc_submission_history_id = (
                sum(len(row.history) for row in rows) + 1
            )
            value.create_date = datetime.now(timezone.utc)
            next(
                row
                for row in rows
                if row.da_eoc_submission_id == value.da_eoc_submission_id
            ).history.append(value)

    repo.db.add.side_effect = add
    repo.action_history = action_history
    return InitiativeAgreementServices(repo=repo, request=NS(user=user))


@pytest.mark.anyio
async def test_autosave_reuses_draft_and_submission_owns_lifecycle(service):
    await service.save_eoc(3, EOCSaveSchema(summary_of_work_completed="First"))
    await service.save_eoc(3, EOCSaveSchema(summary_of_work_completed="Saved"))
    rows = await service.repo.get_portal_evidence_submissions(3)
    assert len(rows) == 1
    assert rows[0].status == "Draft"
    assert rows[0].summary_of_work_completed == "Saved"
    result = await service.save_eoc(
        3,
        EOCSaveSchema(summary_of_work_completed="Complete", declaration_accepted=True),
        submit=True,
    )
    assert result.status == "Submitted"
    assert result.submitted_by_user_id == 17
    assert result.submitted_at.tzinfo is not None
    assert result.can_edit is False
    assert (
        service.repo.get_designated_action_by_id.return_value.current_status.status
        == "Not started"
    )
    event = service._submission_event(rows[0])
    assert event.snapshot["declaration_accepted"] is True
    assert event.user_profile_id == 17
    with pytest.raises(HTTPException) as exc:
        await service.save_eoc(3, EOCSaveSchema())
    assert exc.value.status_code == 409


@pytest.mark.anyio
async def test_requirement_responses_are_saved_and_snapshotted(service):
    requirements = [
        EvidenceRequirement(
            evidence_requirement_id=41,
            designated_action_id=3,
            requirement_number=1,
            title="Permits",
            description="List permits and approvals.",
            is_active=True,
        ),
        EvidenceRequirement(
            evidence_requirement_id=42,
            designated_action_id=3,
            requirement_number=2,
            title="Environmental review",
            description="Submit environmental studies.",
            is_active=True,
        ),
    ]
    service.repo.get_evidence_requirements.return_value = requirements
    answers = {
        "41": {
            "summaryOfWorkCompleted": "Permit issued",
            "howEvidenceMeetsAgreementRequirements": "It covers the required permits",
            "exceptionsLimitationsAndContext": "No exceptions",
        },
        "42": {
            "summaryOfWorkCompleted": "Studies completed",
            "howEvidenceMeetsAgreementRequirements": "All studies attached",
            "exceptionsLimitationsAndContext": "Seasonal limitation",
        },
    }
    data = EOCSaveSchema(
        evidence_responses=answers,
        declaration_accepted=True,
    )

    result = await service.save_eoc(3, data, submit=True)

    row = (await service.repo.get_portal_evidence_submissions(3))[0]
    assert row.evidence_responses["41"]["summary_of_work_completed"] == "Permit issued"
    assert result.requirements[0].id == 41
    assert result.evidence_responses["42"].exceptions_limitations_and_context == (
        "Seasonal limitation"
    )
    assert result.sibling_action_ids == [3]
    assert result.applicant.name == "Alex Signer"
    assert result.applicant.title == "Supplier"
    assert result.organization_details.email == "org@example.com"

    submission_history = result.submissions[0]
    assert submission_history["requirements"][0] == {
        "id": 41,
        "requirementNumber": 1,
        "title": "Permits",
        "description": "List permits and approvals.",
    }
    assert (
        submission_history["evidenceResponses"]["42"][
            "howEvidenceMeetsAgreementRequirements"
        ]
        == "All studies attached"
    )
    # Later edits to requirement metadata cannot change the submitted snapshot.
    requirements[0].title = "Renamed permit requirement"
    reread = await service.get_eoc(3)
    assert reread.submissions[0]["requirements"][0]["title"] == "Permits"


@pytest.mark.anyio
@pytest.mark.parametrize("reason", ["Information requested", "Returned"])
async def test_revision_creates_new_row_preserves_history_and_relocks(service, reason):
    await service.save_eoc(
        3,
        EOCSaveSchema(summary_of_work_completed="Original", declaration_accepted=True),
        submit=True,
    )
    original = (await service.repo.get_portal_evidence_submissions(3))[0]
    if reason == "Information requested":
        service.repo.get_designated_action_by_id.return_value.current_status.status = (
            "Underway"
        )
        service.repo.db.add(
            DaEocSubmissionHistory(
                da_eoc_submission_id=original.da_eoc_submission_id,
                event="SUB_STATUS_CHANGE",
                sub_status=reason,
            )
        )
    else:
        action = service.repo.get_designated_action_by_id.return_value
        action.current_status.status = "Returned"
        action.update_date += timedelta(seconds=1)
        service.repo.action_history.insert(
            0,
            NS(
                designated_action_history_id=1,
                event="STATUS_CHANGE",
                status=NS(status="Returned"),
            ),
        )
    assert (await service.get_eoc(3)).can_edit
    await service.save_eoc(3, EOCSaveSchema(summary_of_work_completed="Revision"))
    rows = await service.repo.get_portal_evidence_submissions(3)
    assert len(rows) == 2 and rows[0].status == "Draft"
    assert original.summary_of_work_completed == "Original"
    result = await service.save_eoc(
        3,
        EOCSaveSchema(summary_of_work_completed="Revision", declaration_accepted=True),
        submit=True,
    )
    assert result.can_edit is False
    assert len(result.submissions) == 2
    assert original.status == "Submitted"
    assert service._submission_sub_status(original) is None
    assert result.submissions[1]["content"]["summary_of_work_completed"] == "Original"
    if reason == "Returned":
        action = service.repo.get_designated_action_by_id.return_value
        action.update_date += timedelta(seconds=1)
        assert not (await service.get_eoc(3)).can_edit
        service.repo.action_history.insert(
            0,
            NS(
                designated_action_history_id=2,
                event="STATUS_CHANGE",
                status=NS(status="Returned"),
            ),
        )
        assert (await service.get_eoc(3)).can_edit


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status",
    [
        "Submission received",
        "Underway",
        "Approved",
        "Rejected",
        "Cancelled",
        "Recommended to manager",
    ],
)
@pytest.mark.parametrize("draft_exists", [False, True])
async def test_first_portal_submission_cannot_interrupt_review(
    service, status, draft_exists
):
    service.repo.get_designated_action_by_id.return_value.current_status.status = status
    if draft_exists:
        service.repo.db.add(
            DaEocSubmission(designated_action_id=3, organization_id=4, status="Draft")
        )
    assert not (await service.get_eoc(3)).can_edit
    with pytest.raises(HTTPException) as exc:
        await service.save_eoc(3, EOCSaveSchema(declaration_accepted=True), submit=True)
    assert exc.value.status_code == 409


@pytest.mark.anyio
@pytest.mark.parametrize("status", ["Not started", "Information requested", "Returned"])
async def test_initial_legacy_response_states(service, status):
    service.repo.get_designated_action_by_id.return_value.current_status.status = status
    result = await service.save_eoc(
        3, EOCSaveSchema(declaration_accepted=True), submit=True
    )
    assert result.status == "Submitted" and not result.can_edit
    assert (
        service.repo.get_designated_action_by_id.return_value.current_status.status
        == status
    )


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["read", "save", "submit", "documents"])
async def test_cross_org_is_rejected(service, operation):
    service.request.user.organization.organization_id = 99
    with pytest.raises(HTTPException) as exc:
        if operation == "read":
            await service.get_eoc(3)
        elif operation == "documents":
            await service.validate_eoc_write(3)
        else:
            await service.save_eoc(
                3,
                EOCSaveSchema(declaration_accepted=True),
                submit=operation == "submit",
            )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_only_signer_can_submit_and_must_accept_declaration(service):
    service.request.user.role_names = [RoleEnum.IA_PROPONENT]
    await service.save_eoc(3, EOCSaveSchema(summary_of_work_completed="Draft"))
    with pytest.raises(HTTPException) as exc:
        await service.save_eoc(3, EOCSaveSchema(declaration_accepted=True), submit=True)
    assert exc.value.status_code == 403
    service.request.user.role_names = [RoleEnum.IA_SIGNER]
    with pytest.raises(HTTPException) as exc:
        await service.save_eoc(3, EOCSaveSchema(), submit=True)
    assert exc.value.status_code == 422


@pytest.mark.anyio
async def test_internal_review_reset_is_preserved_in_submission_history(service):
    req = EvidenceRequirement(
        evidence_requirement_id=1,
        designated_action_id=3,
        requirement_number=1,
        title="Evidence",
        description="Requirement",
        review_outcome="Satisfactory",
        analyst_review="Prior",
        reviewed_by_user_id=9,
    )
    service.repo.get_evidence_requirements.return_value = [req]
    await service.save_eoc(3, EOCSaveSchema(declaration_accepted=True), submit=True)
    assert req.review_outcome is None and req.reviewed_by_user_id is None
    assert not await service._all_evidence_satisfactory(3)
    event = service._submission_event(
        (await service.repo.get_portal_evidence_submissions(3))[0]
    )
    assert (
        event.snapshot["previous_evidence_review"][0]["review_outcome"]
        == "Satisfactory"
    )
    assert "previous_evidence_review" not in (await service.get_eoc(3)).submissions[0]


@pytest.mark.anyio
async def test_documents_are_linked_and_metadata_survives_replacement(service):
    docs = [
        {
            "document_id": 9,
            "file_name": "Original.pdf",
            "file_size": 100,
            "mime_type": "application/pdf",
            "folder_path": ["Original"],
        }
    ]
    service.repo.get_eoc_document_snapshot.return_value = docs
    await service.save_eoc(3, EOCSaveSchema(declaration_accepted=True), submit=True)
    original = (await service.repo.get_portal_evidence_submissions(3))[0]
    # The association insert, not get_eoc's later reads (#5545).
    inserts = [
        call for call in service.repo.db.execute.call_args_list if len(call.args) > 1
    ]
    assert inserts[-1].args[1] == [{"da_eoc_submission_id": 1, "document_id": 9}]
    service.repo.db.add(
        DaEocSubmissionHistory(
            da_eoc_submission_id=1,
            event="SUB_STATUS_CHANGE",
            sub_status="Information requested",
        )
    )
    service.repo.get_eoc_document_snapshot.return_value = []
    await service.save_eoc(3, EOCSaveSchema(declaration_accepted=True), submit=True)
    assert service._submission_event(original).snapshot["documents"] == docs
    service.repo.get_submission_document = AsyncMock(return_value=NS(document_id=9))
    assert (
        await service.get_eoc_submission_document(3, 1, 9)
    ).file_name == "Original.pdf"
    service.repo.get_submission_document.return_value = None
    with pytest.raises(HTTPException) as exc:
        await service.get_eoc_submission_document(3, 1, 99)
    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_submission_organization_must_match_da_for_document_writes(service):
    service.repo.db.add(
        DaEocSubmission(designated_action_id=3, organization_id=99, status="Draft")
    )
    with pytest.raises(HTTPException) as exc:
        await service.validate_eoc_write(3)
    assert exc.value.status_code == 403
