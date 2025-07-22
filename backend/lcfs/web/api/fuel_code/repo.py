from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Dict, Any, Union, Optional, Sequence

import structlog
from fastapi import Depends
from sqlalchemy import and_, or_, select, func, text, update, distinct, desc, asc
from sqlalchemy.sql.functions import coalesce
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager, selectinload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.fuel import CategoryCarbonIntensity, DefaultCarbonIntensity
from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelInstance import FuelInstance
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.TargetCarbonIntensity import TargetCarbonIntensity
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.db.models.fuel.FuelCodeListView import FuelCodeListView
from lcfs.web.api.base import (
    PaginationRequestSchema,
    get_field_for_filter,
    apply_filter_conditions,
)
from lcfs.web.api.fuel_code.schema import FuelCodeCloneSchema, FuelCodeSchema
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


@dataclass
class CarbonIntensityResult:
    effective_carbon_intensity: float
    target_ci: float | None
    eer: float
    energy_density: float | None
    uci: float | None


class FuelCodeRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fuel_types(self, include_legacy=False) -> List[FuelType]:
        stmt = select(FuelType).options(
            joinedload(FuelType.provision_1),
            joinedload(FuelType.provision_2),
        )

        # Conditionally add the legacy filter
        if not include_legacy:
            stmt = stmt.where(FuelType.is_legacy == False)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    @repo_handler
    async def get_compliance_period_id(self, compliance_period: str) -> int:
        stmt = select(CompliancePeriod.compliance_period_id).where(
            CompliancePeriod.description == compliance_period
        )
        result = await self.db.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"No compliance period found: {compliance_period}")
        return row

    @repo_handler
    async def get_formatted_fuel_types(
        self, include_legacy=False, compliance_period: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all fuel type options with their associated fuel categories and fuel codes"""
        # Get compliance period ID if provided
        compliance_period_id = None
        if compliance_period:
            compliance_period_id = await self.get_compliance_period_id(
                compliance_period
            )

        # Define the filtering conditions for fuel codes
        current_date = date.today()
        fuel_code_filters = or_(
            FuelCode.effective_date == None, FuelCode.effective_date <= current_date
        ) & or_(
            FuelCode.expiration_date == None, FuelCode.expiration_date > current_date
        )

        conditions = [fuel_code_filters]

        # If we don't want to include legacy fuel types, filter them out
        if not include_legacy:
            conditions.append(FuelType.is_legacy == False)

        # Build the query with filtered fuel_codes and compliance period joins
        query = (
            select(FuelType)
            .outerjoin(FuelType.fuel_instances)
            .outerjoin(FuelInstance.fuel_category)
            .outerjoin(FuelType.fuel_codes)
        )

        # Add compliance period dependent joins if period is provided
        if compliance_period_id:
            query = (
                query.outerjoin(
                    EnergyDensity,
                    and_(
                        EnergyDensity.fuel_type_id == FuelType.fuel_type_id,
                        EnergyDensity.compliance_period_id == compliance_period_id,
                    ),
                )
                .outerjoin(
                    EnergyEffectivenessRatio,
                    and_(
                        EnergyEffectivenessRatio.fuel_type_id == FuelType.fuel_type_id,
                        EnergyEffectivenessRatio.compliance_period_id
                        == compliance_period_id,
                        EnergyEffectivenessRatio.fuel_category_id
                        == FuelCategory.fuel_category_id,
                    ),
                )
                .outerjoin(
                    DefaultCarbonIntensity,
                    and_(
                        DefaultCarbonIntensity.fuel_type_id == FuelType.fuel_type_id,
                        DefaultCarbonIntensity.compliance_period_id
                        == compliance_period_id,
                    ),
                )
            )

        query = query.where(and_(*conditions)).options(
            contains_eager(FuelType.fuel_instances).contains_eager(
                FuelInstance.fuel_category
            ),
            contains_eager(FuelType.fuel_codes),
            joinedload(FuelType.provision_1),
            joinedload(FuelType.provision_2),
            joinedload(FuelType.default_carbon_intensities),
        )

        result = await self.db.execute(query)
        fuel_types = result.unique().scalars().all()

        # Prepare the data in the format matching your schema
        formatted_fuel_types = []
        for fuel_type in fuel_types:
            formatted_fuel_type = {
                "fuel_type_id": fuel_type.fuel_type_id,
                "fuel_type": fuel_type.fuel_type,
                "default_carbon_intensity": fuel_type.default_carbon_intensity,
                "units": fuel_type.units if fuel_type.units else None,
                "unrecognized": fuel_type.unrecognized,
                "fuel_categories": [
                    {
                        "fuel_category_id": fc.fuel_category.fuel_category_id,
                        "category": fc.fuel_category.category,
                    }
                    for fc in fuel_type.fuel_instances
                ],
                "fuel_codes": [
                    {
                        "fuel_code_id": fc.fuel_code_id,
                        "fuel_code": fc.fuel_code,
                        "carbon_intensity": fc.carbon_intensity,
                        "fuel_production_facility_country": fc.fuel_production_facility_country,
                    }
                    for fc in fuel_type.fuel_codes
                ],
                "provision_of_the_act": [],
            }

            if fuel_type.provision_1:
                formatted_fuel_type["provision_of_the_act"].append(
                    {
                        "provision_of_the_act_id": fuel_type.provision_1_id,
                        "name": fuel_type.provision_1.name,
                    }
                )

            if fuel_type.provision_2:
                formatted_fuel_type["provision_of_the_act"].append(
                    {
                        "provision_of_the_act_id": fuel_type.provision_2_id,
                        "name": fuel_type.provision_2.name,
                    }
                )
            formatted_fuel_types.append(formatted_fuel_type)

        return formatted_fuel_types

    @repo_handler
    async def get_fuel_type_by_name(self, fuel_type_name: str) -> FuelType:
        """Get fuel type by name"""
        stmt = select(FuelType).where(FuelType.fuel_type == fuel_type_name)
        result = await self.db.execute(stmt)
        fuel_type = result.scalars().first()
        if not fuel_type:
            raise ValueError(f"Fuel type '{fuel_type_name}' not found")
        return fuel_type

    @repo_handler
    async def get_fuel_type_by_id(self, fuel_type_id: int) -> FuelType:
        """Get fuel type by ID"""
        result = await self.db.get_one(
            FuelType,
            fuel_type_id,
            options=[
                joinedload(FuelType.energy_density),
                joinedload(FuelType.energy_effectiveness_ratio),
            ],
        )
        if not result:
            raise ValueError(f"Fuel type with ID '{fuel_type_id}' not found")
        return result

    @repo_handler
    async def get_fuel_categories(self) -> List[FuelCategory]:
        """Get all fuel category options"""
        return (await self.db.execute(select(FuelCategory))).scalars().all()

    @repo_handler
    async def get_fuel_category_by(self, **filters: Any) -> FuelCategory:
        """Get a fuel category by any filters"""
        result = await self.db.execute(select(FuelCategory).filter_by(**filters))
        return result.scalar_one_or_none()

    @repo_handler
    async def get_transport_modes(self) -> List[TransportMode]:
        """Get all transport mode options"""
        return (await self.db.execute(select(TransportMode))).scalars().all()

    @repo_handler
    async def get_transport_mode(self, transport_mode_id: int) -> TransportMode:
        return await self.db.scalar(
            select(TransportMode).where(
                TransportMode.transport_mode_id == transport_mode_id
            )
        )

    @repo_handler
    async def get_transport_mode_by_name(self, mode_name: str) -> TransportMode:
        query = select(TransportMode).where(TransportMode.transport_mode == mode_name)
        result = await self.db.execute(query)
        transport_mode = result.scalar_one()

        return transport_mode

    @repo_handler
    async def get_fuel_code_prefixes(self) -> List[FuelCodePrefix]:
        """Get all fuel code prefix options"""
        return (await self.db.execute(select(FuelCodePrefix))).scalars().all()

    @repo_handler
    async def get_fuel_code_prefix(self, prefix_id: int) -> FuelCodePrefix:
        """Get fuel code prefix"""
        return await self.db.get_one(FuelCodePrefix, prefix_id)

    @repo_handler
    async def get_fuel_status_by_status(
        self, status: Union[str, FuelCodeStatusEnum]
    ) -> FuelCodeStatus:
        """Get fuel status by name"""
        return (
            await self.db.execute(select(FuelCodeStatus).filter_by(status=status))
        ).scalar()

    @repo_handler
    async def get_energy_densities(self) -> List[EnergyDensity]:
        """Get all energy densities"""
        return (
            (
                await self.db.execute(
                    select(EnergyDensity).options(
                        joinedload(EnergyDensity.fuel_type),
                        joinedload(EnergyDensity.uom),
                    )
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_energy_density(
        self, fuel_type_id: int, compliance_period_id: int
    ) -> EnergyDensity:
        """Get the energy density for the specified fuel_type_id"""
        stmt = (
            select(EnergyDensity)
            .where(
                and_(
                    EnergyDensity.fuel_type_id == fuel_type_id,
                    EnergyDensity.compliance_period_id <= compliance_period_id,
                )
            )
            .order_by(desc(EnergyDensity.compliance_period_id))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        energy_density = result.scalars().first()

        return energy_density

    @repo_handler
    async def get_energy_effectiveness_ratios(self) -> List[EnergyEffectivenessRatio]:
        """Get all energy effectiveness ratios"""
        return (
            (
                await self.db.execute(
                    select(EnergyEffectivenessRatio).options(
                        joinedload(EnergyEffectivenessRatio.fuel_category),
                        joinedload(EnergyEffectivenessRatio.fuel_type),
                        joinedload(EnergyEffectivenessRatio.end_use_type),
                    )
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_units_of_measure(self) -> List[UnitOfMeasure]:
        """Get all unit of measure options"""
        return (await self.db.execute(select(UnitOfMeasure))).scalars().all()

    @repo_handler
    async def get_expected_use_types(self) -> List[ExpectedUseType]:
        """Get all expected use options"""
        return (await self.db.execute(select(ExpectedUseType))).scalars().all()

    @repo_handler
    async def get_expected_use_type_by_name(self, name: str) -> ExpectedUseType:
        """Get a expected use by its name"""
        result = await self.db.execute(select(ExpectedUseType).filter_by(name=name))
        return result.scalar_one_or_none()

    @repo_handler
    async def get_fuel_codes_paginated(
        self, pagination: PaginationRequestSchema
    ) -> tuple[Sequence[FuelCode], int]:
        """
        Queries fuel codes from the database with optional filters. Supports pagination and sorting.

        Args:
            pagination (dict): Pagination and sorting parameters.

        Returns:
            List[FuelCodeBaseSchema]: A list of fuel codes matching the query.
        """
        conditions = []
        query = select(FuelCodeListView)
        for filter in pagination.filters:

            filter_value = filter.filter
            if filter.filter_type == "date":
                if filter.type == "inRange":
                    filter_value = [filter.date_from, filter.date_to]
                else:
                    filter_value = filter.date_from

            filter_option = filter.type
            filter_type = filter.filter_type

            # Handle transport mode filters - these are array fields in the view
            if filter.field in [
                "feedstock_fuel_transport_modes",
                "finished_fuel_transport_modes",
            ]:
                field = get_field_for_filter(FuelCodeListView, filter.field)
                conditions.append(field.any(filter_value))
                continue
            else:
                # Use the view field directly
                field = get_field_for_filter(FuelCodeListView, filter.field)

            conditions.append(
                apply_filter_conditions(field, filter_value, filter_option, filter_type)
            )

        # setup pagination
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        # Construct the base query with conditions
        base_query = query.where(and_(*conditions))

        # Execute the count query - use select(func.count()) from the filtered base query
        count_query = select(func.count()).select_from(base_query.subquery())
        total_count = (await self.db.execute(count_query)).scalar()

        # Apply sorting to the main query
        for order in pagination.sort_orders:
            direction = asc if order.direction == "asc" else desc
            field = getattr(FuelCodeListView, order.field)
            base_query = base_query.order_by(direction(field))
        # Apply default sort order
        base_query = base_query.order_by(desc(FuelCodeListView.last_updated))

        # Execute the main query to retrieve all fuel codes
        result = await self.db.execute(base_query.offset(offset).limit(limit))
        fuel_codes = result.unique().scalars().all()
        return fuel_codes, total_count

    @repo_handler
    async def get_fuel_code_statuses(self):
        query = select(FuelCodeStatus).order_by(asc(FuelCodeStatus.display_order))
        status_results = await self.db.execute(query)
        return status_results.scalars().all()

    @repo_handler
    async def create_fuel_code(self, fuel_code: FuelCode) -> FuelCode:
        """
        Saves a new fuel code to the database.

        Args:
            fuel_code (FuelCodeSchema): A fuel code to be saved.
        """
        self.db.add(fuel_code)
        await self.db.flush()
        result = await self.get_fuel_code(fuel_code.fuel_code_id)
        return result

    @repo_handler
    async def get_fuel_code(self, fuel_code_id: int) -> FuelCode:
        return await self.db.scalar(
            select(FuelCode)
            .options(
                joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                    FeedstockFuelTransportMode.feedstock_fuel_transport_mode
                ),
                joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                    FinishedFuelTransportMode.finished_fuel_transport_mode
                ),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_2),
            )
            .where(FuelCode.fuel_code_id == fuel_code_id)
        )

    @repo_handler
    async def get_fuel_code_status(
        self, fuel_code_status: FuelCodeStatusEnum
    ) -> FuelCodeStatus:
        return await self.db.scalar(
            select(FuelCodeStatus).where(FuelCodeStatus.status == fuel_code_status)
        )

    @repo_handler
    async def update_fuel_code(self, fuel_code: FuelCode) -> FuelCodeSchema:

        await self.db.flush()
        await self.db.refresh(fuel_code)

        return FuelCodeSchema.model_validate(fuel_code)

    @repo_handler
    async def delete_fuel_code(self, fuel_code_id: int):
        delete_status = await self.get_fuel_status_by_status(FuelCodeStatusEnum.Deleted)
        await self.db.execute(
            update(FuelCode)
            .where(FuelCode.fuel_code_id == fuel_code_id)
            .values(fuel_status_id=delete_status.fuel_code_status_id)
        )

    @repo_handler
    async def get_distinct_company_names(self, company: str) -> List[str]:
        query = (
            select(distinct(FuelCode.company))
            .where(func.lower(FuelCode.company).like(func.lower(company + "%")))
            .order_by(FuelCode.company)
            .limit(10)
        )
        return (await self.db.execute(query)).scalars().all()

    @repo_handler
    async def get_contact_names_by_company(
        self, company: str, contact_name: str
    ) -> List[str]:
        query = (
            select(distinct(FuelCode.contact_name))
            .where(
                and_(
                    func.lower(FuelCode.company) == func.lower(company),
                    func.lower(FuelCode.contact_name).like(
                        func.lower(contact_name + "%")
                    ),
                )
            )
            .order_by(FuelCode.contact_name)
            .limit(10)
        )
        return (await self.db.execute(query)).scalars().all()

    @repo_handler
    async def get_contact_email_by_company_and_name(
        self, company: str, contact_name: str, contact_email: str
    ) -> List[str]:
        query = (
            select(distinct(FuelCode.contact_email))
            .where(
                and_(
                    func.lower(FuelCode.company) == func.lower(company),
                    func.lower(FuelCode.contact_name) == func.lower(contact_name),
                ),
                func.lower(FuelCode.contact_email).like(
                    func.lower(contact_email + "%")
                ),
            )
            .order_by(FuelCode.contact_email)
            .limit(10)
        )
        return (await self.db.execute(query)).scalars().all()

    @repo_handler
    async def get_fp_facility_location_by_name(
        self,
        city: Optional[str] = None,
        province: Optional[str] = None,
        country: Optional[str] = None,
    ) -> List[str]:
        """
        Fetch fuel production locations dynamically based on provided filters.

        - If `city` is provided → Returns "city, province, country"
        - If `province` is provided → Returns "province, country"
        - If `country` is provided → Returns "country"
        """
        # Start building the query
        stmt = select()

        if city:
            stmt = stmt.add_columns(
                func.concat(
                    coalesce(FuelCode.fuel_production_facility_city, ""),
                    ", ",
                    coalesce(FuelCode.fuel_production_facility_province_state, ""),
                    ", ",
                    coalesce(FuelCode.fuel_production_facility_country, ""),
                ).label("location")
            ).filter(FuelCode.fuel_production_facility_city.ilike(f"%{city}%"))

        elif province:
            stmt = stmt.add_columns(
                func.concat(
                    coalesce(FuelCode.fuel_production_facility_province_state, ""),
                    ", ",
                    coalesce(FuelCode.fuel_production_facility_country, ""),
                ).label("location")
            ).filter(
                FuelCode.fuel_production_facility_province_state.ilike(f"%{province}%")
            )

        elif country:
            stmt = stmt.add_columns(
                coalesce(FuelCode.fuel_production_facility_country, "").label(
                    "location"
                )
            ).filter(FuelCode.fuel_production_facility_country.ilike(f"%{country}%"))

        else:
            return []  # If no filter is provided, return an empty list.

        # Ensure uniqueness and limit results
        stmt = stmt.distinct().limit(10)

        # Execute query
        result = await self.db.execute(stmt)
        return [row[0] for row in result.unique().all()]

    @repo_handler
    async def get_distinct_fuel_codes_by_code(
        self, fuel_code: str, prefix: str
    ) -> List[str]:
        query = (
            select(distinct(FuelCode.fuel_suffix))
            .join(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
            .where(
                and_(
                    FuelCode.fuel_suffix.like(fuel_code + "%"),
                    func.lower(FuelCodePrefix.prefix) == func.lower(prefix),
                    FuelCodeStatus.status != FuelCodeStatusEnum.Deleted,
                )
            )
            .order_by(FuelCode.fuel_suffix)
            .limit(10)
        )

        return (await self.db.execute(query)).scalars().all()

    @repo_handler
    async def get_fuel_code_by_code_prefix(
        self, fuel_suffix: str, prefix: str
    ) -> list[FuelCodeCloneSchema]:
        query = (
            select(FuelCode)
            .options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_2),
                joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                    FeedstockFuelTransportMode.feedstock_fuel_transport_mode
                ),
                joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                    FinishedFuelTransportMode.finished_fuel_transport_mode
                ),
            )
            .where(
                and_(
                    FuelCode.fuel_suffix == fuel_suffix,
                    FuelCodePrefix.prefix == prefix,
                    FuelCodeStatus.status != FuelCodeStatusEnum.Deleted,
                )
            )
        )
        fuel_code_main_version = fuel_suffix.split(".")[0]
        results = (await self.db.execute(query)).unique().scalars().all()
        next_suffix = await self.get_next_available_sub_version_fuel_code_by_prefix(
            fuel_code_main_version, prefix
        )
        if results is None or len(results) < 1:
            fc = FuelCodeCloneSchema(fuel_suffix=next_suffix, prefix=prefix)
            return [fc]
        else:
            fuel_code_results = []
            for fuel_code in results:
                fc = FuelCodeCloneSchema.model_validate(fuel_code)
                fc.fuel_suffix = next_suffix
                fuel_code_results.append(fc)
            return fuel_code_results

    def format_decimal(self, value):
        parts = str(value).split(".")
        # Format the integer part to always have 3 digits
        formatted_integer = f"{int(parts[0]):03d}"
        if len(parts) > 1:
            return f"{formatted_integer}.{parts[1]}"
        else:
            return formatted_integer

    @repo_handler
    async def validate_fuel_code(self, suffix: str, prefix_id: int) -> str:
        # check if the fuel_code already exists
        query = (
            select(FuelCode)
            .join(FuelCode.fuel_code_prefix)
            .join(FuelCode.fuel_code_status)
            .options(joinedload(FuelCode.fuel_code_prefix))
            .where(
                and_(
                    FuelCode.fuel_suffix == suffix,
                    FuelCodePrefix.fuel_code_prefix_id == prefix_id,
                    FuelCodeStatus.status != FuelCodeStatusEnum.Deleted,
                )
            )
        )
        result = (await self.db.execute(query)).scalar_one_or_none()
        if result:
            fuel_code_main_version = suffix.split(".")[0]
            suffix = await self.get_next_available_sub_version_fuel_code_by_prefix(
                fuel_code_main_version, prefix_id
            )
            if int(suffix.split(".")[1]) > 9:
                return await self.get_next_available_fuel_code_by_prefix(
                    result.fuel_code_prefix.prefix
                )
            return suffix
        else:
            return suffix

    @repo_handler
    async def get_next_available_fuel_code_by_prefix(self, prefix: str) -> str:
        query = text(
            """
            WITH parsed_codes AS (
                SELECT SPLIT_PART(fc.fuel_suffix, '.', 1)::INTEGER AS base_code
                FROM fuel_code fc
                JOIN fuel_code_prefix fcp ON fcp.fuel_code_prefix_id = fc.prefix_id
                WHERE fcp.prefix = :prefix
            ),
            range_params AS (
                SELECT
                    CASE
                        WHEN :prefix = 'PROXY' THEN 1
                        ELSE 101
                    END AS min_code
            ),
            all_possible_codes AS (
                SELECT generate_series(
                    (SELECT min_code FROM range_params),
                    GREATEST(
                        (SELECT min_code FROM range_params),
                        COALESCE((SELECT MAX(base_code) FROM parsed_codes), 0) + 1
                    )
                ) AS base_code
            ),
            available_codes AS (
                SELECT base_code
                FROM all_possible_codes
                WHERE base_code NOT IN (SELECT base_code FROM parsed_codes)
            ),
            next_code AS (
                SELECT MIN(base_code) AS next_base_code
                FROM available_codes
            )
            SELECT LPAD(next_base_code::TEXT, 3, '0') || '.0' AS next_fuel_code
            FROM next_code;
            """
        )
        result = (await self.db.execute(query, {"prefix": prefix})).scalar_one_or_none()
        return self.format_decimal(result)

    async def get_next_available_sub_version_fuel_code_by_prefix(
        self, input_version: str, prefix_id: int
    ) -> str:
        query = text(
            """
            WITH split_versions AS (
                SELECT
                    fuel_suffix,
                    CAST(SPLIT_PART(fuel_suffix, '.', 1) AS INTEGER) AS main_version,
                    CAST(SPLIT_PART(fuel_suffix, '.', 2) AS INTEGER) AS sub_version
                FROM fuel_code fc
                JOIN fuel_code_prefix fcp ON fcp.fuel_code_prefix_id = fc.prefix_id
                WHERE fcp.fuel_code_prefix_id = :prefix_id
            ),
            sub_versions AS (
                SELECT
                    main_version,
                    sub_version
                FROM split_versions
                WHERE main_version = :input_version
            ),
            all_sub_versions AS (
                SELECT generate_series(0, COALESCE((SELECT MAX(sub_version) FROM sub_versions), -1)) AS sub_version
            ),
            missing_sub_versions AS (
                SELECT a.sub_version
                FROM all_sub_versions a
                LEFT JOIN sub_versions s ON a.sub_version = s.sub_version
                WHERE s.sub_version IS NULL
                ORDER BY a.sub_version
                LIMIT 1
            )
            SELECT
                :input_version || '.' ||
                COALESCE((SELECT sub_version FROM missing_sub_versions)::VARCHAR,
                        (SELECT COALESCE(MAX(sub_version), -1) + 1 FROM sub_versions)::VARCHAR)
                AS next_available_version
            """
        )
        result = (
            await self.db.execute(
                query, {"input_version": int(input_version), "prefix_id": prefix_id}
            )
        ).scalar_one_or_none()
        return self.format_decimal(result)

    async def get_latest_fuel_codes(self) -> List[FuelCodeSchema]:
        subquery = (
            select(func.max(FuelCode.fuel_suffix).label("latest_code"))
            .group_by(func.split_part(FuelCode.fuel_suffix, ".", 1))
            .subquery()
        )

        query = (
            select(FuelCode)
            .join(subquery, FuelCode.fuel_suffix == subquery.c.latest_code)
            .options(
                joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                    FeedstockFuelTransportMode.feedstock_fuel_transport_mode
                ),
                joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                    FinishedFuelTransportMode.finished_fuel_transport_mode
                ),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_type).joinedload(FuelType.provision_2),
            )
            .filter(FuelCodeStatus.status != FuelCodeStatusEnum.Deleted)
        )

        result = await self.db.execute(query)

        fuel_codes = result.unique().scalars().all()

        next_fuel_codes = []

        for fuel_code in fuel_codes:
            base_code, version = fuel_code.fuel_code.rsplit(".", 1)
            next_version = str(int(version) + 1)
            next_code = f"{base_code}.{next_version}"

            fuel_code_pydantic = FuelCodeSchema.from_orm(fuel_code)

            fuel_code_dict = fuel_code_pydantic.dict()

            next_fuel_codes.append({**fuel_code_dict, "fuel_code": next_code})

        return next_fuel_codes

    @repo_handler
    async def get_fuel_code_field_options(self):
        query = select(
            FuelCode.company,
            FuelCode.feedstock,
            FuelCode.feedstock_location,
            FuelCode.feedstock_misc,
            FuelCode.former_company,
            FuelCode.contact_name,
            FuelCode.contact_email,
        )

        result = (await self.db.execute(query)).all()

        return result

    @repo_handler
    async def get_fp_locations(self):
        query = select(
            FuelCode.fuel_production_facility_city,
            FuelCode.fuel_production_facility_province_state,
            FuelCode.fuel_production_facility_country,
        )

        result = (await self.db.execute(query)).all()

        return result

    @repo_handler
    async def get_fuel_code_by_name(self, fuel_code: str) -> FuelCode:
        result = await self.db.execute(
            select(FuelCode)
            .join(FuelCode.fuel_code_prefix)
            .join(
                FuelCodeStatus,
                FuelCode.fuel_status_id == FuelCodeStatus.fuel_code_status_id,
            )
            .outerjoin(FuelType, FuelCode.fuel_type_id == FuelType.fuel_type_id)
            .options(
                contains_eager(FuelCode.fuel_code_prefix),
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_type),
            )
            .where(
                and_(
                    func.concat(FuelCodePrefix.prefix, FuelCode.fuel_suffix)
                    == fuel_code,
                    FuelCodeStatus.status != FuelCodeStatusEnum.Deleted,
                )
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_provision_of_the_act_by_name(
        self, provision_of_the_act: str
    ) -> ProvisionOfTheAct:
        result = await self.db.execute(
            select(ProvisionOfTheAct).where(
                ProvisionOfTheAct.name == provision_of_the_act
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_energy_effectiveness_ratio(
        self,
        fuel_type_id: int,
        fuel_category_id: int,
        compliance_period_id: int,
        end_use_type_id: Optional[int],
    ) -> EnergyEffectivenessRatio:
        """
        Retrieves the Energy Effectiveness Ratio based on fuel type, fuel category,
        and optionally the end use type.

        Args:
            compliance_period_id (int): The ID of the compliance period.
            fuel_type_id (int): The ID of the fuel type.
            fuel_category_id (int): The ID of the fuel category.
            end_use_type_id (Optional[int]): The ID of the end use type (optional).

        Returns:
            Optional[EnergyEffectivenessRatio]: The matching EnergyEffectivenessRatio record or None.
        """
        conditions = [
            EnergyEffectivenessRatio.fuel_type_id == fuel_type_id,
            EnergyEffectivenessRatio.compliance_period_id == compliance_period_id,
            EnergyEffectivenessRatio.fuel_category_id == fuel_category_id,
        ]

        if end_use_type_id is not None:
            conditions.append(
                EnergyEffectivenessRatio.end_use_type_id == end_use_type_id
            )

        stmt = select(EnergyEffectivenessRatio).where(*conditions)
        result = await self.db.execute(stmt)
        energy_effectiveness_ratio = result.scalars().first()

        return energy_effectiveness_ratio

    @repo_handler
    async def get_target_carbon_intensity(
        self, fuel_category_id: int, compliance_period: str
    ) -> TargetCarbonIntensity:

        compliance_period_id_subquery = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliance_period)
            .scalar_subquery()
        )

        stmt = (
            select(TargetCarbonIntensity)
            .where(
                TargetCarbonIntensity.fuel_category_id == fuel_category_id,
                TargetCarbonIntensity.compliance_period_id
                == compliance_period_id_subquery,
            )
            .options(
                selectinload(TargetCarbonIntensity.fuel_category),
                selectinload(TargetCarbonIntensity.compliance_period),
            )
        )
        result = await self.db.execute(stmt)

        return result.scalar_one()

    @repo_handler
    async def get_standardized_fuel_data(
        self,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        compliance_period: str,
        fuel_code_id: Optional[int] = None,
        provision_of_the_act: Optional[str] = None,
        export_date: Optional[date] = None,
    ) -> CarbonIntensityResult:
        """
        Fetch and standardize fuel data values required for compliance calculations.
        """
        compliance_period_id = await self.get_compliance_period_id(compliance_period)
        # Fetch the fuel type details
        fuel_type = await self.get_fuel_type_by_id(fuel_type_id)
        if not fuel_type:
            raise ValueError("Invalid fuel type ID")

        # Determine energy density
        energy_density_result = await self.get_energy_density(
            fuel_type_id, compliance_period_id
        )
        energy_density = (
            energy_density_result.density
            if energy_density_result and fuel_type.fuel_type != "Other"
            else None
        )

        # Find lowest CI from active fuel codes in last 12 months if provision_of_the_act is 'unknown'
        if provision_of_the_act and provision_of_the_act.lower() == "unknown":
            if not export_date:
                raise ValueError(
                    "Export date is required when provision_of_the_act is 'unknown'."
                )

            # Calculate 12 months prior
            twelve_months_ago = export_date - timedelta(days=365)

            # Fetch the lowest carbon intensity from active fuel codes
            stmt = (
                select(FuelCode.carbon_intensity)
                .join(FuelCode.fuel_code_status)
                .where(
                    and_(
                        FuelCode.fuel_type_id == fuel_type_id,
                        FuelCodeStatus.status == FuelCodeStatusEnum.Approved,
                        or_(
                            FuelCode.effective_date.is_(None),
                            FuelCode.effective_date <= export_date,
                        ),
                        or_(
                            FuelCode.expiration_date.is_(None),
                            FuelCode.expiration_date > export_date,
                        ),
                        or_(
                            FuelCode.effective_date.is_(None),
                            FuelCode.effective_date >= twelve_months_ago,
                        ),
                    )
                )
                .order_by(asc(FuelCode.carbon_intensity))
                .limit(1)
            )
            lowest_ci = (await self.db.execute(stmt)).scalar_one_or_none()

            if lowest_ci is None:
                # If we can't find any active fuel codes, just revert to the default carbon intensity
                effective_carbon_intensity = await self.get_default_carbon_intensity(
                    fuel_type_id, compliance_period
                )
            else:
                effective_carbon_intensity = lowest_ci

        else:
            if fuel_code_id:
                fuel_code = await self.get_fuel_code(fuel_code_id)
                effective_carbon_intensity = fuel_code.carbon_intensity
            # Other Fuel uses the Default CI of the Category
            elif fuel_type.unrecognized:
                effective_carbon_intensity = await self.get_category_carbon_intensity(
                    fuel_category_id=fuel_category_id,
                    compliance_period=compliance_period,
                )
            else:
                effective_carbon_intensity = await self.get_default_carbon_intensity(
                    fuel_type_id=fuel_type_id, compliance_period=compliance_period
                )

        # Get energy effectiveness ratio (EER)
        energy_effectiveness = await self.get_energy_effectiveness_ratio(
            fuel_type_id, fuel_category_id, compliance_period_id, end_use_id
        )
        eer = energy_effectiveness.ratio if energy_effectiveness else 1.0

        # Fetch target carbon intensity (TCI)
        target_carbon_intensity = await self.get_target_carbon_intensity(
            fuel_category_id, compliance_period
        )
        target_ci = target_carbon_intensity.target_carbon_intensity

        # Additional Carbon Intensity (UCI)
        uci = await self.get_additional_carbon_intensity(
            fuel_type_id, end_use_id, compliance_period
        )

        return CarbonIntensityResult(
            effective_carbon_intensity=effective_carbon_intensity,
            target_ci=target_ci,
            eer=eer,
            energy_density=energy_density,
            uci=uci.intensity if uci else None,
        )

    @repo_handler
    async def get_additional_carbon_intensity(
        self, fuel_type_id: int, end_use_type_id: int, compliance_period: str
    ) -> Optional[AdditionalCarbonIntensity]:
        """Get a single use of a carbon intensity (UCI), returns None if one does not apply"""

        compliance_period_id_subquery = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliance_period)
            .scalar_subquery()
        )

        # Exact match for compliance_period_id
        query = select(AdditionalCarbonIntensity).where(
            AdditionalCarbonIntensity.end_use_type_id == end_use_type_id,
            AdditionalCarbonIntensity.fuel_type_id == fuel_type_id,
            AdditionalCarbonIntensity.compliance_period_id
            == compliance_period_id_subquery,
        )

        result = await self.db.execute(query)
        return result.scalars().one_or_none()

    @repo_handler
    async def get_default_carbon_intensity(
        self, fuel_type_id: int, compliance_period: str
    ) -> Optional[float]:
        """Get default carbon intensity for specified compliance period"""

        compliance_period_id_subquery = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliance_period)
            .scalar_subquery()
        )

        query = select(DefaultCarbonIntensity).where(
            DefaultCarbonIntensity.fuel_type_id == fuel_type_id,
            DefaultCarbonIntensity.compliance_period_id
            == compliance_period_id_subquery,
        )

        result = await self.db.execute(query)
        record = result.scalar_one_or_none()
        return record.default_carbon_intensity if record else 0.0

    @repo_handler
    async def get_category_carbon_intensity(
        self, fuel_category_id: int, compliance_period: str
    ) -> Optional[float]:
        """Get default carbon intensity for specified compliance period and fuel category"""

        compliance_period_id_subquery = (
            select(CompliancePeriod.compliance_period_id)
            .where(CompliancePeriod.description == compliance_period)
            .scalar_subquery()
        )

        query = select(CategoryCarbonIntensity).where(
            CategoryCarbonIntensity.fuel_category_id == fuel_category_id,
            CategoryCarbonIntensity.compliance_period_id
            == compliance_period_id_subquery,
        )

        result = await self.db.execute(query)
        record = result.scalar_one_or_none()
        return record.category_carbon_intensity if record else 0.0

    @repo_handler
    async def get_expiring_fuel_codes(
        self, start_date: date, end_date: date
    ) -> List[FuelCode]:
        """
        Get all fuel codes that are expiring within a given date range.
        """
        approved_status = await self.get_fuel_code_status(FuelCodeStatusEnum.Approved)
        query = (
            select(FuelCode)
            .options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
            )
            .where(
                and_(
                    FuelCode.expiration_date >= start_date,
                    FuelCode.expiration_date <= end_date,
                    FuelCodeStatus.status == FuelCodeStatusEnum.Approved,
                )
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()
