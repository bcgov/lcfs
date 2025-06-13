from typing import List
from fastapi import Depends
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelTypeOptionsSchema,
)
from lcfs.web.api.calculator.schema import CreditsResultSchema
from lcfs.web.utils.calculations import (
    calculate_compliance_units,
    calculate_legacy_compliance_units,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.api.calculator.repo import CalculatorRepository
from lcfs.web.core.decorators import service_handler


class CalculatorService:
    def __init__(
        self,
        repo: CalculatorRepository = Depends(),
        fs_service: FuelSupplyServices = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
    ):
        self.repo = repo
        self.fs_service = fs_service
        self.fuel_repo = fuel_repo

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

    @service_handler
    async def get_fuel_type_options(
        self,
        compliance_period: str,
        fuel_type_id: int,
        fuel_category_id: int,
        lcfs_only: bool = False,
    ):
        """Fetches all fuel type options for a given compliance period, fuel type, and fuel category."""

        try:
            compliance_year = int(compliance_period)
        except ValueError as e:
            raise ValueError(
                f"Invalid compliance_period: '{compliance_period}' must be an integer"
            ) from e

        # Determine if legacy records should be included
        include_legacy = compliance_year < 2024

        options = await self.repo.get_fuel_type_options(
            compliance_period,
            fuel_type_id,
            fuel_category_id,
            lcfs_only=lcfs_only,
            include_legacy=include_legacy,
        )

        fuel_types = []
        for row in options["fuel_types"]:
            self.fs_service.fuel_type_row_mapper(compliance_period, fuel_types, row)

        if not fuel_types:
            return {}
        return FuelTypeOptionsSchema.model_validate(fuel_types[0])

    @service_handler
    async def get_calculated_data(
        self,
        compliance_period: str,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        fuel_code_id: int,
        quantity: int,
    ):
        # Fetch standardized fuel data
        fuel_data = await self.fuel_repo.get_standardized_fuel_data(
            fuel_type_id=fuel_type_id,
            fuel_category_id=fuel_category_id,
            end_use_id=end_use_id,
            compliance_period=compliance_period,
            fuel_code_id=fuel_code_id,
        )
        if int(compliance_period) < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR):
            compliance_units = calculate_legacy_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=fuel_data.effective_carbon_intensity or 0,
                Q=quantity,
                ED=fuel_data.energy_density or 0,
            )
        else:
            compliance_units = calculate_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=fuel_data.effective_carbon_intensity or 0,
                UCI=fuel_data.uci or 0,
                Q=quantity,
                ED=fuel_data.energy_density or 0,
            )

        # Return Credits result
        return CreditsResultSchema(
            rci=round(fuel_data.effective_carbon_intensity, 2),
            tci=round(fuel_data.target_ci, 2),
            eer=round(fuel_data.eer, 2),
            energy_density=round(fuel_data.energy_density or 0, 2),
            uci=fuel_data.uci,
            quantity=quantity,
            energy_content=(quantity * (fuel_data.energy_density or 0)),
            compliance_units=round(compliance_units),
        )
