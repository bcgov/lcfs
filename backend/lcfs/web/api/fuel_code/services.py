import asyncio
from logging import getLogger
import math
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.web.api.fuel_code.schema import (
    FuelCodeCreateSchema,
    FuelCodeSchema,
    FuelCodesSchema,
    FuelTypeSchema,
    SearchFuelCodeList,
    TransportModeSchema,
    FuelCodePrefixSchema,
    TableOptionsSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException

logger = getLogger("fuel_code_services")


class FuelCodeServices:
    def __init__(self, repo: FuelCodeRepository = Depends(FuelCodeRepository)) -> None:
        self.repo = repo

    @service_handler
    async def search_fuel_code(self, fuel_code, prefix, distinct_search):
        if distinct_search:
            result = await self.repo.get_distinct_fuel_codes_by_code(fuel_code, prefix)
        else:
            result = await self.repo.get_fuel_code_by_code_prefix(fuel_code, prefix)
        return SearchFuelCodeList(fuel_codes=result)

    @service_handler
    async def search_company(self, company):
        return await self.repo.get_distinct_company_names(company)

    @service_handler
    async def search_contact_name(self, company, contact_name):
        return await self.repo.get_contact_names_by_company(company, contact_name)

    @service_handler
    async def search_contact_email(self, company, contact_name, contact_email):
        return await self.repo.get_contact_email_by_company_and_name(
            company, contact_name, contact_email
        )

    @service_handler
    async def get_table_options(self) -> TableOptionsSchema:
        """
        Gets the list of table options related to fuel codes.
        """
        fuel_types = await self.repo.get_fuel_types()
        transport_modes = await self.repo.get_transport_modes()
        fuel_code_prefixes = await self.repo.get_fuel_code_prefixes()
        latest_fuel_codes = await self.repo.get_latest_fuel_codes()
        field_options_results = await self.repo.get_fuel_code_field_options()
        fp_locations = await self.repo.get_fp_locations()
        facility_nameplate_capacity_units = [unit.value for unit in QuantityUnitsEnum]

        field_options_results_dict = {}
        for row in field_options_results:
            for key, value in row._mapping.items():
                if value is None or value == "":  # Skip empty strings or null values
                    continue
                if key not in field_options_results_dict:
                    # Use a set to remove duplicates
                    field_options_results_dict[key] = set()
                field_options_results_dict[key].add(value)

        field_options = {
            key: sorted(list(values))
            for key, values in field_options_results_dict.items()
        }

        # Get next available fuel code for each prefix
        fuel_code_prefixes_with_next = []
        for prefix in fuel_code_prefixes:
            next_code = await self.repo.get_next_available_fuel_code_by_prefix(
                prefix.prefix
            )
            schema = FuelCodePrefixSchema.model_validate(prefix)
            schema.next_fuel_code = next_code
            fuel_code_prefixes_with_next.append(schema)

        return {
            "fuel_types": [
                FuelTypeSchema.model_validate(fuel_type) for fuel_type in fuel_types
            ],
            "transport_modes": [
                TransportModeSchema.model_validate(transport_mode)
                for transport_mode in transport_modes
            ],
            "fuel_code_prefixes": fuel_code_prefixes_with_next,
            "latest_fuel_codes": latest_fuel_codes,
            "field_options": field_options,
            "fp_locations": list(set(fp_locations)),
            "facility_nameplate_capacity_units": facility_nameplate_capacity_units,
        }

    @service_handler
    async def get_fuel_codes(
        self, pagination: PaginationRequestSchema
    ) -> FuelCodesSchema:
        """
        Gets the list of fuel codes.
        """
        fuel_codes, total_count = await self.repo.get_fuel_codes_paginated(pagination)

        if len(fuel_codes) == 0:
            raise DataNotFoundException("No fuel codes found")
        return FuelCodesSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            fuel_codes=[
                FuelCodeSchema.model_validate(fuel_code) for fuel_code in fuel_codes
            ],
        )

    async def convert_to_model(self, fuel_code: FuelCodeCreateSchema) -> FuelCode:
        """
        Converts data from FuelCodeCreateSchema to FuelCode data model to store in the database.
        """
        prefix = await self.repo.get_fuel_code_prefix_by_name(fuel_code.prefix)
        fuel_status = await self.repo.get_fuel_status_by_status(fuel_code.status)
        fuel_type = await self.repo.get_fuel_type_by_name(fuel_code.fuel)
        facility_nameplate_capacity_units_enum = (
            QuantityUnitsEnum(fuel_code.facility_nameplate_capacity_unit)
            if fuel_code.facility_nameplate_capacity_unit is not None
            else None
        )
        transport_modes = await self.repo.get_transport_modes()

        fc = FuelCode(
            **fuel_code.model_dump(
                exclude={
                    "id",
                    "prefix",
                    "prefix_id",
                    "fuel",
                    "fuel_type_id",
                    "feedstock_fuel_transport_mode",
                    "finished_fuel_transport_mode",
                    "feedstock_fuel_transport_modes",
                    "finished_fuel_transport_modes",
                    "status",
                    "is_valid",
                    "validation_msg",
                    "fuel_suffix",
                    "deleted",
                    "facility_nameplate_capacity_unit",
                }
            ),
            fuel_code_status=fuel_status,
            fuel_suffix=str(fuel_code.fuel_suffix),
            prefix_id=prefix.fuel_code_prefix_id,
            fuel_type_id=fuel_type.fuel_type_id,
            facility_nameplate_capacity_unit=facility_nameplate_capacity_units_enum,
        )

        fc.feedstock_fuel_transport_modes = []
        fc.finished_fuel_transport_modes = []
        for transport_mode in fuel_code.feedstock_fuel_transport_mode or []:
            matching_transport_mode = next(
                (tm for tm in transport_modes if tm.transport_mode == transport_mode),
                None,
            )
            if matching_transport_mode:
                fc.feedstock_fuel_transport_modes.append(
                    FeedstockFuelTransportMode(
                        fuel_code_id=fc.fuel_code_id,
                        transport_mode_id=matching_transport_mode.transport_mode_id,
                    )
                )

        for transport_mode in fuel_code.finished_fuel_transport_mode or []:
            matching_transport_mode = next(
                (tm for tm in transport_modes if tm.transport_mode == transport_mode),
                None,
            )
            if matching_transport_mode:
                fc.finished_fuel_transport_modes.append(
                    FinishedFuelTransportMode(
                        fuel_code_id=fc.fuel_code_id,
                        transport_mode_id=matching_transport_mode.transport_mode_id,
                    )
                )

        return fc

    @service_handler
    async def create_fuel_code(self, fuel_code: FuelCodeCreateSchema) -> FuelCodeSchema:
        """
        Create a new fuel code.
        """
        fuel_code.status = FuelCodeStatusEnum.Draft
        fuel_suffix_value = await self.repo.validate_fuel_code(
            fuel_code.fuel_suffix, fuel_code.prefix
        )
        fuel_code.fuel_suffix = fuel_suffix_value
        fuel_code_model = await self.convert_to_model(fuel_code)
        fuel_code_model = await self.repo.create_fuel_code(fuel_code_model)
        result = FuelCodeSchema.model_validate(fuel_code_model)
        return result

    @service_handler
    async def get_fuel_code(self, fuel_code_id: int):
        return await self.repo.get_fuel_code(fuel_code_id)

    async def get_fuel_code_status(self, fuel_code_status: str) -> FuelCodeStatus:
        return await self.repo.get_fuel_code_status(fuel_code_status)

    @service_handler
    async def update_fuel_code(
        self, fuel_code_id: int, fuel_code_data: FuelCodeCreateSchema
    ):
        fuel_code = await self.get_fuel_code(fuel_code_id)
        if not fuel_code:
            raise ValueError("Fuel code not found")

        for field, value in fuel_code_data.model_dump(
            exclude={
                "feedstock_fuel_transport_modes",
                "finished_fuel_transport_modes",
                "facility_nameplate_capacity_unit",
            }
        ).items():
            setattr(fuel_code, field, value)

        fuel_code.feedstock_fuel_transport_modes.clear()
        if fuel_code_data.feedstock_fuel_transport_modes:
            for mode in fuel_code_data.feedstock_fuel_transport_modes:

                transport_mode = await self.repo.get_transport_mode(
                    mode.transport_mode_id
                )

                feedstock_mode = FeedstockFuelTransportMode(
                    fuel_code_id=fuel_code.fuel_code_id,
                    transport_mode_id=transport_mode.transport_mode_id,
                )

                fuel_code.feedstock_fuel_transport_modes.append(feedstock_mode)

        fuel_code.finished_fuel_transport_modes.clear()
        if fuel_code_data.finished_fuel_transport_modes:
            for mode in fuel_code_data.finished_fuel_transport_modes:

                transport_mode = await self.repo.get_transport_mode(
                    mode.transport_mode_id
                )

                finished_mode = FinishedFuelTransportMode(
                    fuel_code_id=fuel_code.fuel_code_id,
                    transport_mode_id=transport_mode.transport_mode_id,
                )

                fuel_code.finished_fuel_transport_modes.append(finished_mode)

        facility_nameplate_capacity_units_enum = (
            QuantityUnitsEnum(fuel_code_data.facility_nameplate_capacity_unit).name
            if fuel_code_data.facility_nameplate_capacity_unit is not None
            else None
        )
        fuel_code.facility_nameplate_capacity_unit = (
            facility_nameplate_capacity_units_enum
        )

        if fuel_code_data.status == "Approved":
            fuel_code.fuel_status_id = (
                await self.get_fuel_code_status(fuel_code_data.status)
            ).fuel_code_status_id
            fuel_code.approval_date = datetime.now()

        return await self.repo.update_fuel_code(fuel_code)

    @service_handler
    async def delete_fuel_code(self, fuel_code_id: int):
        return await self.repo.delete_fuel_code(fuel_code_id)
