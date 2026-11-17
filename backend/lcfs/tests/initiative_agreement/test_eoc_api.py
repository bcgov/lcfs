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
from lcfs.db.models.initiative_agreement.DesignatedActionStatus import (
    DesignatedActionStatus,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    _seed_action,
    _action_status_id,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
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
