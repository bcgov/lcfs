import structlog
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, union_all

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import FuelSupply, FuelExport, AllocationAgreement
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger("fuel_type_repo")


class FuelTypeRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fuel_type_others(self) -> List[str]:
        """
        Retrieve the list of fuel supplied information for a given compliance report.
        """
        fuel_supply_query = select(FuelSupply.fuel_type_other).where(
            FuelSupply.fuel_type_other.isnot(None)
        )
        fuel_export_query = select(FuelExport.fuel_type_other).where(
            FuelExport.fuel_type_other.isnot(None)
        )
        allocation_agreement_query = select(AllocationAgreement.fuel_type_other).where(
            AllocationAgreement.fuel_type_other.isnot(None)
        )

        # Use union_all to combine the queries
        combined_query = union_all(
            fuel_supply_query, fuel_export_query, allocation_agreement_query
        )

        # Now, you can execute the combined_query to get all results in a single list
        result = (await self.db.execute(combined_query)).unique().scalars().all()

        return result
