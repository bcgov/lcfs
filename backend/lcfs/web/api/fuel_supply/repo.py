import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import and_, or_, select, delete, func, cast, String
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
from lcfs.web.api.base import PaginationRequestSchema, camel_to_snake
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

        # Match both new (Section 19) and legacy (Section 6) fuel code provisions
        # so fuel codes are available for both pre-2024 and 2024+ reports
        subquery_fuel_code_provision_ids = (
            select(ProvisionOfTheAct.provision_of_the_act_id).where(
                ProvisionOfTheAct.name.in_(
                    [
                        "Fuel code - section 19 (b) (i)",
                        "Approved fuel code - Section 6 (5) (c)",
                    ]
                )
            )
        )

        try:
            current_year = int(compliance_period)
        except ValueError as e:
            logger.error(
                "Invalid compliance_period: not an integer",
                compliance_period=compliance_period,
                error=str(e),
            )
            # Raise a generic exception so @repo_handler wraps it as DatabaseException
            raise Exception(
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
                FuelType.renewable,
                func.coalesce(
                    DefaultCarbonIntensity.default_carbon_intensity,
                    FuelType.default_carbon_intensity,
                ).label("default_carbon_intensity"),
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
                        # 2024+ fossil-derived: Section 19 prescribed (ID 1) only
                        and_(
                            current_year
                            >= int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                            FuelType.fossil_derived == True,
                            ProvisionOfTheAct.provision_of_the_act_id == 1,
                        ),
                        # 2024+ renewables: anything except Section 19 prescribed (1)
                        # and "Fuel code - section 19 (b) (ii)" duplicate (8).
                        and_(
                            current_year
                            >= int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                            FuelType.fossil_derived == False,
                            ProvisionOfTheAct.provision_of_the_act_id.notin_([1, 8]),
                        ),
                        # Pre-2024 petroleum-based fuel types (is_legacy=True
                        # — Petroleum-based diesel/gasoline, Natural gas-based
                        # gasoline): the prescribed-CI provision is determined by
                        # fuel category, so only one option is valid per fuel —
                        # Gasoline -> Section 6 (5) (a) (ID 4), Diesel ->
                        # Section 6 (5) (b) (ID 5). Offering both for every fuel
                        # created duplicate/invalid pathways (#4435).
                        and_(
                            current_year
                            < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                            FuelType.is_legacy == True,
                            or_(
                                and_(
                                    FuelCategory.category == "Gasoline",
                                    ProvisionOfTheAct.provision_of_the_act_id == 4,
                                ),
                                and_(
                                    FuelCategory.category == "Diesel",
                                    ProvisionOfTheAct.provision_of_the_act_id == 5,
                                ),
                            ),
                        ),
                        # Pre-2024 renewable fuel types (is_legacy=False, reused
                        # across eras): all legacy provisions except the
                        # petroleum-only Prescribed (4, 5) and the modern
                        # Section 19 prescribed (1).
                        and_(
                            current_year
                            < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR),
                            FuelType.is_legacy == False,
                            ProvisionOfTheAct.provision_of_the_act_id.notin_(
                                [1, 4, 5]
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
                    ProvisionOfTheAct.provision_of_the_act_id.in_(
                        subquery_fuel_code_provision_ids
                    ),
                    FuelCode.expiration_date >= start_of_compliance_year,
                    FuelCode.effective_date <= end_of_compliance_year,
                ),
            )
            .outerjoin(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
        )

        include_legacy = current_year < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR)
        if not include_legacy:
            # For 2024+, exclude legacy fuel types and provisions
            query = query.where(
                and_(FuelType.is_legacy == False, ProvisionOfTheAct.is_legacy == False)
            )
        else:
            # For pre-2024:
            # - Exclude Jet fuel category (didn't exist before 2024)
            # - Exclude Fossil-derived fuel types (new in 2024, is_legacy=False but fossil_derived=True)
            # - Only show legacy provisions (Section 6 references, not Section 19)
            # - Renewable naphtha (fuel_type_id=15) was first reportable in the
            #   2022 compliance year; exclude it from 2019-2021 legacy reports.
            renewable_naphtha_fuel_type_id = 15
            renewable_naphtha_min_year = 2022
            extra_filters = [
                FuelCategory.category != "Jet fuel",
                ~and_(FuelType.is_legacy == False, FuelType.fossil_derived == True),
                ProvisionOfTheAct.is_legacy == True,
                # Exclude 2024-era "Other" fuel types from legacy reports
                FuelType.fuel_type.notin_(LCFS_Constants.LEGACY_EXCLUDED_FUEL_TYPES),
            ]
            if current_year < renewable_naphtha_min_year:
                extra_filters.append(
                    FuelType.fuel_type_id != renewable_naphtha_fuel_type_id
                )
            query = query.where(and_(*extra_filters))

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

        # Subquery to get the maximum version for each group_uuid
        max_version_subquery = (
            select(
                FuelSupply.group_uuid, func.max(FuelSupply.version).label("max_version")
            )
            .where(
                FuelSupply.compliance_report_id.in_(related_reports_subquery),
                FuelSupply.action_type.in_(
                    [ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]
                ),
            )
            .group_by(FuelSupply.group_uuid)
        ).subquery()

        # Main duplicate query - only consider latest versions of each group
        duplicate_query = (
            select(FuelSupply.fuel_supply_id)
            .join(
                max_version_subquery,
                and_(
                    FuelSupply.group_uuid == max_version_subquery.c.group_uuid,
                    FuelSupply.version == max_version_subquery.c.max_version,
                ),
            )
            .where(
                FuelSupply.compliance_report_id.in_(related_reports_subquery),
                FuelSupply.fuel_type_id == fuel_supply.fuel_type_id,
                FuelSupply.fuel_category_id == fuel_supply.fuel_category_id,
                FuelSupply.provision_of_the_act_id
                == fuel_supply.provision_of_the_act_id,
                FuelSupply.fuel_code_id == fuel_supply.fuel_code_id,
                FuelSupply.end_use_id == fuel_supply.end_use_id,
                FuelSupply.is_canada_produced == fuel_supply.is_canada_produced,
                FuelSupply.is_q1_supplied == fuel_supply.is_q1_supplied,
                FuelSupply.action_type.in_(
                    [ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]
                ),
                FuelSupply.group_uuid != fuel_supply.group_uuid,
            )
        )

        # Add conditional filter for fuel_supply_id if it exists
        if fuel_supply.fuel_supply_id is not None:
            duplicate_query = duplicate_query.where(
                FuelSupply.fuel_supply_id != fuel_supply.fuel_supply_id
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
    async def get_prev_fuel_supply_by_group_uuid(
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
            .offset(1)  # Skip the first (latest) record
            .limit(1)
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

        # Get groups where the latest version is a DELETE.
        # We check the latest version rather than any version because
        # ETL-migrated TFRS supplemental chains can have DELETE followed
        # by UPDATE on the same group_uuid (not possible in modern LCFS).
        latest_version_per_group = (
            select(
                FuelSupply.group_uuid,
                func.max(FuelSupply.version).label("max_version"),
            )
            .where(FuelSupply.compliance_report_id.in_(compliance_reports_select))
            .group_by(FuelSupply.group_uuid)
        ).subquery()

        deleted_groups = (
            select(FuelSupply.group_uuid)
            .join(
                latest_version_per_group,
                and_(
                    FuelSupply.group_uuid
                    == latest_version_per_group.c.group_uuid,
                    FuelSupply.version
                    == latest_version_per_group.c.max_version,
                ),
            )
            .where(FuelSupply.action_type == ActionTypeEnum.DELETE)
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

    @repo_handler
    async def get_organization_fuel_supply_paginated(
        self, organization_id: int, pagination: PaginationRequestSchema
    ):
        """
        Get paginated fuel supply records for an organization across all compliance reports.
        Returns FuelSupply objects with relationships loaded.
        """
        # Build base query with eager loading of relationships
        query = (
            select(FuelSupply)
            .join(
                ComplianceReport,
                FuelSupply.compliance_report_id == ComplianceReport.compliance_report_id,
            )
            .join(
                CompliancePeriod,
                ComplianceReport.compliance_period_id == CompliancePeriod.compliance_period_id,
            )
            .outerjoin(FuelType, FuelSupply.fuel_type_id == FuelType.fuel_type_id)
            .outerjoin(
                FuelCategory,
                FuelSupply.fuel_category_id == FuelCategory.fuel_category_id,
            )
            .outerjoin(
                ProvisionOfTheAct,
                FuelSupply.provision_of_the_act_id
                == ProvisionOfTheAct.provision_of_the_act_id,
            )
            .outerjoin(FuelCode, FuelSupply.fuel_code_id == FuelCode.fuel_code_id)
            .options(
                joinedload(FuelSupply.fuel_type),
                joinedload(FuelSupply.fuel_category),
                joinedload(FuelSupply.provision_of_the_act),
                joinedload(FuelSupply.fuel_code),
                joinedload(FuelSupply.compliance_report).joinedload(ComplianceReport.compliance_period)
            )
            .where(ComplianceReport.organization_id == organization_id)
            .where(FuelSupply.action_type.in_([ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]))
        )

        # Apply filters if provided
        if pagination.filters:
            for filter_item in pagination.filters:
                field = camel_to_snake(getattr(filter_item, "field", "") or "")
                filter_value = getattr(filter_item, "filter", None)

                if not filter_value:
                    continue

                if field == "compliance_period":
                    query = query.where(
                        CompliancePeriod.description.ilike(f"%{filter_value}%")
                    )
                elif field == "fuel_type":
                    query = query.where(
                        FuelType.fuel_type.ilike(f"%{filter_value}%")
                    )
                elif field == "fuel_category":
                    # category is a Postgres enum; cast to text so ILIKE works
                    # (otherwise the pattern is cast to the enum type and fails).
                    query = query.where(
                        cast(FuelCategory.category, String).ilike(
                            f"%{filter_value}%"
                        )
                    )
                elif field == "provision_of_the_act":
                    query = query.where(
                        ProvisionOfTheAct.name.ilike(f"%{filter_value}%")
                    )
                elif field == "fuel_code":
                    # FuelCode.fuel_code is a Python property (prefix + suffix),
                    # not a column, so it can't be used in SQL. Join the prefix
                    # table and match the concatenated value instead.
                    query = query.join(
                        FuelCodePrefix,
                        FuelCode.prefix_id == FuelCodePrefix.fuel_code_prefix_id,
                    ).where(
                        func.concat(
                            FuelCodePrefix.prefix, FuelCode.fuel_suffix
                        ).ilike(f"%{filter_value}%")
                    )

        # Get total count before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar()

        # Apply sorting
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                field = camel_to_snake(getattr(sort_order, "field", "") or "")
                direction = sort_order.direction

                if field == "compliance_period":
                    sort_column = CompliancePeriod.description
                elif field == "report_submission_date":
                    sort_column = ComplianceReport.update_date
                elif field == "fuel_type":
                    sort_column = FuelType.fuel_type
                elif field == "fuel_category":
                    sort_column = FuelCategory.category
                elif field == "provision_of_the_act":
                    sort_column = ProvisionOfTheAct.name
                elif field == "fuel_code":
                    sort_column = FuelCode.fuel_code
                elif field == "fuel_quantity":
                    sort_column = func.coalesce(FuelSupply.quantity, 0)
                else:
                    continue

                if direction == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())
        else:
            # Default sorting: most recent year first
            query = query.order_by(CompliancePeriod.description.desc())

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        query = query.limit(pagination.size).offset(offset)

        # Execute query
        result = await self.db.execute(query)
        fuel_supplies = result.scalars().all()

        return fuel_supplies, total_count

    @repo_handler
    async def get_organization_fuel_supply_analytics(
        self, organization_id: int, filters: Optional[List] = None
    ):
        """
        Get analytics data for organization fuel supply.
        Calculates totals by fuel type, year, category, and provision.
        """
        # Base query - get all fuel supplies with relationships
        query = (
            select(FuelSupply)
            .join(
                ComplianceReport,
                FuelSupply.compliance_report_id == ComplianceReport.compliance_report_id,
            )
            .join(
                CompliancePeriod,
                ComplianceReport.compliance_period_id == CompliancePeriod.compliance_period_id,
            )
            .outerjoin(FuelType, FuelSupply.fuel_type_id == FuelType.fuel_type_id)
            .outerjoin(
                FuelCategory,
                FuelSupply.fuel_category_id == FuelCategory.fuel_category_id,
            )
            .outerjoin(
                ProvisionOfTheAct,
                FuelSupply.provision_of_the_act_id
                == ProvisionOfTheAct.provision_of_the_act_id,
            )
            .outerjoin(FuelCode, FuelSupply.fuel_code_id == FuelCode.fuel_code_id)
            .options(
                joinedload(FuelSupply.fuel_type),
                joinedload(FuelSupply.fuel_category),
                joinedload(FuelSupply.provision_of_the_act),
                joinedload(FuelSupply.fuel_code).joinedload(
                    FuelCode.fuel_code_prefix
                ),
                joinedload(FuelSupply.compliance_report).joinedload(
                    ComplianceReport.compliance_period
                ),
            )
            .where(ComplianceReport.organization_id == organization_id)
            .where(
                FuelSupply.action_type.in_(
                    [ActionTypeEnum.CREATE, ActionTypeEnum.UPDATE]
                )
            )
        )

        selected_year_filter = None

        # Apply filters if provided. Keep compliance_period as a selected year for
        # YoY calculations instead of limiting the analytics query to one year.
        if filters:
            for filter_item in filters:
                field = camel_to_snake(getattr(filter_item, "field", "") or "")
                filter_value = getattr(filter_item, "filter", None)

                if not filter_value:
                    continue

                # The base query already outerjoins each of these tables, so the
                # filters only add a WHERE clause. Re-joining (e.g.
                # ``query.join(FuelType)``) emits a second, unaliased join of the
                # same table — SQLAlchemy infers it off the most recent entity
                # (fuel_code) — which Postgres rejects with
                # "table name ... specified more than once" (issue #4601).
                if field == "compliance_period":
                    selected_year_filter = str(filter_value)
                elif field == "fuel_type":
                    query = query.where(
                        FuelType.fuel_type.ilike(f"%{filter_value}%")
                    )
                elif field == "fuel_category":
                    # category is a Postgres enum; cast to text so ILIKE works
                    # (otherwise the pattern is cast to the enum type and fails).
                    query = query.where(
                        cast(FuelCategory.category, String).ilike(
                            f"%{filter_value}%"
                        )
                    )
                elif field == "provision_of_the_act":
                    query = query.where(
                        ProvisionOfTheAct.name.ilike(f"%{filter_value}%")
                    )
                elif field == "fuel_code":
                    # FuelCode.fuel_code is a Python property (prefix + suffix),
                    # not a column, so it can't be used in SQL. Join the prefix
                    # table and match the concatenated value instead.
                    query = query.join(
                        FuelCodePrefix,
                        FuelCode.prefix_id == FuelCodePrefix.fuel_code_prefix_id,
                    ).where(
                        func.concat(
                            FuelCodePrefix.prefix, FuelCode.fuel_suffix
                        ).ilike(f"%{filter_value}%")
                    )

        # Execute query
        result = await self.db.execute(query)
        all_fuel_supplies = result.scalars().all()

        def _quantity(fuel_supply):
            return (
                fuel_supply.quantity
                if fuel_supply.quantity is not None
                else (
                    (fuel_supply.q1_quantity or 0)
                    + (fuel_supply.q2_quantity or 0)
                    + (fuel_supply.q3_quantity or 0)
                    + (fuel_supply.q4_quantity or 0)
                )
            )

        def _pct_change(current, previous):
            if previous in (None, 0):
                return None
            return round(((current - previous) / previous) * 100, 2)

        def _share(part, total):
            if not total:
                return None
            return round((part / total) * 100, 2)

        def _round(value, digits=2):
            if value is None:
                return None
            return round(float(value), digits)

        # Calculate analytics from FuelSupply objects
        total_volume = 0
        fuel_types_set = set()
        submission_dates_set = set()
        total_by_fuel_type = {}
        total_by_year = {}
        total_by_fuel_category = {}
        total_by_provision = {}
        total_by_fuel_code = {}
        yearly = {}
        yearly_fuel_type = {}

        for fs in all_fuel_supplies:
            quantity = _quantity(fs)
            compliance_units = float(fs.compliance_units or 0)
            year = fs.compliance_report.compliance_period.description
            include_in_filtered_totals = (
                selected_year_filter is None or year == selected_year_filter
            )

            if include_in_filtered_totals:
                total_volume += quantity

                # Track unique fuel types
                fuel_types_set.add(fs.fuel_type.fuel_type)

                # Track submission dates
                if fs.compliance_report.update_date:
                    submission_dates_set.add(fs.compliance_report.update_date)

                # Aggregate by fuel type
                fuel_type_name = fs.fuel_type.fuel_type
                total_by_fuel_type[fuel_type_name] = (
                    total_by_fuel_type.get(fuel_type_name, 0) + quantity
                )

                # Aggregate by year
                total_by_year[year] = total_by_year.get(year, 0) + quantity

                # Aggregate by category
                category = fs.fuel_category.category
                total_by_fuel_category[category] = (
                    total_by_fuel_category.get(category, 0) + quantity
                )

                # Aggregate by provision
                provision = fs.provision_of_the_act.name
                total_by_provision[provision] = (
                    total_by_provision.get(provision, 0) + quantity
                )

                if fs.fuel_code:
                    fuel_code = fs.fuel_code.fuel_code
                    total_by_fuel_code[fuel_code] = (
                        total_by_fuel_code.get(fuel_code, 0) + quantity
                    )

            category = fs.fuel_category.category
            yearly.setdefault(
                year,
                {
                    "total_volume": 0,
                    "total_compliance_units": 0,
                    "positive_compliance_units": 0,
                    "zero_or_negative_compliance_units": 0,
                    "positive_cu_volume": 0,
                    "non_positive_cu_volume": 0,
                },
            )
            yearly[year]["total_volume"] += quantity
            yearly[year]["total_compliance_units"] += compliance_units
            if compliance_units > 0:
                yearly[year]["positive_compliance_units"] += compliance_units
                yearly[year]["positive_cu_volume"] += quantity
            else:
                yearly[year][
                    "zero_or_negative_compliance_units"
                ] += compliance_units
                yearly[year]["non_positive_cu_volume"] += quantity

            fuel_type_name = fs.fuel_type.fuel_type
            yearly_fuel_type.setdefault(year, {})
            yearly_fuel_type[year].setdefault(
                fuel_type_name,
                {
                    "fuel_type": fuel_type_name,
                    "fuel_category": category,
                    "total_volume": 0,
                    "total_compliance_units": 0,
                    "positive_compliance_units": False,
                    "renewable": bool(getattr(fs.fuel_type, "renewable", False)),
                    "fossil_derived": bool(
                        getattr(fs.fuel_type, "fossil_derived", False)
                    ),
                },
            )
            yearly_fuel_type[year][fuel_type_name]["total_volume"] += quantity
            yearly_fuel_type[year][fuel_type_name][
                "total_compliance_units"
            ] += compliance_units
            if compliance_units > 0:
                yearly_fuel_type[year][fuel_type_name][
                    "positive_compliance_units"
                ] = True

        # Calculate most recent submission
        most_recent_submission = max(submission_dates_set).isoformat() if submission_dates_set else None

        sorted_years = sorted(
            [year for year in yearly.keys() if str(year).isdigit()],
            key=lambda value: int(value),
        )
        selected_year = (
            selected_year_filter
            if selected_year_filter in yearly
            else (sorted_years[-1] if sorted_years else None)
        )
        selected_year_index = (
            sorted_years.index(selected_year)
            if selected_year is not None and selected_year in sorted_years
            else -1
        )
        prior_year = (
            sorted_years[selected_year_index - 1] if selected_year_index > 0 else None
        )

        current_year_data = yearly.get(selected_year, {})
        prior_year_data = yearly.get(prior_year, {})
        current_volume = current_year_data.get("total_volume", 0)
        prior_volume = prior_year_data.get("total_volume", 0)
        current_compliance_units = current_year_data.get("total_compliance_units", 0)
        prior_compliance_units = prior_year_data.get("total_compliance_units", 0)
        current_compliance_units_per_unit = (
            _round(current_compliance_units / current_volume, 6)
            if current_volume
            else None
        )
        prior_compliance_units_per_unit = (
            _round(prior_compliance_units / prior_volume, 6)
            if prior_volume
            else None
        )

        fuel_type_yoy = []
        current_fuel_types = yearly_fuel_type.get(selected_year, {})
        prior_fuel_types = yearly_fuel_type.get(prior_year, {})
        all_fuel_type_names = sorted(
            set(current_fuel_types.keys()) | set(prior_fuel_types.keys())
        )
        for fuel_type_name in all_fuel_type_names:
            current_type = current_fuel_types.get(fuel_type_name, {})
            prior_type = prior_fuel_types.get(fuel_type_name, {})
            current_type_volume = current_type.get("total_volume", 0)
            prior_type_volume = prior_type.get("total_volume", 0)
            if current_type_volume == 0 and prior_type_volume == 0:
                continue
            fuel_type_yoy.append(
                {
                    "fuelType": fuel_type_name,
                    "fuelCategory": current_type.get(
                        "fuel_category", prior_type.get("fuel_category")
                    ),
                    "totalVolume": current_type_volume,
                    "priorYearVolume": prior_type_volume or None,
                    "volumeChange": current_type_volume - prior_type_volume,
                    "pctChangeYoy": _pct_change(
                        current_type_volume, prior_type_volume
                    ),
                    "totalComplianceUnits": _round(
                        current_type.get("total_compliance_units", 0)
                    ),
                    "positiveComplianceUnits": current_type.get(
                        "positive_compliance_units", False
                    ),
                    "isNew": current_type_volume > 0 and prior_type_volume == 0,
                    "isDiscontinued": current_type_volume == 0
                    and prior_type_volume > 0,
                    "renewable": current_type.get(
                        "renewable", prior_type.get("renewable", False)
                    ),
                    "fossilDerived": current_type.get(
                        "fossil_derived", prior_type.get("fossil_derived", False)
                    ),
                }
            )

        fuel_type_yoy.sort(
            key=lambda row: abs(row["pctChangeYoy"] or 0), reverse=True
        )
        negative_yoy_count = len(
            [
                row
                for row in fuel_type_yoy
                if row["priorYearVolume"] not in (None, 0)
                and row["totalVolume"] < row["priorYearVolume"]
            ]
        )
        new_fuel_types = [row for row in fuel_type_yoy if row["isNew"]]
        biggest_single_mover = next(
            (row for row in fuel_type_yoy if row["pctChangeYoy"] is not None), None
        )

        compliance_unit_credit_debit_trend = []
        compliance_units_per_unit_trend = []
        fuel_type_volume_trend = []
        top_fuel_codes = [
            {"fuelCode": fuel_code, "totalVolume": volume}
            for fuel_code, volume in sorted(
                total_by_fuel_code.items(), key=lambda item: item[1], reverse=True
            )[:10]
        ]
        for year in sorted_years:
            year_data = yearly[year]
            year_volume = year_data["total_volume"]
            compliance_unit_credit_debit_trend.extend(
                [
                    {
                        "reportingYear": year,
                        "complianceUnitGroup": "Positive compliance units",
                        "complianceUnits": _round(
                            year_data["positive_compliance_units"]
                        ),
                    },
                    {
                        "reportingYear": year,
                        "complianceUnitGroup": "Zero or negative compliance units",
                        "complianceUnits": _round(
                            year_data["zero_or_negative_compliance_units"]
                        ),
                    },
                ]
            )
            compliance_units_per_unit_trend.append(
                {
                    "reportingYear": year,
                    "complianceUnitsPerUnitSupply": _round(
                        year_data["total_compliance_units"] / year_volume, 6
                    )
                    if year_volume
                    else None,
                }
            )
            for fuel_type_name, fuel_type_data in yearly_fuel_type.get(
                year, {}
            ).items():
                fuel_type_volume_trend.append(
                    {
                        "reportingYear": year,
                        "fuelType": fuel_type_name,
                        "fuelCategory": fuel_type_data.get("fuel_category"),
                        "totalVolume": fuel_type_data.get("total_volume", 0),
                    }
                )

        return {
            "total_volume": total_volume,
            "total_fuel_types": len(fuel_types_set),
            "total_reports": len(submission_dates_set),
            "most_recent_submission": most_recent_submission,
            "total_by_fuel_type": total_by_fuel_type,
            "total_by_year": total_by_year,
            "total_by_fuel_category": total_by_fuel_category,
            "total_by_provision": total_by_provision,
            "selected_year_summary": {
                "reportingYear": selected_year,
                "priorYear": prior_year,
                "totalVolume": current_volume,
                "priorYearVolume": prior_volume or None,
                "volumeChange": current_volume - prior_volume,
                "volumePctChangeYoy": _pct_change(current_volume, prior_volume),
                "totalComplianceUnits": _round(current_compliance_units),
                "priorYearComplianceUnits": _round(prior_compliance_units)
                if prior_year
                else None,
                "complianceUnitsChange": _round(
                    current_compliance_units - prior_compliance_units
                )
                if prior_year
                else None,
                "complianceUnitsPctChangeYoy": _pct_change(
                    current_compliance_units, prior_compliance_units
                ),
                "complianceUnitsPerUnitSupply": current_compliance_units_per_unit,
                "priorYearComplianceUnitsPerUnitSupply": prior_compliance_units_per_unit,
                "complianceUnitsPerUnitSupplyChange": _round(
                    current_compliance_units_per_unit
                    - prior_compliance_units_per_unit,
                    6,
                )
                if current_compliance_units_per_unit is not None
                and prior_compliance_units_per_unit is not None
                else None,
                "negativeYoyFuelTypeCount": negative_yoy_count,
                "newFuelTypeCount": len(new_fuel_types),
                "newFuelTypes": [row["fuelType"] for row in new_fuel_types],
                "biggestSingleMover": biggest_single_mover,
            },
            "fuel_type_yoy": fuel_type_yoy,
            "compliance_unit_credit_debit_trend": compliance_unit_credit_debit_trend,
            "compliance_units_per_unit_trend": compliance_units_per_unit_trend,
            "fuel_type_volume_trend": fuel_type_volume_trend,
            "top_fuel_codes": top_fuel_codes,
        }
