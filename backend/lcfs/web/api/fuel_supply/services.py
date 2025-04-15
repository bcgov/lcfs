import math
import structlog
from fastapi import Depends, Request, HTTPException, status

from lcfs.db.models import FuelSupply
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
    ProvisionOfTheActSchema,
    TargetCarbonIntensitySchema,
    UnitOfMeasureSchema,
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

    def fuel_type_row_mapper(self, compliance_period, fuel_types, rows):
        fuel_type_dict = {}

        fuel_code_provisions = {
            "Fuel code - section 19 (b) (i)",
            "Approved fuel code - Section 6 (5) (c)",
        }

        for row in rows:
            row_data = dict(zip(row._fields, row))
            ft_key = row_data["fuel_type_id"]
            # Initialize fuel type entry if it doesn't exist yet
            if ft_key not in fuel_type_dict:
                energy_density = None
                if row_data["energy_density_id"]:
                    energy_density = EnergyDensitySchema(
                        energy_density_id=row_data["energy_density_id"],
                        energy_density=round(row_data["energy_density"], 2),
                        unit=UnitOfMeasureSchema(
                            uom_id=row_data["uom_id"], name=row_data["name"]
                        ),
                    )

                fuel_type_dict[ft_key] = FuelTypeOptionsSchema(
                    fuel_type_id=row_data["fuel_type_id"],
                    fuel_type=row_data["fuel_type"],
                    fossil_derived=row_data["fossil_derived"],
                    default_carbon_intensity=(
                        round(row_data["default_carbon_intensity"], 2)
                        if row_data["default_carbon_intensity"] is not None
                        and row_data["fuel_type"] != "Other"
                        else row_data["category_carbon_intensity"]
                    ),
                    unit=row_data["unit"].value,
                    energy_density=energy_density,
                    fuel_categories=[],
                    provisions=[],
                    eer_ratios=[],
                    target_carbon_intensities=[],
                    fuel_codes=[],
                    unrecognized=row_data["unrecognized"],
                )

            ft = fuel_type_dict[ft_key]

            # Fuel category
            if all(
                fc.fuel_category_id != row_data["fuel_category_id"]
                for fc in ft.fuel_categories
            ):
                fuel_category = FuelCategorySchema(
                    fuel_category_id=row_data["fuel_category_id"],
                    fuel_category=row_data["category"],
                    default_and_prescribed_ci=(
                        row_data["default_carbon_intensity"]
                        if row_data["default_carbon_intensity"] is not None
                        and row_data["fuel_type"] != "Other"
                        else row_data["category_carbon_intensity"]
                    ),
                )
                ft.fuel_categories.append(fuel_category)

            # Provisions
            for prov in row_data.get("provisions", []):
                provision = ProvisionOfTheActSchema(
                    provision_of_the_act_id=prov["provision_of_the_act_id"],
                    name=prov["name"],
                )
                if all(
                    p.provision_of_the_act_id != provision.provision_of_the_act_id
                    for p in ft.provisions
                ):
                    ft.provisions.append(provision)

            # Fuel codes
            for code in row_data.get("fuel_codes", []):
                if code.get("fuel_code_id"):
                    fuel_code = FuelCodeSchema(
                        fuel_code_id=code["fuel_code_id"],
                        fuel_code=code["fuel_code"],
                        fuel_code_prefix_id=code["fuel_code_prefix_id"],
                        fuel_code_carbon_intensity=(
                            round(code["fuel_code_carbon_intensity"], 2)
                            if code["fuel_code_carbon_intensity"] is not None
                            else None
                        ),
                    )
                    if all(
                        fc.fuel_code_id != fuel_code.fuel_code_id
                        for fc in ft.fuel_codes
                    ):
                        ft.fuel_codes.append(fuel_code)

            # EER Ratios
            for eer_data in row_data.get("eers", []):
                if eer_data.get("eer_id") and all(
                    e.eer_id != eer_data["eer_id"] for e in ft.eer_ratios
                ):
                    eer = EnergyEffectivenessRatioSchema(
                        eer_id=eer_data["eer_id"],
                        energy_effectiveness_ratio=round(
                            eer_data["energy_effectiveness_ratio"], 2
                        ),
                        fuel_category=fuel_category,
                        end_use_type=(
                            EndUseTypeSchema(
                                end_use_type_id=eer_data["end_use_type_id"],
                                type=eer_data["end_use_type"],
                                sub_type=eer_data["end_use_sub_type"],
                            )
                            if eer_data.get("end_use_type_id")
                            else None
                        ),
                    )
                    ft.eer_ratios.append(eer)

            # Target Carbon Intensities
            for tci_data in row_data.get("target_carbon_intensities", []):
                if tci_data.get("target_carbon_intensity_id") and all(
                    t.target_carbon_intensity_id
                    != tci_data["target_carbon_intensity_id"]
                    for t in ft.target_carbon_intensities
                ):
                    tci = TargetCarbonIntensitySchema(
                        target_carbon_intensity_id=tci_data[
                            "target_carbon_intensity_id"
                        ],
                        target_carbon_intensity=round(
                            tci_data["target_carbon_intensity"], 5
                        ),
                        reduction_target_percentage=round(
                            tci_data["reduction_target_percentage"], 2
                        ),
                        fuel_category=fuel_category,
                        compliance_period=compliance_period,
                    )
                    ft.target_carbon_intensities.append(tci)

        # Filter provisions after collecting
        for ft in fuel_type_dict.values():
            has_fuel_codes = bool(ft.fuel_codes)
            ft.provisions = [
                p
                for p in ft.provisions
                if p.name not in fuel_code_provisions or has_fuel_codes
            ]

        fuel_types.extend(fuel_type_dict.values())

    @service_handler
    async def get_fuel_supply_options(
        self, compliance_period: str
    ) -> FuelTypeOptionsResponse:
        """Get fuel supply table options"""
        fs_options = await self.repo.get_fuel_supply_table_options(compliance_period)
        fuel_types = []
        self.fuel_type_row_mapper(
            compliance_period, fuel_types, fs_options["fuel_types"]
        )

        return FuelTypeOptionsResponse(fuel_types=fuel_types)

    @service_handler
    async def get_fuel_supply_list(
        self, compliance_report_id: int, changelog: bool = False
    ) -> FuelSuppliesSchema:
        """Get fuel supply list for a compliance report"""
        fuel_supply_models = await self.repo.get_fuel_supply_list(
            compliance_report_id, changelog
        )
        fs_list = [self.map_entity_to_schema(fs) for fs in fuel_supply_models]

        return FuelSuppliesSchema(fuel_supplies=fs_list if fs_list else [])

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
            end_use_type=(
                fuel_supply.end_use_type.type if fuel_supply.end_use_type else None
            ),
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
        )

    @service_handler
    async def get_compliance_report_by_id(self, compliance_report_id: int):
        """Get compliance report by period with status"""
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_by_id(
                compliance_report_id,
            )
        )

        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found for this period",
            )

        return compliance_report
