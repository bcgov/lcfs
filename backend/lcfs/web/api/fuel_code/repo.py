import structlog
from datetime import date
from typing import List, Dict, Any, Union, Optional, Sequence
from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import and_, or_, select, func, text, update, distinct, Row, RowMapping
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager, selectinload

from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.FuelInstance import FuelInstance
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.TargetCarbonIntensity import TargetCarbonIntensity
from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import FuelCodeCloneSchema, FuelCodeSchema
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class FuelCodeRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fuel_types(self) -> List[FuelType]:
        """Get all fuel type options"""
        return (
            (
                await self.db.execute(
                    select(FuelType).options(
                        joinedload(FuelType.provision_1),
                        joinedload(FuelType.provision_2),
                    )
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_formatted_fuel_types(self) -> List[Dict[str, Any]]:
        """Get all fuel type options with their associated fuel categories and fuel codes"""
        # Define the filtering conditions for fuel codes
        current_date = date.today()
        fuel_code_filters = or_(
            FuelCode.effective_date == None, FuelCode.effective_date <= current_date
        ) & or_(
            FuelCode.expiration_date == None, FuelCode.expiration_date > current_date
        )

        # Build the query with filtered fuel_codes
        query = (
            select(FuelType)
            .outerjoin(FuelType.fuel_instances)
            .outerjoin(FuelInstance.fuel_category)
            .outerjoin(FuelType.fuel_codes)
            .where(fuel_code_filters)
            .options(
                contains_eager(FuelType.fuel_instances).contains_eager(
                    FuelInstance.fuel_category
                ),
                contains_eager(FuelType.fuel_codes),
                joinedload(FuelType.provision_1),
                joinedload(FuelType.provision_2),
            )
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
    async def get_fuel_category_by_name(self, name: str) -> FuelCategory:
        """Get a fuel category by its name"""
        result = await self.db.execute(select(FuelCategory).filter_by(category=name))
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
    async def get_energy_density(self, fuel_type_id) -> EnergyDensity:
        """Get the energy density for the specified fuel_type_id"""

        stmt = select(EnergyDensity).where(EnergyDensity.fuel_type_id == fuel_type_id)
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
    async def get_use_of_a_carbon_intensities(self) -> List[AdditionalCarbonIntensity]:
        """Get all use of a carbon intensities (UCI)"""
        return (
            (
                await self.db.execute(
                    select(AdditionalCarbonIntensity).options(
                        joinedload(AdditionalCarbonIntensity.end_use_type),
                        joinedload(AdditionalCarbonIntensity.fuel_type),
                        joinedload(AdditionalCarbonIntensity.uom),
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
            List[FuelCodeSchema]: A list of fuel codes matching the query.
        """
        conditions = []
        # TODO: Filtering and Sorting logic needs to be added.
        delete_status = await self.get_fuel_status_by_status("Deleted")
        # setup pagination
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        # Construct the select query with options for eager loading
        query = (
            select(FuelCode)
            .options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_2),
                joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                    FeedstockFuelTransportMode.feedstock_fuel_transport_mode
                ),
                joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                    FinishedFuelTransportMode.finished_fuel_transport_mode
                ),
            )
            .where(FuelCode.fuel_status_id != delete_status.fuel_code_status_id)
        )
        # Execute the count query to get the total count
        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        # Execute the main query to retrieve all fuel codes
        result = await self.db.execute(
            query.offset(offset).limit(limit).order_by(FuelCode.create_date.desc())
        )
        fuel_codes = result.unique().scalars().all()
        return fuel_codes, total_count

    @repo_handler
    async def create_fuel_code(self, fuel_code: FuelCode) -> FuelCode:
        """
        Saves a new fuel code to the database.

        Args:
            fuel_code (FuelCodeSchema): A fuel code to be saved.
        """
        self.db.add(fuel_code)
        await self.db.flush()
        await self.db.refresh(
            fuel_code,
            [
                "fuel_code_status",
                "fuel_code_prefix",
                "fuel_code_type",
                "feedstock_fuel_transport_modes",
                "finished_fuel_transport_modes",
            ],
        )
        # Manually load nested relationships
        await self.db.refresh(fuel_code.fuel_code_type, ["provision_1", "provision_2"])
        return fuel_code

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
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_2),
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
    ) -> List[str]:
        query = (
            select(FuelCode)
            .options(
                joinedload(FuelCode.fuel_code_status),
                joinedload(FuelCode.fuel_code_prefix),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_2),
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
            return await self.get_next_available_sub_version_fuel_code_by_prefix(
                fuel_code_main_version, prefix_id
            )
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
            all_possible_codes AS (
                SELECT generate_series(101, COALESCE((SELECT MAX(base_code) FROM parsed_codes), 101) + 1) AS base_code
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
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_1),
                joinedload(FuelCode.fuel_code_type).joinedload(FuelType.provision_2),
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
            .options(
                contains_eager(FuelCode.fuel_code_prefix).subqueryload(
                    FuelCodePrefix.fuel_codes
                )
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
        self, fuel_type_id: int, fuel_category_id: int, end_use_type_id: int
    ) -> EnergyEffectivenessRatio:

        stmt = select(EnergyEffectivenessRatio).where(
            EnergyEffectivenessRatio.fuel_type_id == fuel_type_id,
            EnergyEffectivenessRatio.fuel_category_id == fuel_category_id,
            EnergyEffectivenessRatio.end_use_type_id == end_use_type_id,
        )
        result = await self.db.execute(stmt)
        energy_density = result.scalars().first()

        return energy_density

    @repo_handler
    async def get_target_carbon_intensities(
        self, fuel_category_id: int, compliance_period: str
    ) -> List[TargetCarbonIntensity]:

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
                joinedload(TargetCarbonIntensity.fuel_category),
                joinedload(TargetCarbonIntensity.compliance_period),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    @repo_handler
    async def get_standardized_fuel_data(
        self,
        fuel_type_id: int,
        fuel_category_id: int,
        end_use_id: int,
        compliance_period: str,
        fuel_code_id: Optional[int] = None,
    ):
        """
        Fetch and standardize fuel data values required for compliance calculations.
        """
        # Fetch the fuel type details
        fuel_type = await self.get_fuel_type_by_id(fuel_type_id)
        if not fuel_type:
            raise ValueError("Invalid fuel type ID")

        # Determine energy density
        energy_density = (
            (await self.get_energy_density(fuel_type_id)).density
            if fuel_type.fuel_type != "Other"
            else None
        )

        # Set effective carbon intensity and target carbon intensity
        if fuel_code_id:
            fuel_code = await self.get_fuel_code(fuel_code_id)
            effective_carbon_intensity = fuel_code.carbon_intensity
        else:
            effective_carbon_intensity = fuel_type.default_carbon_intensity

        # Get energy effectiveness ratio (EER)
        eer = None
        if fuel_type_id and fuel_category_id and end_use_id:
            energy_effectiveness = await self.get_energy_effectiveness_ratio(
                fuel_type_id, fuel_category_id, end_use_id
            )
            eer = energy_effectiveness.ratio if energy_effectiveness else 1

        # Fetch target carbon intensity (TCI)
        target_ci = None
        target_carbon_intensities = await self.get_target_carbon_intensities(
            fuel_category_id, compliance_period
        )
        if target_carbon_intensities:
            target_ci = next(
                (tci.target_carbon_intensity for tci in target_carbon_intensities),
                0,
            )

        return {
            "effective_carbon_intensity": effective_carbon_intensity,
            "target_ci": target_ci,
            "eer": eer,
            "energy_density": energy_density,
        }
