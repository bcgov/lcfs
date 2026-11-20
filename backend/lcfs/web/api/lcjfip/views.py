"""Low Carbon Jet Fuel Incentive Program (LCJFIP) application endpoints (#5532)."""

from typing import List

from botocore.client import BaseClient
from fastapi import APIRouter, BackgroundTasks, Body, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db import dependencies
from lcfs.services.s3.dependency import get_s3_client
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.lcjfip.schema import (
    LCJFIPApplicationsListSchema,
    LCJFIPApplicationSaveSchema,
    LCJFIPApplicationSchema,
    LCJFIPFuelCodeOptionSchema,
    LCJFIPReferenceDataSchema,
    LCJFIPSubmitSchema,
)
from lcfs.web.api.lcjfip.services import LCJFIPServices
from lcfs.web.api.lcjfip.validation import (
    APPLICANT_ROLES,
    READ_ROLES,
    LCJFIPValidation,
)
from lcfs.web.api.role.schema import is_government_user
from lcfs.web.core.decorators import view_handler

router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get(
    "/reference-data",
    response_model=LCJFIPReferenceDataSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(READ_ROLES)
async def get_lcjfip_reference_data(
    request: Request, service: LCJFIPServices = Depends()
) -> LCJFIPReferenceDataSchema:
    """Select list options and incentive rates for the application form."""
    return await service.get_reference_data()


@router.get(
    "/fuel-codes",
    response_model=List[LCJFIPFuelCodeOptionSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(READ_ROLES)
async def get_lcjfip_fuel_codes(
    request: Request, service: LCJFIPServices = Depends()
) -> List[LCJFIPFuelCodeOptionSchema]:
    """Approved, unexpired BC-LCFS fuel codes for low carbon jet fuel."""
    return await service.get_fuel_codes()


@router.get(
    "/statuses",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
)
@view_handler(READ_ROLES)
async def get_lcjfip_statuses(
    request: Request, service: LCJFIPServices = Depends()
) -> List[str]:
    """Statuses the caller can see, for the index's status filter."""
    return await service.get_statuses(exclude_draft=is_government_user(request.user))


@router.post(
    "/applications/list",
    response_model=LCJFIPApplicationsListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(READ_ROLES)
async def list_lcjfip_applications(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
) -> LCJFIPApplicationsListSchema:
    """
    A page of the applications index (#5541). BCeID users see their own
    organization's applications, Drafts included; government users see every
    organization's, without Drafts.
    """
    if is_government_user(request.user):
        return await service.list_applications(
            pagination, organization_id=None, exclude_draft=True
        )
    return await service.list_applications(
        pagination,
        organization_id=validate.require_organization(),
        exclude_draft=False,
    )


@router.post(
    "/applications",
    response_model=LCJFIPApplicationSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(APPLICANT_ROLES)
async def create_lcjfip_application(
    request: Request,
    data: LCJFIPApplicationSaveSchema = Body(...),
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
) -> LCJFIPApplicationSchema:
    """Create a Draft application from the form as first saved."""
    organization_id = validate.require_organization()
    return await service.create_application(organization_id, data, request.user)


@router.get(
    "/applications/{application_id}",
    response_model=LCJFIPApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(READ_ROLES)
async def get_lcjfip_application(
    request: Request,
    application_id: int,
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
) -> LCJFIPApplicationSchema:
    application = await validate.get_application(application_id)
    return await service.get_application(application)


@router.put(
    "/applications/{application_id}",
    response_model=LCJFIPApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(APPLICANT_ROLES)
async def save_lcjfip_application(
    request: Request,
    application_id: int,
    data: LCJFIPApplicationSaveSchema = Body(...),
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
) -> LCJFIPApplicationSchema:
    """Save a Draft. No field is required until the application is submitted."""
    application = await validate.get_application(application_id, write=True)
    return await service.save_application(application, data)


@router.delete(
    "/applications/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(APPLICANT_ROLES)
async def delete_lcjfip_application(
    request: Request,
    application_id: int,
    background_tasks: BackgroundTasks,
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
    db: AsyncSession = Depends(get_async_db, scope="function"),
    s3_client: BaseClient = Depends(get_s3_client),
) -> None:
    """Delete a Draft with its input data, comments and their attachments."""
    # Imported lazily because DocumentService's parent services import routers.
    from lcfs.services.s3.client import DocumentService

    application = await validate.get_application(application_id, write=True)
    document_service = DocumentService(db=db, s3_client=s3_client)
    file_keys = await service.delete_application(application, document_service)
    # Runs after the response, so after the database transaction has committed.
    background_tasks.add_task(document_service.delete_storage_objects, file_keys)


@router.post(
    "/applications/{application_id}/submit",
    response_model=LCJFIPApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(APPLICANT_ROLES)
async def submit_lcjfip_application(
    request: Request,
    application_id: int,
    data: LCJFIPSubmitSchema = Body(...),
    service: LCJFIPServices = Depends(),
    validate: LCJFIPValidation = Depends(),
) -> LCJFIPApplicationSchema:
    """Sign and submit a saved Draft once every required field is complete."""
    application = await validate.get_application(application_id, write=True)
    return await service.submit_application(application, data, request.user)
