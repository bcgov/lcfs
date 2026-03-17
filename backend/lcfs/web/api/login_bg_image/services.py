import os
import uuid
import structlog
from typing import List, Optional

from fastapi import Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.login_bg_image.LoginBgImage import LoginBgImage
from lcfs.services.s3.dependency import get_s3_client
from lcfs.settings import settings
from lcfs.web.api.login_bg_image.repo import LoginBgImageRepository
from lcfs.web.api.login_bg_image.schema import LoginBgImageSchema, LoginBgImageUpdateSchema
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)

BUCKET_NAME = settings.s3_bucket
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
S3_PREFIX = "login-backgrounds"


class LoginBgImageService:
    def __init__(
        self,
        repo: LoginBgImageRepository = Depends(),
        s3_client=Depends(get_s3_client),
    ):
        self.repo = repo
        self.s3_client = s3_client

    @service_handler
    async def get_all(self) -> List[LoginBgImageSchema]:
        images = await self.repo.get_all()
        return [LoginBgImageSchema.model_validate(img) for img in images]

    @service_handler
    async def get_active(self) -> Optional[LoginBgImageSchema]:
        image = await self.repo.get_active()
        if image:
            return LoginBgImageSchema.model_validate(image)
        return None

    @service_handler
    async def upload(
        self,
        file: UploadFile,
        display_name: str,
        caption: Optional[str],
    ) -> LoginBgImageSchema:
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file.content_type}' is not allowed. Please upload JPEG, PNG, or WebP images.",
            )

        file_size = os.fstat(file.file.fileno()).st_size
        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds the 20 MB limit.",
            )

        file_id = uuid.uuid4()
        image_key = f"{S3_PREFIX}/{file_id}"

        file.file.seek(0)
        self.s3_client.upload_fileobj(
            Fileobj=file.file,
            Bucket=BUCKET_NAME,
            Key=image_key,
            ExtraArgs={"ContentType": file.content_type},
        )

        image = LoginBgImage(
            image_key=image_key,
            file_name=file.filename,
            display_name=display_name,
            caption=caption,
            is_active=False,
        )
        image = await self.repo.create(image)
        return LoginBgImageSchema.model_validate(image)

    @service_handler
    async def update(
        self,
        image_id: int,
        data: LoginBgImageUpdateSchema,
    ) -> LoginBgImageSchema:
        image = await self.repo.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        image.display_name = data.display_name
        image.caption = data.caption
        image = await self.repo.update(image)
        return LoginBgImageSchema.model_validate(image)

    @service_handler
    async def delete(self, image_id: int) -> None:
        image = await self.repo.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        try:
            self.s3_client.delete_object(Bucket=BUCKET_NAME, Key=image.image_key)
        except Exception as e:
            logger.warning(f"Could not delete S3 object {image.image_key}: {e}")

        await self.repo.delete(image)

    @service_handler
    async def activate(self, image_id: int) -> LoginBgImageSchema:
        image = await self.repo.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        await self.repo.deactivate_all()
        image.is_active = True
        image = await self.repo.update(image)
        return LoginBgImageSchema.model_validate(image)

    async def stream_image(self, image_id: int):
        """Stream an image directly from S3. Used by the login page (no auth required)."""
        image = await self.repo.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        response = self.s3_client.get_object(Bucket=BUCKET_NAME, Key=image.image_key)
        return response, image
