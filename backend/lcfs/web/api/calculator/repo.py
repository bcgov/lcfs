from datetime import datetime
from typing import List
from lcfs.db.models.compliance import CompliancePeriod
from lcfs.db.models.fuel import (
    CategoryCarbonIntensity,
    DefaultCarbonIntensity,
    EndUseType,
    EnergyDensity,
    EnergyEffectivenessRatio,
    FuelCategory,
    FuelCode,
    FuelCodePrefix,
    FuelCodeStatus,
    FuelInstance,
    FuelType,
    ProvisionOfTheAct,
    TargetCarbonIntensity,
    UnitOfMeasure,
)
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.calculator.schema import FuelTypeSchema
from sqlalchemy import String, and_, cast, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from fastapi import Depends
import structlog

logger = structlog.get_logger(__name__)


class PublicRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
    ):
        self.db = db

    @repo_handler
    async def get_compliance_periods(self) -> List[CompliancePeriod]:
        """
        Get all compliance periods
        """
        compliance_periods = (
            (
                await self.db.execute(
                    select(CompliancePeriod)
                    .join(
                        DefaultCarbonIntensity,
                        CompliancePeriod.compliance_period_id
                        == DefaultCarbonIntensity.compliance_period_id,
                    )
                    .distinct()
                    .order_by(desc(CompliancePeriod.description))
                )
            )
            .scalars()
            .all()
        )
        return compliance_periods

    @repo_handler
    async def get_fuel_types(
        self,
        lcfs_only: bool = False,
        fuel_category: str = None,
        is_legacy: bool = False,
    ):
        """
        Get all fuel types
        """
        query = (
            select(
                FuelType.fuel_type_id,
                FuelType.fuel_type,
                FuelType.fossil_derived,
                FuelType.renewable,
                FuelType.unrecognized,
                FuelType.units,
                FuelCategory.fuel_category_id,
                FuelCategory.category,
            )
            .join(FuelInstance, FuelInstance.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                FuelCategory.fuel_category_id == FuelInstance.fuel_category_id,
            )
            .where(FuelCategory.category == fuel_category)
        )
        if not is_legacy:
            query = query.where(FuelType.is_legacy == False)
        if lcfs_only:
            query = query.where(and_(FuelType.renewable == False))

        result = (await self.db.execute(query)).all()
        return [FuelTypeSchema.model_validate(ft) for ft in result]

    @repo_handler
    async def get_fuel_type_options(
        self,
        compliance_period: str,
        fuel_type_id: int,
        fuel_category_id: int,
        lcfs_only: bool = False,
        include_legacy: bool = False,
    ):
        """
        Retrieve Fuel Type and other static data to use them while populating calculator form.
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

        subquery_provision_of_the_act_id = (
            select(ProvisionOfTheAct.provision_of_the_act_id)
            .where(ProvisionOfTheAct.name == "Fuel code - section 19 (b) (i)")
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
        query = (
            select(
                FuelType.fuel_type_id,
                FuelInstance.fuel_instance_id,
                FuelInstance.fuel_category_id,
                FuelType.fuel_type,
                FuelType.fossil_derived,
                DefaultCarbonIntensity.default_carbon_intensity,
                CategoryCarbonIntensity.category_carbon_intensity,
                FuelCategory.category,
                ProvisionOfTheAct.provision_of_the_act_id,
                ProvisionOfTheAct.name.label("provision_of_the_act"),
                EnergyDensity.energy_density_id,
                EnergyDensity.density.label("energy_density"),
                FuelType.units.label("unit"),
                FuelType.unrecognized,
                EndUseType.end_use_type_id,
                EndUseType.type.label("end_use_type"),
                EndUseType.sub_type.label("end_use_sub_type"),
                UnitOfMeasure.uom_id,
                UnitOfMeasure.name,
                EnergyEffectivenessRatio.eer_id,
                func.coalesce(EnergyEffectivenessRatio.ratio, 1).label(
                    "energy_effectiveness_ratio"
                ),
                TargetCarbonIntensity.target_carbon_intensity_id,
                TargetCarbonIntensity.target_carbon_intensity,
                TargetCarbonIntensity.reduction_target_percentage,
                FuelCode.fuel_code_id,
                FuelCode.fuel_suffix,
                FuelCodePrefix.fuel_code_prefix_id,
                FuelCodePrefix.prefix,
                FuelCode.carbon_intensity.label("fuel_code_carbon_intensity"),
            )
            .join(FuelInstance, FuelInstance.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                FuelCategory.fuel_category_id == FuelInstance.fuel_category_id,
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
                    or_(
                        and_(
                            FuelType.fossil_derived == True,
                            ProvisionOfTheAct.provision_of_the_act_id == 1,
                        ),
                        and_(
                            FuelType.fossil_derived == False,
                            or_(
                                and_(
                                    ProvisionOfTheAct.provision_of_the_act_id.notin_(
                                        [1, 8]
                                    ),
                                    current_year
                                    >= int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                                ),
                                and_(
                                    ProvisionOfTheAct.provision_of_the_act_id != 1,
                                    current_year
                                    < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                                ),
                            ),
                        ),
                    ),
                ),
            )
            .outerjoin(
                EnergyDensity, EnergyDensity.fuel_type_id == FuelType.fuel_type_id
            )
            .outerjoin(UnitOfMeasure, EnergyDensity.uom_id == UnitOfMeasure.uom_id)
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
                    ProvisionOfTheAct.provision_of_the_act_id
                    == subquery_provision_of_the_act_id,
                    FuelCode.expiration_date >= start_of_compliance_year,
                    FuelCode.effective_date <= end_of_compliance_year,
                ),
            )
            .outerjoin(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
        )

        include_legacy = int(compliance_period) < int(
            LCFS_Constants.LEGISLATION_TRANSITION_YEAR
        )
        if not include_legacy:
            query = query.where(
                and_(FuelType.is_legacy == False, ProvisionOfTheAct.is_legacy == False)
            )
        if lcfs_only:
            query = query.where(and_(FuelType.renewable == False))
        if fuel_category_id:
            query = query.where(FuelCategory.fuel_category_id == fuel_category_id)
        if fuel_type_id:
            query = query.where(FuelType.fuel_type_id == fuel_type_id)
        fuel_type_results = (await self.db.execute(query)).all()

        return {
            "fuel_types": fuel_type_results,
        }
