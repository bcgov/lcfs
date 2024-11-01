from logging import getLogger
from typing import List, Optional, Tuple
from lcfs.db.models.compliance import CompliancePeriod, FuelExport
from lcfs.db.models.fuel import (
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
from lcfs.db.base import UserTypeEnum, ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.base import PaginationRequestSchema
from sqlalchemy import and_, or_, select, func, delete
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql import case
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session

logger = getLogger("fuel_export_repo")


class FuelExportRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db
        self.query = select(FuelExport).options(
            joinedload(FuelExport.fuel_code).options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
            ),
            joinedload(FuelExport.fuel_category).options(
                joinedload(FuelCategory.target_carbon_intensities),
                joinedload(FuelCategory.energy_effectiveness_ratio),
            ),
            joinedload(FuelExport.fuel_type).options(
                joinedload(FuelType.energy_density),
                joinedload(FuelType.additional_carbon_intensity),
                joinedload(FuelType.energy_effectiveness_ratio),
            ),
            joinedload(FuelExport.provision_of_the_act),
            joinedload(FuelExport.end_use_type),
        )

    @repo_handler
    async def get_fuel_export_table_options(self, compliancePeriod: str):
        """
        Retrieve Fuel Type and other static data to use them while populating fuel supply form.
        """
        subquery_compliance_period_id = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliancePeriod)
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

        query = (
            select(
                FuelType.fuel_type_id,
                FuelInstance.fuel_instance_id,
                FuelInstance.fuel_category_id,
                FuelType.fuel_type,
                FuelType.fossil_derived,
                FuelType.default_carbon_intensity,
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
            )
            .join(FuelInstance, FuelInstance.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                FuelCategory.fuel_category_id == FuelInstance.fuel_category_id,
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
                EnergyDensity, EnergyDensity.fuel_type_id == FuelType.fuel_type_id
            )
            .outerjoin(UnitOfMeasure, EnergyDensity.uom_id == UnitOfMeasure.uom_id)
            .outerjoin(
                EnergyEffectivenessRatio,
                and_(
                    EnergyEffectivenessRatio.fuel_category_id
                    == FuelCategory.fuel_category_id,
                    EnergyEffectivenessRatio.fuel_type_id == FuelInstance.fuel_type_id,
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
                ),
            )
            .outerjoin(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
        )

        results = (await self.db.execute(query)).all()
        return results

    @repo_handler
    async def get_fuel_export_list(self, compliance_report_id: int) -> List[FuelExport]:
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
            compliance_report_group_uuid=group_uuid
        )

        return effective_fuel_exports

    @repo_handler
    async def get_fuel_exports_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
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
            compliance_report_group_uuid=group_uuid
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
        updated_fuel_export = self.db.merge(fuel_export)
        await self.db.flush()
        await self.db.refresh(
            fuel_export,
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
            ],
        )
        return fuel_export

    @repo_handler
    async def delete_fuel_export(self, fuel_export_id: int):
        """Delete a fuel supply row from the database"""
        await self.db.execute(
            delete(FuelExport).where(FuelExport.fuel_export_id == fuel_export_id)
        )
        await self.db.flush()

    @repo_handler
    async def get_fuel_export_version_by_user(
        self, group_uuid: str, version: int, user_type: UserTypeEnum
    ) -> Optional[FuelExport]:
        """
        Retrieve a specific FuelExport record by group UUID, version, and user_type.
        """
        query = (
            select(FuelExport)
            .where(
                FuelExport.group_uuid == group_uuid,
                FuelExport.version == version,
                FuelExport.user_type == user_type,
            )
            .options(
                joinedload(FuelExport.fuel_code),
                joinedload(FuelExport.fuel_category),
                joinedload(FuelExport.fuel_type),
                joinedload(FuelExport.provision_of_the_act),
                joinedload(FuelExport.end_use_type),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

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
                # FuelExport.user_type == UserTypeEnum.SUPPLIER evaluates to False for GOVERNMENT,
                # thus bringing GOVERNMENT records to the top in the ordered results.
                FuelExport.user_type == UserTypeEnum.SUPPLIER,
                FuelExport.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_effective_fuel_exports(
        self, compliance_report_group_uuid: str
    ) -> List[FuelExport]:
        """
        Retrieve effective FuelExport records associated with the given compliance_report_group_uuid.
        Excludes groups with any DELETE action and selects the highest version and priority.
        """
        # Step 1: Select to get all compliance_report_ids in the specified group
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            ComplianceReport.compliance_report_group_uuid
            == compliance_report_group_uuid
        )

        # Step 2: Select to identify group_uuids that have any DELETE action
        delete_group_select = (
            select(FuelExport.group_uuid)
            .where(
                FuelExport.compliance_report_id.in_(compliance_reports_select),
                FuelExport.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Step 3: Select to find the max version and priority per group_uuid, excluding DELETE groups
        user_type_priority = case(
            (FuelExport.user_type == UserTypeEnum.GOVERNMENT, 1),
            (FuelExport.user_type == UserTypeEnum.SUPPLIER, 0),
            else_=0,
        )

        valid_fuel_exports_select = (
            select(
                FuelExport.group_uuid,
                func.max(FuelExport.version).label("max_version"),
                func.max(user_type_priority).label("max_role_priority"),
            )
            .where(
                FuelExport.compliance_report_id.in_(compliance_reports_select),
                FuelExport.action_type != ActionTypeEnum.DELETE,
                ~FuelExport.group_uuid.in_(delete_group_select),
            )
            .group_by(FuelExport.group_uuid)
        )

        # Now create a subquery for use in the JOIN
        valid_fuel_exports_subq = valid_fuel_exports_select.subquery()

        # Step 4: Main query to retrieve effective FuelExport records
        query = (
            select(FuelExport)
            .options(
                # Load necessary related data
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
                    user_type_priority == valid_fuel_exports_subq.c.max_role_priority,
                ),
            )
        )

        result = await self.db.execute(query)
        fuel_exports = result.unique().scalars().all()

        logger.debug(f"Retrieved {len(fuel_exports)} effective FuelExport records.")
        return fuel_exports
