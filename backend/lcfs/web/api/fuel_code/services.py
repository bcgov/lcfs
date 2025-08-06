from datetime import datetime
import math
from collections import defaultdict
from typing import List, Any, Dict
import re
import uuid

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.fuel import FuelCodeHistory
from lcfs.web.api.email.services import CHESEmailService
import structlog
from fastapi import Depends

from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.web.api.base import (
    NotificationTypeEnum,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.notification.schema import (
    FUEL_CODE_STATUS_NOTIFICATION_MAPPER,
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.base import NotificationTypeEnum
import json
from lcfs.db.models import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_code.schema import (
    FuelCodeBaseSchema,
    FuelCodeCreateUpdateSchema,
    FuelCodeSchema,
    FuelCodeStatusEnumSchema,
    FuelCodesSchema,
    FuelTypeSchema,
    SearchFuelCodeList,
    TransportModeSchema,
    FuelCodePrefixSchema,
    TableOptionsSchema,
    FuelCodeStatusSchema,
)
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)


class FuelCodeServices:
    def __init__(
        self,
        repo: FuelCodeRepository = Depends(FuelCodeRepository),
        notification_service: NotificationService = Depends(NotificationService),
        email_service: CHESEmailService = Depends(CHESEmailService),
    ) -> None:
        self.repo = repo
        self.notification_service = notification_service
        self.email_service = email_service

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
    async def search_fp_facility_location(self, city, province, country):
        return await self.repo.get_fp_facility_location_by_name(city, province, country)

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
        fp_locations = []
        facility_nameplate_capacity_units = [unit.value for unit in QuantityUnitsEnum]

        # Use a set to remove duplicates
        field_options_results_dict = {
            "company": set(),
            "feedstock": set(),
            "feedstock_location": set(),
            "feedstock_misc": set(),
            "former_company": set(),
            "contact_name": set(),
            "contact_email": set(),
        }
        for row in field_options_results:
            for key, value in row._mapping.items():
                if value is None or value == "":  # Skip empty strings or null values
                    continue
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

        return TableOptionsSchema(
            fuel_types=[
                FuelTypeSchema.model_validate(fuel_type) for fuel_type in fuel_types
            ],
            transport_modes=[
                TransportModeSchema.model_validate(transport_mode)
                for transport_mode in transport_modes
            ],
            fuel_code_prefixes=fuel_code_prefixes_with_next,
            latest_fuel_codes=latest_fuel_codes,
            field_options=field_options,
            fp_locations=list(set(fp_locations)),
            facility_nameplate_capacity_units=facility_nameplate_capacity_units,
        )

    @service_handler
    async def search_fuel_codes(
        self, pagination: PaginationRequestSchema
    ) -> FuelCodesSchema:
        """
        Gets the list of fuel codes.
        """
        fuel_codes, total_count = await self.repo.get_fuel_codes_paginated(pagination)
        return FuelCodesSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            fuel_codes=[
                FuelCodeBaseSchema.model_validate(fuel_code) for fuel_code in fuel_codes
            ],
        )

    async def get_fuel_code_statuses(self):
        """
        Get all available statuses for fuel codes from the database.

        Returns:
            List[TransactionStatusView]: A list of TransactionStatusView objects containing the basic transaction status details.
        """
        fuel_code_statuses = await self.repo.get_fuel_code_statuses()
        return [
            FuelCodeStatusSchema.model_validate(fuel_code_status)
            for fuel_code_status in fuel_code_statuses
        ]

    async def get_transport_modes(self):
        """
        Get all available transport modes for fuel codes from the database.

        Returns:
            List[TransportModeSchema]: A list of TransportModeSchema.
        """
        transport_modes = await self.repo.get_transport_modes()
        return [
            TransportModeSchema.model_validate(fuel_code_status)
            for fuel_code_status in transport_modes
        ]

    async def convert_to_model(
        self, fuel_code_schema: FuelCodeCreateUpdateSchema, status: FuelCodeStatusEnum
    ) -> FuelCode:
        """
        Converts data from FuelCodeCreateSchema to FuelCode data model to store in the database.
        """
        prefix = await self.repo.get_fuel_code_prefix(fuel_code_schema.prefix_id)
        fuel_type = await self.repo.get_fuel_type_by_id(fuel_code_schema.fuel_type_id)
        facility_nameplate_capacity_units_enum = (
            QuantityUnitsEnum(fuel_code_schema.facility_nameplate_capacity_unit)
            if fuel_code_schema.facility_nameplate_capacity_unit is not None
            else None
        )
        transport_modes = await self.repo.get_transport_modes()
        fuel_status = await self.repo.get_fuel_status_by_status(status)
        fuel_code = FuelCode(
            **fuel_code_schema.model_dump(
                exclude={
                    "id",
                    "prefix_id",
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
            fuel_suffix=str(fuel_code_schema.fuel_suffix),
            prefix_id=prefix.fuel_code_prefix_id,
            fuel_type_id=fuel_type.fuel_type_id,
            facility_nameplate_capacity_unit=facility_nameplate_capacity_units_enum,
        )

        fuel_code.feedstock_fuel_transport_modes = []
        fuel_code.finished_fuel_transport_modes = []
        for transport_mode in fuel_code_schema.feedstock_fuel_transport_mode or []:
            matching_transport_mode = next(
                (tm for tm in transport_modes if tm.transport_mode == transport_mode),
                None,
            )
            if matching_transport_mode:
                fuel_code.feedstock_fuel_transport_modes.append(
                    FeedstockFuelTransportMode(
                        fuel_code_id=fuel_code.fuel_code_id,
                        transport_mode_id=matching_transport_mode.transport_mode_id,
                    )
                )
            else:
                raise ValueError(f"Invalid transport mode: {transport_mode}")

        for transport_mode in fuel_code_schema.finished_fuel_transport_mode or []:
            matching_transport_mode = next(
                (tm for tm in transport_modes if tm.transport_mode == transport_mode),
                None,
            )
            if matching_transport_mode:
                fuel_code.finished_fuel_transport_modes.append(
                    FinishedFuelTransportMode(
                        fuel_code_id=fuel_code.fuel_code_id,
                        transport_mode_id=matching_transport_mode.transport_mode_id,
                    )
                )
            else:
                raise ValueError(f"Invalid transport mode: {transport_mode}")

        return fuel_code

    @service_handler
    async def create_fuel_code(
        self, fuel_code: FuelCodeCreateUpdateSchema
    ) -> FuelCodeSchema:
        """
        Create a new fuel code.
        """
        fuel_suffix_value = await self.repo.validate_fuel_code(
            fuel_code.fuel_suffix, fuel_code.prefix_id
        )
        fuel_code.fuel_suffix = fuel_suffix_value
        fuel_code_model = await self.convert_to_model(
            fuel_code, FuelCodeStatusEnum.Draft
        )
        fuel_code_model = await self.repo.create_fuel_code(fuel_code_model)
        result = FuelCodeSchema.model_validate(fuel_code_model)
        history = FuelCodeHistory(
            fuel_code_id=fuel_code_model.fuel_code_id,
            fuel_status_id=fuel_code_model.fuel_status_id,
            fuel_code_snapshot=result.model_dump(mode="json"),
            version=0,
            group_uuid=str(uuid.uuid4()),
            action_type=ActionTypeEnum.CREATE.value,
        )
        await self.repo.create_fuel_code_history(history)
        return result

    @service_handler
    async def get_fuel_code(self, fuel_code_id: int):
        fuel_code = await self.repo.get_fuel_code(fuel_code_id)
        fc_schema = FuelCodeSchema.model_validate(fuel_code)
        fc_schema.can_edit_ci = not (await self.repo.is_fuel_code_used(fuel_code_id))

        fc_schema.is_notes_required = any(
            h.fuel_status_id != 1 for h in fuel_code.history_records
        )  # if previously not recommended or approved then notes is not mandatory
        return fc_schema

    @service_handler
    async def update_fuel_code_status(
        self, fuel_code_id: int, status: FuelCodeStatusEnumSchema, user: UserProfile
    ):
        fuel_code = await self.repo.get_fuel_code(fuel_code_id)
        if not fuel_code:
            raise ValueError("Fuel code not found")

        # Store previous status for transition detection
        previous_status = fuel_code.fuel_code_status.status

        fuel_code_status = await self.repo.get_fuel_code_status(status)
        fuel_code.fuel_code_status = fuel_code_status
        fuel_code.update_date = datetime.now()
        fuel_code.last_updated = datetime.now()
        if fuel_code.group_uuid is None:
            fuel_code.group_uuid = str(uuid.uuid4())
        fuel_code.version += 1
        fuel_code.action_type = ActionTypeEnum.UPDATE
        history = FuelCodeHistory(
            fuel_code_id=fuel_code.fuel_code_id,
            fuel_status_id=fuel_code_status.fuel_code_status_id,
            fuel_code_snapshot=FuelCodeSchema.model_validate(fuel_code).model_dump(
                mode="json"
            ),
            version=fuel_code.version,
            group_uuid=fuel_code.group_uuid,
            action_type=fuel_code.action_type,
        )
        await self.repo.create_fuel_code_history(history)
        updated_fuel_code = await self.repo.update_fuel_code(fuel_code)

        # Send notifications based on status change
        notifications = []

        # Check for specific status transitions and new statuses
        if status == FuelCodeStatusEnumSchema.Recommended:
            # Draft → Recommended: notify Director
            notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(
                FuelCodeStatusEnum.Recommended, []
            )
        elif status == FuelCodeStatusEnumSchema.Approved:
            # Recommended → Approved: notify Analyst
            notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(
                FuelCodeStatusEnum.Approved, []
            )
        elif (
            previous_status == FuelCodeStatusEnum.Recommended
            and status == FuelCodeStatusEnumSchema.Draft
            and user.role_names
            and RoleEnum.DIRECTOR.name in user.role_names
        ):
            # Recommended → Draft: notify Analyst (returned by Director)
            # Only send this notification if it's actually a Director making the change
            notifications = [
                NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED
            ]

        if notifications:
            message_data = {
                "id": fuel_code_id,
                "status": status.value,
                "previousStatus": previous_status.value,
                "fuelCode": fuel_code.fuel_code,
                "company": fuel_code.company,
            }
            notification_data = NotificationMessageSchema(
                type="Fuel Code Status Update",
                message=json.dumps(message_data),
                related_organization_id=None,  # Fuel codes don't have organization context
                origin_user_profile_id=user.user_profile_id,
                related_transaction_id=str(fuel_code_id),
            )
            await self.notification_service.send_notification(
                NotificationRequestSchema(
                    notification_types=notifications,
                    notification_data=notification_data,
                )
            )

        return updated_fuel_code

    @service_handler
    async def update_fuel_code(self, fuel_code_data: FuelCodeCreateUpdateSchema):
        fuel_code = await self.repo.get_fuel_code(fuel_code_data.fuel_code_id)
        if not fuel_code:
            raise ValueError("Fuel code not found")
        if any(
            h.fuel_status_id != 1 for h in fuel_code.history_records
        ):  # if previously not recommended or approved then notes is not mandatory
            if not fuel_code_data.notes:
                raise ValueError("Notes is required")

        for field, value in fuel_code_data.model_dump(
            exclude={
                "feedstock_fuel_transport_modes",
                "feedstock_fuel_transport_mode",
                "finished_fuel_transport_modes",
                "facility_nameplate_capacity_unit",
            }
        ).items():
            setattr(fuel_code, field, value)

        fuel_code.feedstock_fuel_transport_modes.clear()

        if fuel_code_data.feedstock_fuel_transport_mode:
            for mode_name in fuel_code_data.feedstock_fuel_transport_mode:
                transport_mode = await self.repo.get_transport_mode_by_name(mode_name)
                feedstock_mode = FeedstockFuelTransportMode(
                    fuel_code_id=fuel_code.fuel_code_id,
                    transport_mode_id=transport_mode.transport_mode_id,
                )
                fuel_code.feedstock_fuel_transport_modes.append(feedstock_mode)

        fuel_code.finished_fuel_transport_modes.clear()

        if fuel_code_data.finished_fuel_transport_mode:
            for mode_name in fuel_code_data.finished_fuel_transport_mode:
                transport_mode = await self.repo.get_transport_mode_by_name(mode_name)
                if transport_mode:
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
        fuel_code.last_updated = datetime.now()
        fuel_code.action_type = ActionTypeEnum.UPDATE.value

        if fuel_code.group_uuid is None:
            fuel_code.group_uuid = str(uuid.uuid4())
            fuel_code.version = 0
        fuel_code = await self.repo.update_fuel_code(fuel_code)
        history = await self.repo.get_fuel_code_history(
            fuel_code_id=fuel_code.fuel_code_id, version=fuel_code.version
        )
        if history is None:
            history = FuelCodeHistory(
                fuel_code_id=fuel_code.fuel_code_id,
                fuel_status_id=fuel_code.fuel_status_id,
                fuel_code_snapshot=FuelCodeSchema.model_validate(fuel_code).model_dump(
                    mode="json"
                ),
                version=fuel_code.version,
                group_uuid=fuel_code.group_uuid,
                action_type=fuel_code.action_type,
            )
            await self.repo.create_fuel_code_history(history)
        else:
            history.fuel_code_snapshot = FuelCodeSchema.model_validate(
                fuel_code
            ).model_dump(mode="json")
            await self.repo.update_fuel_code_history(history)
        return fuel_code

    @service_handler
    async def delete_fuel_code(self, fuel_code_id: int):
        return await self.repo.delete_fuel_code(fuel_code_id)
