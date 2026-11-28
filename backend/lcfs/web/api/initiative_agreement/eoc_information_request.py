"""Request additional information on one EOC of a submitted DA/EOC
submission (#5545).

An IDIR analyst asks for more on one EOC. Only that EOC opens to the BCeID
proponent: its response and the files they add for it. The proponent answers
and the EOC closes again. The cycle repeats as often as needed.

The parent ``DaEocSubmission`` stays Submitted throughout, and its
sub-status is left alone: under #5516 an "Information requested" sub-status
reopens the WHOLE submission. Each cycle is one ``DaEocInformationRequest``
row; an EOC is "additional information requested" while it has an open
(Requested) row on the latest submission.

Every write is authorized here, server-side:
- the caller's role and organization (``_get_action_or_404``);
- the DA is still under analyst review;
- the latest submission is Submitted, and not reopened as a whole;
- the EOC is active and part of the accepted package;
- for proponent writes, the request is open, on that submission and EOC;
- for file changes, the file was added to that request by the caller.

The generic document routes and the whole-page EOC save are not opened by
any of this: they still go through ``validate_eoc_write``.
"""

from datetime import datetime, timezone
from html import unescape
import json
from typing import Optional

import structlog
from fastapi import Depends, HTTPException, Request, UploadFile
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import selectinload

from lcfs.db.models.document.Document import Document
from lcfs.db.models.initiative_agreement.DaEocInformationRequest import (
    INFORMATION_REQUEST_REQUESTED,
    INFORMATION_REQUEST_SUBMITTED,
    INFORMATION_REQUEST_SUPERSEDED,
    DaEocInformationRequest,
    da_eoc_information_request_document_association,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.initiative_agreement.rich_text import sanitize_eoc_rich_text
from lcfs.web.api.initiative_agreement.schema import (
    EOCInformationRequestCreateSchema,
    EOCInformationRequestResponseSchema,
)
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.workflow import IN_REVIEW_STATUSES
from lcfs.web.api.internal_comment.services import sanitize_comment_text
from lcfs.web.api.notification.schema import NotificationMessageSchema
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)

PARENT_TYPE = "designatedAction"
SUBMISSION_STATUS_SUBMITTED = "Submitted"
EOC_EDITOR_ROLES = (RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER)
REVIEW_SNAPSHOT_FIELDS = (
    "analyst_review",
    "review_outcome",
    "review_notes",
    "missing_information",
    "reviewed_by_user_id",
)


def _plain_text(value: Optional[str]) -> str:
    return unescape(sanitize_comment_text(value or "")).strip()


def _full_name(profile) -> Optional[str]:
    if profile is None:
        return None
    name = " ".join(
        part
        for part in (
            getattr(profile, "first_name", None),
            getattr(profile, "last_name", None),
        )
        if part
    ).strip()
    return name or None


def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _action_label(action) -> str:
    return f"DA{action.action_number}-IA{action.initiative_agreement_id}"


def _link_path(action) -> str:
    return (
        f"/initiative-agreements/{action.initiative_agreement_id}"
        f"/designated-actions/{action.designated_action_id}"
    )


async def supersede_open_requests(db, submission_ids, user_profile_id=None) -> None:
    """Close the open requests on submissions a whole resubmission replaces.

    Called when the proponent submits the whole DA/EOC again (#5516): the
    new submission answers everything, so a request still open on an older
    one is no longer theirs to answer. The rows are kept, marked Superseded.
    """
    if not submission_ids:
        return
    rows = (
        (
            await db.execute(
                select(DaEocInformationRequest)
                .where(
                    DaEocInformationRequest.da_eoc_submission_id.in_(
                        list(submission_ids)
                    ),
                    DaEocInformationRequest.status == INFORMATION_REQUEST_REQUESTED,
                )
                .with_for_update()
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.status = INFORMATION_REQUEST_SUPERSEDED


class EocInformationRequestService:
    def __init__(
        self,
        request: Request = None,
        ia_service: InitiativeAgreementServices = Depends(InitiativeAgreementServices),
    ) -> None:
        self.request = request
        self.ia = ia_service
        self.repo = ia_service.repo
        self.db = ia_service.repo.db
        self.notification_service = ia_service.notfn_service

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    @property
    def _user(self):
        return self.request.user if self.request else None

    def _is_government(self, user=None) -> bool:
        user = user if user is not None else self._user
        return bool(user and user_has_roles(user, [RoleEnum.GOVERNMENT]))

    def _is_eoc_editor(self, user=None) -> bool:
        user = user if user is not None else self._user
        return bool(
            user
            and not self._is_government(user)
            and any(role in user.role_names for role in EOC_EDITOR_ROLES)
        )

    @staticmethod
    def _in_review(action) -> bool:
        status = action.current_status.status if action.current_status else None
        return action.transaction_id is None and status in IN_REVIEW_STATUSES

    @staticmethod
    def _latest_submitted(rows):
        """The latest submission, when it is Submitted. A newer Draft means
        the whole submission is being revised, which supersedes per-EOC
        requests."""
        latest = rows[0] if rows else None
        if latest is not None and latest.status == SUBMISSION_STATUS_SUBMITTED:
            return latest
        return None

    def _open_for_requests(self, action, rows) -> bool:
        """Whether IDIR may raise a request on this DA right now."""
        return (
            self._latest_submitted(rows) is not None
            and self._in_review(action)
            and not self.ia._eoc_is_editable(action, rows)
        )

    async def _requests_for_submissions(self, submission_ids):
        if not submission_ids:
            return []
        result = await self.db.execute(
            select(DaEocInformationRequest)
            .options(
                selectinload(DaEocInformationRequest.requested_by),
                selectinload(DaEocInformationRequest.submitted_by),
                selectinload(DaEocInformationRequest.evidence_requirement),
            )
            .where(DaEocInformationRequest.da_eoc_submission_id.in_(submission_ids))
            .order_by(DaEocInformationRequest.da_eoc_information_request_id.asc())
            .execution_options(populate_existing=True)
        )
        return list(result.scalars().all())

    async def _linked_documents(self, request_ids):
        """Live files on each request, by request ID."""
        if not request_ids:
            return {}
        link = da_eoc_information_request_document_association
        result = await self.db.execute(
            select(link.c.da_eoc_information_request_id, Document)
            .join(Document, Document.document_id == link.c.document_id)
            .where(link.c.da_eoc_information_request_id.in_(request_ids))
            .order_by(Document.document_id.asc())
        )
        documents = {}
        for request_id, document in result.all():
            documents.setdefault(request_id, []).append(document)
        return documents

    @staticmethod
    def _document_payload(document) -> dict:
        return {
            "document_id": document.document_id,
            "file_name": document.file_name,
            "display_name": document.display_name,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "create_user": document.create_user,
        }

    def _request_payload(self, row, live_documents, *, can_edit, can_submit):
        """One request as the EOC page shows it. Internal fields (the
        analyst's review, the response before the cycle) stay server-side,
        and organizations see no IDIR names."""
        government = self._is_government()
        requirement = row.evidence_requirement
        if row.status == INFORMATION_REQUEST_REQUESTED:
            documents = [self._document_payload(doc) for doc in live_documents]
        else:
            documents = list(row.documents or [])
        username = getattr(self._user, "keycloak_username", None)
        return {
            "id": row.da_eoc_information_request_id,
            "submission_id": row.da_eoc_submission_id,
            "evidence_requirement_id": row.evidence_requirement_id,
            "requirement_number": getattr(requirement, "requirement_number", None),
            "requirement_title": getattr(requirement, "title", None),
            "status": row.status,
            "missing_information": row.missing_information,
            "requested_at": row.requested_at,
            "requested_by": (_full_name(row.requested_by) if government else None),
            # The working copy is the proponent's until they submit it.
            "response": (
                row.response
                if row.status != INFORMATION_REQUEST_REQUESTED or not government
                else None
            ),
            "submitted_at": row.submitted_at,
            "submitted_by": _full_name(row.submitted_by),
            "documents": [
                {
                    **document,
                    "can_change": bool(
                        can_edit
                        and username is not None
                        and document.get("create_user") == username
                    ),
                }
                for document in documents
            ],
            "can_edit": can_edit,
            "can_submit": can_submit,
        }

    async def information_request_view(self, action, rows) -> dict:
        """The request fields of the EOC page (merged into ``get_eoc``).

        ``information_requests`` lists every cycle on the latest submission,
        oldest first; ``submission_information_requests`` maps every older
        submission to its cycles, for the history accordion.
        """
        submission_ids = [row.da_eoc_submission_id for row in rows]
        requests = await self._requests_for_submissions(submission_ids)
        open_ids = [
            row.da_eoc_information_request_id
            for row in requests
            if row.status == INFORMATION_REQUEST_REQUESTED
        ]
        live_documents = await self._linked_documents(open_ids)
        latest = self._latest_submitted(rows)
        writable = bool(
            latest is not None
            and self._is_eoc_editor()
            and self._in_review(action)
            and not self.ia._eoc_is_editable(action, rows)
        )
        accepted_ids = {
            requirement.evidence_requirement_id
            for requirement in await self.repo.get_evidence_requirements(
                action.designated_action_id
            )
        }
        signer = bool(self._user and user_has_roles(self._user, [RoleEnum.IA_SIGNER]))
        by_submission = {}
        for row in requests:
            editable = (
                writable
                and row.status == INFORMATION_REQUEST_REQUESTED
                and row.da_eoc_submission_id == latest.da_eoc_submission_id
                and row.evidence_requirement_id in accepted_ids
            )
            by_submission.setdefault(row.da_eoc_submission_id, []).append(
                self._request_payload(
                    row,
                    live_documents.get(row.da_eoc_information_request_id, []),
                    can_edit=editable,
                    can_submit=editable and signer,
                )
            )
        reviewer = self._is_government() and any(
            user_has_roles(self._user, [role])
            for role in (RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER)
        )
        return {
            "information_request_available": bool(
                reviewer and self._open_for_requests(action, rows)
            ),
            "information_requests": (
                by_submission.get(latest.da_eoc_submission_id, [])
                if latest is not None
                else []
            ),
            "submission_information_requests": {
                str(submission_id): payload
                for submission_id, payload in by_submission.items()
            },
        }

    # ------------------------------------------------------------------
    # IDIR: request additional information
    # ------------------------------------------------------------------

    async def _requirement_in_package(self, designated_action_id, requirement_id):
        """The EOC, if it is active and in the accepted package. The repo's
        list is the package filter (#5570 adds pending change orders to
        it), so an EOC an unaccepted change order added reads as missing."""
        requirements = await self.repo.get_evidence_requirements(designated_action_id)
        requirement = next(
            (
                requirement
                for requirement in requirements
                if requirement.evidence_requirement_id == requirement_id
            ),
            None,
        )
        if requirement is None:
            raise HTTPException(status_code=404, detail="EOC not found")
        return requirement, requirements

    async def _lock_submissions(self, action):
        rows = await self.repo.get_portal_evidence_submissions(
            action.designated_action_id, for_update=True
        )
        organization_id = action.initiative_agreement.to_organization_id
        if any(row.organization_id != organization_id for row in rows):
            raise HTTPException(
                status_code=403,
                detail="Submission organization does not match agreement",
            )
        action._eoc_action_history = await self.repo.get_designated_action_history(
            action.designated_action_id
        )
        return rows

    async def _open_request(self, submission_id, requirement_id):
        return (
            await self.db.execute(
                select(DaEocInformationRequest)
                .where(
                    DaEocInformationRequest.da_eoc_submission_id == submission_id,
                    DaEocInformationRequest.evidence_requirement_id == requirement_id,
                    DaEocInformationRequest.status == INFORMATION_REQUEST_REQUESTED,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()

    @service_handler
    async def request_information(
        self,
        designated_action_id: int,
        evidence_requirement_id: int,
        data: EOCInformationRequestCreateSchema,
    ):
        user = self._user
        if not self._is_government(user) or not any(
            user_has_roles(user, [role])
            for role in (RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER)
        ):
            raise HTTPException(
                status_code=403, detail="IA analyst or manager required"
            )
        # The DA row lock serializes this with the workflow transitions.
        action = await self.ia._get_action_or_404(designated_action_id, for_update=True)
        rows = await self._lock_submissions(action)
        submission = self._latest_submitted(rows)
        if submission is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Additional information can be requested only while the "
                    "DA/EOC submission is Submitted."
                ),
            )
        if not self._in_review(action):
            raise HTTPException(
                status_code=409,
                detail="This designated action is no longer under analyst review.",
            )
        if self.ia._eoc_is_editable(action, rows):
            raise HTTPException(
                status_code=409,
                detail="The whole submission is already open to the proponent.",
            )
        requirement, requirements = await self._requirement_in_package(
            designated_action_id, evidence_requirement_id
        )
        text = (
            data.missing_information
            if data.missing_information is not None
            else requirement.missing_information
        )
        text = sanitize_eoc_rich_text(text or "")
        if not _plain_text(text):
            raise HTTPException(
                status_code=422,
                detail="Enter the missing information before requesting it.",
            )
        if await self._open_request(
            submission.da_eoc_submission_id, evidence_requirement_id
        ):
            raise HTTPException(
                status_code=409,
                detail="Additional information is already requested for this EOC.",
            )

        response_map = self.ia._eoc_response_map(submission, requirements)
        current_response = response_map.get(
            str(evidence_requirement_id), self.ia._empty_eoc_response()
        )
        review_snapshot = {
            field: getattr(requirement, field) for field in REVIEW_SNAPSHOT_FIELDS
        }
        review_snapshot["reviewed_date"] = _iso(requirement.reviewed_date)
        row = DaEocInformationRequest(
            da_eoc_submission_id=submission.da_eoc_submission_id,
            evidence_requirement_id=evidence_requirement_id,
            status=INFORMATION_REQUEST_REQUESTED,
            missing_information=text,
            requested_by_user_id=user.user_profile_id,
            requested_at=datetime.now(timezone.utc),
            review_snapshot=review_snapshot,
            previous_response=dict(current_response),
            response=dict(current_response),
        )
        self.db.add(row)

        # The card keeps showing what was asked.
        requirement.missing_information = text
        requirement.review_outcome = REVIEW_OUTCOME_INFORMATION_REQUESTED
        requirement.reviewed_by_user_id = user.user_profile_id
        requirement.reviewed_date = datetime.now(timezone.utc)
        requirement.update_user = getattr(user, "keycloak_username", None)
        await self.db.flush()

        await self._notify_proponent(action, submission, requirement)
        return await self.ia.get_eoc(designated_action_id)

    # ------------------------------------------------------------------
    # BCeID: answer a request
    # ------------------------------------------------------------------

    async def _writable_request(self, designated_action_id, request_id):
        """The open request, after every check a proponent write needs."""
        if not self._is_eoc_editor():
            raise HTTPException(
                status_code=403, detail="IA proponent or IA signer required"
            )
        # Org and role are checked here: a proponent only reaches their own
        # organization's actions.
        action = await self.ia._get_action_or_404(designated_action_id, for_update=True)
        rows = await self._lock_submissions(action)
        submission = self._latest_submitted(rows)
        row = (
            await self.db.execute(
                select(DaEocInformationRequest)
                .where(
                    DaEocInformationRequest.da_eoc_information_request_id == request_id
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if row is None or row.da_eoc_submission_id not in {
            r.da_eoc_submission_id for r in rows
        }:
            raise HTTPException(status_code=404, detail="Request not found")
        if row.status != INFORMATION_REQUEST_REQUESTED:
            raise HTTPException(
                status_code=409,
                detail="This request for additional information is closed.",
            )
        if (
            submission is None
            or row.da_eoc_submission_id != submission.da_eoc_submission_id
            or self.ia._eoc_is_editable(action, rows)
        ):
            raise HTTPException(
                status_code=409,
                detail="This request was replaced by a newer submission.",
            )
        if not self._in_review(action):
            raise HTTPException(
                status_code=409,
                detail="This designated action is no longer under analyst review.",
            )
        requirement, requirements = await self._requirement_in_package(
            designated_action_id, row.evidence_requirement_id
        )
        return action, submission, row, requirement, requirements

    def _clean_response(self, data: EOCInformationRequestResponseSchema) -> dict:
        return {
            field: sanitize_eoc_rich_text(getattr(data, field) or "")
            for field in self.ia.EOC_FIELDS
        }

    @service_handler
    async def save_response(
        self,
        designated_action_id: int,
        request_id: int,
        data: EOCInformationRequestResponseSchema,
    ):
        _, _, row, _, _ = await self._writable_request(designated_action_id, request_id)
        row.response = self._clean_response(data)
        row.update_user = getattr(self._user, "keycloak_username", None)
        await self.db.flush()
        return await self.ia.get_eoc(designated_action_id)

    @service_handler
    async def submit_response(
        self,
        designated_action_id: int,
        request_id: int,
        data: EOCInformationRequestResponseSchema,
    ):
        user = self._user
        if not user_has_roles(user, [RoleEnum.IA_SIGNER]):
            raise HTTPException(
                status_code=403,
                detail="Only an IA signer may submit additional information",
            )
        action, submission, row, requirement, requirements = (
            await self._writable_request(designated_action_id, request_id)
        )
        response = self._clean_response(data)
        documents = (await self._linked_documents([request_id])).get(request_id, [])
        now = datetime.now(timezone.utc)

        row.response = response
        row.documents = [self._document_payload(doc) for doc in documents]
        row.status = INFORMATION_REQUEST_SUBMITTED
        row.submitted_by_user_id = user.user_profile_id
        row.submitted_at = now
        row.update_user = getattr(user, "keycloak_username", None)

        # The submission's live responses carry the latest answer, so the
        # analyst's view and any later whole revision start from it. What was
        # first submitted stays in the Submitted event's snapshot, and this
        # row keeps the cycle's before and after.
        response_map = self.ia._eoc_response_map(submission, requirements)
        response_map[str(row.evidence_requirement_id)] = response
        submission.evidence_responses = response_map
        first_response = next(iter(response_map.values()))
        for field in self.ia.EOC_FIELDS:
            setattr(submission, field, first_response[field])
        submission.update_user = getattr(user, "keycloak_username", None)

        # The EOC needs reviewing again. The review it had is on the row.
        requirement.review_outcome = None
        requirement.missing_information = None
        requirement.reviewed_by_user_id = None
        requirement.reviewed_by = None
        requirement.reviewed_date = None
        requirement.update_user = getattr(user, "keycloak_username", None)
        await self.db.flush()

        await self._notify_analyst(action, row, requirement)
        return await self.ia.get_eoc(designated_action_id)

    # ------------------------------------------------------------------
    # BCeID: the request's files
    # ------------------------------------------------------------------

    async def _request_document(self, request_id, document_id):
        link = da_eoc_information_request_document_association
        document = (
            await self.db.execute(
                select(Document)
                .join(link, link.c.document_id == Document.document_id)
                .where(
                    link.c.da_eoc_information_request_id == request_id,
                    Document.document_id == document_id,
                )
                .with_for_update(of=Document)
            )
        ).scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        if document.create_user != getattr(self._user, "keycloak_username", None):
            raise HTTPException(
                status_code=403, detail="Only the person who added a file may change it"
            )
        return document

    @service_handler
    async def upload_document(
        self,
        designated_action_id: int,
        request_id: int,
        file: UploadFile,
        document_service,
    ):
        await self._writable_request(designated_action_id, request_id)
        # A new file at the DA tree root: under #5569 a proponent's new file
        # is evidence, not a package change, and no folder is touched.
        document = await document_service.upload_file(
            file, designated_action_id, PARENT_TYPE, self._user
        )
        # Ownership decides who may rename or remove the file, so set it
        # from the caller rather than rely on the session's audit context.
        document.create_user = getattr(self._user, "keycloak_username", None)
        await self.db.execute(
            insert(da_eoc_information_request_document_association).values(
                da_eoc_information_request_id=request_id,
                document_id=document.document_id,
            )
        )
        await self.db.flush()
        return document

    @service_handler
    async def rename_document(
        self,
        designated_action_id: int,
        request_id: int,
        document_id: int,
        display_name: str,
    ):
        from lcfs.services.s3.client import _normalize_display_name

        await self._writable_request(designated_action_id, request_id)
        document = await self._request_document(request_id, document_id)
        new_name = _normalize_display_name(display_name, document.file_name)
        for sibling in (await self._linked_documents([request_id])).get(request_id, []):
            if sibling.document_id == document_id:
                continue
            if (sibling.display_name or sibling.file_name).lower() == new_name.lower():
                raise HTTPException(
                    status_code=400, detail="A file with this name already exists."
                )
        document.display_name = new_name
        await self.db.flush()
        await self.db.refresh(document)
        return document

    @service_handler
    async def delete_document(
        self,
        designated_action_id: int,
        request_id: int,
        document_id: int,
        document_service,
    ):
        await self._writable_request(designated_action_id, request_id)
        await self._request_document(request_id, document_id)
        await self.db.execute(
            delete(da_eoc_information_request_document_association).where(
                da_eoc_information_request_document_association.c.da_eoc_information_request_id
                == request_id,
                da_eoc_information_request_document_association.c.document_id
                == document_id,
            )
        )
        await document_service.delete_file(
            document_id, designated_action_id, PARENT_TYPE
        )
        await self.db.flush()

    # ------------------------------------------------------------------
    # Notifications: direct, to one person each
    # ------------------------------------------------------------------

    def _notification(self, action, requirement, kind: str, organization_id):
        return NotificationMessageSchema(
            type=kind,
            related_transaction_id=_action_label(action),
            related_organization_id=organization_id,
            origin_user_profile_id=getattr(self._user, "user_profile_id", None),
            message=json.dumps(
                {
                    "service": PARENT_TYPE,
                    "id": action.designated_action_id,
                    "initiativeAgreementId": action.initiative_agreement_id,
                    "requirementNumber": requirement.requirement_number,
                    "status": kind.lower(),
                    "linkPath": _link_path(action),
                }
            ),
        )

    def _email_context(self, action, requirement, subject: str) -> dict:
        return {
            "subject": subject,
            "action_label": _action_label(action),
            "action_name": action.name,
            "requirement_number": requirement.requirement_number,
            "link_path": _link_path(action),
        }

    async def _notify_proponent(self, action, submission, requirement) -> None:
        """Alert the BCeID user who submitted the DA/EOC."""
        event = self.ia._submission_event(submission)
        recipient_id = event.user_profile_id if event else None
        if recipient_id is None:
            logger.warning(
                "No submitter to notify of an EOC information request",
                designated_action_id=action.designated_action_id,
            )
            return
        recipient = await self.repo.get_user_profile_by_id(recipient_id)
        await self.notification_service.send_direct_notification(
            NotificationTypeEnum.BCEID__INITIATIVE_AGREEMENT__EOC_INFORMATION_REQUESTED,
            recipient_id,
            getattr(recipient, "email", None),
            self._notification(
                action,
                requirement,
                "EOC additional information requested",
                submission.organization_id,
            ),
            self._email_context(
                action,
                requirement,
                f"Additional information requested for {_action_label(action)}",
            ),
        )

    async def _notify_analyst(self, action, row, requirement) -> None:
        """Notify the assigned analyst, or the analyst who asked when the
        action has none."""
        recipient_id = action.assigned_analyst_id or row.requested_by_user_id
        recipient = await self.repo.get_user_profile_by_id(recipient_id)
        await self.notification_service.send_direct_notification(
            NotificationTypeEnum.IDIR_ANALYST__INITIATIVE_AGREEMENT__EOC_INFORMATION_SUBMITTED,
            recipient_id,
            getattr(recipient, "email", None),
            self._notification(
                action,
                requirement,
                "EOC additional information submitted",
                action.initiative_agreement.to_organization_id,
            ),
            self._email_context(
                action,
                requirement,
                f"Additional information submitted for {_action_label(action)}",
            ),
        )
