import math
import structlog
from fastapi import Depends, Request, HTTPException, status

from lcfs.db.models import FuelSupply
from lcfs.db.base import ActionTypeEnum
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
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
    ModeEnum,
    ProvisionOfTheActSchema,
    TargetCarbonIntensitySchema,
    UnitOfMeasureSchema,
    OrganizationFuelSuppliesSchema,
    OrganizationFuelSupplySchema,
    FuelSupplyAnalyticsSchema,
)
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)


class FuelSupplyServices:
    def __init__(
        self,
        request: Request = None,
        repo: FuelSupplyRepository = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.request = request
        self.repo = repo
        self.fuel_repo = fuel_repo
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
        eer = EnergyEffectivenessRatioSchema(
            eer_id=row_data["eer_id"],
            energy_effectiveness_ratio=round(
                row_data["energy_effectiveness_ratio"] or 1, 2
            ),
            fuel_category=fuel_category,
            end_use_type=end_use_type,
        )
        tci = TargetCarbonIntensitySchema(
            target_carbon_intensity_id=row_data["target_carbon_intensity_id"] or 0,
            target_carbon_intensity=round(row_data["target_carbon_intensity"] or 0, 5),
            reduction_target_percentage=round(
                row_data["reduction_target_percentage"] or 0, 2
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
                    row_data["fuel_code_carbon_intensity"] or 0, 2
                ),
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
                if not next(
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
                    energy_density=round(row_data["energy_density"] or 0, 2),
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
                renewable=row_data["renewable"],
                default_carbon_intensity=(
                    round(default_ci or 0, 2)
                    if default_ci is not None and row_data["fuel_type"] != "Other"
                    else category_ci if category_ci is not None else None
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
        fs_options = await self.repo.get_fuel_supply_table_options(compliance_period)
        fuel_types = []
        for row in fs_options["fuel_types"]:
            self.fuel_type_row_mapper(compliance_period, fuel_types, row)

        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_supply_list(
        self, compliance_report_id: int, mode: ModeEnum = ModeEnum.VIEW
    ) -> FuelSuppliesSchema:
        """Get fuel supply list for a compliance report"""
        fuel_supply_models = await self.repo.get_fuel_supply_list(
            compliance_report_id, mode
        )
        fs_list = [self.map_entity_to_schema(fs) for fs in fuel_supply_models]

        # Calculate total compliance units (excluding deleted records)
        total_compliance_units = round(
            sum(
                fs.compliance_units if fs.compliance_units else 0
                for fs in fuel_supply_models
                if fs.action_type != ActionTypeEnum.DELETE
            )
        )

        return FuelSuppliesSchema(
            fuel_supplies=fs_list if fs_list else [],
            total_compliance_units=total_compliance_units,
        )

    def map_entity_to_schema(self, fuel_supply: FuelSupply):
        return FuelSupplyResponseSchema(
            compliance_report_id=fuel_supply.compliance_report_id,
            fuel_code=(
                fuel_supply.fuel_code.fuel_code if fuel_supply.fuel_code else None
            ),
            fuel_type_id=fuel_supply.fuel_type_id,
            fuel_type_other=fuel_supply.fuel_type_other,
            ci_of_fuel=fuel_supply.ci_of_fuel,
            end_use_id=fuel_supply.end_use_id,
            provision_of_the_act=fuel_supply.provision_of_the_act.name,
            provision_of_the_act_id=fuel_supply.provision_of_the_act_id,
            fuel_type=fuel_supply.fuel_type.fuel_type,
            fuel_category=fuel_supply.fuel_category.category,
            fuel_code_id=fuel_supply.fuel_code_id,
            fuel_category_id=fuel_supply.fuel_category_id,
            fuel_supply_id=fuel_supply.fuel_supply_id,
            action_type=fuel_supply.action_type,
            compliance_units=round(fuel_supply.compliance_units),
            end_use_type=fuel_supply.end_use_type.type,
            target_ci=fuel_supply.target_ci,
            version=fuel_supply.version,
            quantity=fuel_supply.quantity,
            q1_quantity=fuel_supply.q1_quantity,
            q2_quantity=fuel_supply.q2_quantity,
            q3_quantity=fuel_supply.q3_quantity,
            q4_quantity=fuel_supply.q4_quantity,
            group_uuid=fuel_supply.group_uuid,
            energy_density=fuel_supply.energy_density,
            eer=fuel_supply.eer,
            uci=fuel_supply.uci,
            units=fuel_supply.units,
            energy=fuel_supply.energy,
            deleted=False,
            is_new_supplemental_entry=False,
            is_canada_produced=fuel_supply.is_canada_produced,
            is_q1_supplied=fuel_supply.is_q1_supplied,
        )

    @service_handler
    async def get_fuel_supplies_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
    ):
        """Get paginated fuel supply list for a compliance report"""
        fuel_supplies, total_count = await self.repo.get_fuel_supplies_paginated(
            pagination, compliance_report_id
        )

        # Calculate total compliance units from all records (not just paginated ones)
        # Get all fuel supplies to calculate the total
        all_fuel_supplies = await self.repo.get_fuel_supply_list(
            compliance_report_id, ModeEnum.VIEW
        )
        total_compliance_units = round(
            sum(
                fs.compliance_units if fs.compliance_units else 0
                for fs in all_fuel_supplies
                if fs.action_type != ActionTypeEnum.DELETE
            )
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
            fuel_supplies=[self.map_entity_to_schema(fs) for fs in fuel_supplies],
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

    @service_handler
    async def get_organization_fuel_supply(
        self, organization_id: int, pagination: PaginationRequestSchema
    ) -> OrganizationFuelSuppliesSchema:
        """
        Get paginated fuel supply history for an organization.
        Aggregates data from all compliance reports for the organization.
        Includes analytics for charts and summary cards.
        """
        # Get paginated fuel supply data and total count
        fuel_supplies, total_count = (
            await self.repo.get_organization_fuel_supply_paginated(
                organization_id, pagination
            )
        )

        # Get analytics data
        analytics = await self.repo.get_organization_fuel_supply_analytics(
            organization_id,
            pagination.filters if hasattr(pagination, "filters") else None,
        )

        # Map entities to response schemas
        fuel_supply_list = [
            OrganizationFuelSupplySchema(
                fuel_supply_id=fs.fuel_supply_id,
                compliance_period=fs.compliance_report.compliance_period.description,
                report_submission_date=(
                    fs.compliance_report.update_date.isoformat()
                    if fs.compliance_report.update_date
                    else None
                ),
                fuel_type=fs.fuel_type.fuel_type,
                fuel_category=fs.fuel_category.category,
                provision_of_the_act=fs.provision_of_the_act.name,
                fuel_code=fs.fuel_code.fuel_code if fs.fuel_code else None,
                fuel_quantity=(
                    (fs.quantity or 0)
                    if fs.quantity is not None
                    else (
                        (fs.q1_quantity or 0)
                        + (fs.q2_quantity or 0)
                        + (fs.q3_quantity or 0)
                        + (fs.q4_quantity or 0)
                    )
                ),
                units=fs.units.value,
                compliance_report_id=fs.compliance_report_id,
            )
            for fs in fuel_supplies
        ]

        return OrganizationFuelSuppliesSchema(
            fuel_supplies=fuel_supply_list,
            analytics=FuelSupplyAnalyticsSchema(**analytics),
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total_count,
                total_pages=(
                    math.ceil(total_count / pagination.size) if total_count > 0 else 0
                ),
            ),
        )
