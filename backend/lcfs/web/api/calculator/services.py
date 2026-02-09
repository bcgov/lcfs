from typing import List
from fastapi import Depends
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelTypeOptionsSchema,
)
from lcfs.web.api.calculator.schema import (
    CreditsResultSchema,
    LookupTableResponseSchema,
    LookupTableRowSchema,
)
from lcfs.web.utils.calculations import (
    calculate_compliance_units,
    calculate_legacy_compliance_units,
    calculate_legacy_quantity_from_compliance_units,
    calculate_quantity_from_compliance_units,
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
        quantity: float,
        use_custom_ci: bool = False,
        custom_ci_value: float | None = None,
    ):
        # Fetch standardized fuel data
        fuel_data = await self.fuel_repo.get_standardized_fuel_data(
            fuel_type_id=fuel_type_id,
            fuel_category_id=fuel_category_id,
            end_use_id=end_use_id,
            compliance_period=compliance_period,
            fuel_code_id=fuel_code_id,
        )
        energy_density_value = float(fuel_data.energy_density or 0)
        recorded_ci = (
            float(custom_ci_value)
            if use_custom_ci and custom_ci_value is not None
            else float(fuel_data.effective_carbon_intensity or 0)
        )

        if int(compliance_period) < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR):
            compliance_units = calculate_legacy_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=recorded_ci,
                Q=quantity,
                ED=fuel_data.energy_density or 0,
            )
        else:
            compliance_units = calculate_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=recorded_ci,
                UCI=fuel_data.uci or 0,
                Q=quantity,
                ED=fuel_data.energy_density or 0,
            )

        # Return Credits result
        return CreditsResultSchema(
            rci=round(recorded_ci, 2),
            tci=round(fuel_data.target_ci, 5),
            eer=round(fuel_data.eer, 2),
            energy_density=round(energy_density_value, 2),
            uci=fuel_data.uci,
            quantity=quantity,
            energy_content=(float(quantity) * energy_density_value),
            compliance_units=round(compliance_units),
        )

    @service_handler
    async def get_quantity_from_compliance_units(
        self,
        compliance_period: str,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        fuel_code_id: int,
        compliance_units: float,
        use_custom_ci: bool = False,
        custom_ci_value: float | None = None,
    ):
        fuel_data = await self.fuel_repo.get_standardized_fuel_data(
            fuel_type_id=fuel_type_id,
            fuel_category_id=fuel_category_id,
            end_use_id=end_use_id,
            compliance_period=compliance_period,
            fuel_code_id=fuel_code_id,
        )
        energy_density_value = float(fuel_data.energy_density or 0)
        recorded_ci = (
            float(custom_ci_value)
            if use_custom_ci and custom_ci_value is not None
            else float(fuel_data.effective_carbon_intensity or 0)
        )

        if int(compliance_period) < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR):
            quantity = calculate_legacy_quantity_from_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=recorded_ci,
                compliance_units=compliance_units,
                ED=fuel_data.energy_density or 0,
            )
        else:
            quantity = calculate_quantity_from_compliance_units(
                TCI=fuel_data.target_ci or 0,
                EER=fuel_data.eer or 1,
                RCI=recorded_ci,
                UCI=fuel_data.uci or 0,
                compliance_units=compliance_units,
                ED=fuel_data.energy_density or 0,
            )

        return CreditsResultSchema(
            rci=round(recorded_ci, 2),
            tci=round(fuel_data.target_ci, 5),
            eer=round(fuel_data.eer, 2),
            energy_density=round(energy_density_value, 2),
            uci=fuel_data.uci,
            quantity=quantity,
            energy_content=(float(quantity) * energy_density_value),
            compliance_units=round(compliance_units),
        )

    @service_handler
    async def get_lookup_table_data(
        self, compliance_year: int
    ) -> LookupTableResponseSchema:
        """
        Get lookup table data for display showing all fuel type combinations
        with their associated carbon intensity and other calculation parameters.
        """
        result = await self.repo.get_lookup_table_data(compliance_year)
        data = result["data"]
        uci_map = result["uci_map"]

        rows = []
        seen_combinations = set()

        for row in data:
            # Skip rows where determining CI is "Fuel code"
            # Only show Default CI and Prescribed CI rows
            if row.provision_of_the_act == "Fuel code":
                continue

            # Create a unique key for each combination
            key = (
                row.fuel_category,
                row.fuel_type,
                row.end_use_type,
                row.provision_of_the_act,
            )

            # Skip if we've already processed this combination
            if key in seen_combinations:
                continue
            seen_combinations.add(key)

            # Determine CI value based on provision
            ci_of_fuel = None
            if row.default_carbon_intensity is not None:
                ci_of_fuel = row.default_carbon_intensity
            elif row.category_carbon_intensity is not None:
                ci_of_fuel = row.category_carbon_intensity

            # Get UCI from the map if available
            uci = None
            if row.end_use_type_id is not None:
                uci = uci_map.get((row.fuel_type_id, row.end_use_type_id))

            rows.append(
                LookupTableRowSchema(
                    fuel_category=row.fuel_category,
                    fuel_type=row.fuel_type,
                    end_use=row.end_use_type,
                    determining_carbon_intensity=row.provision_of_the_act or "N/A",
                    target_ci=round(row.target_carbon_intensity, 2)
                    if row.target_carbon_intensity
                    else None,
                    ci_of_fuel=round(ci_of_fuel, 2) if ci_of_fuel else None,
                    uci=round(uci, 2) if uci else None,
                    energy_density=round(row.energy_density, 2)
                    if row.energy_density
                    else None,
                    energy_density_unit=row.energy_density_unit,
                    eer=round(row.eer, 2) if row.eer else None,
                )
            )

        return LookupTableResponseSchema(compliance_year=compliance_year, data=rows)
