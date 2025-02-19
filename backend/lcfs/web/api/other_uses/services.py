import math
import uuid
from typing import Optional

import structlog
from fastapi import Depends, HTTPException, status

from lcfs.db.base import UserTypeEnum, ActionTypeEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
    OtherUsesSchema,
    OtherUsesListSchema,
    OtherUsesTableOptionsSchema,
    OtherUsesFuelCategorySchema,
    OtherUsesAllSchema,
    FuelTypeSchema,
    ExpectedUseTypeSchema,
    ProvisionOfTheActSchema,
    FuelCodeSchema,
    DeleteOtherUsesResponseSchema,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.role.schema import user_has_roles
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)

# Constants defining which fields to exclude during model operations
OTHER_USE_EXCLUDE_FIELDS = {
    "id",
    "other_uses_id",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
}


class OtherUsesServices:
    def __init__(
        self,
        repo: OtherUsesRepository = Depends(OtherUsesRepository),
        fuel_repo: FuelCodeRepository = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo
        self.compliance_report_repo = compliance_report_repo

    async def schema_to_model(self, other_use: OtherUsesCreateSchema) -> OtherUses:
        """
        Converts data from OtherUsesCreateSchema to OtherUses data model to store into the database.
        """
        fuel_category = await self.fuel_repo.get_fuel_category_by(
            category=other_use.fuel_category
        )
        fuel_type = await self.fuel_repo.get_fuel_type_by_name(other_use.fuel_type)
        expected_use = await self.fuel_repo.get_expected_use_type_by_name(
            other_use.expected_use
        )
        provision_of_the_act = await self.fuel_repo.get_provision_of_the_act_by_name(
            other_use.provision_of_the_act
        )
        fuel_code_id = None
        if other_use.fuel_code:
            fuel_code = await self.fuel_repo.get_fuel_code_by_name(other_use.fuel_code)
            fuel_code_id = fuel_code.fuel_code_id

        return OtherUses(
            **other_use.model_dump(
                exclude={
                    "other_uses_id",
                    "id",
                    "fuel_category",
                    "fuel_type",
                    "provision_of_the_act",
                    "fuel_code",
                    "expected_use",
                    "deleted",
                }
            ),
            fuel_category_id=fuel_category.fuel_category_id,
            fuel_type_id=fuel_type.fuel_type_id,
            provision_of_the_act_id=provision_of_the_act.provision_of_the_act_id,
            fuel_code_id=fuel_code_id,
            expected_use_id=expected_use.expected_use_type_id
        )

    def model_to_schema(self, model: OtherUses):
        """
        Converts data from OtherUses to OtherUsesCreateSchema data model to store into the database.
        """
        updated_schema = OtherUsesSchema(
            other_uses_id=model.other_uses_id,
            compliance_report_id=model.compliance_report_id,
            quantity_supplied=model.quantity_supplied,
            rationale=model.rationale,
            units=model.units,
            fuel_type=model.fuel_type.fuel_type,
            fuel_category=model.fuel_category.category,
            provision_of_the_act=model.provision_of_the_act.name,
            fuel_code=model.fuel_code.fuel_code if model.fuel_code else None,
            ci_of_fuel=model.ci_of_fuel,
            expected_use=model.expected_use.name,
            user_type=model.user_type,
            group_uuid=model.group_uuid,
            version=model.version,
            action_type=model.action_type,
        )
        return updated_schema

    @service_handler
    async def get_table_options(
        self, compliance_period: str
    ) -> OtherUsesTableOptionsSchema:
        """
        Gets the list of table options related to other uses.
        """
        table_options = await self.repo.get_table_options(compliance_period)
        return OtherUsesTableOptionsSchema(
            fuel_categories=[
                OtherUsesFuelCategorySchema.model_validate(category)
                for category in table_options["fuel_categories"]
            ],
            fuel_types=[
                FuelTypeSchema.model_validate(fuel_type)
                for fuel_type in table_options["fuel_types"]
            ],
            units_of_measure=table_options["units_of_measure"],
            expected_uses=[
                ExpectedUseTypeSchema.model_validate(use)
                for use in table_options["expected_uses"]
            ],
            provisions_of_the_act=[
                ProvisionOfTheActSchema.model_validate(provision)
                for provision in table_options["provisions_of_the_act"]
            ],
            fuel_codes=[
                FuelCodeSchema.model_validate(fuel_code)
                for fuel_code in table_options["fuel_codes"]
            ],
        )

    @service_handler
    async def get_other_uses(self, compliance_report_id: int) -> OtherUsesListSchema:
        """
        Gets the list of other uses for a specific compliance report.
        """
        is_gov_user = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
        other_uses = await self.repo.get_other_uses(
            compliance_report_id, exclude_draft_reports=is_gov_user
        )
        return OtherUsesAllSchema(
            other_uses=[OtherUsesSchema.model_validate(
                ou) for ou in other_uses]
        )

    @service_handler
    async def get_other_uses_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> OtherUsesListSchema:
        is_gov_user = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
        other_uses, total_count = await self.repo.get_other_uses_paginated(
            pagination, compliance_report_id, exclude_draft_reports=is_gov_user
        )
        return OtherUsesListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            other_uses=other_uses,
        )

    @service_handler
    async def update_other_use(
        self, other_use_data: OtherUsesCreateSchema, user_type: UserTypeEnum
    ) -> OtherUsesSchema:
        """Update an existing other use"""
        other_use = await self.repo.get_other_use_version_by_user(
            other_use_data.group_uuid, other_use_data.version, user_type
        )

        if not other_use:
            raise ValueError("Other use not found")

        if other_use.compliance_report_id == other_use_data.compliance_report_id:
            # Update existing record if compliance report ID matches
            for field, value in other_use_data.model_dump(
                exclude={
                    "id",
                    "deleted",
                    "fuel_type",
                    "fuel_category",
                    "expected_use",
                    "provision_of_the_act",
                    "fuel_code",
                }
            ).items():
                setattr(other_use, field, value)

            if other_use.fuel_type.fuel_type != other_use_data.fuel_type:
                other_use.fuel_type = await self.fuel_repo.get_fuel_type_by_name(
                    other_use_data.fuel_type
                )

            if other_use.fuel_category.category != other_use_data.fuel_category:
                other_use.fuel_category = await self.fuel_repo.get_fuel_category_by(
                    category=other_use_data.fuel_category
                )

            if other_use.expected_use.name != other_use_data.expected_use:
                other_use.expected_use = (
                    await self.fuel_repo.get_expected_use_type_by_name(
                        other_use_data.expected_use
                    )
                )

            if (
                not other_use.provision_of_the_act
                or other_use.provision_of_the_act.name
                != other_use_data.provision_of_the_act
            ):
                other_use.provision_of_the_act = (
                    await self.fuel_repo.get_provision_of_the_act_by_name(
                        other_use_data.provision_of_the_act
                    )
                )
            if (
                other_use.fuel_code is None
                or other_use_data.fuel_code is None
                or other_use.fuel_code.fuel_code != other_use_data.fuel_code
            ):
                other_use.fuel_code = await self.fuel_repo.get_fuel_code_by_name(
                    other_use_data.fuel_code
                )
            other_use.ci_of_fuel = other_use_data.ci_of_fuel

            updated_use = await self.repo.update_other_use(other_use)
            updated_schema = self.model_to_schema(updated_use)
            return OtherUsesSchema.model_validate(updated_schema)

        else:
            updated_use = await self.create_other_use(
                other_use_data, user_type, existing_record=other_use
            )
            return OtherUsesSchema.model_validate(updated_use)

    @service_handler
    async def create_other_use(
        self,
        other_use_data: OtherUsesCreateSchema,
        user_type: UserTypeEnum,
        existing_record: Optional[OtherUses] = None,
    ) -> OtherUsesSchema:
        """Create a new other use"""
        other_use = await self.schema_to_model(other_use_data)
        new_group_uuid = str(uuid.uuid4())
        other_use.group_uuid = (
            new_group_uuid if not existing_record else existing_record.group_uuid
        )
        other_use.action_type = (
            ActionTypeEnum.CREATE if not existing_record else ActionTypeEnum.UPDATE
        )
        other_use.version = 0 if not existing_record else existing_record.version + 1
        other_use.user_type = user_type
        created_use = await self.repo.create_other_use(other_use)

        return self.model_to_schema(created_use)

    @service_handler
    async def delete_other_use(
        self, other_use_data: OtherUsesCreateSchema, user_type: UserTypeEnum
    ) -> DeleteOtherUsesResponseSchema:
        """Delete an other use"""
        existing_fuel_supply = await self.repo.get_latest_other_uses_by_group_uuid(
            other_use_data.group_uuid
        )

        if existing_fuel_supply.action_type == ActionTypeEnum.DELETE:
            return DeleteOtherUsesResponseSchema(
                success=True, message="Already deleted."
            )

        deleted_entity = OtherUses(
            compliance_report_id=other_use_data.compliance_report_id,
            group_uuid=other_use_data.group_uuid,
            version=existing_fuel_supply.version + 1,
            action_type=ActionTypeEnum.DELETE,
            user_type=user_type,
        )

        # Copy fields from the latest version for the deletion record
        for field in existing_fuel_supply.__table__.columns.keys():
            if field not in OTHER_USE_EXCLUDE_FIELDS:
                setattr(deleted_entity, field, getattr(
                    existing_fuel_supply, field))

        deleted_entity.compliance_report_id = other_use_data.compliance_report_id

        await self.repo.create_other_use(deleted_entity)
        return DeleteOtherUsesResponseSchema(success=True, message="Marked as deleted.")

    @service_handler
    async def get_compliance_report_by_id(self, compliance_report_id: int):
        """Get compliance report by period with status"""
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_by_id(
                compliance_report_id,
            )
        )

        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found for this period",
            )

        return compliance_report
