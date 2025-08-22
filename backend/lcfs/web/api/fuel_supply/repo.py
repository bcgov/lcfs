import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import and_, or_, select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload, aliased
from typing import List, Optional, Sequence, Any

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import (
    CompliancePeriod,
    FuelSupply,
    ComplianceReport,
)
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
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema, ModeEnum
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class FuelSupplyRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db
        self.query = select(FuelSupply).options(
            joinedload(FuelSupply.fuel_code).options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
            ),
            joinedload(FuelSupply.fuel_category).options(
                joinedload(FuelCategory.target_carbon_intensities),
                joinedload(FuelCategory.energy_effectiveness_ratio),
            ),
            joinedload(FuelSupply.fuel_type).options(
                joinedload(FuelType.energy_density),
                joinedload(FuelType.additional_carbon_intensity),
                joinedload(FuelType.energy_effectiveness_ratio),
                joinedload(FuelType.default_carbon_intensities),
            ),
            joinedload(FuelSupply.provision_of_the_act),
            joinedload(FuelSupply.end_use_type),
        )

    @repo_handler
    async def get_fuel_supply_table_options(self, compliance_period: str):
        """
        Retrieve Fuel Type and other static data to use them while populating fuel supply form.
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
                FuelCode.fuel_production_facility_country,
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

        include_legacy = compliance_period < LCFS_Constants.LEGISLATION_TRANSITION_YEAR
        if not include_legacy:
            query = query.where(
                and_(FuelType.is_legacy == False, ProvisionOfTheAct.is_legacy == False)
            )

        fuel_type_results = (await self.db.execute(query)).all()

        return {
            "fuel_types": fuel_type_results,
        }

    @repo_handler
    async def get_fuel_supply_list(
        self,
        compliance_report_id: int,
        mode: Optional[ModeEnum] = ModeEnum.VIEW,
    ) -> List[FuelSupply]:
        """
        Retrieve the list of effective fuel supplies for a given compliance report.
        """
        # Retrieve the compliance report's group UUID and version
        report_query = await self.db.execute(
            select(
                ComplianceReport.compliance_report_group_uuid, ComplianceReport.version
            ).where(ComplianceReport.compliance_report_id == compliance_report_id)
        )
        result = report_query.first()

        if not result:
            return [], 0

        group_uuid, version = result
        if not group_uuid:
            return []

        # Retrieve effective fuel supplies using the group UUID,
        effective_fuel_supplies = await self.get_effective_fuel_supplies(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
            version=version,
            mode=mode,
        )

        return effective_fuel_supplies

    @repo_handler
    async def get_fuel_supplies_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
        effective: bool = True,
    ) -> tuple[list[Any], int] | tuple[Sequence[FuelSupply] | list[FuelSupply], int]:
        """
        Retrieve a paginated list of effective fuel supplies for a given compliance report.
        """
        # Retrieve the compliance report's group UUID and version
        report_query = await self.db.execute(
            select(
                ComplianceReport.compliance_report_group_uuid, ComplianceReport.version
            ).where(ComplianceReport.compliance_report_id == compliance_report_id)
        )
        result = report_query.first()

        if not result:
            return [], 0

        group_uuid, version = result
        if not group_uuid:
            return [], 0

        if effective:
            # Retrieve effective fuel supplies using the group UUID
            fuel_supplies = await self.get_effective_fuel_supplies(
                group_uuid, compliance_report_id, version
            )
        else:
            fuel_supplies = await self.get_fuel_supplies(compliance_report_id)

        # Manually apply pagination
        total_count = len(fuel_supplies)
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        paginated_supplies = fuel_supplies[offset : offset + limit]

        return paginated_supplies, total_count

    @repo_handler
    async def get_fuel_supply_by_id(self, fuel_supply_id: int) -> FuelSupply:
        """
        Retrieve a fuel supply row from the database
        """
        query = self.query.where(FuelSupply.fuel_supply_id == fuel_supply_id)
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()

    @repo_handler
    async def update_fuel_supply(self, fuel_supply: FuelSupply) -> FuelSupply:
        """
        Update an existing fuel supply row in the database.
        """
        fuel_supply = await self.db.merge(fuel_supply)
        await self.db.flush()
        await self.db.refresh(
            fuel_supply,
            [
                "fuel_category",
                "fuel_type",
                "fuel_code",
                "provision_of_the_act",
                "end_use_type",
            ],
        )
        return fuel_supply

    @repo_handler
    async def create_fuel_supply(self, fuel_supply: FuelSupply) -> FuelSupply:
        """
        Create a new fuel supply row in the database.
        """
        self.db.add(fuel_supply)
        await self.db.flush()
        await self.db.refresh(
            fuel_supply,
            [
                "fuel_category",
                "fuel_type",
                "fuel_code",
                "provision_of_the_act",
                "end_use_type",
            ],
        )
        return fuel_supply

    @repo_handler
    async def get_fuel_supplies(self, report_id: int) -> List[FuelSupply]:
        """
        Retrieve the list of fuel supplies for a given report (compliance or supplemental).
        """
        query = select(FuelSupply).options(
            joinedload(FuelSupply.fuel_code),
            joinedload(FuelSupply.fuel_category),
            joinedload(FuelSupply.fuel_type),
            joinedload(FuelSupply.provision_of_the_act),
            joinedload(FuelSupply.end_use_type),
        )

        query = query.where(FuelSupply.compliance_report_id == report_id)

        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def check_duplicate(self, fuel_supply: FuelSupplyCreateUpdateSchema):
        """Check if this would duplicate an existing row"""

        CurrentReport = aliased(ComplianceReport)

        # Get all compliance report IDs that belong to the same group in a subquery
        related_reports_subquery = (
            select(ComplianceReport.compliance_report_id)
            .join(
                CurrentReport,
                CurrentReport.compliance_report_id == fuel_supply.compliance_report_id,
            )
            .where(
                ComplianceReport.compliance_report_group_uuid
                == CurrentReport.compliance_report_group_uuid
            )
        )
        # Type, Category, and Determine CI/Fuel codes are included
        duplicate_query = select(FuelSupply.fuel_supply_id).where(
            FuelSupply.compliance_report_id.in_(related_reports_subquery),
            FuelSupply.fuel_type_id == fuel_supply.fuel_type_id,
            FuelSupply.fuel_category_id == fuel_supply.fuel_category_id,
            FuelSupply.provision_of_the_act_id == fuel_supply.provision_of_the_act_id,
            FuelSupply.fuel_code_id == fuel_supply.fuel_code_id,
            FuelSupply.end_use_id == fuel_supply.end_use_id,
            FuelSupply.is_canada_produced == fuel_supply.is_canada_produced,
            FuelSupply.is_q1_supplied == fuel_supply.is_q1_supplied,
            FuelSupply.action_type.in_([ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]),
            FuelSupply.group_uuid != fuel_supply.group_uuid,
        )

        # Add conditional filter for fuel_supply_id if it exists
        if fuel_supply.fuel_supply_id is not None:
            duplicate_query = duplicate_query.where(
                FuelSupply.fuel_supply_id != fuel_supply.fuel_supply_id
            )

        # Add ordering to get the most recent record
        duplicate_query = duplicate_query.order_by(
            FuelSupply.create_date.desc(), FuelSupply.version.desc()
        )

        result = await self.db.execute(duplicate_query)
        return result.scalars().first()

    @repo_handler
    async def get_fuel_supply_by_group_version(
        self, group_uuid: str, version: int
    ) -> Optional[FuelSupply]:
        """
        Retrieve a specific FuelSupply record by group UUID, version, and user_type.
        This method explicitly requires user_type to avoid ambiguity.
        """
        query = select(FuelSupply).where(
            FuelSupply.group_uuid == group_uuid,
            FuelSupply.version == version,
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_latest_fuel_supply_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[FuelSupply]:
        """
        Retrieve the latest FuelSupply record for a given group UUID.
        Ordered by `version` in descending order.
        """
        query = (
            select(FuelSupply)
            .where(FuelSupply.group_uuid == group_uuid)
            .order_by(
                FuelSupply.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_effective_fuel_supplies(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        version: int,
        mode: Optional[ModeEnum] = ModeEnum.VIEW,
    ) -> Sequence[FuelSupply]:
        """
        Queries fuel supplies from the database for a specific compliance report.
        If mode=VIEW: Shows only active records (excludes deleted ones)
        If mode=EDIT: Shows records for the current compliance report only including deletes in case of supplemental records
        If mode=CHANGELOG: Shows all history including deleted records.
        """
        # Get all compliance report IDs in the group up to the specified report
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            and_(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report_group_uuid,
                ComplianceReport.version <= version,
            )
        )

        # Get groups that have any deleted records
        deleted_groups = (
            select(FuelSupply.group_uuid)
            .where(
                FuelSupply.compliance_report_id.in_(compliance_reports_select),
                FuelSupply.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Build query conditions
        conditions = [FuelSupply.compliance_report_id.in_(compliance_reports_select)]

        if mode == ModeEnum.CHANGELOG:
            # In changelog view, include all groups (both active and deleted)
            conditions.extend(
                [
                    or_(
                        ~FuelSupply.group_uuid.in_(deleted_groups),
                        FuelSupply.group_uuid.in_(deleted_groups),
                    )
                ]
            )
        elif mode == ModeEnum.VIEW:
            # In regular view, exclude any groups that have deleted records
            conditions.extend([~FuelSupply.group_uuid.in_(deleted_groups)])

        # Get the latest version of each record
        valid_fuel_supplies_select = (
            select(
                FuelSupply.group_uuid,
                func.max(FuelSupply.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(FuelSupply.group_uuid)
        )

        valid_fuel_supplies_subq = valid_fuel_supplies_select.subquery()

        # Get the actual records with their related data
        query = (
            select(FuelSupply)
            .options(
                selectinload(FuelSupply.fuel_code).options(
                    selectinload(FuelCode.fuel_code_status),
                    selectinload(FuelCode.fuel_code_prefix),
                ),
                selectinload(FuelSupply.fuel_category).options(
                    selectinload(FuelCategory.target_carbon_intensities),
                    selectinload(FuelCategory.energy_effectiveness_ratio),
                ),
                joinedload(FuelSupply.fuel_type).options(
                    joinedload(FuelType.energy_density),
                    joinedload(FuelType.additional_carbon_intensity),
                    joinedload(FuelType.energy_effectiveness_ratio),
                ),
                joinedload(FuelSupply.provision_of_the_act),
                selectinload(FuelSupply.end_use_type),
            )
            .join(
                valid_fuel_supplies_subq,
                and_(
                    FuelSupply.group_uuid == valid_fuel_supplies_subq.c.group_uuid,
                    FuelSupply.version == valid_fuel_supplies_subq.c.max_version,
                ),
                isouter=False,
            )
            .order_by(FuelSupply.create_date.asc())
        )
        if mode == ModeEnum.EDIT:
            query = query.where(
                or_(
                    and_(
                        FuelSupply.compliance_report_id == compliance_report_id,
                        FuelSupply.action_type == ActionTypeEnum.DELETE,
                    ),
                    FuelSupply.action_type.in_(
                        [ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]
                    ),
                )
            )
        result = await self.db.execute(query)
        fuel_supplies = result.unique().scalars().all()

        return fuel_supplies

    async def delete_fuel_supply(self, fuel_supply_id):
        await self.db.execute(
            delete(FuelSupply).where(FuelSupply.fuel_supply_id == fuel_supply_id)
        )
