from logging import getLogger
import math
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette import status
from sqlalchemy.orm import selectinload
from starlette.responses import Response
from fastapi_cache.decorator import cache
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

from lcfs.db import dependencies
from lcfs.db.models import UserProfile
from lcfs.db.models.Organization import Organization
from lcfs.db.models.OrganizationAddress import OrganizationAddress
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.organization.session import OrganizationRepository
from lcfs.web.api.organization.schema import (
    OrganizationSchema,
    OrganizationCreateSchema,
    OrganizationStatusBase,
    OrganizationTypeBase,
    OrganizationUpdateSchema,
    OrganizationUserSchema,
    GetOrganizationResponse,
    Organizations,
)
from lcfs.web.core.decorators import roles_required

logger = getLogger("organization")
router = APIRouter()
get_async_db = dependencies.get_async_db_session
# Initialize the cache with Redis backend
FastAPICache.init(RedisBackend(dependencies.pool), prefix="fastapi-cache")


@router.post("", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government", "Administrator")
async def create_organization(
    request: Request,
    organization_data: OrganizationCreateSchema,
    db: AsyncSession = Depends(get_async_db),
):
    """
    Endpoint to create a new organization. This includes processing the provided
    organization details along with associated addresses.
    """
    async with db.begin():
        try:
            # Create and add address models to the database
            org_address = OrganizationAddress(**organization_data.address.dict())
            org_attorney_address = OrganizationAttorneyAddress(
                **organization_data.attorney_address.dict()
            )

            db.add_all([org_address, org_attorney_address])
            await db.flush()

            # Create and add organization model to the database
            org_model = Organization(
                name=organization_data.name,
                email=organization_data.email,
                phone=organization_data.phone,
                edrms_record=organization_data.edrms_record,
                organization_status_id=organization_data.organization_status_id,
                organization_type_id=organization_data.organization_type_id,
                organization_address_id=org_address.organization_address_id,
                organization_attorney_address_id=org_attorney_address.organization_attorney_address_id,
            )
            db.add(org_model)
            await db.flush()

            return OrganizationSchema.from_orm(org_model)
        except Exception as e:
            logger.error("Internal Server Error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal Server Error",
            ) from e


@router.get(
    "/{organization_id}",
    response_model=GetOrganizationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        org = await db.scalar(
            select(Organization)
            .options(
                selectinload(Organization.org_status),
                selectinload(Organization.org_address),
                selectinload(Organization.org_attorney_address),
            )
            .where(Organization.organization_id == organization_id)
        )

        if org is None:
            raise HTTPException(status_code=404, detail="org not found")

        return org

    except Exception as e:
        logger.error("Internal Server Error: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.put("/{organization_id}", response_model=OrganizationSchema)
async def update_organization(
    organization_id: int,
    organization_data: OrganizationUpdateSchema,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        async with db.begin():
            organization = (
                await db.execute(Organization)
                .filter(Organization.organization_id == organization_id)
                .first()
            )

        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
            )

        # Update the organization fields with new data
        for key, value in organization_data.dict().items():
            setattr(organization, key, value)

        await db.commit()
        await db.refresh(organization)

        return organization
    except Exception as e:
        logger.error("Internal Server Error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        )


@router.post("/list", response_model=Organizations, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def list_organizations(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    repo: OrganizationRepository = Depends(),
    response: Response = None,
):
    try:
        organizations, total_count = await repo.get_organizations(pagination)
        if not organizations:
            logger.error("Error getting organizations")
            response.status_code = status.HTTP_404_NOT_FOUND
            return Organizations(
                organizations=[],
                pagination=PaginationResponseSchema(
                    total=0, page=0, size=0, total_pages=0
                ),
            )
        return Organizations(
            organizations=organizations,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )
    except Exception as e:
        logger.error(f"Error getting organizations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Technical Error: Failed to get organizations",
        )


@router.get(
    "/statuses/list",
    response_model=List[OrganizationStatusBase],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_organization_statuses(
    repo: OrganizationRepository = Depends(),
) -> List[OrganizationStatusBase]:
    try:
        statuses = await repo.get_statuses()
        if len(statuses) == 0:
            raise HTTPException(
                status_code=404, detail="No organization statuses found"
            )
        return statuses

    except Exception as e:
        logger.error(f"Error getting organization statuses: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get(
    "/types/list",
    response_model=List[OrganizationTypeBase],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_organization_types(
    repo: OrganizationRepository = Depends(),
) -> List[OrganizationTypeBase]:
    try:
        types = await repo.get_types()
        if len(types) == 0:
            raise HTTPException(status_code=404, detail="No organization types found")
        return types

    except Exception as e:
        logger.error(f"Error getting organization types: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error")


@router.get("/{organization_id}/users/", response_model=List[OrganizationUserSchema])
async def get_users_for_organization(
    organization_id: int, db: AsyncSession = Depends(get_async_db)
):
    try:
        async with db.begin():
            users = (
                await db.execute(UserProfile)
                .filter(UserProfile.organization_id == organization_id)
                .all()
            )

        if not users:
            raise HTTPException(
                status_code=404, detail="No users found for the organization"
            )

        return users
    except Exception as e:
        logger.error(f"Error getting users for organization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error")
