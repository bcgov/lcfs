from fastapi import HTTPException
import os
import uuid

from lcfs.utils.constants import ALLOWED_MIME_TYPES, ALLOWED_FILE_TYPES
from lcfs.db.models.admin_adjustment.AdminAdjustment import (
    admin_adjustment_document_association,
    AdminAdjustment,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    initiative_agreement_document_association,
    InitiativeAgreement,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from fastapi import Depends
from pydantic.v1 import ValidationError
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.services.s3.dependency import get_s3_client
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import (
    compliance_report_document_association,
)
from lcfs.db.models.document import Document
from lcfs.services.clamav.client import ClamAVService
from lcfs.settings import settings
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import ServiceException, DataNotFoundException

BUCKET_NAME = settings.s3_bucket
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes


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
    ):
        self.initiative_agreement_service = initiative_agreement_service
        self.admin_adjustment_service = admin_adjustment_service
        self.db = db
        self.clamav_service = clamav_service
        self.s3_client = s3_client
        self.compliance_report_repo = compliance_report_repo
        self.fuel_supply_repo = fuel_supply_repo

    @repo_handler
    async def upload_file(self, file, parent_id: int, parent_type, user=None):
        if parent_type == "compliance_report":
            await self._verify_compliance_report_access(parent_id, user)
        elif parent_type == "administrativeAdjustment":
            await self._verify_administrative_adjustment_access(parent_id, user)
        elif parent_type == "initiativeAgreement":
            await self._verify_initiative_agreement_access(parent_id, user)
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
        self.s3_client.upload_fileobj(
            Fileobj=file.file,
            Bucket=BUCKET_NAME,
            Key=file_key,
            ExtraArgs={"ContentType": file.content_type},
        )

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
            initiative_agreement = (
                await self.initiative_agreement_service.get_initiative_agreement(
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
        initiative_agreement = (
            await self.initiative_agreement_service.get_initiative_agreement(parent_id)
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

        links = []
        if parent_type == "compliance_report":
            links = (
                await self.db.execute(
                    select(compliance_report_document_association).where(
                        document_id
                        == compliance_report_document_association.c.document_id
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
                delete(compliance_report_document_association).where(
                    and_(
                        parent_id
                        == compliance_report_document_association.c.compliance_report_id,
                        document_id
                        == compliance_report_document_association.c.document_id,
                    )
                )
            )

    @repo_handler
    async def get_by_id_and_type(self, parent_id: int, parent_type="compliance_report"):
        # Mapping of parent types to their respective association tables and columns
        type_mapping = {
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
        }

        # Retrieve the association table and column based on the parent_type
        association_info = type_mapping.get(parent_type)

        if not association_info:
            raise ServiceException(f"Invalid Type for loading Documents {parent_type}")

        association_table, column_name = association_info

        # Construct the SQL statement dynamically
        stmt = (
            select(Document)
            .join(association_table)
            .where(getattr(association_table.c, column_name) == parent_id)
        )

        # Execute the statement and fetch results
        result = await self.db.execute(stmt)
        documents = result.scalars().all()
        return documents

    @repo_handler
    async def get_object(self, document_id: int):
        document = await self.db.get_one(Document, document_id)

        if not document:
            raise Exception("Document not found")

        response = self.s3_client.get_object(Bucket=BUCKET_NAME, Key=document.file_key)
        return response, document

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
