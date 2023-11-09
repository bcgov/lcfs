from logging import getLogger
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from lcfs.db.models import User
from lcfs.db import dependencies
from lcfs.web.api.organization.schema import Organization, OrganizationCreate, OrganizationUpdate, OrganizationUser


logger = getLogger("organization")
router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.post("/createorganization/", response_model=OrganizationCreate, status_code=status.HTTP_201_CREATED)
async def create_organization(organization: OrganizationCreate, db: AsyncSession = Depends(get_async_db)):
    try:
        db.add(organization)
        await db.commit()
        await db.refresh(organization)
        
        return organization
    except Exception as e:
        logger.error(f"Internal Server Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal Server Error")

@router.put("/organizations/{organization_id}", response_model=Organization)
async def update_organization(organization_id: int, organization_data: OrganizationUpdate, db: AsyncSession = Depends(get_async_db)):
    try:
        async with db.begin():
            organization = await db.execute(Organization).filter(Organization.id == organization_id).first()

        if not organization:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

        # Update the organization fields with new data
        for key, value in organization_data.dict().items():
            setattr(organization, key, value)

        await db.commit()
        await db.refresh(organization)

        return organization
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal Server Error: {str(e)}")

@router.get("/organizations/", response_model=list[Organization])
async def list_organizations(db: AsyncSession = Depends(get_async_db), response: Response = None):
    try:
        async with db.begin():
            organizations = await db.execute(Organization).all()
        if not organizations:
            logger.error("Error getting organizations")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No organizations found")
            
        return organizations
    except Exception as e:
        logger.error(f"Internal Server Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal Server Error")


@router.get("/organizations/{organization_id}/users/", response_model=List[OrganizationUser])
async def get_users_for_organization(organization_id: int, db: AsyncSession = Depends(get_async_db)):
    try:
        async with db.begin():
            users = await db.execute(User).filter(User.organization_id == organization_id).all()
        
        if not users:
            raise HTTPException(status_code=404, detail="No users found for the organization")
        
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
