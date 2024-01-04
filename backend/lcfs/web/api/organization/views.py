from logging import getLogger
import math
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette import status
from sqlalchemy.orm import selectinload
from starlette.responses import Response

from lcfs.db import dependencies
from lcfs.db.models import UserProfile
from lcfs.db.models.Organization import Organization
from lcfs.db.models.OrganizationAddress import OrganizationAddress
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseScehema
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


async def startup():
    global organization_repo
    async for db in get_async_db():
        organization_repo = OrganizationRepository(db)
        break


logger = getLogger("organization")
router = APIRouter(on_startup=[startup])
get_async_db = dependencies.get_async_db_session


@router.post(
    "/", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED
)
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
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(e)}",
        )


@router.post("/list", response_model=Organizations, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def list_organizations(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
):
    try:
        organizations, total_count = await organization_repo.get_organizations(
            pagination
        )
        if not organizations:
            logger.error("Error getting organizations")
            response.status_code = status.HTTP_404_NOT_FOUND
            return Organizations(
                organizations=[],
                pagination=PaginationResponseScehema(
                    total=0, page=0, size=0, total_pages=0
                ),
            )
        return Organizations(
            organizations=organizations,
            pagination=PaginationResponseScehema(
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
            detail=f"Technical Error: Failed to get organizations: {str(e)}",
        )


@router.get(
    "/statuses/list",
    response_model=List[OrganizationStatusBase],
    status_code=status.HTTP_200_OK,
)
async def get_organization_statuses() -> List[OrganizationStatusBase]:
    try:
        statuses = await organization_repo.get_statuses()
        if len(statuses) == 0:
            raise HTTPException(
                status_code=404, detail="No organization statuses found"
            )
        return statuses

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get(
    "/types/list",
    response_model=List[OrganizationTypeBase],
    status_code=status.HTTP_200_OK,
)
async def get_organization_types() -> List[OrganizationTypeBase]:
    try:
        types = await organization_repo.get_types()
        if len(types) == 0:
            raise HTTPException(
                status_code=404, detail="No organization types found"
            )
        return types

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
