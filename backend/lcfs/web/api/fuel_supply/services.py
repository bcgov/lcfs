from logging import getLogger
import math
from fastapi import Depends, Request


from lcfs.db.models.compliance.FuelSupply import FuelSupply, QuantityUnitsEnum
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.fuel_supply.schema import (
    EndUseTypeSchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
    FuelCategorySchema,
    FuelCodeSchema,
    FuelSuppliesSchema,
    FuelSupplySchema,
    FuelTypeOptionsResponse,
    FuelTypeOptionsSchema,
    ProvisionOfTheActSchema,
    TargetCarbonIntensitySchema,
    UnitOfMeasureSchema,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.core.decorators import service_handler

logger = getLogger(__name__)


class FuelSupplyServices:
    def __init__(
        self, request: Request = None, repo: FuelSupplyRepository = Depends()
    ) -> None:
        self.request = request
        self.repo = repo

    def fuel_type_row_mapper(self, compliance_period, fuel_types, row):
        column_names = row._fields
        row_data = dict(zip(column_names, row))
        fuel_category = FuelCategorySchema(
                fuel_category_id=row_data["fuel_category_id"],
                fuel_category=row_data["category"],
                default_and_prescribed_ci=round(row_data["default_carbon_intensity"], 2),
            )
        provision = ProvisionOfTheActSchema(
                provision_of_the_act_id=row_data["provision_of_the_act_id"],
                name=row_data["provision_of_the_act"],
            )
        end_use_type = EndUseTypeSchema(
                end_use_type_id=row_data["end_use_type_id"],
                type=row_data["end_use_type"],
                sub_type=row_data["end_use_sub_type"],
            ) if row_data["end_use_type_id"] else None
        eer = EnergyEffectivenessRatioSchema(
                eer_id=row_data["eer_id"],
                energy_effectiveness_ratio=round(row_data["energy_effectiveness_ratio"], 2),
                fuel_category=fuel_category,
                end_use_type=end_use_type
            )
        tci = TargetCarbonIntensitySchema(
                target_carbon_intensity_id=row_data["target_carbon_intensity_id"],
                target_carbon_intensity=round(row_data["target_carbon_intensity"], 2),
                reduction_target_percentage=round(row_data["reduction_target_percentage"], 2),
                fuel_category=fuel_category,
                compliance_period=compliance_period
            )
        fuel_code = FuelCodeSchema(
                fuel_code_id=row_data["fuel_code_id"],
                fuel_code=row_data["fuel_code"],
                fuel_code_prefix_id=row_data["fuel_code_prefix_id"],
                fuel_code_carbon_intensity=round(row_data["fuel_code_carbon_intensity"], 2)
            ) if row_data["fuel_code_id"] else None
        # Find the existing fuel type if it exists
        existing_fuel_type = next(
                (ft for ft in fuel_types if ft.fuel_type == row_data["fuel_type"]), None
            )

        if existing_fuel_type:
            # Append to the existing fuel type's
            existing_fuel_type.fuel_categories.append(fuel_category) if not next(
                (fc for fc in existing_fuel_type.fuel_categories if fc.fuel_category == row_data["category"]), None
            ) else None
            # Only add provision if it's "Fuel code - section 19 (b) (i)" and fuel_code exists
            if (row_data["provision_of_the_act"] == "Fuel code - section 19 (b) (i)" and fuel_code) or row_data["provision_of_the_act"] != "Fuel code - section 19 (b) (i)":
                existing_fuel_type.provisions.append(provision) if not next(
                    (p for p in existing_fuel_type.provisions if p.name == row_data["provision_of_the_act"]), None
                ) else None

            existing_fuel_type.eer_ratios.append(eer) if not next(
                (e for e in existing_fuel_type.eer_ratios if e.end_use_type == row_data["end_use_type"] and e.fuel_category == fuel_category), None
            ) else None
            existing_fuel_type.target_carbon_intensities.append(tci) if not next(
                (t for t in existing_fuel_type.target_carbon_intensities if t.fuel_category == fuel_category and t.compliance_period == compliance_period), None
            ) else None
            existing_fuel_type.fuel_codes.append(fuel_code) if fuel_code and not next(
                (fc for fc in existing_fuel_type.fuel_codes if fc.fuel_code == row_data["fuel_code"]), None
            ) else None
        else:
            if row_data["energy_density_id"]:
                unit = UnitOfMeasureSchema(
                        uom_id=row_data["uom_id"],
                        name=row_data["name"],
                    )
                energy_density = EnergyDensitySchema(
                        energy_density_id=row_data["energy_density_id"],
                        energy_density=round(row_data["energy_density"], 2),
                        unit=unit,
                    )
            # Only include provision if it's "Fuel code - section 19 (b) (i)" and fuel_code exists
            provisions = [provision] if (row_data["provision_of_the_act"] == "Fuel code - section 19 (b) (i)" and fuel_code) or (row_data["provision_of_the_act"] != "Fuel code - section 19 (b) (i)") else []
            # Create a new fuel type and append
            fuel_type = FuelTypeOptionsSchema(
                    fuel_type_id=row_data["fuel_type_id"],
                    fuel_type=row_data["fuel_type"],
                    fossil_derived=row_data["fossil_derived"],
                    default_carbon_intensity=round(row_data["default_carbon_intensity"], 2),
                    unit=row_data["unit"].value,
                    energy_density=energy_density if row_data["energy_density_id"] else None,
                    fuel_categories=[fuel_category],
                    provisions=provisions,
                    eer_ratios=[eer],
                    target_carbon_intensities=[tci],
                    fuel_codes=[fuel_code] if fuel_code else [],
                )
            fuel_types.append(fuel_type)

    @service_handler
    async def get_fuel_supply_options(self, compliance_period: str) -> FuelTypeOptionsResponse:
        """Get fuel supply table options"""
        logger.info("Getting fuel supply table options")
        fs_options = await self.repo.get_fuel_supply_table_options(compliance_period)
        fuel_types = []
        for row in fs_options:
            self.fuel_type_row_mapper(compliance_period, fuel_types, row)
        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_supply_list(self, compliance_report_id: int) -> FuelSuppliesSchema:
        """Get fuel supply list for a compliance report"""
        logger.info("Getting fuel supply list for compliance report %s", compliance_report_id)
        fuel_supply_models = await self.repo.get_fuel_supply_list(compliance_report_id)
        fs_list = [FuelSupplySchema.model_validate(fs) for fs in fuel_supply_models]
        return FuelSuppliesSchema(fuel_supplies=fs_list if fs_list else [])

    @service_handler
    async def get_fuel_supplies_paginated(self, pagination: PaginationRequestSchema, compliance_report_id: int):
        """Get paginated fuel supply list for a compliance report"""
        logger.info("Getting paginated fuel supply list for compliance report %s", compliance_report_id)
        fuel_supplies, total_count = await self.repo.get_fuel_supplies_paginated(pagination, compliance_report_id)
        return FuelSuppliesSchema(
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total_count,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            fuel_supplies=[FuelSupplySchema.model_validate(fs) for fs in fuel_supplies],
        )

    @service_handler
    async def update_fuel_supply(self, fs_data: FuelSupplySchema) -> FuelSupplySchema:
        """Update an existing fuel supply record"""

        existing_fs = await self.repo.get_fuel_supply_by_id(fs_data.fuel_supply_id)
        if not existing_fs:
            raise ValueError("fuel supply record not found")

        for key, value in fs_data.dict().items():
            if key != "fuel_supply_id" and value is not None:
                setattr(existing_fs, key, value)

        updated_transfer = await self.repo.update_fuel_supply(existing_fs)
        return FuelSupplySchema.model_validate(updated_transfer)

    @service_handler
    async def create_fuel_supply(self, fs_data: FuelSupplySchema) -> FuelSupplySchema:
        """Create a new fuel supply record"""
        fuel_supply = FuelSupply(
            **fs_data.model_dump(
                exclude={
                    "id",
                    "fuel_type",
                    "fuel_category",
                    "provision_of_the_act",
                    "end_use",
                    "fuel_code",
                    "units",
                    "deleted",
                }
            )
        )
        fuel_supply.units = QuantityUnitsEnum(fs_data.units)
        created_equipment = await self.repo.create_fuel_supply(fuel_supply)
        return FuelSupplySchema.model_validate(created_equipment)

    @service_handler
    async def delete_fuel_supply(self, fuel_supply_id: int) -> str:
        """Delete a fuel supply record"""
        return await self.repo.delete_fuel_supply(fuel_supply_id)
