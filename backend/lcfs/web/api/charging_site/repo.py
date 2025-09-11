from lcfs.db.models.compliance import ChargingSiteStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite
import structlog
from typing import List, Sequence
from fastapi import Depends
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from sqlalchemy import desc
from sqlalchemy.orm import joinedload, selectinload


logger = structlog.get_logger(__name__)


class ChargingSiteRepo:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve a list of intended user types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(EndUserType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_charging_site_status_by_name(
        self, status_name: str
    ) -> ChargingSiteStatus:
        """
        Retrieve a charging site status by its name from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSiteStatus).where(
                        ChargingSiteStatus.status == status_name
                    )
                )
            )
            .scalars()
            .first()
        )

    @repo_handler
    async def get_end_user_types_by_ids(self, ids: List[int]) -> List[EndUserType]:
        """Get EndUserType objects by their IDs"""
        result = await self.db.execute(
            select(EndUserType).where(EndUserType.end_user_type_id.in_(ids))
        )
        return result.scalars().all()

    @repo_handler
    async def create_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Create a new charging site in the database
        """
        self.db.add(charging_site)
        await self.db.flush()
        return charging_site

    @repo_handler
    async def get_all_charging_sites_by_organization_id(
        self, organization_id: int
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites from the database
        """
        query = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                selectinload(ChargingSite.intended_users),
            )
            .where(ChargingSite.organization_id == organization_id)
            .order_by(desc(ChargingSite.update_date))
        )
        results = await self.db.execute(query)

        return results.scalars().all()

    @repo_handler
    async def update_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Update an existing charging site in the database using merge
        """
        merged_site = await self.db.merge(charging_site)
        await self.db.commit()
        await self.db.refresh(merged_site)
        return merged_site

    @repo_handler
    async def get_charging_site_by_id(self, charging_site_id: int) -> ChargingSite:
        """
        Retrieve a charging site by its ID from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSite).where(
                        ChargingSite.charging_site_id == charging_site_id
                    )
                )
            )
            .scalars()
            .first()
        )

    @repo_handler
    async def delete_charging_site(self, charging_site_id: int) -> None:
        """
        Delete a charging site from the database by its ID
        """
        await self.db.execute(
            delete(ChargingSite).where(
                ChargingSite.charging_site_id == charging_site_id
            )
        )
