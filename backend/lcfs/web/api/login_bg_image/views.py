import structlog
from typing import List, Optional

from fastapi import APIRouter, Depends, Form, Request, UploadFile, status
from fastapi.params import File
from starlette.responses import StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.login_bg_image.schema import LoginBgImageSchema, LoginBgImageUpdateSchema
from lcfs.web.api.login_bg_image.services import LoginBgImageService
from lcfs.web.core.decorators import view_handler

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get(
    "/active",
    response_model=Optional[LoginBgImageSchema],
    status_code=status.HTTP_200_OK,
)
async def get_active_image(
    service: LoginBgImageService = Depends(),
):
    """Returns the currently active login background image metadata. No auth required."""
    return await service.get_active()


@router.get(
    "/{image_id}/stream",
    status_code=status.HTTP_200_OK,
)
async def stream_image(
    image_id: int,
    service: LoginBgImageService = Depends(),
):
    """Streams the image bytes from S3. No auth required (used by login page)."""
    s3_response, image = await service.stream_image(image_id)
    headers = {
        "Content-Disposition": f'inline; filename="{image.file_name}"',
        "content-length": str(s3_response["ContentLength"]),
        "Cache-Control": "public, max-age=3600",
    }
    return StreamingResponse(
        content=s3_response["Body"],
        media_type=s3_response["ContentType"],
        headers=headers,
    )


@router.get(
    "/",
    response_model=List[LoginBgImageSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def get_all_images(
    request: Request,
    service: LoginBgImageService = Depends(),
) -> List[LoginBgImageSchema]:
    """List all login background images. Administrator only."""
    return await service.get_all()


@router.post(
    "/",
    response_model=LoginBgImageSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    display_name: str = Form(...),
    caption: Optional[str] = Form(None),
    service: LoginBgImageService = Depends(),
) -> LoginBgImageSchema:
    """Upload a new login background image. Administrator only."""
    return await service.upload(file, display_name, caption)


@router.put(
    "/{image_id}",
    response_model=LoginBgImageSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def update_image(
    request: Request,
    image_id: int,
    data: LoginBgImageUpdateSchema,
    service: LoginBgImageService = Depends(),
) -> LoginBgImageSchema:
    """Update image display name and caption. Administrator only."""
    return await service.update(image_id, data)


@router.put(
    "/{image_id}/activate",
    response_model=LoginBgImageSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def activate_image(
    request: Request,
    image_id: int,
    service: LoginBgImageService = Depends(),
) -> LoginBgImageSchema:
    """Set an image as the active login background. Administrator only."""
    return await service.activate(image_id)


@router.delete(
    "/{image_id}",
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def delete_image(
    request: Request,
    image_id: int,
    service: LoginBgImageService = Depends(),
):
    """Delete a login background image. Administrator only."""
    await service.delete(image_id)
    return {"message": "Image deleted successfully"}
