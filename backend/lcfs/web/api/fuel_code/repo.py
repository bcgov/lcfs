from logging import getLogger
from typing import List, Dict, Any
from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import and_, select, func, text, update, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager

from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.FuelInstance import FuelInstance
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import FuelCodeCloneSchema, FuelCodeSchema
from lcfs.web.core.decorators import repo_handler

logger = getLogger("fuel_code_repo")


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
        query = (
            select(FuelType)
            .outerjoin(FuelType.fuel_instances)
            .outerjoin(FuelInstance.fuel_category)
            .options(
                contains_eager(FuelType.fuel_instances).contains_eager(
                    FuelInstance.fuel_category
                ),
                joinedload(FuelType.provision_1),
                joinedload(FuelType.provision_2),
                joinedload(FuelType.fuel_codes),
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
            }
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
    async def get_fuel_code_prefix_by_name(self, prefix_name: str) -> FuelCodePrefix:
        """Get fuel code prefix by name"""
        result = await self.db.execute(
            select(FuelCodePrefix).where(FuelCodePrefix.prefix == prefix_name)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_fuel_status_by_status(self, status: str) -> FuelCodeStatus:
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
    ) -> List[FuelCodeSchema]:
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
    async def save_fuel_codes(self, fuel_codes: List[FuelCode]) -> str:
        """
        Saves fuel codes to the database.

        Args:
            fuel_codes (List[FuelCodeSchema]): A list of fuel codes to be saved.
        """
        self.db.add_all(fuel_codes)
        await self.db.flush()

        return "fuel codes added successfully"

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
    async def get_fuel_code_status(self, fuel_code_status: str) -> FuelCodeStatus:
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
        await self.db.execute(
            update(FuelCode)
            .where(FuelCode.fuel_code_id == fuel_code_id)
            .values(fuel_status_id=3)
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
                    FuelCode.fuel_suffix == fuel_suffix, FuelCodePrefix.prefix == prefix
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
    async def validate_fuel_code(self, suffix: str, prefix: str) -> str:
        # check if the fuel_code already exists
        query = select(FuelCode).where(
            and_(
                FuelCode.fuel_suffix == suffix,
                func.lower(FuelCodePrefix.prefix) == func.lower(prefix),
            )
        )
        result = (await self.db.execute(query)).scalar_one_or_none()
        if result:
            fuel_code_main_version = suffix.split(".")[0]
            return await self.get_next_available_sub_version_fuel_code_by_prefix(
                fuel_code_main_version, prefix
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
                SELECT generate_series(1, COALESCE((SELECT MAX(base_code) FROM parsed_codes), 0) + 1) AS base_code
            ),
            available_codes AS (
                SELECT base_code
                FROM all_possible_codes
                WHERE base_code NOT IN (SELECT base_code FROM parsed_codes)
            ),
            next_code AS (
                SELECT MAX(base_code) AS next_base_code
                FROM available_codes
            )
            SELECT LPAD(next_base_code::TEXT, 3, '0') || '.0' AS next_fuel_code
            FROM next_code;
            """
        )
        result = (await self.db.execute(query, {"prefix": prefix})).scalar_one_or_none()
        return self.format_decimal(result)

    async def get_next_available_sub_version_fuel_code_by_prefix(
        self, input_version: str, prefix: str
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
                WHERE fcp.prefix = :prefix
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
                query, {"input_version": int(input_version), "prefix": prefix}
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
                func.concat(FuelCodePrefix.prefix, FuelCode.fuel_suffix) == fuel_code
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
