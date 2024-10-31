from logging import getLogger
import math
from fastapi import Depends, Request
from fastapi_cache.decorator import cache

from lcfs.db.models.compliance.FuelExport import (
    FuelExport,
    ChangeType,
    QuantityUnitsEnum,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    lcfs_cache_key_builder,
)
from lcfs.web.api.fuel_export.schema import (
    EndUseTypeSchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
    FuelCategorySchema,
    FuelCodeSchema,
    FuelExportsSchema,
    FuelExportSchema,
    FuelTypeOptionsResponse,
    FuelTypeOptionsSchema,
    ProvisionOfTheActSchema,
    TargetCarbonIntensitySchema,
    UnitOfMeasureSchema,
)
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_export.validation import FuelExportValidation
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)


class FuelExportServices:
    def __init__(
        self,
        request: Request = None,
        repo: FuelExportRepository = Depends(),
        validate: FuelExportValidation = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.request = request
        self.repo = repo
        self.compliance_report_repo = compliance_report_repo

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
                fuel_code=row_data["fuel_code"],
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
                        if fc.fuel_code == row_data["fuel_code"]
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
                default_carbon_intensity=round(row_data["default_carbon_intensity"], 2),
                unit=row_data["unit"].value,
                energy_density=(
                    energy_density if row_data["energy_density_id"] else None
                ),
                fuel_categories=[fuel_category],
                provisions=provisions,
                eer_ratios=[eer],
                target_carbon_intensities=[tci],
                fuel_codes=[fuel_code] if fuel_code else [],
            )
            fuel_types.append(fuel_type)

    @service_handler
    # @cache(
    #     expire=3600 * 24,
    #     key_builder=lcfs_cache_key_builder,
    #     namespace="users",
    # )  # Cache for 24 hours, already handled to clear cache if any new users are added or existing users are updated.
    async def get_fuel_export_options(
        self, compliance_period: str
    ) -> FuelTypeOptionsResponse:
        """Get fuel supply table options"""
        logger.info("Getting fuel supply table options")
        fs_options = await self.repo.get_fuel_export_table_options(compliance_period)
        fuel_types = []
        for row in fs_options:
            self.fuel_type_row_mapper(compliance_period, fuel_types, row)
        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_export_list(
        self, compliance_report_id: int
    ) -> FuelExportsSchema:
        """Get fuel supply list for a compliance report"""
        logger.info(
            "Getting fuel supply list for compliance report %s", compliance_report_id
        )
        fuel_export_models = await self.repo.get_fuel_export_list(compliance_report_id)
        fs_list = [FuelExportSchema.model_validate(fs) for fs in fuel_export_models]
        return FuelExportsSchema(fuel_exports=fs_list if fs_list else [])

    @service_handler
    async def get_fuel_exports_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ):
        """Get paginated fuel supply list for a compliance report"""
        logger.info(
            "Getting paginated fuel supply list for compliance report %s",
            compliance_report_id,
        )
        fuel_exports, total_count = await self.repo.get_fuel_exports_paginated(
            pagination, compliance_report_id
        )
        return FuelExportsSchema(
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total_count,
                total_pages=(
                    math.ceil(total_count / pagination.size) if total_count > 0 else 0
                ),
            ),
            fuel_exports=[FuelExportSchema.model_validate(fs) for fs in fuel_exports],
        )

    async def validate_and_calculate_compliance_units(
        self, fs_data: FuelExportSchema
    ) -> FuelExportSchema:
        """Validate and update the compliance units"""

        # Fetch fuel export options based on the compliance period
        fuel_export_options = await self.get_fuel_export_options(
            fs_data.compliance_period
        )

        # Extract the relevant fuel type data
        fuel_type_data = next(
            (
                obj
                for obj in fuel_export_options["fuelTypes"]
                if fs_data.fuel_type == obj["fuelType"]
            ),
            None,
        )

        if not fuel_type_data:
            # Handle the case where the fuel type is not found
            raise ValueError(
                f"Fuel type {fs_data.fuel_type} not found in export options."
            )

        # Get energy density
        energy_density = fuel_type_data.get("energyDensity", {}).get("energyDensity", 0)

        # Get target carbon intensity (TCI)
        target_ci = next(
            (
                item["targetCarbonIntensity"]
                for item in fuel_type_data.get("targetCarbonIntensities", [])
                if item["fuelCategory"]["fuelCategory"] == fs_data.fuel_category
            ),
            0,
        )

        # Determine the recorded carbon intensity (RCI)
        if "Fuel code" in fs_data.provision_of_the_act:
            # Use fuel code carbon intensity
            effective_carbon_intensity = next(
                (
                    item["fuelCodeCarbonIntensity"]
                    for item in fuel_type_data.get("fuelCodes", [])
                    if item["fuelCode"] == fs_data.fuel_code
                ),
                0,
            )
        else:
            # Use default carbon intensity
            effective_carbon_intensity = fuel_type_data.get("defaultCarbonIntensity", 0)

        # Get Energy Effectiveness Ratio (EER)
        eer = next(
            (
                item["energyEffectivenessRatio"]
                for item in fuel_type_data.get("eerRatios", [])
                if item["fuelCategory"]["fuelCategory"] == fs_data.fuel_category
                and (
                    item.get("endUseType") is None
                    or item["endUseType"]["type"] == fs_data.end_use
                )
            ),
            0,
        )

        # Ensure all values are floats and handle None values
        target_ci = float(target_ci or 0)
        eer = float(eer or 0)
        effective_carbon_intensity = float(effective_carbon_intensity or 0)
        energy_density = float(energy_density or 0)
        quantity = float(fs_data.quantity or 0)
        uci = 0  # Assuming Additional Carbon Intensity Attributable to Use is zero

        # Calculate compliance units using the shared utility function
        compliance_units = calculate_compliance_units(
            TCI=target_ci,
            EER=eer,
            RCI=effective_carbon_intensity,
            UCI=uci,
            Q=quantity,
            ED=energy_density,
        )

        # Adjust compliance units to negative to act as exporting fuel
        compliance_units = -compliance_units

        # Ensure compliance units are rounded and remain negative
        compliance_units = round(compliance_units) if compliance_units < 0 else 0

        # Calculate energy content
        energy_content = round(energy_density * quantity)

        # Update the fs_data object with calculated values
        fs_data.target_ci = target_ci
        fs_data.ci_of_fuel = effective_carbon_intensity
        fs_data.energy_density = energy_density
        fs_data.energy = energy_content
        fs_data.eer = eer
        fs_data.compliance_units = compliance_units

        return fs_data

    @service_handler
    async def update_fuel_export(self, fs_data: FuelExportSchema) -> FuelExportSchema:
        """Update an existing fuel supply record"""
        fs_data = await self.validate_and_calculate_compliance_units(fs_data)
        existing_fs = await self.repo.get_fuel_export_by_id(fs_data.fuel_export_id)
        if not existing_fs:
            raise ValueError("fuel supply record not found")

        for key, value in fs_data.model_dump().items():
            if (
                key
                not in [
                    "fuel_export_id" "id",
                    "compliance_period",
                    "fuel_type",
                    "fuel_category",
                    "provision_of_the_act",
                    "end_use",
                    "fuel_code",
                    "units",
                    "deleted",
                ]
                and value is not None
            ):
                if key == "units":
                    value = QuantityUnitsEnum(value)
                setattr(existing_fs, key, value)

        updated_transfer = await self.repo.update_fuel_export(existing_fs)
        return FuelExportSchema.model_validate(updated_transfer)

    @service_handler
    async def create_fuel_export(self, fs_data: FuelExportSchema) -> FuelExportSchema:
        """Create a new fuel supply record"""
        fs_data = await self.validate_and_calculate_compliance_units(fs_data)
        fuel_export = FuelExport(
            **fs_data.model_dump(
                exclude={
                    "id",
                    "fuel_type",
                    "fuel_category",
                    "compliance_period",
                    "provision_of_the_act",
                    "end_use",
                    "fuel_code",
                    "units",
                    "deleted",
                }
            )
        )
        fuel_export.units = QuantityUnitsEnum(fs_data.units)
        created_equipment = await self.repo.create_fuel_export(fuel_export)
        return FuelExportSchema.model_validate(created_equipment)

    @service_handler
    async def delete_fuel_export(self, fuel_export_id: int) -> str:
        """Delete a fuel supply record"""
        return await self.repo.delete_fuel_export(fuel_export_id)

    # TODO Left here for example for version tracking work
    # @service_handler
    # async def create_supplemental_fuel_export(
    #     self, supplemental_report_id: int, data: dict
    # ):
    #     new_supply = FuelExport(
    #         supplemental_report_id=supplemental_report_id,
    #         change_type=ChangeType.CREATE,
    #         **data,
    #     )
    #     return await self.repo.create_fuel_export(new_supply)

    # @service_handler
    # async def update_supplemental_fuel_export(
    #     self, supplemental_report_id: int, original_fuel_export_id: int, data: dict
    # ):
    #     updated_supply = FuelExport(
    #         supplemental_report_id=supplemental_report_id,
    #         previous_fuel_export_id=original_fuel_export_id,
    #         change_type=ChangeType.UPDATE,
    #         **data,
    #     )
    #     return await self.repo.create_fuel_export(updated_supply)

    # @service_handler
    # async def delete_supplemental_fuel_export(
    #     self, supplemental_report_id: int, original_fuel_export_id: int
    # ):
    #     delete_record = FuelExport(
    #         supplemental_report_id=supplemental_report_id,
    #         previous_fuel_export_id=original_fuel_export_id,
    #         change_type=ChangeType.DELETE,
    #         quantity=None,  # or any appropriate default value
    #     )
    #     return await self.repo.create_fuel_export(delete_record)

    # @service_handler
    # async def get_fuel_export_changes(
    #     self, original_report_id: int, supplemental_report_id: int
    # ):
    #     original_exports = await self.get_effective_fuel_exports(original_report_id)
    #     supplemental_exports = await self.get_effective_fuel_exports(
    #         supplemental_report_id, is_supplemental=True
    #     )

    #     changes = []

    #     # Check for updates and deletes
    #     for original_supply in original_exports:
    #         supplemental_supply = next(
    #             (
    #                 s
    #                 for s in supplemental_exports
    #                 if s.previous_fuel_export_id == original_supply.fuel_export_id
    #             ),
    #             None,
    #         )
    #         if not supplemental_supply:
    #             changes.append(
    #                 {
    #                     "type": ChangeType.DELETE,
    #                     "original": original_supply,
    #                     "updated": None,
    #                 }
    #             )
    #         elif original_supply != supplemental_supply:
    #             changes.append(
    #                 {
    #                     "type": ChangeType.UPDATE,
    #                     "original": original_supply,
    #                     "updated": supplemental_supply,
    #                 }
    #             )

    #     # Check for new records
    #     for supplemental_supply in supplemental_exports:
    #         if supplemental_supply.change_type == ChangeType.CREATE:
    #             changes.append(
    #                 {
    #                     "type": ChangeType.CREATE,
    #                     "original": None,
    #                     "updated": supplemental_supply,
    #                 }
    #             )

    #     return changes
