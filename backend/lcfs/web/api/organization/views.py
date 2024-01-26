import io
from logging import getLogger
import math
from typing import List
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette import status
from sqlalchemy.orm import selectinload, joinedload
from starlette.responses import Response
from fastapi_cache.decorator import cache

from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.db import dependencies
from lcfs.db.models import UserProfile
from lcfs.db.models.Organization import Organization
from lcfs.db.models.OrganizationAddress import OrganizationAddress
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.organization.session import OrganizationRepository
from lcfs.web.api.organization.schema import (
    MiniOrganization,
    OrganizationSchema,
    OrganizationSummarySchema,
    OrganizationCreateSchema,
    OrganizationStatusBase,
    OrganizationTypeBase,
    OrganizationUpdateSchema,
    OrganizationUserSchema,
    GetOrganizationResponse,
    Organizations,
)
from lcfs.web.core.decorators import roles_required
from lcfs.web.api.transaction.schema import Transactions
from lcfs.db.models.Transaction import Transaction
from lcfs.db.models.IssuanceHistory import IssuanceHistory
from lcfs.db.models.TransferHistory import TransferHistory
from sqlalchemy import func, select, distinct
from lcfs.web.api.organization.session import OrganizationRepository

logger = getLogger("organization")
router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def export_organizations(
    request: Request,
    repo: OrganizationRepository = Depends()
):
    """
    Endpoint to export information of all organizations

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'export_format' and 'media_type' variables.
    - 'export_format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'export_format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """

    try:
        return await repo.export_organizations()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from e


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
            org_address = OrganizationAddress(
                **organization_data.address.dict())
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


@router.post("/", response_model=Organizations, status_code=status.HTTP_200_OK)
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
    "/statuses/",
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
    "/types/",
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
            raise HTTPException(
                status_code=404, detail="No organization types found")
        return types

    except Exception as e:
        logger.error(f"Error getting organization types: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error")
    
@router.get(
    "/names/", response_model=List[MiniOrganization], status_code=status.HTTP_200_OK
)
@cache(expire=60 * 60)  # cache for 1 hour
async def get_organization_names(repo: OrganizationRepository = Depends()):
    try:
        names = await repo.get_names()
        if len(names) == 0:
            raise HTTPException(status_code=404, detail="No organization names found")
        # TODO: Implement for All Organizations and Balance calculation for it.
        names.append(
            MiniOrganization.model_validate(
                {
                    "organization_id": 0,
                    "name": "All Organizations",
                    "balance": 0,
                }
            )
        )
        return names

    except Exception as e:
        logger.error(f"Error getting organization names: {str(e)}")
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

@router.post("/{organization_id}/transactions/", response_model=Transactions)
async def get_transactions_for_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_async_db),
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    repo: OrganizationRepository = Depends()
):
    """
    Endpoint to retrieve transactions from a specific organization. This includes processing the provided
    transaction details.
    """
    try:
        transactions, total_count = await repo.get_transactions(organization_id, pagination)

        if not transactions:
            response.status_code = status.HTTP_404_NOT_FOUND
            return Transactions(
                pagination=PaginationResponseSchema(
                    total=0, page=0, size=0, total_pages=0
                ),
                transactions=transactions,
            )

        return Transactions(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            transactions=transactions,
        )

    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(
            status_code=500,
            detail=f"Technical Error: Failed to get transactions: {str(e)}"
        )

@router.get("/registered/external", response_model=List[OrganizationSummarySchema], status_code=status.HTTP_200_OK)
async def list_external_registered_organizations(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    repo: OrganizationRepository = Depends()
):
    try:
        user_org_id = request.user.organization_id

        organizations = await repo.get_external_registered_organizations(user_org_id)

        if not organizations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No external registered organizations found"
            )

        return organizations

    except Exception as e:
        logger.error("Error listing external registered organizations: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Technical Error: Failed to list external registered organizations"

        )
