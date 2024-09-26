import logging
import os

import boto3
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.document import Document
from lcfs.settings import settings
from lcfs.web.core.decorators import repo_handler

logger = logging.getLogger(__name__)
BUCKET_NAME = settings.s3_bucket


class DocumentService:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            endpoint_url=settings.s3_endpoint,
            region_name="us-east-1",
        )

    # Upload a file to S3 and store metadata in the database
    @repo_handler
    async def upload_file(self, report_id, file):
        # TODO: Generate an ID before setting in S3
        file_key = f"compliance_report/{report_id}/{file.filename}"

        # Scan file size
        file_size = os.fstat(file.file.fileno()).st_size

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
            compliance_report_id=report_id,
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)

        return document

    # Generate a pre-signed URL for downloading a file from S3
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

    # Delete a file from S3 and remove the entry from the database
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
    async def get_by_report_id(self, report_id):
        stmt = select(Document).where(Document.compliance_report_id == report_id)
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
