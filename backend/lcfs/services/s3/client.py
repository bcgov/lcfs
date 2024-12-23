from fastapi import HTTPException
import os
import uuid
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from fastapi import Depends
from pydantic.v1 import ValidationError
from sqlalchemy import select
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
from lcfs.web.core.decorators import repo_handler

BUCKET_NAME = settings.s3_bucket
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes


class DocumentService:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        clamav_service: ClamAVService = Depends(),
        s3_client=Depends(get_s3_client),
        compliance_report_service: ComplianceReportServices = Depends(),
    ):
        self.db = db
        self.clamav_service = clamav_service
        self.s3_client = s3_client
        self.compliance_report_service = compliance_report_service

    @repo_handler
    async def upload_file(
        self, file, parent_id: str, parent_type="compliance_report", user=None
    ):
        compliance_report = (
            await self.compliance_report_service.get_compliance_report_by_id(parent_id)
        )
        if not compliance_report:
            raise HTTPException(status_code=404, detail="Compliance report not found")

        # Check if the user is a supplier and the compliance report status is different from Draft
        if (
            RoleEnum.SUPPLIER in user.role_names
            and compliance_report.current_status.status
            != ComplianceReportStatusEnum.Draft.value
        ):
            raise HTTPException(
                status_code=400,
                detail="Suppliers can only upload files when the compliance report status is Draft",
            )

        file_id = uuid.uuid4()
        file_key = f"{settings.s3_docs_path}/{parent_type}/{parent_id}/{file_id}"

        # Scan file size
        file_size = os.fstat(file.file.fileno()).st_size

        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValidationError(
                f"File size exceeds the maximum limit of {MAX_FILE_SIZE_MB} MB."
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
        else:
            raise ValidationError(f"Invalid Type {parent_type}")

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
    async def delete_file(self, document_id: int):
        document = await self.db.get_one(Document, document_id)

        if not document:
            raise Exception("Document not found")

        # Delete the file from S3
        self.s3_client.delete_object(Bucket=BUCKET_NAME, Key=document.file_key)

        # Delete the entry from the database
        await self.db.delete(document)
        await self.db.flush()

    @repo_handler
    async def get_by_id_and_type(self, parent_id: int, parent_type="compliance_report"):
        # Select documents that are associated with the given compliance report ID
        if parent_type == "compliance_report":
            stmt = (
                select(Document)
                .join(compliance_report_document_association)
                .where(
                    compliance_report_document_association.c.compliance_report_id
                    == parent_id
                )
            )
        else:
            raise ValidationError(f"Invalid Type for loading Documents {parent_type}")
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
