"""Live persistence and authorization for #5499-backed portal submissions."""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import pytest
from sqlalchemy import select
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.initiative_agreement.DaEocSubmission import (
    DaEocSubmission,
    DaEocSubmissionHistory,
    current_sub_status_query,
)
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_INFORMATION_REQUESTED,
    EVENT_STATUS_CHANGE,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.DesignatedActionStatus import (
    DesignatedActionStatus,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
)
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_IA_MANAGER,
    _seed_action,
    _action_status_id,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_comments import (
    _ensure_author_profile,
)
from lcfs.tests.document_folder.test_document_folder_view import _seed_document


@pytest.mark.anyio
@pytest.mark.parametrize("revision_reason", ["Information requested", "Returned"])
async def test_portal_draft_submission_revision_and_document_retention(
    client, fastapi_app, set_mock_user, dbsession, revision_reason
):
    def authenticate(roles, details):
        fastapi_app.middleware_stack = None
        set_mock_user(fastapi_app, roles, details)

    org, other_org = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org, "IA-5454-STACK")
    action = await _seed_action(dbsession, agreement, 1, "Equipment")
    original_status_id = action.current_status_id
    document = await _seed_document(
        dbsession, action, "Original.pdf", create_user="mockuser"
    )
    await _ensure_author_profile(dbsession)
    signer = (
        (
            await dbsession.execute(
                select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
            )
        )
        .scalars()
        .one()
    )
    details = {"organization_id": org, "user_profile_id": signer.user_profile_id}
    authenticate([RoleEnum.IA_PROPONENT], details)
    url = str(
        fastapi_app.url_path_for(
            "get_eoc", designated_action_id=action.designated_action_id
        )
    )
    first = {
        "summaryOfWorkCompleted": "Work",
        "howEvidenceMeetsAgreementRequirements": "Meets requirements",
        "exceptionsLimitationsAndContext": "None",
    }
    assert (await client.get(url)).json()["canEdit"]
    assert (await client.put(url, json=first)).status_code == 200
    assert (
        await client.put(url, json={**first, "summaryOfWorkCompleted": "Saved"})
    ).status_code == 200
    rows = (await dbsession.execute(select(DaEocSubmission))).scalars().all()
    assert len(rows) == 1 and rows[0].status == "Draft"
    assert rows[0].summary_of_work_completed == "Saved"
    assert (
        await client.post(f"{url}/submit", json={**first, "declarationAccepted": True})
    ).status_code == 403
    authenticate([RoleEnum.IA_SIGNER], details)
    assert (await client.post(f"{url}/submit", json=first)).status_code == 422
    submitted = await client.post(
        f"{url}/submit", json={**first, "declarationAccepted": True}
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "Submitted"
    assert submitted.json()["submittedByUserId"] == signer.user_profile_id
    assert submitted.json()["submittedAt"]
    assert not submitted.json()["canEdit"]
    assert (await client.put(url, json=first)).status_code == 409
    await dbsession.refresh(action)
    assert action.current_status_id == original_status_id
    history = submitted.json()["submissions"]
    original_id = history[0]["id"]
    assert history[0]["documents"][0]["fileName"] == "Original.pdf"
    document.deleted_date = datetime.now(timezone.utc)
    document.display_name = "Changed.pdf"
    await _seed_document(dbsession, action, "Replacement.pdf", create_user="mockuser")
    req = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        title="Review",
        description="Evidence",
        is_active=True,
        review_outcome="Satisfactory",
        analyst_review="Previous",
    )
    dbsession.add(req)
    if revision_reason == "Information requested":
        dbsession.add(
            DaEocSubmissionHistory(
                da_eoc_submission_id=original_id,
                event="SUB_STATUS_CHANGE",
                sub_status=revision_reason,
                user_profile_id=signer.user_profile_id,
            )
        )
    else:
        action.current_status_id = await _action_status_id(dbsession, "Returned")
        action.update_date = datetime.now(timezone.utc) + timedelta(seconds=1)
        dbsession.add(
            DesignatedActionHistory(
                designated_action_id=action.designated_action_id,
                designated_action_group_uuid=action.group_uuid,
                event=EVENT_STATUS_CHANGE,
                status_id=action.current_status_id,
            )
        )
    await dbsession.flush()
    assert (await client.get(url)).json()["canEdit"]
    assert (
        await client.put(
            url, json={**first, "summaryOfWorkCompleted": "Revision draft"}
        )
    ).status_code == 200
    records = (
        (
            await dbsession.execute(
                select(DaEocSubmission).order_by(DaEocSubmission.da_eoc_submission_id)
            )
        )
        .scalars()
        .all()
    )
    assert (
        len(records) == 2
        and records[0].status == "Submitted"
        and records[1].status == "Draft"
    )
    assert records[0].summary_of_work_completed == "Work"
    resubmitted = await client.post(
        f"{url}/submit",
        json={
            **first,
            "summaryOfWorkCompleted": "Revised work",
            "declarationAccepted": True,
        },
    )
    assert resubmitted.status_code == 200, resubmitted.text
    assert not resubmitted.json()["canEdit"]
    assert len(resubmitted.json()["submissions"]) == 2
    assert (
        resubmitted.json()["submissions"][1]["documents"][0]["fileName"]
        == "Original.pdf"
    )
    assert (
        resubmitted.json()["submissions"][0]["documents"][0]["fileName"]
        == "Replacement.pdf"
    )
    assert (
        await dbsession.execute(current_sub_status_query(original_id))
    ).scalar_one_or_none() is None
    await dbsession.refresh(req)
    assert req.review_outcome is None and req.analyst_review is None
    from lcfs.services.s3.client import DocumentService

    storage = MagicMock()
    assert (
        await DocumentService(db=dbsession, s3_client=storage).delete_file(
            document.document_id,
            action.designated_action_id,
            "designatedAction",
            require_physical_delete=True,
        )
        is False
    )
    storage.delete_object.assert_not_called()
    authenticate([RoleEnum.IA_SIGNER], {**details, "organization_id": other_org})
    assert (await client.get(url)).status_code == 403
    assert (await client.put(url, json=first)).status_code == 403
    historical_url = str(
        fastapi_app.url_path_for(
            "download_eoc_submission_document",
            designated_action_id=action.designated_action_id,
            submission_id=original_id,
            document_id=document.document_id,
        )
    )
    assert (await client.get(historical_url)).status_code == 403


@pytest.mark.anyio
async def test_eoc_api_saves_requirement_responses_and_immutable_metadata(
    client, fastapi_app, set_mock_user, dbsession
):
    org, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org, "IA-5454-REQUIREMENTS")
    action = await _seed_action(dbsession, agreement, 1, "Equipment")
    sibling = await _seed_action(dbsession, agreement, 2, "Permitting")
    await _ensure_author_profile(dbsession)
    signer = (
        (
            await dbsession.execute(
                select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
            )
        )
        .scalars()
        .one()
    )
    requirements = [
        EvidenceRequirement(
            designated_action_id=action.designated_action_id,
            requirement_number=1,
            title="Permits and approvals",
            description="List major project permits.",
            is_active=True,
        ),
        EvidenceRequirement(
            designated_action_id=action.designated_action_id,
            requirement_number=2,
            title="Environmental review",
            description="Provide environmental studies.",
            is_active=True,
        ),
    ]
    dbsession.add_all(requirements)
    await dbsession.flush()
    details = {"organization_id": org, "user_profile_id": signer.user_profile_id}

    def authenticate(roles):
        fastapi_app.middleware_stack = None
        set_mock_user(fastapi_app, roles, details)

    authenticate([RoleEnum.IA_SIGNER])
    url = str(
        fastapi_app.url_path_for(
            "get_eoc", designated_action_id=action.designated_action_id
        )
    )
    initial = (await client.get(url)).json()
    assert [item["id"] for item in initial["requirements"]] == [
        item.evidence_requirement_id for item in requirements
    ]
    assert initial["siblingActionIds"] == [
        action.designated_action_id,
        sibling.designated_action_id,
    ]

    evidence_responses = {
        str(requirements[0].evidence_requirement_id): {
            "summaryOfWorkCompleted": "Permit granted",
            "howEvidenceMeetsAgreementRequirements": "All permits are listed",
            "exceptionsLimitationsAndContext": "None",
        },
        str(requirements[1].evidence_requirement_id): {
            "summaryOfWorkCompleted": "Studies completed",
            "howEvidenceMeetsAgreementRequirements": "All required studies attached",
            "exceptionsLimitationsAndContext": "Seasonal data limitation",
        },
    }
    saved = await client.put(url, json={"evidenceResponses": evidence_responses})
    assert saved.status_code == 200, saved.text
    assert saved.json()["evidenceResponses"] == evidence_responses
    submitted = await client.post(
        f"{url}/submit",
        json={"evidenceResponses": evidence_responses, "declarationAccepted": True},
    )
    assert submitted.status_code == 200, submitted.text
    first_snapshot = submitted.json()["submissions"][0]
    assert first_snapshot["requirements"][0]["title"] == "Permits and approvals"
    assert first_snapshot["evidenceResponses"] == evidence_responses

    requirements[0].title = "Updated current requirement"
    await dbsession.flush()
    authenticate(IDIR_IA_ANALYST)
    historical = (await client.get(url)).json()
    assert historical["applicant"]["name"] == "Mock User"
    assert historical["submissions"][0]["requirements"][0]["title"] == (
        "Permits and approvals"
    )
    assert historical["submissions"][0]["evidenceResponses"] == evidence_responses


@pytest.mark.anyio
async def test_idir_request_information_authorizes_one_portal_revision(
    client, fastapi_app, set_mock_user, dbsession
):
    org, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org, "IA-5454-REQUEST")
    action = await _seed_action(dbsession, agreement, 1, "Equipment")
    await _ensure_author_profile(dbsession)
    signer = (
        await dbsession.execute(
            select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
        )
    ).scalar_one()
    details = {"organization_id": org, "user_profile_id": signer.user_profile_id}

    def authenticate(roles):
        fastapi_app.middleware_stack = None
        set_mock_user(fastapi_app, roles, details)

    eoc_url = str(
        fastapi_app.url_path_for(
            "get_eoc", designated_action_id=action.designated_action_id
        )
    )
    workflow_url = fastapi_app.url_path_for(
        "perform_designated_action_workflow",
        designated_action_id=action.designated_action_id,
    )
    payload = {
        "summaryOfWorkCompleted": "First response",
        "howEvidenceMeetsAgreementRequirements": "Initial evidence",
        "exceptionsLimitationsAndContext": "None",
        "declarationAccepted": True,
    }

    authenticate([RoleEnum.IA_SIGNER])
    first = await client.post(f"{eoc_url}/submit", json=payload)
    assert first.status_code == 200, first.text
    assert not first.json()["canEdit"]

    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        title="Permits",
        description="Provide the signed permits",
        is_active=True,
        review_outcome=REVIEW_OUTCOME_INFORMATION_REQUESTED,
        missing_information=(
            "<p>Upload the <strong>signed</strong> permits &amp; photos.</p>"
        ),
    )
    dbsession.add(requirement)
    await dbsession.flush()

    authenticate(IDIR_IA_ANALYST)
    requested = await client.put(workflow_url, json={"action": "request_information"})
    assert requested.status_code == 200, requested.text
    info_event = (
        (
            await dbsession.execute(
                select(DesignatedActionHistory)
                .where(
                    DesignatedActionHistory.designated_action_id
                    == action.designated_action_id,
                    DesignatedActionHistory.event == EVENT_INFORMATION_REQUESTED,
                )
                .order_by(DesignatedActionHistory.designated_action_history_id.desc())
            )
        )
        .scalars()
        .first()
    )
    assert info_event is not None

    authenticate([RoleEnum.IA_SIGNER])
    revision_response = await client.get(eoc_url)
    assert revision_response.status_code == 200
    revision_state = revision_response.json()
    assert revision_state["canEdit"]
    assert revision_state["revisionRequest"]["eventType"] == "Information requested"
    assert revision_state["revisionRequest"]["message"] == (
        "EOC 1 - Permits: Upload the signed permits & photos."
    )
    assert set(revision_state["revisionRequest"]) == {
        "eventType",
        "requestedAt",
        "message",
    }
    assert "evidenceRequirements" not in revision_state["revisionRequest"]
    revision = {**payload, "summaryOfWorkCompleted": "Revised response"}
    first_draft_save = await client.put(eoc_url, json=revision)
    assert first_draft_save.status_code == 200, first_draft_save.text
    assert first_draft_save.json()["canEdit"]
    revised_again = {**revision, "summaryOfWorkCompleted": "Revised again"}
    second_draft_save = await client.put(eoc_url, json=revised_again)
    assert second_draft_save.status_code == 200, second_draft_save.text
    assert second_draft_save.json()["canEdit"]
    resubmitted = await client.post(f"{eoc_url}/submit", json=revised_again)
    assert resubmitted.status_code == 200, resubmitted.text
    assert not resubmitted.json()["canEdit"]

    latest_submission = (
        await dbsession.execute(
            select(DaEocSubmission.da_eoc_submission_id)
            .where(DaEocSubmission.designated_action_id == action.designated_action_id)
            .order_by(DaEocSubmission.da_eoc_submission_id.desc())
            .limit(1)
        )
    ).scalar_one()
    submitted_event = (
        (
            await dbsession.execute(
                select(DaEocSubmissionHistory)
                .where(
                    DaEocSubmissionHistory.da_eoc_submission_id == latest_submission,
                    DaEocSubmissionHistory.event == "STATUS_CHANGE",
                    DaEocSubmissionHistory.status == "Submitted",
                )
                .order_by(DaEocSubmissionHistory.da_eoc_submission_history_id.desc())
            )
        )
        .scalars()
        .first()
    )
    assert submitted_event is not None
    assert (
        submitted_event.snapshot["da_information_request_history_id"]
        == info_event.designated_action_history_id
    )
    assert (await client.put(eoc_url, json=revision)).status_code == 409


@pytest.mark.anyio
async def test_ordinary_analyst_edit_does_not_reopen_returned_submission(
    client, fastapi_app, set_mock_user, dbsession
):
    org, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org, "IA-5454-RETURN")
    action = await _seed_action(dbsession, agreement, 1, "Equipment")
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        title="Permits",
        description="Provide signed permits",
        is_active=True,
    )
    dbsession.add(requirement)
    await dbsession.flush()
    await _ensure_author_profile(dbsession)
    signer = (
        await dbsession.execute(
            select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
        )
    ).scalar_one()
    details = {"organization_id": org, "user_profile_id": signer.user_profile_id}

    def authenticate(roles):
        fastapi_app.middleware_stack = None
        set_mock_user(fastapi_app, roles, details)

    eoc_url = str(
        fastapi_app.url_path_for(
            "get_eoc", designated_action_id=action.designated_action_id
        )
    )
    workflow_url = fastapi_app.url_path_for(
        "perform_designated_action_workflow",
        designated_action_id=action.designated_action_id,
    )
    payload = {
        "summaryOfWorkCompleted": "First response",
        "howEvidenceMeetsAgreementRequirements": "Initial evidence",
        "exceptionsLimitationsAndContext": "None",
        "declarationAccepted": True,
    }

    authenticate([RoleEnum.IA_SIGNER])
    first = await client.post(f"{eoc_url}/submit", json=payload)
    assert first.status_code == 200, first.text

    action.current_status_id = await _action_status_id(
        dbsession, "Recommended to manager"
    )
    await dbsession.flush()
    await dbsession.refresh(action)
    authenticate(IDIR_IA_MANAGER)
    returned = await client.put(
        workflow_url, json={"action": "return", "comment": "Revise the evidence."}
    )
    assert returned.status_code == 200, returned.text
    return_event = (
        (
            await dbsession.execute(
                select(DesignatedActionHistory)
                .where(
                    DesignatedActionHistory.designated_action_id
                    == action.designated_action_id,
                    DesignatedActionHistory.event == EVENT_STATUS_CHANGE,
                    DesignatedActionHistory.status_id
                    == await _action_status_id(dbsession, "Returned"),
                )
                .order_by(DesignatedActionHistory.designated_action_history_id.desc())
            )
        )
        .scalars()
        .first()
    )
    assert return_event is not None

    authenticate([RoleEnum.IA_SIGNER])
    revision_response = await client.get(eoc_url)
    assert revision_response.status_code == 200
    revision_state = revision_response.json()
    assert revision_state["canEdit"]
    assert revision_state["revisionRequest"]["eventType"] == "Returned"
    assert revision_state["revisionRequest"]["message"] == "Revise the evidence."
    assert set(revision_state["revisionRequest"]) == {
        "eventType",
        "requestedAt",
        "message",
    }
    revision = {**payload, "summaryOfWorkCompleted": "Revised evidence"}
    assert (await client.put(eoc_url, json=revision)).status_code == 200
    resubmitted = await client.post(f"{eoc_url}/submit", json=revision)
    assert resubmitted.status_code == 200, resubmitted.text

    latest_submission = (
        await dbsession.execute(
            select(DaEocSubmission.da_eoc_submission_id)
            .where(DaEocSubmission.designated_action_id == action.designated_action_id)
            .order_by(DaEocSubmission.da_eoc_submission_id.desc())
            .limit(1)
        )
    ).scalar_one()
    submitted_event = (
        (
            await dbsession.execute(
                select(DaEocSubmissionHistory)
                .where(
                    DaEocSubmissionHistory.da_eoc_submission_id == latest_submission,
                    DaEocSubmissionHistory.event == "STATUS_CHANGE",
                    DaEocSubmissionHistory.status == "Submitted",
                )
                .order_by(DaEocSubmissionHistory.da_eoc_submission_history_id.desc())
            )
        )
        .scalars()
        .first()
    )
    assert submitted_event is not None
    assert (
        submitted_event.snapshot["da_return_history_id"]
        == return_event.designated_action_history_id
    )

    authenticate(IDIR_IA_ANALYST)
    edited = await client.put(
        fastapi_app.url_path_for(
            "update_designated_action", designated_action_id=action.designated_action_id
        ),
        json={"name": "Corrected equipment name"},
    )
    assert edited.status_code == 200, edited.text

    authenticate([RoleEnum.IA_SIGNER])
    assert not (await client.get(eoc_url)).json()["canEdit"]
    assert (await client.put(eoc_url, json=revision)).status_code == 409

    action.current_status_id = await _action_status_id(
        dbsession, "Recommended to manager"
    )
    await dbsession.flush()
    await dbsession.refresh(action)
    authenticate(IDIR_IA_MANAGER)
    returned_again = await client.put(
        workflow_url, json={"action": "return", "comment": "Please revise again."}
    )
    assert returned_again.status_code == 200, returned_again.text

    authenticate([RoleEnum.IA_SIGNER])
    assert (await client.get(eoc_url)).json()["canEdit"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "initial_status,allowed",
    [
        ("Not started", True),
        ("Information requested", True),
        ("Returned", True),
        ("Submission received", False),
        ("Underway", False),
    ],
)
async def test_initial_portal_submission_respects_review_state(
    client, fastapi_app, set_mock_user, dbsession, initial_status, allowed
):
    org, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org, "IA-5454-STATE")
    action = await _seed_action(
        dbsession,
        agreement,
        1,
        "Equipment",
        current_status_id=await _action_status_id(dbsession, initial_status),
    )
    original_status_id = action.current_status_id
    await _ensure_author_profile(dbsession)
    signer = (
        (
            await dbsession.execute(
                select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
            )
        )
        .scalars()
        .one()
    )
    set_mock_user(
        fastapi_app,
        [RoleEnum.IA_SIGNER],
        {"organization_id": org, "user_profile_id": signer.user_profile_id},
    )
    url = str(
        fastapi_app.url_path_for(
            "get_eoc", designated_action_id=action.designated_action_id
        )
    )
    assert (await client.get(url)).json()["canEdit"] is allowed
    response = await client.post(
        f"{url}/submit",
        json={"summaryOfWorkCompleted": "Work", "declarationAccepted": True},
    )
    assert response.status_code == (200 if allowed else 409), response.text
    if allowed:
        assert not response.json()["canEdit"]
    await dbsession.refresh(action)
    assert action.current_status_id == original_status_id
