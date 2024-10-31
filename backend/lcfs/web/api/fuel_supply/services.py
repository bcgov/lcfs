from logging import getLogger
import math
from fastapi import Depends, Request, HTTPException

from lcfs.db.models.compliance.FuelSupply import (
    FuelSupply,
    ChangeType,
    QuantityUnitsEnum,
)
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.schema import (
    EndUseTypeSchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
    FuelCategorySchema,
    FuelCodeSchema,
    FuelSuppliesSchema,
    FuelSupplyResponseSchema,
    FuelTypeOptionsResponse,
    FuelTypeOptionsSchema,
    ProvisionOfTheActSchema,
    TargetCarbonIntensitySchema,
    UnitOfMeasureSchema,
    FuelSupplyCreateUpdateSchema,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units
from lcfs.utils.constants import default_ci

logger = getLogger(__name__)


class FuelSupplyServices:
    def __init__(
        self,
        request: Request = None,
        repo: FuelSupplyRepository = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
    ) -> None:
        self.request = request
        self.repo = repo
        self.fuel_repo = fuel_repo

    def fuel_type_row_mapper(self, compliance_period, fuel_types, row):
        column_names = row._fields

        row_data = dict(zip(column_names, row))

        fuel_category = FuelCategorySchema(
            fuel_category_id=row_data["fuel_category_id"],
            fuel_category=row_data["category"],
            default_and_prescribed_ci=(
                round(row_data["default_carbon_intensity"], 2)
                if row_data["fuel_type"] != "Other"
                else default_ci.get(row_data["category"])
            ),
        )
        provision = ProvisionOfTheActSchema(
            provision_of_the_act_id=row_data["provision_of_the_act_id"],
            name=row_data["provision_of_the_act"],
        )
        end_use_type = (
            EndUseTypeSchema(
                end_use_type_id=row_data["end_use_type_id"],
                type=row_data["end_use_type"],
                sub_type=row_data["end_use_sub_type"],
            )
            if row_data["end_use_type_id"]
            else None
        )
        eer = EnergyEffectivenessRatioSchema(
            eer_id=row_data["eer_id"],
            energy_effectiveness_ratio=round(row_data["energy_effectiveness_ratio"], 2),
            fuel_category=fuel_category,
            end_use_type=end_use_type,
        )
        tci = TargetCarbonIntensitySchema(
            target_carbon_intensity_id=row_data["target_carbon_intensity_id"],
            target_carbon_intensity=round(row_data["target_carbon_intensity"], 2),
            reduction_target_percentage=round(
                row_data["reduction_target_percentage"], 2
            ),
            fuel_category=fuel_category,
            compliance_period=compliance_period,
        )
        fuel_code = (
            FuelCodeSchema(
                fuel_code_id=row_data["fuel_code_id"],
                fuel_code=row_data["prefix"] + row_data["fuel_suffix"],
                fuel_code_prefix_id=row_data["fuel_code_prefix_id"],
                fuel_code_carbon_intensity=round(
                    row_data["fuel_code_carbon_intensity"], 2
                ),
            )
            if row_data["fuel_code_id"]
            else None
        )
        # Find the existing fuel type if it exists
        existing_fuel_type = next(
            (ft for ft in fuel_types if ft.fuel_type == row_data["fuel_type"]), None
        )

        if existing_fuel_type:
            # Append to the existing fuel type's
            (
                existing_fuel_type.fuel_categories.append(fuel_category)
                if not next(
                    (
                        fc
                        for fc in existing_fuel_type.fuel_categories
                        if fc.fuel_category == row_data["category"]
                    ),
                    None,
                )
                else None
            )
            # Only add provision if it's "Fuel code - section 19 (b) (i)" and fuel_code exists
            if (
                row_data["provision_of_the_act"] == "Fuel code - section 19 (b) (i)"
                and fuel_code
            ) or row_data["provision_of_the_act"] != "Fuel code - section 19 (b) (i)":
                (
                    existing_fuel_type.provisions.append(provision)
                    if not next(
                        (
                            p
                            for p in existing_fuel_type.provisions
                            if p.name == row_data["provision_of_the_act"]
                        ),
                        None,
                    )
                    else None
                )

            (
                existing_fuel_type.eer_ratios.append(eer)
                if not next(
                    (
                        e
                        for e in existing_fuel_type.eer_ratios
                        if e.end_use_type == row_data["end_use_type"]
                        and e.fuel_category == fuel_category
                    ),
                    None,
                )
                else None
            )
            (
                existing_fuel_type.target_carbon_intensities.append(tci)
                if not next(
                    (
                        t
                        for t in existing_fuel_type.target_carbon_intensities
                        if t.fuel_category == fuel_category
                        and t.compliance_period == compliance_period
                    ),
                    None,
                )
                else None
            )
            (
                existing_fuel_type.fuel_codes.append(fuel_code)
                if fuel_code
                and not next(
                    (
                        fc
                        for fc in existing_fuel_type.fuel_codes
                        if fc.fuel_code
                        == (row_data["prefix"] + row_data["fuel_suffix"])
                    ),
                    None,
                )
                else None
            )
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
            provisions = (
                [provision]
                if (
                    row_data["provision_of_the_act"] == "Fuel code - section 19 (b) (i)"
                    and fuel_code
                )
                or (
                    row_data["provision_of_the_act"] != "Fuel code - section 19 (b) (i)"
                )
                else []
            )
            # Create a new fuel type and append
            fuel_type = FuelTypeOptionsSchema(
                fuel_type_id=row_data["fuel_type_id"],
                fuel_type=row_data["fuel_type"],
                fossil_derived=row_data["fossil_derived"],
                default_carbon_intensity=(
                    round(row_data["default_carbon_intensity"], 2)
                    if row_data["fuel_type"] != "Other"
                    else default_ci.get(row_data["category"])
                ),
                unit=row_data["unit"].value,
                energy_density=(
                    energy_density if row_data["energy_density_id"] else None
                ),
                fuel_categories=[fuel_category],
                provisions=provisions,
                eer_ratios=[eer],
                target_carbon_intensities=[tci],
                fuel_codes=[fuel_code] if fuel_code else [],
                unrecognized=row_data["unrecognized"],
            )
            fuel_types.append(fuel_type)

    @service_handler
    async def get_fuel_supply_options(
        self, compliance_period: str
    ) -> FuelTypeOptionsResponse:
        """Get fuel supply table options"""
        logger.info("Getting fuel supply table options")
        fs_options = await self.repo.get_fuel_supply_table_options(compliance_period)
        fuel_types = []
        for row in fs_options["fuel_types"]:
            self.fuel_type_row_mapper(compliance_period, fuel_types, row)

        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_supply_list(
        self, compliance_report_id: int
    ) -> FuelSuppliesSchema:
        """Get fuel supply list for a compliance report"""
        logger.info(
            "Getting fuel supply list for compliance report %s", compliance_report_id
        )
        fuel_supply_models = await self.repo.get_fuel_supply_list(compliance_report_id)
        fs_list = [
            FuelSupplyResponseSchema.model_validate(fs) for fs in fuel_supply_models
        ]
        return FuelSuppliesSchema(fuel_supplies=fs_list if fs_list else [])

    @service_handler
    async def get_fuel_supplies_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ):
        """Get paginated fuel supply list for a compliance report"""
        logger.info(
            "Getting paginated fuel supply list for compliance report %s",
            compliance_report_id,
        )
        fuel_supplies, total_count = await self.repo.get_fuel_supplies_paginated(
            pagination, compliance_report_id
        )
        return FuelSuppliesSchema(
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total_count,
                total_pages=(
                    math.ceil(total_count / pagination.size) if total_count > 0 else 0
                ),
            ),
            fuel_supplies=[
                FuelSupplyResponseSchema.model_validate(fs) for fs in fuel_supplies
            ],
        )

    @service_handler
    async def update_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema
    ) -> FuelSupplyResponseSchema:
        """Update an existing fuel supply record"""
        fuel_supply = await self.repo.get_fuel_supply_by_id(fs_data.fuel_supply_id)
        if not fuel_supply:
            raise HTTPException(status_code=404, detail="Fuel supply not found")

        # Update fields
        update_data = fs_data.model_dump(
            exclude={
                "id",
                "fuel_supply_id",
                "fuel_type",
                "fuel_category",
                "provision_of_the_act",
                "end_use",
                "fuel_code",
                "units",
                "compliance_units",
                "target_ci",
                "ci_of_fuel",
                "energy_density",
                "eer",
                "energy",
                "deleted",
            }
        )

        # Re-calculate Energy Fields
        did_change_fuel = fs_data.fuel_type_id != fuel_supply.fuel_type_id
        if did_change_fuel:
            new_fuel = await self.fuel_repo.get_fuel_type_by_id(fs_data.fuel_type_id)
            if new_fuel.unrecognized:
                fuel_supply.ci_of_fuel = None
                fuel_supply.energy_density = None
                fuel_supply.eer = None
                fuel_supply.energy = 0
            else:
                fuel_supply.ci_of_fuel = new_fuel.default_carbon_intensity

        for field, value in update_data.items():
            setattr(fuel_supply, field, value)
        fuel_supply.units = QuantityUnitsEnum(fs_data.units)

        if (
            fuel_supply.fuel_type_id
            and fuel_supply.fuel_category_id
            and fuel_supply.end_use_id
        ):
            energy_effectiveness = await self.fuel_repo.get_energy_effectiveness_ratio(
                fuel_supply.fuel_type_id,
                fuel_supply.fuel_category_id,
                fuel_supply.end_use_id,
            )
            fuel_supply.eer = energy_effectiveness.ratio

        # Copy CI if using a custom fuel code
        if fuel_supply.fuel_code_id:
            fuel_code = await self.fuel_repo.get_fuel_code(
                fuel_code_id=fuel_supply.fuel_type_id
            )
            fuel_supply.ci_of_fuel = fuel_code.carbon_intensity

        if fuel_supply.fuel_type.fuel_type == "Other":
            energy_density = fs_data.energy_density
        else:
            energy_density = (
                await self.fuel_repo.get_energy_density(fuel_supply.fuel_type_id)
            ).density

        fuel_supply.energy_density = energy_density

        # Recalculate energy
        if fuel_supply.energy_density:
            fuel_supply.energy = int(fuel_supply.energy_density * fuel_supply.quantity)

        # Recalculate compliance units
        compliance_units = self.calculate_compliance_units_for_supply(fuel_supply)
        fuel_supply.compliance_units = compliance_units

        # Save updates
        updated_supply = await self.repo.update_fuel_supply(fuel_supply)

        return FuelSupplyResponseSchema.model_validate(updated_supply)

    @service_handler
    async def create_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema
    ) -> FuelSupplyResponseSchema:
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
        created_supply = await self.repo.create_fuel_supply(fuel_supply)

        # Calculate compliance units
        compliance_units = self.calculate_compliance_units_for_supply(created_supply)
        created_supply.compliance_units = compliance_units

        # Update the fuel supply record with compliance units
        updated_supply = await self.repo.update_fuel_supply(created_supply)

        return FuelSupplyResponseSchema.model_validate(updated_supply)

    @service_handler
    async def delete_fuel_supply(self, fuel_supply_id: int) -> str:
        """Delete a fuel supply record"""
        return await self.repo.delete_fuel_supply(fuel_supply_id)

    # TODO Left here for example for version tracking work
    @service_handler
    async def create_supplemental_fuel_supply(
        self, supplemental_report_id: int, data: dict
    ):
        new_supply = FuelSupply(
            supplemental_report_id=supplemental_report_id,
            change_type=ChangeType.CREATE,
            **data,
        )
        return await self.repo.create_fuel_supply(new_supply)

    @service_handler
    async def update_supplemental_fuel_supply(
        self, supplemental_report_id: int, original_fuel_supply_id: int, data: dict
    ):
        updated_supply = FuelSupply(
            supplemental_report_id=supplemental_report_id,
            previous_fuel_supply_id=original_fuel_supply_id,
            change_type=ChangeType.UPDATE,
            **data,
        )
        return await self.repo.create_fuel_supply(updated_supply)

    @service_handler
    async def delete_supplemental_fuel_supply(
        self, supplemental_report_id: int, original_fuel_supply_id: int
    ):
        delete_record = FuelSupply(
            supplemental_report_id=supplemental_report_id,
            previous_fuel_supply_id=original_fuel_supply_id,
            change_type=ChangeType.DELETE,
            quantity=None,  # or any appropriate default value
        )
        return await self.repo.create_fuel_supply(delete_record)

    def calculate_compliance_units_for_supply(self, fuel_supply: FuelSupply) -> float:
        """
        Calculate the compliance units for a single fuel supply record.
        """
        TCI = fuel_supply.target_ci or 0  # Target Carbon Intensity
        EER = fuel_supply.eer or 0  # Energy Efficiency Ratio
        RCI = fuel_supply.ci_of_fuel or 0  # Recorded Carbon Intensity
        UCI = 0  # Additional carbon intensity attributable to use (assumed 0)
        Q = fuel_supply.quantity or 0  # Quantity of Fuel Supplied
        ED = fuel_supply.energy_density or 0  # Energy Density

        # Apply the compliance units formula
        compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
        return compliance_units

    @service_handler
    async def get_fuel_supply_changes(
        self, original_report_id: int, supplemental_report_id: int
    ):
        original_supplies = await self.get_effective_fuel_supplies(original_report_id)
        supplemental_supplies = await self.get_effective_fuel_supplies(
            supplemental_report_id, is_supplemental=True
        )

        changes = []

        # Check for updates and deletes
        for original_supply in original_supplies:
            supplemental_supply = next(
                (
                    s
                    for s in supplemental_supplies
                    if s.previous_fuel_supply_id == original_supply.fuel_supply_id
                ),
                None,
            )
            if not supplemental_supply:
                changes.append(
                    {
                        "type": ChangeType.DELETE,
                        "original": original_supply,
                        "updated": None,
                    }
                )
            elif original_supply != supplemental_supply:
                changes.append(
                    {
                        "type": ChangeType.UPDATE,
                        "original": original_supply,
                        "updated": supplemental_supply,
                    }
                )

        # Check for new records
        for supplemental_supply in supplemental_supplies:
            if supplemental_supply.change_type == ChangeType.CREATE:
                changes.append(
                    {
                        "type": ChangeType.CREATE,
                        "original": None,
                        "updated": supplemental_supply,
                    }
                )

        return changes
