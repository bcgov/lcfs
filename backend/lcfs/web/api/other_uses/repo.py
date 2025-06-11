import structlog
from datetime import date, datetime
from fastapi import Depends
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager
from typing import List, Optional, Dict, Any

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.fuel import FuelCodeStatus
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelInstance import FuelInstance
from lcfs.db.models.fuel.FuelType import FuelType, QuantityUnitsEnum
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class OtherUsesRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_code_repo: FuelCodeRepository = Depends(),
    ):
        self.db = db
        self.fuel_code_repo = fuel_code_repo

    @repo_handler
    async def get_table_options(self, compliance_period: str) -> dict:
        """Get all table options"""
        include_legacy = compliance_period < LCFS_Constants.LEGISLATION_TRANSITION_YEAR
        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        fuel_types = await self.get_formatted_fuel_types(
            include_legacy=include_legacy, compliance_period=int(compliance_period)
        )
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

        fuel_codes = (
            (
                await self.db.execute(
                    select(FuelCode)
                    .join(FuelCodeStatus)
                    .where(
                        and_(
                            FuelCodeStatus.status == "Approved",
                            FuelCode.effective_date
                            <= datetime(
                                int(compliance_period), 12, 31
                            ),  # end of compliance year
                            FuelCode.expiration_date
                            >= datetime(
                                int(compliance_period), 1, 1
                            ),  # within compliance year
                        )
                    )
                )
            )
            .scalars()
            .all()
        )

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
                OtherUses.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.unique().scalars().first()

    @repo_handler
    async def get_other_uses(
        self,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> List[OtherUsesSchema]:
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

        result = await self.get_effective_other_uses(
            group_uuid, compliance_report_id, False, changelog
        )
        return result

    @repo_handler
    async def get_effective_other_uses(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        return_model: bool = False,
        changelog: bool = False,
    ) -> List[OtherUsesSchema]:
        """
        Queries other uses from the database for a specific compliance report.
        If changelog=True, includes deleted records to show history.
        """
        # Get all compliance report IDs in the group up to the specified report
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            and_(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report_group_uuid,
                ComplianceReport.compliance_report_id <= compliance_report_id,
            )
        )

        # Get groups that have any deleted records
        deleted_groups = (
            select(OtherUses.group_uuid)
            .where(
                OtherUses.compliance_report_id.in_(compliance_reports_select),
                OtherUses.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Build query conditions
        conditions = [OtherUses.compliance_report_id.in_(compliance_reports_select)]

        if changelog:
            # In changelog view, include all groups (both active and deleted)
            conditions.extend(
                [
                    or_(
                        ~OtherUses.group_uuid.in_(deleted_groups),
                        OtherUses.group_uuid.in_(deleted_groups),
                    )
                ]
            )
        else:
            # In regular view, exclude any groups that have deleted records
            conditions.extend([~OtherUses.group_uuid.in_(deleted_groups)])

        # Get the latest version of each record
        valid_other_uses_select = (
            select(
                OtherUses.group_uuid,
                func.max(OtherUses.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(OtherUses.group_uuid)
        )

        # Now create a subquery for use in the JOIN
        valid_other_uses_subq = valid_other_uses_select.subquery()

        # Get the actual records with their related data
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
                valid_other_uses_subq,
                and_(
                    OtherUses.group_uuid == valid_other_uses_subq.c.group_uuid,
                    OtherUses.version == valid_other_uses_subq.c.max_version,
                ),
            )
            .order_by(OtherUses.create_date.asc())
        )

        result = await self.db.execute(other_uses_select)
        other_uses = result.unique().scalars().all()

        if return_model:
            return other_uses

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
                action_type=ou.action_type,
            )
            for ou in other_uses
        ]

    async def get_other_uses_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
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

        other_uses = await self.get_effective_other_uses(
            group_uuid, compliance_report_id
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
                joinedload(OtherUses.provision_of_the_act),
                joinedload(OtherUses.fuel_code),
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
    async def get_formatted_fuel_types(
        self, include_legacy=False, compliance_period: int = None
    ) -> List[Dict[str, Any]]:
        """Get all fuel type options with their associated fuel categories and fuel codes for other uses"""
        base_conditions = [
            FuelType.other_uses_fossil_derived == True,
        ]

        # Conditionally add the is_legacy filter
        if not include_legacy:
            base_conditions.append(FuelType.is_legacy == False)

        # Get compliance period id for default CI lookup
        compliance_period_id = None
        if compliance_period:
            cp_result = await self.db.execute(
                select(CompliancePeriod.compliance_period_id).where(
                    CompliancePeriod.description == str(compliance_period)
                )
            )
            compliance_period_id = cp_result.scalar_one_or_none()

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
        approved_fuel_code_status_id = (
            await self.db.execute(
                select(FuelCodeStatus.fuel_code_status_id).where(
                    FuelCodeStatus.status == "Approved"
                )
            )
        ).scalar_one_or_none()
        for fuel_type in fuel_types:
            valid_fuel_codes = [
                fc
                for fc in fuel_type.fuel_codes
                if (
                    fc.effective_date is None
                    or fc.effective_date <= date(compliance_period, 12, 31)
                )
                and (
                    fc.expiration_date is None
                    or fc.expiration_date >= date(compliance_period, 1, 1)
                )
                and (fc.fuel_status_id == approved_fuel_code_status_id)
            ]

            # Get default CI for compliance period
            default_ci = None
            if compliance_period_id:
                default_ci = next(
                    (
                        dci.default_carbon_intensity
                        for dci in fuel_type.default_carbon_intensities
                        if dci.compliance_period_id == compliance_period_id
                    ),
                    None,
                )

            formatted_fuel_type = {
                "fuel_type_id": fuel_type.fuel_type_id,
                "fuel_type": fuel_type.fuel_type,
                "default_carbon_intensity": default_ci,
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
                    for fc in valid_fuel_codes
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

    async def delete_other_use(self, other_uses_id):
        await self.db.execute(
            delete(OtherUses).where(OtherUses.other_uses_id == other_uses_id)
        )
