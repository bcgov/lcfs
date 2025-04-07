from typing import List
from lcfs.db.models.compliance import CompliancePeriod
from lcfs.db.models.fuel import (
    DefaultCarbonIntensity,
    FuelCategory,
    FuelInstance,
    FuelType,
)
from lcfs.web.api.public.schema import FuelTypeSchema
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from fastapi import Depends
import structlog

logger = structlog.get_logger(__name__)


class PublicRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
    ):
        self.db = db

    @repo_handler
    async def get_compliance_periods(self) -> List[CompliancePeriod]:
        """
        Get all compliance periods
        """
        compliance_periods = (
            (
                await self.db.execute(
                    select(CompliancePeriod)
                    .join(
                        DefaultCarbonIntensity,
                        CompliancePeriod.compliance_period_id
                        == DefaultCarbonIntensity.compliance_period_id,
                    )
                    .distinct()
                    .order_by(desc(CompliancePeriod.description))
                )
            )
            .scalars()
            .all()
        )
        return compliance_periods

    @repo_handler
    async def get_fuel_types(
        self,
        lcfs_only: bool = False,
        fuel_category: str = None,
        is_legacy: bool = False,
    ):
        """
        Get all fuel types
        """
        query = select(
            FuelType.fuel_type_id,
            FuelType.fuel_type,
            FuelType.fossil_derived,
            FuelType.renewable,
            FuelType.unrecognized,
            FuelType.units,
        ).where(FuelType.is_legacy == is_legacy)

        if lcfs_only:
            query = query.where(and_(FuelType.renewable == False))

        if fuel_category:
            query = (
                query.join(FuelInstance)
                .join(FuelCategory)
                .where(FuelCategory.category == fuel_category)
            )
        print("Generated SQL Query:")
        from sqlalchemy.dialects import postgresql

        print(
            query.compile(
                dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
            )
        )
        result = (await self.db.execute(query)).all()
        return [FuelTypeSchema.model_validate(ft) for ft in result]
