from datetime import datetime
import structlog
from fastapi import Depends
from sqlalchemy import and_, or_, select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload, subqueryload
from typing import List, Optional, Tuple

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import (
    CompliancePeriod,
    FuelExport,
)
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
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
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class FuelExportRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db
        self.query = select(FuelExport).options(
            subqueryload(FuelExport.fuel_code).options(
                subqueryload(FuelCode.fuel_code_status),
                subqueryload(FuelCode.fuel_code_prefix),
            ),
            subqueryload(FuelExport.fuel_category).options(
                subqueryload(FuelCategory.target_carbon_intensities),
                subqueryload(FuelCategory.energy_effectiveness_ratio),
            ),
            subqueryload(FuelExport.fuel_type).options(
                subqueryload(FuelType.energy_density),
                subqueryload(FuelType.additional_carbon_intensity),
                subqueryload(FuelType.energy_effectiveness_ratio),
                subqueryload(FuelType.default_carbon_intensities).options(
                    subqueryload(DefaultCarbonIntensity.compliance_period)
                ),
            ),
            subqueryload(FuelExport.provision_of_the_act),
            subqueryload(FuelExport.end_use_type),
        )

    @repo_handler
    async def get_fuel_export_table_options(self, compliance_period: str):
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
                FuelCodePrefix.fuel_code_prefix_id,
                func.concat(FuelCodePrefix.prefix, FuelCode.fuel_suffix).label(
                    "fuel_code"
                ),
                FuelCode.carbon_intensity.label("fuel_code_carbon_intensity"),
                FuelCode.effective_date.label("fuel_code_effective_date"),
                FuelCode.expiration_date.label("fuel_code_expiration_date"),
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
                or_(
                    and_(
                        FuelType.fossil_derived == True,
                        ProvisionOfTheAct.provision_of_the_act_id == 1,
                    ),
                    and_(
                        FuelType.fossil_derived == False,
                        ProvisionOfTheAct.provision_of_the_act_id != 1,
                    ),
                ),
            )
            .outerjoin(
                EnergyDensity,
                and_(
                    EnergyDensity.fuel_type_id == FuelType.fuel_type_id,
                    EnergyDensity.compliance_period_id == subquery_compliance_period_id,
                ),
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

        results = (await self.db.execute(query)).all()
        return results

    @repo_handler
    async def get_fuel_export_list(
        self,
        compliance_report_id: int,
        changelog: Optional[bool] = False,
        exclude_draft_reports: bool = False,
    ) -> List[FuelExport]:
        """
        Retrieve the list of effective fuel exports for a given compliance report.
        """
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return []

        # Retrieve effective fuel exports using the group UUID
        effective_fuel_exports = await self.get_effective_fuel_exports(
            group_uuid,
            compliance_report_id,
            changelog=changelog,
        )

        return effective_fuel_exports

    @repo_handler
    async def get_fuel_exports_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
    ) -> Tuple[List[FuelExport], int]:
        """
        Retrieve a paginated list of effective fuel exports for a given compliance report.
        """
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return [], 0

        # Retrieve effective fuel exports using the group UUID
        effective_fuel_exports = await self.get_effective_fuel_exports(
            group_uuid,
            compliance_report_id,
        )

        # Manually apply pagination
        total_count = len(effective_fuel_exports)
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        paginated_exports = effective_fuel_exports[offset : offset + limit]

        return paginated_exports, total_count

    @repo_handler
    async def get_fuel_export_by_id(self, fuel_export_id: int) -> FuelExport:
        """
        Retrieve a fuel supply row from the database
        """
        query = self.query.where(FuelExport.fuel_export_id == fuel_export_id)
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()

    @repo_handler
    async def update_fuel_export(self, fuel_export: FuelExport) -> FuelExport:
        """
        Update an existing fuel supply row in the database.
        """
        updated_fuel_export = await self.db.merge(fuel_export)
        await self.db.flush()
        await self.db.refresh(
            updated_fuel_export,
            [
                "fuel_category",
                "fuel_type",
                "provision_of_the_act",
                "end_use_type",
            ],
        )
        return updated_fuel_export

    @repo_handler
    async def create_fuel_export(self, fuel_export: FuelExport) -> FuelExport:
        """
        Create a new fuel supply row in the database.
        """
        self.db.add(fuel_export)
        await self.db.flush()
        await self.db.refresh(
            fuel_export,
            [
                "fuel_category",
                "fuel_type",
                "provision_of_the_act",
                "end_use_type",
                "fuel_code",
            ],
        )
        return fuel_export

    @repo_handler
    async def get_latest_fuel_export_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[FuelExport]:
        """
        Retrieve the latest FuelExport record for a given group UUID.
        Government records are prioritized over supplier records.
        """
        query = (
            select(FuelExport)
            .where(FuelExport.group_uuid == group_uuid)
            .order_by(
                FuelExport.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_effective_fuel_exports(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        changelog: Optional[bool] = False,
    ) -> List[FuelExport]:
        """
        Queries fuel exports from the database for a specific compliance report.
        If changelog=True, includes deleted records to show history.
        """
        # Get all compliance report IDs in the group up to the specified report
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            and_(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report_group_uuid,
                ComplianceReport.compliance_report_id <= compliance_report_id,
            )
        )

        # Get groups that have any deleted records
        deleted_groups = (
            select(FuelExport.group_uuid)
            .where(
                FuelExport.compliance_report_id.in_(compliance_reports_select),
                FuelExport.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Build query conditions
        conditions = [FuelExport.compliance_report_id.in_(compliance_reports_select)]

        if changelog:
            # In changelog view, include all groups (both active and deleted)
            conditions.extend(
                [
                    or_(
                        ~FuelExport.group_uuid.in_(deleted_groups),
                        FuelExport.group_uuid.in_(deleted_groups),
                    )
                ]
            )
        else:
            # In regular view, exclude any groups that have deleted records
            conditions.extend([~FuelExport.group_uuid.in_(deleted_groups)])

        # Get the latest version of each record
        valid_fuel_exports_select = (
            select(
                FuelExport.group_uuid,
                func.max(FuelExport.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(FuelExport.group_uuid)
        )

        valid_fuel_exports_subq = valid_fuel_exports_select.subquery()

        # Get the actual records with their related data
        query = (
            select(FuelExport)
            .options(
                joinedload(FuelExport.fuel_code),
                joinedload(FuelExport.fuel_category),
                joinedload(FuelExport.fuel_type),
                joinedload(FuelExport.provision_of_the_act),
                selectinload(FuelExport.end_use_type),
            )
            .join(
                valid_fuel_exports_subq,
                and_(
                    FuelExport.group_uuid == valid_fuel_exports_subq.c.group_uuid,
                    FuelExport.version == valid_fuel_exports_subq.c.max_version,
                ),
            )
            .order_by(FuelExport.create_date.asc())
        )

        result = await self.db.execute(query)
        fuel_exports = result.unique().scalars().all()

        return fuel_exports

    async def delete_fuel_export(self, fuel_export_id):
        await self.db.execute(
            delete(FuelExport).where(FuelExport.fuel_export_id == fuel_export_id)
        )
