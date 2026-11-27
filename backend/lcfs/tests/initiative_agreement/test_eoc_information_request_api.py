"""Request additional information on one EOC of a submitted DA/EOC (#5545).

Live API tests: IDIR requests, only that EOC opens to the proponent, the
proponent answers (response and files), the analyst is notified, and the
cycle repeats without overwriting earlier cycles.
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from lcfs.db.models.initiative_agreement.DaEocInformationRequest import (
    DaEocInformationRequest,
    da_eoc_information_request_document_association,
)
from lcfs.db.models.initiative_agreement.DaEocSubmission import (
    DaEocSubmission,
    DaEocSubmissionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
    EvidenceRequirement,
)
from lcfs.db.models.notification.NotificationMessage import NotificationMessage
from lcfs.db.models.notification.NotificationType import NotificationType
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.services.s3.dependency import get_s3_client
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_DIRECTOR,
    IDIR_IA_MANAGER,
    _seed_action,
    _seed_ia_analyst,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _action_status_id,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_comments import (
    _ensure_author_profile,
)

BCEID_TYPE = "BCEID__INITIATIVE_AGREEMENT__EOC_INFORMATION_REQUESTED"
IDIR_TYPE = "IDIR_ANALYST__INITIATIVE_AGREEMENT__EOC_INFORMATION_SUBMITTED"


def _response(summary, how="How it meets", exceptions="None"):
    return {
        "summaryOfWorkCompleted": summary,
        "howEvidenceMeetsAgreementRequirements": how,
        "exceptionsLimitationsAndContext": exceptions,
    }


class Scenario:
    """A DA with two EOCs whose DA/EOC submission the signer has submitted."""

    def __init__(self, client, fastapi_app, set_mock_user, dbsession):
        self.client = client
        self.app = fastapi_app
        self.set_mock_user = set_mock_user
        self.db = dbsession

    def as_user(self, roles, **details):
        self.app.middleware_stack = None
        self.set_mock_user(self.app, roles, details)

    def as_signer(self):
        self.as_user(
            [RoleEnum.IA_SIGNER],
            organization_id=self.org,
            user_profile_id=self.signer.user_profile_id,
        )

    def as_proponent(self, **details):
        self.as_user(
            [RoleEnum.IA_PROPONENT],
            organization_id=self.org,
            user_profile_id=self.signer.user_profile_id,
            **details,
        )

    def as_analyst(self, analyst=None, roles=IDIR_IA_ANALYST):
        analyst = analyst or self.analyst
        self.as_user(
            roles,
            organization_id=None,
            user_profile_id=analyst.user_profile_id,
            keycloak_username=analyst.keycloak_username,
            first_name=analyst.first_name,
            last_name=analyst.last_name,
        )

    async def build(self, *, submit=True):
        self.org, self.other_org = await _two_org_ids(self.db)
        agreement = await _seed_agreement(self.db, self.org, "IA-5545-REQ")
        self.action = await _seed_action(self.db, agreement, 1, "Equipment")
        self.eoc1 = EvidenceRequirement(
            designated_action_id=self.action.designated_action_id,
            requirement_number=1,
            title="Commissioning",
            description="Commissioning evidence",
        )
        self.eoc2 = EvidenceRequirement(
            designated_action_id=self.action.designated_action_id,
            requirement_number=2,
            title="Invoices",
            description="Invoices",
        )
        self.db.add_all([self.eoc1, self.eoc2])
        await self.db.flush()
        await _ensure_author_profile(self.db)
        self.signer = (
            (
                await self.db.execute(
                    select(UserProfile).where(
                        UserProfile.keycloak_username == "mockuser"
                    )
                )
            )
            .scalars()
            .one()
        )
        self.analyst = await _seed_ia_analyst(self.db, "ia.analyst5545", "Ana", "Lyst")
        self.eoc_url = str(
            self.app.url_path_for(
                "get_eoc", designated_action_id=self.action.designated_action_id
            )
        )
        self.original = {
            str(self.eoc1.evidence_requirement_id): _response("Original one"),
            str(self.eoc2.evidence_requirement_id): _response("Original two"),
        }
        if submit:
            self.as_signer()
            submitted = await self.client.post(
                f"{self.eoc_url}/submit",
                json={"evidenceResponses": self.original, "declarationAccepted": True},
            )
            assert submitted.status_code == 200, submitted.text
            assert submitted.json()["status"] == "Submitted"
        return self

    def request_url(self, requirement):
        return str(
            self.app.url_path_for(
                "request_eoc_information",
                designated_action_id=self.action.designated_action_id,
                evidence_requirement_id=requirement.evidence_requirement_id,
            )
        )

    def response_url(self, request_id):
        return str(
            self.app.url_path_for(
                "save_eoc_information_response",
                designated_action_id=self.action.designated_action_id,
                request_id=request_id,
            )
        )

    def documents_url(self, request_id):
        return str(
            self.app.url_path_for(
                "upload_eoc_information_document",
                designated_action_id=self.action.designated_action_id,
                request_id=request_id,
            )
        )

    async def request(self, requirement, text="<p>Please add the invoices</p>"):
        self.as_analyst()
        return await self.client.post(
            self.request_url(requirement), json={"missingInformation": text}
        )

    async def submission(self):
        return (
            (
                await self.db.execute(
                    select(DaEocSubmission)
                    .where(
                        DaEocSubmission.designated_action_id
                        == self.action.designated_action_id
                    )
                    .order_by(DaEocSubmission.da_eoc_submission_id.desc())
                    .execution_options(populate_existing=True)
                )
            )
            .scalars()
            .first()
        )

    async def rows(self):
        return (
            (
                await self.db.execute(
                    select(DaEocInformationRequest)
                    .order_by(DaEocInformationRequest.da_eoc_information_request_id)
                    .execution_options(populate_existing=True)
                )
            )
            .scalars()
            .all()
        )

    async def notifications(self, type_name):
        return (
            (
                await self.db.execute(
                    select(NotificationMessage)
                    .join(
                        NotificationType,
                        NotificationType.notification_type_id
                        == NotificationMessage.notification_type_id,
                    )
                    .where(NotificationType.name == type_name)
                    .order_by(NotificationMessage.notification_message_id)
                )
            )
            .scalars()
            .all()
        )


@pytest.fixture
async def scenario(client, fastapi_app, set_mock_user, dbsession):
    return await Scenario(client, fastapi_app, set_mock_user, dbsession).build()


@pytest.mark.anyio
async def test_request_resubmit_cycle_repeats_without_overwriting(scenario):
    s = scenario
    eoc1_id = str(s.eoc1.evidence_requirement_id)
    eoc2_id = str(s.eoc2.evidence_requirement_id)

    # IDIR requests information on EOC 1 only.
    requested = await s.request(s.eoc1)
    assert requested.status_code == 201, requested.text
    body = requested.json()
    assert body["status"] == "Submitted"
    [open_request] = body["informationRequests"]
    assert open_request["status"] == "Requested"
    assert open_request["evidenceRequirementId"] == s.eoc1.evidence_requirement_id
    assert open_request["requestedBy"] == "Ana Lyst"
    # The proponent's working copy is not government's to read.
    assert open_request["response"] is None
    assert open_request["canEdit"] is False
    await s.db.refresh(s.eoc1)
    assert s.eoc1.review_outcome == REVIEW_OUTCOME_INFORMATION_REQUESTED
    assert "invoices" in s.eoc1.missing_information

    # The submitter is alerted, by name, on the BCeID side.
    [alert] = await s.notifications(BCEID_TYPE)
    assert alert.related_user_profile_id == s.signer.user_profile_id
    assert alert.related_organization_id == s.org
    assert "linkPath" in alert.message

    # Asking twice for the same EOC is refused while the first is open.
    assert (await s.request(s.eoc1)).status_code == 409

    # The proponent sees only EOC 1 open; the submission stays read-only.
    s.as_proponent()
    page = (await s.client.get(s.eoc_url)).json()
    assert page["status"] == "Submitted" and page["canEdit"] is False
    [mine] = page["informationRequests"]
    assert mine["canEdit"] is True and mine["canSubmit"] is False
    assert mine["requestedBy"] is None  # no IDIR names for organizations
    assert mine["response"]["summaryOfWorkCompleted"] == "Original one"
    assert (
        await s.client.put(s.eoc_url, json={"evidenceResponses": s.original})
    ).status_code == 409

    # A proponent saves a draft answer; nothing reaches the submission yet.
    saved = await s.client.put(
        s.response_url(mine["id"]), json=_response("Draft answer")
    )
    assert saved.status_code == 200, saved.text
    submission = await s.submission()
    assert (
        submission.evidence_responses[eoc1_id]["summary_of_work_completed"]
        == "Original one"
    )
    # Only a signer submits.
    assert (
        await s.client.post(
            f"{s.response_url(mine['id'])}/submit", json=_response("Draft answer")
        )
    ).status_code == 403

    s.as_signer()
    answered = await s.client.post(
        f"{s.response_url(mine['id'])}/submit", json=_response("<p>First answer</p>")
    )
    assert answered.status_code == 200, answered.text
    answered_request = answered.json()["informationRequests"][0]
    assert answered_request["status"] == "Submitted"
    assert answered_request["canEdit"] is False
    submission = await s.submission()
    assert submission.status == "Submitted"
    assert (
        submission.evidence_responses[eoc1_id]["summary_of_work_completed"]
        == "<p>First answer</p>"
    )
    assert (
        submission.evidence_responses[eoc2_id]["summary_of_work_completed"]
        == "Original two"
    )
    await s.db.refresh(s.eoc1)
    assert s.eoc1.review_outcome is None and s.eoc1.missing_information is None

    # No assigned analyst: the analyst who asked is notified.
    [notice] = await s.notifications(IDIR_TYPE)
    assert notice.related_user_profile_id == s.analyst.user_profile_id

    # The request is closed to further edits.
    assert (
        await s.client.put(s.response_url(mine["id"]), json=_response("Late"))
    ).status_code == 409

    # Second cycle on the same EOC, now with an assigned analyst.
    assigned = await _seed_ia_analyst(s.db, "ia.assigned5545", "Asa", "Signed")
    s.action.assigned_analyst_id = assigned.user_profile_id
    await s.db.flush()
    again = await s.request(s.eoc1, "<p>Invoice dates are missing</p>")
    assert again.status_code == 201, again.text
    second_id = again.json()["informationRequests"][1]["id"]
    s.as_signer()
    assert (
        await s.client.post(
            f"{s.response_url(second_id)}/submit", json=_response("Second answer")
        )
    ).status_code == 200

    first, second = await s.rows()
    assert first.response["summary_of_work_completed"] == "<p>First answer</p>"
    assert first.previous_response["summary_of_work_completed"] == "Original one"
    assert second.previous_response["summary_of_work_completed"] == (
        "<p>First answer</p>"
    )
    assert second.response["summary_of_work_completed"] == "Second answer"
    assert first.missing_information != second.missing_information
    assert first.requested_by_user_id == s.analyst.user_profile_id
    assert first.submitted_by_user_id == s.signer.user_profile_id
    assert first.submitted_at and second.submitted_at

    # The original submission snapshot is untouched.
    event = (
        (
            await s.db.execute(
                select(DaEocSubmissionHistory).where(
                    DaEocSubmissionHistory.da_eoc_submission_id
                    == submission.da_eoc_submission_id,
                    DaEocSubmissionHistory.event == "STATUS_CHANGE",
                )
            )
        )
        .scalars()
        .one()
    )
    assert (
        event.snapshot["evidence_responses"][eoc1_id]["summary_of_work_completed"]
        == "Original one"
    )
    notices = await s.notifications(IDIR_TYPE)
    assert notices[-1].related_user_profile_id == assigned.user_profile_id

    # IDIR reads both cycles, in order, with the answers.
    s.as_analyst()
    page = (await s.client.get(s.eoc_url)).json()
    assert [r["status"] for r in page["informationRequests"]] == [
        "Submitted",
        "Submitted",
    ]
    assert (
        page["informationRequests"][1]["response"]["summaryOfWorkCompleted"]
        == "Second answer"
    )
    assert page["submissionInformationRequests"][str(submission.da_eoc_submission_id)]
    assert page["informationRequestAvailable"] is True


@pytest.mark.anyio
async def test_request_validation_and_review_state(scenario):
    s = scenario
    # Missing information is required, after stripping empty markup.
    empty = await s.request(s.eoc1, "<p><br></p>")
    assert empty.status_code == 422
    # Absent text falls back to the EOC's saved field, which is empty here.
    s.as_analyst()
    assert (await s.client.post(s.request_url(s.eoc1), json={})).status_code == 422

    # An EOC of another action, or an inactive one, is not found.
    s.eoc2.is_active = False
    await s.db.flush()
    assert (await s.request(s.eoc2)).status_code == 404

    # Directors see the review but do not request; BCeID cannot request.
    s.as_analyst(roles=IDIR_DIRECTOR)
    assert (
        await s.client.post(s.request_url(s.eoc1), json={"missingInformation": "x"})
    ).status_code == 403
    s.as_signer()
    assert (
        await s.client.post(s.request_url(s.eoc1), json={"missingInformation": "x"})
    ).status_code == 403

    # A manager may cover for the analyst.
    s.as_analyst(roles=IDIR_IA_MANAGER)
    assert (
        await s.client.post(
            s.request_url(s.eoc1), json={"missingInformation": "<p>More</p>"}
        )
    ).status_code == 201

    # Once the action leaves analyst review, no request can be raised.
    s.action.current_status_id = await _action_status_id(s.db, "Recommended to manager")
    await s.db.flush()
    s.eoc2.is_active = True
    await s.db.flush()
    assert (await s.request(s.eoc2)).status_code == 409


@pytest.mark.anyio
async def test_request_needs_a_submitted_submission(
    client, fastapi_app, set_mock_user, dbsession
):
    s = await Scenario(client, fastapi_app, set_mock_user, dbsession).build(
        submit=False
    )
    assert (await s.request(s.eoc1)).status_code == 409
    # A draft alone is not a submission either.
    s.as_proponent()
    assert (
        await s.client.put(s.eoc_url, json={"evidenceResponses": s.original})
    ).status_code == 200
    assert (await s.request(s.eoc1)).status_code == 409
    s.as_analyst()
    page = (await s.client.get(s.eoc_url)).json()
    assert page["informationRequestAvailable"] is False


@pytest.mark.anyio
async def test_proponent_writes_are_scoped_to_the_open_request(scenario):
    s = scenario
    request_id = (await s.request(s.eoc1)).json()["informationRequests"][0]["id"]

    # Another organization's proponent cannot reach it.
    s.as_user(
        [RoleEnum.IA_PROPONENT],
        organization_id=s.other_org,
        user_profile_id=s.signer.user_profile_id,
    )
    assert (
        await s.client.put(s.response_url(request_id), json=_response("x"))
    ).status_code == 403

    # A request ID from elsewhere reads as missing on this action.
    s.as_proponent()
    assert (
        await s.client.put(s.response_url(request_id + 999), json=_response("x"))
    ).status_code == 404

    # IDIR cannot answer for the proponent.
    s.as_analyst()
    assert (
        await s.client.put(s.response_url(request_id), json=_response("x"))
    ).status_code == 403

    # Only the requested EOC is open: EOC 2 has no request at all.
    s.as_proponent()
    page = (await s.client.get(s.eoc_url)).json()
    assert {r["evidenceRequirementId"] for r in page["informationRequests"]} == {
        s.eoc1.evidence_requirement_id
    }

    # Unsafe markup is stripped from the answer.
    saved = await s.client.put(
        s.response_url(request_id),
        json=_response(
            '<p>ok</p><script>alert(1)</script><a href="javascript:x">l</a>'
        ),
    )
    assert saved.status_code == 200
    [row] = await s.rows()
    assert "script" not in row.response["summary_of_work_completed"]
    assert "javascript" not in row.response["summary_of_work_completed"]

    # Leaving analyst review closes the request to the proponent.
    s.action.current_status_id = await _action_status_id(s.db, "Recommended to manager")
    await s.db.flush()
    assert (
        await s.client.put(s.response_url(request_id), json=_response("x"))
    ).status_code == 409


@pytest.mark.anyio
async def test_request_files_add_rename_remove_and_freeze(scenario):
    s = scenario
    storage = MagicMock()
    s.app.dependency_overrides[get_s3_client] = lambda: storage
    try:
        request_id = (await s.request(s.eoc1)).json()["informationRequests"][0]["id"]
        s.as_proponent()
        uploaded = await s.client.post(
            s.documents_url(request_id),
            files={"file": ("invoice.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        assert uploaded.status_code == 201, uploaded.text
        document_id = uploaded.json()["documentId"]
        page = (await s.client.get(s.eoc_url)).json()
        [document] = page["informationRequests"][0]["documents"]
        assert document["documentId"] == document_id
        assert document["canChange"] is True

        file_url = f"{s.documents_url(request_id)}/{document_id}"
        renamed = await s.client.put(file_url, json={"displayName": "Invoices"})
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["displayName"] == "Invoices.pdf"

        # Someone else at the organization cannot change it.
        s.as_proponent(keycloak_username="colleague", username="colleague")
        assert (
            await s.client.put(file_url, json={"displayName": "Mine"})
        ).status_code == 403
        assert (await s.client.delete(file_url)).status_code == 403

        # The generic document routes stay closed to the proponent.
        s.as_proponent()
        generic = await s.client.post(
            str(
                s.app.url_path_for(
                    "upload_file",
                    parent_type="designatedAction",
                    parent_id=s.action.designated_action_id,
                )
            ),
            files={"file": ("other.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        assert generic.status_code == 409

        # Remove one, keep another, then submit: the list is frozen.
        second = await s.client.post(
            s.documents_url(request_id),
            files={"file": ("photo.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        assert second.status_code == 201
        assert (await s.client.delete(file_url)).status_code == 200
        links = (
            (
                await s.db.execute(
                    select(
                        da_eoc_information_request_document_association.c.document_id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert links == [second.json()["documentId"]]

        s.as_signer()
        answered = await s.client.post(
            f"{s.response_url(request_id)}/submit", json=_response("With files")
        )
        assert answered.status_code == 200
        [row] = await s.rows()
        assert [d["file_name"] for d in row.documents] == ["photo.pdf"]
        assert (
            await s.client.post(
                s.documents_url(request_id),
                files={"file": ("late.pdf", b"%PDF-1.4 test", "application/pdf")},
            )
        ).status_code == 409
        assert (
            await s.client.delete(
                f"{s.documents_url(request_id)}/{second.json()['documentId']}"
            )
        ).status_code == 409
    finally:
        s.app.dependency_overrides.pop(get_s3_client, None)


@pytest.mark.anyio
async def test_whole_resubmission_supersedes_open_requests(scenario):
    s = scenario
    request_id = (await s.request(s.eoc1)).json()["informationRequests"][0]["id"]
    submission = await s.submission()

    # Government reopens the whole submission (#5516's route): the per-EOC
    # request gives way to the full revision.
    s.db.add(
        DaEocSubmissionHistory(
            da_eoc_submission_id=submission.da_eoc_submission_id,
            event="SUB_STATUS_CHANGE",
            sub_status="Information requested",
            user_profile_id=s.analyst.user_profile_id,
        )
    )
    await s.db.flush()
    s.as_proponent()
    page = (await s.client.get(s.eoc_url)).json()
    assert page["canEdit"] is True
    assert page["informationRequests"][0]["canEdit"] is False
    assert (
        await s.client.put(s.response_url(request_id), json=_response("x"))
    ).status_code == 409

    s.as_signer()
    resubmitted = await s.client.post(
        f"{s.eoc_url}/submit",
        json={"evidenceResponses": s.original, "declarationAccepted": True},
    )
    assert resubmitted.status_code == 200, resubmitted.text
    [row] = await s.rows()
    assert row.status == "Superseded"
    # The new submission starts with no open request; IDIR may ask again.
    assert resubmitted.json()["informationRequests"] == []
    assert (await s.request(s.eoc1)).status_code == 201


@pytest.mark.anyio
async def test_one_open_request_per_eoc_is_enforced_by_the_database(scenario):
    from sqlalchemy.exc import IntegrityError

    s = scenario
    assert (await s.request(s.eoc1)).status_code == 201
    submission = await s.submission()
    nested = await s.db.begin_nested()
    s.db.add(
        DaEocInformationRequest(
            da_eoc_submission_id=submission.da_eoc_submission_id,
            evidence_requirement_id=s.eoc1.evidence_requirement_id,
            status="Requested",
            missing_information="Duplicate",
            requested_by_user_id=s.analyst.user_profile_id,
        )
    )
    with pytest.raises(IntegrityError):
        await s.db.flush()
    await nested.rollback()
