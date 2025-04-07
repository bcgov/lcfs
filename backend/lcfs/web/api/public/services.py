from typing import List
from fastapi import Depends
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.public.repo import PublicRepository
from lcfs.web.core.decorators import service_handler


class PublicService:
    def __init__(self, repo: PublicRepository = Depends()):
        self.repo = repo

    @service_handler
    async def get_compliance_periods(self) -> List[CompliancePeriodBaseSchema]:
        """Fetches all compliance periods and converts them to Pydantic models."""
        periods = await self.repo.get_compliance_periods()
        return [CompliancePeriodBaseSchema.model_validate(period) for period in periods]

    @service_handler
    async def get_fuel_types(
        self, compliance_period: str, lcfs_only: bool, fuel_category: str
    ):
        """Fetches all fuel types for a given compliance period and fuel category."""

        try:
            compliance_year = int(compliance_period)
        except ValueError as e:
            raise ValueError(
                f"Invalid compliance_period: '{compliance_period}' must be an integer"
            ) from e

        # Determine if legacy records should be included
        is_legacy = compliance_year < 2024

        return await self.repo.get_fuel_types(
            lcfs_only, fuel_category, is_legacy=is_legacy
        )
