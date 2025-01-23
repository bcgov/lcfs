import structlog
from datetime import date
from typing import List, Optional, Tuple, Dict, Any

from fastapi import Depends
from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, delete, func, case, and_, or_
from sqlalchemy.orm import joinedload, contains_eager
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelType import FuelType, QuantityUnitsEnum
from lcfs.db.models.fuel.FuelInstance import FuelInstance
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import repo_handler
from sqlalchemy.dialects import postgresql

logger = structlog.get_logger(__name__)


class OtherUsesRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_repo: FuelCodeRepository = Depends(),
    ):
        self.db = db
        self.fuel_code_repo = fuel_repo

    @repo_handler
    async def get_table_options(self, compliance_period: str) -> dict:
        """Get all table options"""
        include_legacy = compliance_period < LCFS_Constants.LEGISLATION_TRANSITION_YEAR
        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        fuel_types = await self.get_formatted_fuel_types(include_legacy=include_legacy)
        expected_uses = await self.fuel_code_repo.get_expected_use_types()
        units_of_measure = [unit.value for unit in QuantityUnitsEnum]

        provisions_select = select(ProvisionOfTheAct)
        if include_legacy:
            provisions_select = provisions_select.where(
                ProvisionOfTheAct.is_legacy == True
            )
        provisions_of_the_act = (
            (await self.db.execute(provisions_select)).scalars().all()
        )

        fuel_codes = (await self.db.execute(select(FuelCode))).scalars().all()

        return {
            "fuel_types": fuel_types,
            "fuel_categories": fuel_categories,
            "provisions_of_the_act": provisions_of_the_act,
            "expected_uses": expected_uses,
            "units_of_measure": units_of_measure,
            "fuel_codes": fuel_codes,
        }

    @repo_handler
    async def get_latest_other_uses_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[OtherUses]:
        """
        Retrieve the latest OtherUses record for a given group UUID.
        Government records are prioritized over supplier records by ordering first by `user_type`
        (with GOVERNMENT records coming first) and then by `version` in descending order.
        """
        query = (
            select(OtherUses)
            .where(OtherUses.group_uuid == group_uuid)
            .order_by(
                # OtherUses.user_type == UserTypeEnum.SUPPLIER evaluates to False for GOVERNMENT,
                # thus bringing GOVERNMENT records to the top in the ordered results.
                OtherUses.user_type == UserTypeEnum.SUPPLIER,
                OtherUses.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.unique().scalars().first()

    @repo_handler
    async def get_other_uses(self, compliance_report_id: int) -> List[OtherUsesSchema]:
        """
        Queries other uses from the database for a specific compliance report.
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

        result = await self.get_effective_other_uses(group_uuid)
        return result

    async def get_effective_other_uses(
        self, compliance_report_group_uuid: str
    ) -> List[OtherUsesSchema]:
        """
        Queries other uses from the database for a specific compliance report.
        """

        # Step 1: Subquery to get all compliance_report_ids in the specified group
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            ComplianceReport.compliance_report_group_uuid
            == compliance_report_group_uuid
        )

        # Step 2: Subquery to identify record group_uuids that have any DELETE action
        delete_group_select = (
            select(OtherUses.group_uuid)
            .where(
                OtherUses.compliance_report_id.in_(compliance_reports_select),
                OtherUses.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Step 3: Subquery to find the maximum version and priority per group_uuid,
        # excluding groups with any DELETE action
        user_type_priority = case(
            (OtherUses.user_type == UserTypeEnum.GOVERNMENT, 1),
            (OtherUses.user_type == UserTypeEnum.SUPPLIER, 0),
            else_=0,
        )

        valid_other_uses_select = (
            select(
                OtherUses.group_uuid,
                func.max(OtherUses.version).label("max_version"),
                func.max(user_type_priority).label("max_role_priority"),
            )
            .where(
                OtherUses.compliance_report_id.in_(compliance_reports_select),
                OtherUses.action_type != ActionTypeEnum.DELETE,
                ~OtherUses.group_uuid.in_(delete_group_select),
            )
            .group_by(OtherUses.group_uuid)
        )
        # Now create a subquery for use in the JOIN
        valid_fuel_supplies_subq = valid_other_uses_select.subquery()

        other_uses_select = (
            select(OtherUses)
            .options(
                joinedload(OtherUses.fuel_category),
                joinedload(OtherUses.fuel_type),
                joinedload(OtherUses.expected_use),
                joinedload(OtherUses.provision_of_the_act),
                joinedload(OtherUses.fuel_code),
            )
            .join(
                valid_fuel_supplies_subq,
                and_(
                    OtherUses.group_uuid == valid_fuel_supplies_subq.c.group_uuid,
                    OtherUses.version == valid_fuel_supplies_subq.c.max_version,
                    user_type_priority == valid_fuel_supplies_subq.c.max_role_priority,
                ),
            )
            .order_by(OtherUses.other_uses_id)
        )

        result = await self.db.execute(other_uses_select)
        other_uses = result.unique().scalars().all()

        return [
            OtherUsesSchema(
                other_uses_id=ou.other_uses_id,
                compliance_report_id=ou.compliance_report_id,
                quantity_supplied=ou.quantity_supplied,
                fuel_type=ou.fuel_type.fuel_type,
                fuel_category=ou.fuel_category.category,
                ci_of_fuel=ou.ci_of_fuel,
                provision_of_the_act=(
                    ou.provision_of_the_act.name if ou.provision_of_the_act else None
                ),
                fuel_code=(ou.fuel_code.fuel_code if ou.fuel_code else None),
                expected_use=ou.expected_use.name,
                units=ou.units,
                rationale=ou.rationale,
                group_uuid=ou.group_uuid,
                version=ou.version,
                user_type=ou.user_type,
                action_type=ou.action_type,
            )
            for ou in other_uses
        ]

    async def get_other_uses_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> tuple[list[Any], int] | tuple[list[OtherUsesSchema], int]:
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return [], 0

        # Retrieve effective fuel supplies using the group UUID
        other_uses = await self.get_effective_other_uses(
            compliance_report_group_uuid=group_uuid
        )

        # Manually apply pagination
        total_count = len(other_uses)
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        paginated_other_uses = other_uses[offset : offset + limit]

        return paginated_other_uses, total_count

    @repo_handler
    async def get_other_use(self, other_uses_id: int) -> OtherUses:
        """
        Get a specific other use by id.
        """
        return await self.db.scalar(
            select(OtherUses)
            .options(
                joinedload(OtherUses.fuel_category),
                joinedload(OtherUses.fuel_type),
                joinedload(OtherUses.expected_use),
            )
            .where(OtherUses.other_uses_id == other_uses_id)
        )

    @repo_handler
    async def update_other_use(self, other_use: OtherUses) -> OtherUses:
        """
        Update an existing other use in the database.
        """
        updated_other_use = await self.db.merge(other_use)
        await self.db.flush()
        await self.db.refresh(
            other_use,
            [
                "fuel_category",
                "fuel_type",
                "expected_use",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return updated_other_use

    @repo_handler
    async def create_other_use(self, other_use: OtherUses) -> OtherUses:
        """
        Create a new other use in the database.
        """
        self.db.add(other_use)
        await self.db.flush()
        await self.db.refresh(
            other_use,
            [
                "fuel_category",
                "fuel_type",
                "expected_use",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return other_use

    @repo_handler
    async def delete_other_use(self, other_uses_id: int):
        """Delete an other use from the database"""
        await self.db.execute(
            delete(OtherUses).where(OtherUses.other_uses_id == other_uses_id)
        )
        await self.db.flush()

    @repo_handler
    async def get_other_use_version_by_user(
        self, group_uuid: str, version: int, user_type: UserTypeEnum
    ) -> Optional[OtherUses]:
        """
        Retrieve a specific OtherUses record by group UUID, version, and user_type.
        This method explicitly requires user_type to avoid ambiguity.
        """
        query = (
            select(OtherUses)
            .where(
                OtherUses.group_uuid == group_uuid,
                OtherUses.version == version,
                OtherUses.user_type == user_type,
            )
            .options(
                joinedload(OtherUses.fuel_category),
                joinedload(OtherUses.fuel_type),
                joinedload(OtherUses.expected_use),
                joinedload(OtherUses.provision_of_the_act),
                joinedload(OtherUses.fuel_code),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_formatted_fuel_types(
        self, include_legacy=False
    ) -> List[Dict[str, Any]]:
        """Get all fuel type options with their associated fuel categories and fuel codes for other uses"""
        current_date = date.today()
        base_conditions = [
            FuelType.other_uses_fossil_derived == True,
        ]

        # Conditionally add the is_legacy filter
        if not include_legacy:
            base_conditions.append(FuelType.is_legacy == False)

        combined_conditions = and_(*base_conditions)

        query = (
            select(FuelType)
            .outerjoin(FuelType.fuel_instances)
            .outerjoin(FuelInstance.fuel_category)
            .outerjoin(FuelType.fuel_codes)
            .where(combined_conditions)
            .options(
                contains_eager(FuelType.fuel_instances).contains_eager(
                    FuelInstance.fuel_category
                ),
                contains_eager(FuelType.fuel_codes),
                joinedload(FuelType.provision_1),
                joinedload(FuelType.provision_2),
            )
            .order_by(FuelType.fuel_type)
        )

        result = await self.db.execute(query)
        fuel_types = result.unique().scalars().all()

        # Prepare the data in the format matching your schema
        formatted_fuel_types = []
        for fuel_type in fuel_types:
            valid_fuel_codes = [
                fc for fc in fuel_type.fuel_codes
                if (fc.effective_date is None or fc.effective_date <= current_date) and
                (fc.expiration_date is None or fc.expiration_date > current_date)
            ]

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
                    if (fc.effective_date is None or fc.effective_date <= current_date) and
                    (fc.expiration_date is None or fc.expiration_date > current_date)
                    ],
                "provision_of_the_act": [],
            }

            if fuel_type.provision_1:
                is_fuel_code = "fuel code" in fuel_type.provision_1.name.lower().strip()
                if not is_fuel_code or (is_fuel_code and valid_fuel_codes):
                    formatted_fuel_type["provision_of_the_act"].append(
                        {
                            "provision_of_the_act_id": fuel_type.provision_1_id,
                            "name": fuel_type.provision_1.name,
                        }
                    )

            if fuel_type.provision_2:
                is_fuel_code = "fuel code" in fuel_type.provision_2.name.lower().strip()
                if not is_fuel_code or (is_fuel_code and valid_fuel_codes):
                    formatted_fuel_type["provision_of_the_act"].append(
                        {
                            "provision_of_the_act_id": fuel_type.provision_2_id,
                            "name": fuel_type.provision_2.name,
                        }
                    )

            formatted_fuel_types.append(formatted_fuel_type)

        return formatted_fuel_types
