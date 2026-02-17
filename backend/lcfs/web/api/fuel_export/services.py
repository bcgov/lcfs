import math

import structlog
from fastapi import Depends, HTTPException, Request, status

from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
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
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.role.schema import user_has_roles
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.base import ActionTypeEnum

logger = structlog.get_logger(__name__)


class FuelExportServices:
    def __init__(
        self,
        request: Request = None,
        repo: FuelExportRepository = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.request = request
        self.repo = repo
        self.compliance_report_repo = compliance_report_repo

    def fuel_type_row_mapper(self, compliance_period, fuel_types, row):
        column_names = row._fields
        row_data = dict(zip(column_names, row))
        default_ci = row_data.get("default_carbon_intensity")
        category_ci = row_data.get("category_carbon_intensity")

        fuel_category = FuelCategorySchema(
            fuel_category_id=row_data["fuel_category_id"],
            fuel_category=row_data["category"],
            default_and_prescribed_ci=(
                default_ci
                if default_ci is not None and row_data["fuel_type"] != "Other"
                else category_ci if category_ci is not None else None
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
        eer = (
            EnergyEffectivenessRatioSchema(
                eer_id=row_data["eer_id"],
                energy_effectiveness_ratio=round(row_data["energy_effectiveness_ratio"] or 0, 2),
                fuel_category=fuel_category,
                end_use_type=end_use_type,
            )
            if row_data["eer_id"]
            else None
        )
        tci = (
            TargetCarbonIntensitySchema(
                target_carbon_intensity_id=row_data["target_carbon_intensity_id"],
                target_carbon_intensity=round(row_data["target_carbon_intensity"] or 0, 5),
                reduction_target_percentage=round(
                    row_data["reduction_target_percentage"] or 0, 2
                ),
                fuel_category=fuel_category,
                compliance_period=compliance_period,
            )
            if row_data["target_carbon_intensity_id"]
            else None
        )
        fuel_code = (
            FuelCodeSchema(
                fuel_code_id=row_data["fuel_code_id"],
                fuel_code=row_data["fuel_code"],
                fuel_code_prefix_id=row_data["fuel_code_prefix_id"],
                fuel_code_carbon_intensity=round(
                    row_data["fuel_code_carbon_intensity"] or 0, 2
                ),
                fuel_code_effective_date=row_data["fuel_code_effective_date"],
                fuel_code_expiration_date=row_data["fuel_code_expiration_date"],
                fuel_production_facility_country=row_data.get(
                    "fuel_production_facility_country"
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
                if eer and not next(
                    (
                        e
                        for e in existing_fuel_type.eer_ratios
                        if e.eer_id == eer.eer_id
                    ),
                    None,
                )
                else None
            )
            (
                existing_fuel_type.target_carbon_intensities.append(tci)
                if tci and not next(
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
                default_carbon_intensity=(
                    row_data["default_carbon_intensity"]
                    if row_data["fuel_type"] != "Other"
                    else category_ci if category_ci is not None else None
                ),
                unit=row_data["unit"].value,
                energy_density=(
                    energy_density if row_data["energy_density_id"] else None
                ),
                fuel_categories=[fuel_category],
                provisions=provisions,
                eer_ratios=[eer] if eer else [],
                target_carbon_intensities=[tci] if tci else [],
                fuel_codes=[fuel_code] if fuel_code else [],
            )
            fuel_types.append(fuel_type)

    @service_handler
    # @cache(
    #     expire=3600 * 24,
    #     key_builder=lcfs_cache_key_builder,
    #     namespace="users",
    # ) # seems to cause issues with fuel exports
    async def get_fuel_export_options(
        self, compliance_period: str
    ) -> FuelTypeOptionsResponse:
        """Get fuel supply table options"""
        fs_options = await self.repo.get_fuel_export_table_options(compliance_period)
        fuel_types = []
        for row in fs_options:
            self.fuel_type_row_mapper(compliance_period, fuel_types, row)
        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_export_list(
        self, compliance_report_id: int, changelog: bool = False
    ) -> FuelExportsSchema:
        """Get fuel export list for a compliance report"""
        is_gov_user = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
        fuel_export_models = await self.repo.get_fuel_export_list(
            compliance_report_id, changelog, exclude_draft_reports=is_gov_user
        )
        fs_list = [FuelExportSchema.model_validate(fs) for fs in fuel_export_models]

        # Calculate total compliance units (excluding deleted records)
        total_compliance_units = round(
            sum(
                fs.compliance_units if fs.compliance_units else 0
                for fs in fuel_export_models
                if fs.action_type != ActionTypeEnum.DELETE
            )
        )

        return FuelExportsSchema(
            fuel_exports=fs_list if fs_list else [],
            total_compliance_units=total_compliance_units,
        )

    @service_handler
    async def get_fuel_exports_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ):
        """Get paginated fuel export list for a compliance report"""
        fuel_exports, total_count = await self.repo.get_fuel_exports_paginated(
            pagination, compliance_report_id
        )

        # Calculate total compliance units from all records (not just paginated ones)
        # Get all fuel exports to calculate the total
        is_gov_user = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
        all_fuel_exports = await self.repo.get_fuel_export_list(
            compliance_report_id, changelog=False, exclude_draft_reports=is_gov_user
        )
        total_compliance_units = round(
            sum(
                fs.compliance_units if fs.compliance_units else 0
                for fs in all_fuel_exports
                if fs.action_type != ActionTypeEnum.DELETE
            )
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
            total_compliance_units=total_compliance_units,
        )

    @service_handler
    async def get_compliance_report_by_id(self, compliance_report_id: int):
        """Get compliance report by period with status"""
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_schema_by_id(
                compliance_report_id,
            )
        )

        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found for this period",
            )

        return compliance_report
