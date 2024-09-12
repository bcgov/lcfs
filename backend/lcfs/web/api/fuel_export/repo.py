from logging import getLogger
from typing import List
from lcfs.db.models.compliance import CompliancePeriod, FuelExport
from lcfs.db.models.fuel import (
    EnergyDensity,
    EnergyEffectivenessRatio,
    FuelCategory,
    FuelClass,
    FuelCode,
    FuelCodePrefix,
    FuelCodeStatus,
    FuelType,
    ProvisionOfTheAct,
    TargetCarbonIntensity,
    UnitOfMeasure,
    EndUseType,
)
from lcfs.web.api.base import PaginationRequestSchema
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from sqlalchemy import func
from sqlalchemy.orm import joinedload

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
            joinedload(FuelExport.custom_fuel_type),
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
                FuelClass.fuel_class_id,
                FuelClass.fuel_category_id,
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
                func.concat(FuelCodePrefix.prefix, FuelCode.fuel_code).label(
                    "fuel_code"
                ),
                FuelCode.carbon_intensity.label("fuel_code_carbon_intensity"),
            )
            .join(FuelClass, FuelClass.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                FuelCategory.fuel_category_id == FuelClass.fuel_category_id,
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
                    EnergyEffectivenessRatio.fuel_type_id == FuelClass.fuel_type_id,
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
        Retrieve the list of fuel supplied information for a given compliance report.
        """
        query = self.query.where(
            FuelExport.compliance_report_id == compliance_report_id
        )
        results = (await self.db.execute(query)).unique().scalars().all()
        return results

    @repo_handler
    async def get_fuel_exports_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[FuelExport]:
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        query = self.query.where(
            FuelExport.compliance_report_id == compliance_report_id
        )
        count_query = query.with_only_columns(
            func.count(FuelExport.fuel_export_id)
        ).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.offset(offset).limit(limit).order_by(FuelExport.create_date.desc())
        )
        fuel_exports = result.unique().scalars().all()
        return fuel_exports, total_count

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
            fuel_export,
            [
                "fuel_category",
                "fuel_type",
                "provision_of_the_act",
                "custom_fuel_type",
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
                "custom_fuel_type",
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
    async def get_fuel_exports(
        self, report_id: int, is_supplemental: bool = False
    ) -> List[FuelExport]:
        """
        Retrieve the list of fuel supplies for a given report (compliance or supplemental).
        """
        query = select(FuelExport).options(
            joinedload(FuelExport.fuel_code),
            joinedload(FuelExport.fuel_category),
            joinedload(FuelExport.fuel_type),
            joinedload(FuelExport.provision_of_the_act),
            joinedload(FuelExport.custom_fuel_type),
            joinedload(FuelExport.end_use_type),
        )

        if is_supplemental:
            query = query.where(FuelExport.supplemental_report_id == report_id)
        else:
            query = query.where(FuelExport.compliance_report_id == report_id)

        result = await self.db.execute(query)
        return result.scalars().all()
