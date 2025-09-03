import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import and_, or_, select, literal
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import Optional, Sequence, Any
from sqlalchemy.dialects.postgresql import array_agg
from sqlalchemy.sql.expression import distinct
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import CompliancePeriod
from lcfs.db.models.fuel import (
    CategoryCarbonIntensity,
    DefaultCarbonIntensity,
    EnergyDensity,
    EnergyEffectivenessRatio,
    FuelCategory,
    FuelInstance,
    FuelCode,
    FuelCodePrefix,
    FuelCodeStatus,
    FuelType,
    ProvisionOfTheAct,
    TargetCarbonIntensity,
    UnitOfMeasure,
    EndUseType,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class LegacyFuelSupplyRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fuel_supply_table_options(self, compliance_period: str):
        """
        Retrieve Fuel Type and other static data for LEGACY years (before LCFS transition year)
        to use them while populating fuel supply form.
        """

        subquery_compliance_period_id = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliance_period)
            .scalar_subquery()
        )

        subquery_fuel_code_status_id = (
            select(FuelCodeStatus.fuel_code_status_id)
            .where(FuelCodeStatus.status == "Approved")
            .scalar_subquery()
        )

        try:
            current_year = int(compliance_period)
        except ValueError as e:
            logger.error(
                "Invalid compliance_period: not an integer",
                compliance_period=compliance_period,
                error=str(e),
            )
            raise ValueError(
                f"""Invalid compliance_period: '{
                    compliance_period}' must be an integer."""
            ) from e

        start_of_compliance_year = datetime(current_year, 1, 1)
        end_of_compliance_year = datetime(current_year, 12, 31)

        # Define conditions for the query for legacy years:
        # - Include fuel types marked as legacy or non‑fossil-derived.
        # - Exclude jet fuel from FuelCategory.
        # - Provision itself is flagged as legacy.
        # - Gasoline (Natural gas-based, Petroleum-based): provision ID 4
        # - Petroleum-based diesel: provision ID 5
        # - Other non-fossil fuels: provision ID not in [4, 5]
        fuel_instance_condition = or_(
            FuelType.is_legacy == True,
            FuelType.fossil_derived == False,
        )
        fuel_category_condition = FuelCategory.fuel_category_id != 3  # Exclude Jet Fuel
        provision_condition = and_(
            ProvisionOfTheAct.is_legacy == True,
            or_(
                # For gasoline types (Natural gas-based and Petroleum-based)
                and_(
                    FuelType.fuel_type.in_(
                        ["Natural gas-based gasoline", "Petroleum-based gasoline"]
                    ),
                    ProvisionOfTheAct.provision_of_the_act_id == 4,
                ),
                # For Petroleum-based diesel
                and_(
                    FuelType.fuel_type == "Petroleum-based diesel",
                    ProvisionOfTheAct.provision_of_the_act_id == 5,
                ),
                # For all other non-fossil fuels
                and_(
                    ~FuelType.fuel_type.in_(
                        [
                            "Natural gas-based gasoline",
                            "Petroleum-based gasoline",
                            "Petroleum-based diesel",
                        ]
                    ),
                    ProvisionOfTheAct.provision_of_the_act_id.notin_([4, 5]),
                ),
            ),
        )

        # Construct the main query using the above conditions.
        query = (
            select(
                FuelType.fuel_type_id,
                FuelInstance.fuel_instance_id,
                EndUseType.end_use_type_id,
                FuelType.fuel_type,
                FuelType.fossil_derived,
                FuelCategory.fuel_category_id,
                FuelCategory.category,
                DefaultCarbonIntensity.default_carbon_intensity,
                CategoryCarbonIntensity.category_carbon_intensity,
                EnergyDensity.energy_density_id,
                EnergyDensity.density.label("energy_density"),
                FuelType.units.label("unit"),
                FuelType.unrecognized,
                UnitOfMeasure.uom_id,
                UnitOfMeasure.name,
                func.coalesce(
                    array_agg(
                        distinct(
                            func.jsonb_build_object(
                                "provision_of_the_act_id",
                                ProvisionOfTheAct.provision_of_the_act_id,
                                "name",
                                ProvisionOfTheAct.name,
                            )
                        )
                    ).filter(ProvisionOfTheAct.provision_of_the_act_id.is_not(None)),
                    [],
                ).label("provisions"),
                func.coalesce(
                    array_agg(
                        distinct(
                            func.jsonb_build_object(
                                "fuel_code_id",
                                FuelCode.fuel_code_id,
                                "fuel_code",
                                FuelCodePrefix.prefix + FuelCode.fuel_suffix,
                                "fuel_code_prefix_id",
                                FuelCodePrefix.fuel_code_prefix_id,
                                "fuel_code_carbon_intensity",
                                FuelCode.carbon_intensity,
                            )
                        )
                    ).filter(FuelCode.fuel_code_id.is_not(None)),
                    [],
                ).label("fuel_codes"),
                func.coalesce(
                    array_agg(
                        distinct(
                            func.jsonb_build_object(
                                "eer_id",
                                EnergyEffectivenessRatio.eer_id,
                                "energy_effectiveness_ratio",
                                func.coalesce(EnergyEffectivenessRatio.ratio, 1),
                                "end_use_type_id",
                                EndUseType.end_use_type_id,
                                "end_use_type",
                                EndUseType.type,
                                "end_use_sub_type",
                                EndUseType.sub_type,
                            )
                        )
                    ).filter(EnergyEffectivenessRatio.eer_id.is_not(None)),
                    [],
                ).label("eers"),
                func.coalesce(
                    array_agg(
                        distinct(
                            func.jsonb_build_object(
                                "target_carbon_intensity_id",
                                TargetCarbonIntensity.target_carbon_intensity_id,
                                "target_carbon_intensity",
                                TargetCarbonIntensity.target_carbon_intensity,
                                "reduction_target_percentage",
                                TargetCarbonIntensity.reduction_target_percentage,
                            )
                        )
                    ).filter(
                        TargetCarbonIntensity.target_carbon_intensity_id.is_not(None)
                    ),
                    [],
                ).label("target_carbon_intensities"),
            )
            .join(
                FuelInstance,
                and_(
                    FuelInstance.fuel_type_id == FuelType.fuel_type_id,
                    fuel_instance_condition,
                ),
            )
            .join(
                FuelCategory,
                and_(
                    FuelCategory.fuel_category_id == FuelInstance.fuel_category_id,
                    fuel_category_condition,
                ),
            )
            .outerjoin(
                DefaultCarbonIntensity,
                and_(
                    DefaultCarbonIntensity.fuel_type_id == FuelType.fuel_type_id,
                    DefaultCarbonIntensity.compliance_period_id
                    == subquery_compliance_period_id,
                ),
            )
            .outerjoin(
                CategoryCarbonIntensity,
                and_(
                    CategoryCarbonIntensity.fuel_category_id
                    == FuelCategory.fuel_category_id,
                    CategoryCarbonIntensity.compliance_period_id
                    == subquery_compliance_period_id,
                ),
            )
            .outerjoin(
                ProvisionOfTheAct,
                and_(
                    ProvisionOfTheAct.name != "Unknown",
                    provision_condition,
                ),
            )
            .outerjoin(
                EnergyDensity, EnergyDensity.fuel_type_id == FuelType.fuel_type_id
            )
            .outerjoin(UnitOfMeasure, UnitOfMeasure.uom_id == EnergyDensity.uom_id)
            .outerjoin(
                EnergyEffectivenessRatio,
                and_(
                    EnergyEffectivenessRatio.fuel_category_id
                    == FuelCategory.fuel_category_id,
                    EnergyEffectivenessRatio.fuel_type_id == FuelInstance.fuel_type_id,
                    EnergyEffectivenessRatio.compliance_period_id
                    == subquery_compliance_period_id,
                ),
            )
            .outerjoin(
                EndUseType,
                EndUseType.end_use_type_id == EnergyEffectivenessRatio.end_use_type_id,
            )
            .outerjoin(
                TargetCarbonIntensity,
                and_(
                    TargetCarbonIntensity.fuel_category_id
                    == FuelCategory.fuel_category_id,
                    TargetCarbonIntensity.compliance_period_id
                    == subquery_compliance_period_id,
                ),
            )
            .outerjoin(
                FuelCode,
                and_(
                    FuelCode.fuel_type_id == FuelType.fuel_type_id,
                    FuelCode.fuel_status_id == subquery_fuel_code_status_id,
                    FuelCode.expiration_date >= start_of_compliance_year,
                    FuelCode.effective_date <= end_of_compliance_year,
                ),
            )
            .outerjoin(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
            .group_by(
                FuelType.fuel_type_id,
                FuelInstance.fuel_instance_id,
                EndUseType.end_use_type_id,
                FuelType.fuel_type,
                FuelType.fossil_derived,
                FuelCategory.fuel_category_id,
                FuelCategory.category,
                DefaultCarbonIntensity.default_carbon_intensity,
                CategoryCarbonIntensity.category_carbon_intensity,
                EnergyDensity.energy_density_id,
                EnergyDensity.density,
                FuelType.units,
                FuelType.unrecognized,
                UnitOfMeasure.uom_id,
                UnitOfMeasure.name,
            )
            .order_by(FuelType.fuel_type_id, FuelType.fuel_type)
        )

        fuel_type_results = (await self.db.execute(query)).all()

        return {
            "fuel_types": fuel_type_results,
        }
