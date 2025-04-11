import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import and_, or_, select, literal
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from typing import List, Optional, Sequence, Any
from sqlalchemy.dialects.postgresql import array_agg
from sqlalchemy.sql.expression import distinct
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
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema
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

        # Determine legacy years.
        is_legacy_year = current_year < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR)

        # Define conditions for the query based on the legacy flag.
        if is_legacy_year:
            # For legacy years:
            # - Include fuel types marked as legacy or non‑fossil-derived.
            # - Exclude jet fuel from FuelCategory.
            # - For fossil fuels: Accept only provision ID 1.
            # - For non‑fossil fuels: Exclude provision ID 1.
            # - Additionally, enforce that the provision itself is flagged as legacy.
            fuel_instance_condition = or_(
                FuelType.is_legacy == True,
                FuelType.fossil_derived == False,
            )
            fuel_category_condition = FuelCategory.fuel_category_id != 3
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
        else:
            # For non-legacy years:
            # - Only include fuel types that are not legacy.
            # - No special filtering on FuelCategory (jet fuel is included).
            # - For fossil fuels: Accept only provision ID 1.
            # - For non‑fossil fuels: Exclude provision IDs 1 and 8.
            fuel_instance_condition = FuelType.is_legacy == False
            fuel_category_condition = literal(True)  # No extra filtering.
            provision_condition = and_(
                ProvisionOfTheAct.is_legacy == False,  # Only get non-legacy provisions
                or_(
                    and_(
                        FuelType.fossil_derived == True,
                        ProvisionOfTheAct.provision_of_the_act_id == 1,
                    ),
                    and_(
                        FuelType.fossil_derived == False,
                        ProvisionOfTheAct.provision_of_the_act_id.in_(
                            [2, 3]
                        ),  # Only allow these non-legacy provisions for non-fossil fuels
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

    @repo_handler
    async def get_fuel_supply_list(
        self,
        compliance_report_id: int,
        changelog: Optional[bool] = False,
    ) -> List[FuelSupply]:
        """
        Retrieve the list of effective fuel supplies for a given compliance report.
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

        # Retrieve effective fuel supplies using the group UUID,
        effective_fuel_supplies = await self.get_effective_fuel_supplies(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
            changelog=changelog,
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
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return [], 0

        if effective:
            # Retrieve effective fuel supplies using the group UUID
            fuel_supplies = await self.get_effective_fuel_supplies(
                group_uuid,
                compliance_report_id,
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

        delete_group_subquery = (
            select(FuelSupply.group_uuid)
            .where(
                FuelSupply.compliance_report_id == fuel_supply.compliance_report_id,
                FuelSupply.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Type, Category, and Determine CI/Fuel codes are included
        query = select(FuelSupply.fuel_supply_id).where(
            FuelSupply.compliance_report_id == fuel_supply.compliance_report_id,
            FuelSupply.fuel_type_id == fuel_supply.fuel_type_id,
            FuelSupply.fuel_category_id == fuel_supply.fuel_category_id,
            FuelSupply.provision_of_the_act_id == fuel_supply.provision_of_the_act_id,
            FuelSupply.fuel_code_id == fuel_supply.fuel_code_id,
            FuelSupply.group_uuid != fuel_supply.group_uuid,
            FuelSupply.end_use_id == fuel_supply.end_use_id,
            FuelSupply.action_type == ActionTypeEnum.CREATE,
            ~FuelSupply.group_uuid.in_(delete_group_subquery),
            (
                FuelSupply.fuel_supply_id != fuel_supply.fuel_supply_id
                if fuel_supply.fuel_supply_id is not None
                else True
            ),
        )

        result = await self.db.execute(query)
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
        changelog: Optional[bool] = False,
    ) -> Sequence[FuelSupply]:
        """
        Retrieve effective FuelSupply records associated with the given compliance_report_group_uuid.
        For each group_uuid:
            - Exclude the entire group if any record in the group is marked as DELETE.
            - From the remaining groups, select the record with the highest version and highest priority.
        Optionally, exclude fuel supplies associated with draft compliance reports if exclude_draft is True.
        """
        # Step 1: Subquery to get all compliance_report_ids in the specified group
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            ComplianceReport.compliance_report_group_uuid
            == compliance_report_group_uuid
        )

        if compliance_report_id is not None:
            compliance_reports_select = compliance_reports_select.where(
                ComplianceReport.compliance_report_id <= compliance_report_id
            )

        conditions = [FuelSupply.compliance_report_id.in_(compliance_reports_select)]
        if not changelog:
            delete_group_select = (
                select(FuelSupply.group_uuid)
                .where(
                    FuelSupply.compliance_report_id.in_(compliance_reports_select),
                    FuelSupply.action_type == ActionTypeEnum.DELETE,
                )
                .distinct()
            )
            conditions.extend(
                [
                    FuelSupply.action_type != ActionTypeEnum.DELETE,
                    ~FuelSupply.group_uuid.in_(delete_group_select),
                ]
            )

        valid_fuel_supplies_select = (
            select(
                FuelSupply.group_uuid,
                func.max(FuelSupply.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(FuelSupply.group_uuid)
        )
        valid_fuel_supplies_subq = valid_fuel_supplies_select.subquery()

        # Step 4: Main query to retrieve FuelSupply records with necessary eager relationships
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

        # Step 5: Execute the query and retrieve results using unique()
        result = await self.db.execute(query)
        fuel_supplies = result.unique().scalars().all()

        return fuel_supplies
