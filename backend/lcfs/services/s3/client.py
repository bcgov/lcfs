from fastapi import Depends, HTTPException
from io import UnsupportedOperation
import os
import re
import uuid

from lcfs.utils.constants import ALLOWED_MIME_TYPES, ALLOWED_FILE_TYPES
from lcfs.db.models.admin_adjustment.AdminAdjustment import (
    admin_adjustment_document_association,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    initiative_agreement_document_association,
)
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    DesignatedAction,
    designated_action_document_association,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from sqlalchemy import select, delete, and_
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.services.s3.dependency import get_s3_client
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import (
    compliance_report_document_association,
)
from lcfs.db.models.ci_application.CIApplication import (
    CI_DOC_CATEGORIES,
    CI_DOC_CATEGORY_SUPPORTING,
    CIApplication,
    ci_application_document_association,
)
from lcfs.db.models.document import Document
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.comment.InternalComment import (
    InternalComment,
    internal_comment_document_association,
)
from lcfs.db.models.comment.CIApplicationInternalComment import (
    CIApplicationInternalComment,
)
from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from lcfs.services.clamav.client import ClamAVService
from lcfs.settings import settings
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.db.models.compliance.ChargingSite import charging_site_document_association
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException
from botocore.exceptions import ClientError

BUCKET_NAME = settings.s3_bucket
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes

DOCUMENT_RENAME_ENABLED_PARENT_TYPES = {"ci_application"}

DOCUMENT_PARENT_ASSOCIATIONS = {
    "compliance_report": (
        compliance_report_document_association,
        "compliance_report_id",
    ),
    "administrativeAdjustment": (
        admin_adjustment_document_association,
        "admin_adjustment_id",
    ),
    "initiativeAgreement": (
        initiative_agreement_document_association,
        "initiative_agreement_id",
    ),
    "designatedAction": (
        designated_action_document_association,
        "designated_action_id",
    ),
    "charging_site": (
        charging_site_document_association,
        "charging_site_id",
    ),
    "ci_application": (
        ci_application_document_association,
        "ci_application_id",
    ),
    "internal_comment": (
        internal_comment_document_association,
        "internal_comment_id",
    ),
}

_INVALID_DISPLAY_NAME_CHARS_RE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_TRAILING_EXTENSION_RE = re.compile(r"\.[A-Za-z0-9]{1,10}$")
MAX_DISPLAY_NAME_LENGTH = 255


def _normalize_display_name(requested_name: str, original_file_name: str) -> str:
    requested_name = (requested_name or "").strip()
    if not requested_name:
        raise HTTPException(status_code=400, detail="Display name cannot be empty.")
    if _INVALID_DISPLAY_NAME_CHARS_RE.search(requested_name):
        raise HTTPException(
            status_code=400,
            detail='Display name contains invalid characters (\\ / : * ? " < > |).',
        )

    _, original_ext = os.path.splitext(original_file_name)
    if original_ext and not requested_name.lower().endswith(original_ext.lower()):
        if _TRAILING_EXTENSION_RE.search(requested_name):
            requested_name = _TRAILING_EXTENSION_RE.sub(original_ext, requested_name)
        else:
            requested_name = f"{requested_name}{original_ext}"

    if len(requested_name) > MAX_DISPLAY_NAME_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Display name must be {MAX_DISPLAY_NAME_LENGTH} characters or fewer.",
        )

    return requested_name


class DocumentService:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        clamav_service: ClamAVService = Depends(),
        s3_client=Depends(get_s3_client),
        compliance_report_repo: ComplianceReportRepository = Depends(),
        fuel_supply_repo: FuelSupplyRepository = Depends(),
        admin_adjustment_service: AdminAdjustmentServices = Depends(),
        initiative_agreement_service: InitiativeAgreementServices = Depends(),
        charging_site_repo: ChargingSiteRepository = Depends(),
        initiative_agreement_repo: InitiativeAgreementRepository = Depends(),
    ):
        self.initiative_agreement_service = initiative_agreement_service
        self.initiative_agreement_repo = initiative_agreement_repo
        self.admin_adjustment_service = admin_adjustment_service
        self.db = db
        self.clamav_service = clamav_service
        self.s3_client = s3_client
        self.compliance_report_repo = compliance_report_repo
        self.fuel_supply_repo = fuel_supply_repo
        self.charging_site_repo = charging_site_repo

    @repo_handler
    async def upload_file(
        self,
        file,
        parent_id: int,
        parent_type,
        user=None,
        document_category: str | None = None,
    ):
        if parent_type == "compliance_report":
            await self._verify_compliance_report_access(parent_id, user)
        elif parent_type == "administrativeAdjustment":
            await self._verify_administrative_adjustment_access(parent_id, user)
        elif parent_type == "initiativeAgreement":
            await self._verify_initiative_agreement_access(parent_id, user)
        elif parent_type == "designatedAction":
            await self._verify_designated_action_access(parent_id, user)
        elif parent_type == "charging_site":
            await self._verify_charging_site_access(parent_id, user)
        elif parent_type == "internal_comment":
            await self.verify_internal_comment_access(parent_id, user, write=True)
        elif parent_type == "ci_application":
            # Access checks for CI application uploads live in the
            # ci_application validation layer; the views.py wrapper invokes
            # them before delegating here.
            if document_category and document_category not in CI_DOC_CATEGORIES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document_category '{document_category}'.",
                )
        else:
            raise ServiceException(f"Unknown parent type {parent_type} in upload_file")

        file_id = uuid.uuid4()
        file_key = f"{settings.s3_docs_path}/{parent_type}/{parent_id}/{file_id}"

        # Validate MIME type
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file.content_type or 'unknown'}' is not allowed. Please upload files of the following types: {ALLOWED_FILE_TYPES}",
            )

        # Scan file size
        file_size = os.fstat(file.file.fileno()).st_size

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds the maximum limit of {MAX_FILE_SIZE_MB} MB.",
            )

        if settings.clamav_enabled:
            self.clamav_service.scan_file(file)

        # Upload file to S3
        file.file.seek(0)
        try:
            self.s3_client.upload_fileobj(
                Fileobj=file.file,
                Bucket=BUCKET_NAME,
                Key=file_key,
                ExtraArgs={"ContentType": file.content_type},
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code != "XAmzContentSHA256Mismatch":
                raise
            # Some S3-compatible stores struggle with signed streaming uploads.
            file.file.seek(0)
            file_bytes = file.file.read()
            self.s3_client.put_object(
                Body=file_bytes,
                Bucket=BUCKET_NAME,
                Key=file_key,
                ContentType=file.content_type,
            )
        except Exception as exc:
            raise ServiceException(f"Error uploading file to S3: {exc}")
        finally:
            try:
                file.file.seek(0)
            except (ValueError, AttributeError, UnsupportedOperation):
                # Starlette's UploadFile may close the underlying SpooledTemporaryFile once streaming ends.
                pass

        document = Document(
            file_key=file_key,
            file_name=file.filename,
            file_size=file_size,
            mime_type=file.content_type,
        )

        if parent_type == "compliance_report":
            compliance_report = await self.db.get(ComplianceReport, parent_id)
            if not compliance_report:
                raise Exception("Compliance report not found")

            self.db.add(document)
            await self.db.flush()

            # Insert the association
            stmt = compliance_report_document_association.insert().values(
                compliance_report_id=compliance_report.compliance_report_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        elif parent_type == "administrativeAdjustment":
            admin_adjustment = await self.admin_adjustment_service.get_admin_adjustment(
                parent_id
            )
            if not admin_adjustment:
                raise Exception("Administrative Adjustment not found")

            self.db.add(document)
            await self.db.flush()

            # Insert the association
            stmt = admin_adjustment_document_association.insert().values(
                admin_adjustment_id=admin_adjustment.admin_adjustment_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        elif parent_type == "initiativeAgreement":
            # Read through the repository, not the legacy response schema:
            # agreement-management records carry no award-era
            # compliance_units or current_status, both of which that schema
            # requires, so validating one here rejected the upload.
            initiative_agreement = (
                await self.initiative_agreement_repo.get_initiative_agreement_by_id(
                    parent_id
                )
            )
            if not initiative_agreement:
                raise Exception("Initiative Agreement not found")

            self.db.add(document)
            await self.db.flush()

            # Insert the association
            stmt = initiative_agreement_document_association.insert().values(
                initiative_agreement_id=initiative_agreement.initiative_agreement_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        elif parent_type == "designatedAction":
            action = await self.db.get(DesignatedAction, parent_id)
            if not action:
                raise Exception("Designated action not found")

            self.db.add(document)
            await self.db.flush()

            stmt = designated_action_document_association.insert().values(
                designated_action_id=action.designated_action_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        elif parent_type == "charging_site":
            charging_site = await self.charging_site_repo.get_charging_site_by_id(
                parent_id
            )
            if not charging_site:
                raise Exception("Charging Site not found")

            self.db.add(document)
            await self.db.flush()

            # Insert the association
            stmt = charging_site_document_association.insert().values(
                charging_site_id=charging_site.charging_site_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        elif parent_type == "ci_application":
            ci_application = await self.db.get(CIApplication, parent_id)
            if not ci_application:
                raise Exception("CI application not found")

            self.db.add(document)
            await self.db.flush()

            stmt = ci_application_document_association.insert().values(
                ci_application_id=ci_application.ci_application_id,
                document_id=document.document_id,
                document_category=document_category or CI_DOC_CATEGORY_SUPPORTING,
            )
            await self.db.execute(stmt)
        elif parent_type == "internal_comment":
            internal_comment = await self.db.get(InternalComment, parent_id)
            if not internal_comment:
                raise Exception("Internal comment not found")

            self.db.add(document)
            await self.db.flush()

            # Insert the association
            stmt = internal_comment_document_association.insert().values(
                internal_comment_id=internal_comment.internal_comment_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
        else:
            raise ServiceException(f"Invalid Type {parent_type}")

        await self.db.flush()
        await self.db.refresh(document)

        return document

    async def _verify_compliance_report_access(self, parent_id, user):
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_by_id(parent_id)
        )

        if not compliance_report:
            raise HTTPException(status_code=404, detail="Compliance report not found")

        # Check if the user is a supplier and the compliance report status is different from Draft
        if (
            RoleEnum.SUPPLIER in user.role_names
            and compliance_report.current_status.status
            != ComplianceReportStatusEnum.Draft
        ):
            raise HTTPException(
                status_code=400,
                detail="Suppliers can only upload files when the compliance report status is Draft",
            )

    async def _verify_administrative_adjustment_access(self, parent_id, user):
        admin_adjustment = await self.admin_adjustment_service.get_admin_adjustment(
            parent_id
        )
        if not admin_adjustment:
            raise HTTPException(
                status_code=404, detail="Administrative Adjustment not found"
            )

        # Check if Government User
        if RoleEnum.GOVERNMENT in user.role_names:
            return
        raise HTTPException(
            status_code=400,
            detail="Only Government Staff can upload files to Administrative Adjustments.",
        )

    async def _verify_initiative_agreement_access(self, parent_id, user):
        # Repository, not the legacy schema — see the note in upload_file.
        initiative_agreement = (
            await self.initiative_agreement_repo.get_initiative_agreement_by_id(
                parent_id
            )
        )
        if not initiative_agreement:
            raise HTTPException(
                status_code=404, detail="Initiative Agreement not found"
            )

        # Check if Government User
        if RoleEnum.GOVERNMENT in user.role_names:
            return
        raise HTTPException(
            status_code=400,
            detail="Only Government Staff can upload files to Initiative Agreements.",
        )

    async def _verify_designated_action_access(self, parent_id, user):
        action = await self.db.get(DesignatedAction, parent_id)
        if not action:
            raise HTTPException(status_code=404, detail="Designated action not found")

        if RoleEnum.GOVERNMENT in user.role_names:
            return
        raise HTTPException(
            status_code=400,
            detail="Only Government Staff can upload files to designated actions.",
        )

    async def get_designated_action_agreement_id(self, designated_action_id: int):
        """Resolve an action's agreement for parent-access checks."""
        agreement_id = (
            await self.db.execute(
                select(DesignatedAction.initiative_agreement_id).where(
                    DesignatedAction.designated_action_id == designated_action_id
                )
            )
        ).scalar_one_or_none()
        if agreement_id is None:
            raise HTTPException(status_code=404, detail="Designated action not found")
        return agreement_id

    async def _verify_charging_site_access(self, parent_id, user):
        charging_site = await self.charging_site_repo.get_charging_site_by_id(parent_id)
        if not charging_site:
            raise HTTPException(status_code=404, detail="Charging Site not found")

        # Analysts can upload files to charging sites
        if (
            RoleEnum.ANALYST in user.role_names
            or RoleEnum.GOVERNMENT in user.role_names
        ):
            return
        if user.organization.organization_id == charging_site.organization_id:
            return
        raise HTTPException(
            status_code=400,
            detail="Only Analysts and Government Staff and related Organization users can upload files to Charging Sites.",
        )

    async def _get_readable_comment_organization_ids(
        self, internal_comment_id: int
    ) -> set[int]:
        """
        Organizations owning the entities a comment hangs off, restricted to
        the entity types a non-government caller may read.

        Only compliance report and CI application threads are resolved, because
        those are the only ones InternalCommentService.get_internal_comments
        exposes to a non-government caller. A comment on any other entity — or
        on none — resolves to an empty set and is refused.

        The organization is derived live from the association tables rather than
        read from ``internal_comment.organization_id``: that column is a
        nullable denormalization, so authorizing off it would deny access to
        attachments on older comments whose value was never backfilled.
        """
        report_orgs = (
            select(ComplianceReport.organization_id)
            .join(
                ComplianceReportInternalComment,
                ComplianceReportInternalComment.compliance_report_id
                == ComplianceReport.compliance_report_id,
            )
            .where(
                ComplianceReportInternalComment.internal_comment_id
                == internal_comment_id
            )
        )
        application_orgs = (
            select(CIApplication.organization_id)
            .join(
                CIApplicationInternalComment,
                CIApplicationInternalComment.ci_application_id
                == CIApplication.ci_application_id,
            )
            .where(
                CIApplicationInternalComment.internal_comment_id == internal_comment_id
            )
        )
        result = await self.db.execute(report_orgs.union(application_orgs))
        return {row[0] for row in result.all() if row[0] is not None}

    async def verify_internal_comment_access(self, parent_id, user, write=False):
        """Authorise attachment access for an internal comment.

        Attachment visibility follows the comment itself ("match comment
        permissions"):

        * write (add/remove attachment): only the comment's author, mirroring
          internal comment edit permissions.
        * read (list/download): government staff see everything; everyone else
          only Public comments, on a compliance report or CI application
          belonging to their own organization.
        """
        comment = await self.db.get(InternalComment, parent_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Internal comment not found")

        is_government = RoleEnum.GOVERNMENT in user.role_names

        if write:
            if comment.create_user != user.keycloak_username:
                raise HTTPException(
                    status_code=403,
                    detail="Only the comment author can modify its attachments.",
                )
        elif not is_government:
            visibility = (
                str(comment.visibility) if comment.visibility is not None else None
            )
            forbidden = HTTPException(
                status_code=403,
                detail="You do not have access to this comment's attachments.",
            )
            if visibility != "Public":
                raise forbidden
            # Visibility alone is not an organization scope, so the same
            # entity-type and ownership rules the comment read path applies
            # are applied here.
            user_organization_id = getattr(user, "organization_id", None)
            if user_organization_id is None:
                user_organization_id = getattr(
                    getattr(user, "organization", None), "organization_id", None
                )
            readable_organization_ids = (
                await self._get_readable_comment_organization_ids(parent_id)
            )
            if (
                user_organization_id is None
                or user_organization_id not in readable_organization_ids
            ):
                raise forbidden

        return comment

    async def _get_document_for_parent(
        self, document_id: int, parent_id: int, parent_type: str
    ) -> Document:
        association_info = DOCUMENT_PARENT_ASSOCIATIONS.get(parent_type)
        if not association_info:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported parent_type: {parent_type}",
            )

        association_table, parent_column = association_info
        result = await self.db.execute(
            select(Document)
            .join(
                association_table,
                association_table.c.document_id == Document.document_id,
            )
            .where(
                Document.document_id == document_id,
                getattr(association_table.c, parent_column) == parent_id,
            )
        )
        document = result.scalar_one_or_none()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document

    @repo_handler
    async def rename_file(
        self,
        document_id: int,
        parent_id: int,
        parent_type: str,
        display_name: str,
    ):
        if parent_type not in DOCUMENT_RENAME_ENABLED_PARENT_TYPES:
            raise HTTPException(
                status_code=403,
                detail=f"Renaming documents is not enabled for '{parent_type}'.",
            )

        document = await self._get_document_for_parent(
            document_id, parent_id, parent_type
        )
        new_display_name = _normalize_display_name(display_name, document.file_name)

        siblings = await self.get_by_id_and_type(parent_id, parent_type)
        for sibling in siblings:
            if sibling.document_id == document_id:
                continue
            existing_name = sibling.display_name or sibling.file_name
            if existing_name.lower() == new_display_name.lower():
                raise HTTPException(
                    status_code=400,
                    detail="A file with this name already exists.",
                )

        document.display_name = new_display_name
        await self.db.flush()
        await self.db.refresh(document)
        return document

    @repo_handler
    async def generate_presigned_url(self, document_id: int):
        document = await self.db.get_one(Document, document_id)

        if not document:
            raise Exception("Document not found")

        presigned_url = self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": document.file_key},
            ExpiresIn=60,  # URL expiration in seconds
        )
        return presigned_url

    @repo_handler
    async def delete_file(self, document_id: int, parent_id: int, parent_type: str):
        document = await self.db.get_one(Document, document_id)

        if not document:
            raise Exception("Document not found")

        association_info = DOCUMENT_PARENT_ASSOCIATIONS.get(parent_type)

        if not association_info:
            raise Exception(f"Unsupported parent_type: {parent_type}")

        association_table, parent_column = association_info

        # Check how many links this document has across all instances of this parent type
        links = (
            await self.db.execute(
                select(association_table).where(
                    document_id == association_table.c.document_id
                )
            )
        ).all()

        # If last link, delete the whole document
        if len(links) == 1:
            # Delete the file from S3
            self.s3_client.delete_object(Bucket=BUCKET_NAME, Key=document.file_key)

            # Delete the entry from the database
            await self.db.delete(document)
            await self.db.flush()
        else:  # Delete the association
            await self.db.execute(
                delete(association_table).where(
                    and_(
                        parent_id == getattr(association_table.c, parent_column),
                        document_id == association_table.c.document_id,
                    )
                )
            )

    @repo_handler
    async def get_by_id_and_type(self, parent_id: int, parent_type="compliance_report"):
        association_info = DOCUMENT_PARENT_ASSOCIATIONS.get(parent_type)

        if not association_info:
            raise ServiceException(f"Invalid Type for loading Documents {parent_type}")

        association_table, column_name = association_info

        # Construct the SQL statement dynamically
        if parent_type == "compliance_report":
            parent_ids = (
                await self.compliance_report_repo.get_related_compliance_report_ids(
                    parent_id
                )
            )
            stmt = (
                select(Document)
                .join(association_table)
                .where(
                    getattr(association_table.c, column_name).in_(parent_ids),
                    # Soft-deleted documents live in the bin, not the list.
                    # Inert for parents that cannot delete softly.
                    Document.deleted_date.is_(None),
                )
                .distinct(Document.document_id)
            )
            result = await self.db.execute(stmt)
            return result.scalars().all()

        if parent_type == "ci_application":
            # Project the join's document_category alongside Document so the
            # API response can carry the Step 3 bucket without a separate
            # endpoint.
            stmt = (
                select(Document, association_table.c.document_category)
                .join(
                    association_table,
                    association_table.c.document_id == Document.document_id,
                )
                .where(
                    getattr(association_table.c, column_name) == parent_id,
                    Document.deleted_date.is_(None),
                )
            )
            result = await self.db.execute(stmt)
            documents = []
            for document, category in result.all():
                # Pydantic's from_attributes reads attribute names verbatim,
                # so stamp the join column onto the Document row.
                document.document_category = category
                documents.append(document)
            return documents

        stmt = (
            select(Document)
            .join(association_table)
            .where(
                getattr(association_table.c, column_name) == parent_id,
                Document.deleted_date.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_uploading_organization_codes(self, usernames):
        """Map uploader usernames to their organization's code.

        Government (IDIR) users carry no organization, so they are absent
        from the result and their uploads render as government files.
        """
        if not usernames:
            return {}
        stmt = (
            select(UserProfile.keycloak_username, Organization.organization_code)
            .join(
                Organization,
                UserProfile.organization_id == Organization.organization_id,
            )
            .where(UserProfile.keycloak_username.in_(usernames))
        )
        result = await self.db.execute(stmt)
        return {username: code for username, code in result.all()}

    @repo_handler
    async def get_object(self, document_id: int):
        document = await self.db.get_one(Document, document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        try:
            response = self.s3_client.get_object(
                Bucket=BUCKET_NAME, Key=document.file_key
            )
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in ("NoSuchKey", "404"):
                raise HTTPException(
                    status_code=404,
                    detail="The file for this document could not be found in storage.",
                )
            raise
        return response, document

    async def get_object_for_parent(
        self, document_id: int, parent_id: int, parent_type: str
    ):
        """
        Fetch a document only when it belongs to the given parent.

        Callers validate the user's access to *parent_id*; without this check
        that validation is meaningless, because a caller who legitimately
        reaches one parent could stream any document id in the system.
        """
        documents = await self.get_by_id_and_type(parent_id, parent_type)
        # ci_application projects (Document, document_category) rows.
        document_ids = {
            (row[0] if isinstance(row, (tuple, Row)) else row).document_id
            for row in documents
        }

        if document_id not in document_ids:
            raise DataNotFoundException(
                f"Document {document_id} does not belong to {parent_type} {parent_id}"
            )

        return await self.get_object(document_id)

    async def copy_documents(self, copy_from_id: int, copy_to_id: int):
        documents = await self.db.execute(
            select(compliance_report_document_association).where(
                copy_from_id
                == compliance_report_document_association.c.compliance_report_id
            )
        )

        for document in documents.all():
            stmt = compliance_report_document_association.insert().values(
                compliance_report_id=copy_to_id,
                document_id=document.document_id,
            )
            await self.db.execute(stmt)
