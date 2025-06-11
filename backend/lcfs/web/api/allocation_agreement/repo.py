import structlog
from fastapi import Depends
from sqlalchemy import and_, select, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import List, Optional

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.allocation_agreement.schema import AllocationAgreementSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import repo_handler
from sqlalchemy import and_, select, delete, func, text

logger = structlog.get_logger(__name__)


ALLOCATION_AGREEMENT_BULK_DELETE_EXCLUDE_FIELDS = {
    "allocation_agreement_id",
}


class AllocationAgreementRepository:
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
        fuel_types = await self.fuel_code_repo.get_formatted_fuel_types(
            include_legacy=include_legacy, compliance_period=compliance_period
        )
        units_of_measure = [unit.value for unit in QuantityUnitsEnum]
        allocation_transaction_types = (
            (await self.db.execute(select(AllocationTransactionType))).scalars().all()
        )

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
            "allocation_transaction_types": allocation_transaction_types,
            "fuel_types": fuel_types,
            "fuel_categories": fuel_categories,
            "provisions_of_the_act": provisions_of_the_act,
            "fuel_codes": fuel_codes,
            "units_of_measure": units_of_measure,
        }

    @repo_handler
    async def get_allocation_agreements(
        self, compliance_report_id: int, changelog: bool = False
    ) -> List[AllocationAgreementSchema]:
        """
        Queries allocation agreements from the database for a specific compliance report.
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

        return await self.get_effective_allocation_agreements(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
            changelog=changelog,
        )

    async def get_effective_allocation_agreements(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> List[AllocationAgreementSchema]:
        """
        Queries allocation agreements from the database for a specific compliance report.
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
            select(AllocationAgreement.group_uuid)
            .where(
                AllocationAgreement.compliance_report_id.in_(compliance_reports_select),
                AllocationAgreement.action_type == ActionTypeEnum.DELETE,
            )
            .distinct()
        )

        # Build query conditions
        conditions = [
            AllocationAgreement.compliance_report_id.in_(compliance_reports_select)
        ]

        if changelog:
            # In changelog view, include all groups (both active and deleted)
            conditions.extend(
                [
                    or_(
                        ~AllocationAgreement.group_uuid.in_(deleted_groups),
                        AllocationAgreement.group_uuid.in_(deleted_groups),
                    )
                ]
            )
        else:
            # In regular view, exclude any groups that have deleted records
            conditions.extend([~AllocationAgreement.group_uuid.in_(deleted_groups)])

        # Get the latest version of each record
        valid_agreements_select = (
            select(
                AllocationAgreement.group_uuid,
                func.max(AllocationAgreement.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(AllocationAgreement.group_uuid)
        )

        valid_agreements_subq = valid_agreements_select.subquery()

        # Get the actual records with their related data
        allocation_agreements_select = (
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
            )
            .join(
                valid_agreements_subq,
                and_(
                    AllocationAgreement.group_uuid
                    == valid_agreements_subq.c.group_uuid,
                    AllocationAgreement.version == valid_agreements_subq.c.max_version,
                ),
            )
            .order_by(AllocationAgreement.create_date)
        )

        result = await self.db.execute(allocation_agreements_select)
        allocation_agreements = result.unique().scalars().all()

        return [
            AllocationAgreementSchema(
                allocation_agreement_id=allocation_agreement.allocation_agreement_id,
                transaction_partner=allocation_agreement.transaction_partner,
                transaction_partner_email=allocation_agreement.transaction_partner_email,
                transaction_partner_phone=allocation_agreement.transaction_partner_phone,
                postal_address=allocation_agreement.postal_address,
                ci_of_fuel=allocation_agreement.ci_of_fuel,
                quantity=allocation_agreement.quantity,
                q1_quantity=allocation_agreement.q1_quantity,
                q2_quantity=allocation_agreement.q2_quantity,
                q3_quantity=allocation_agreement.q3_quantity,
                q4_quantity=allocation_agreement.q4_quantity,
                units=allocation_agreement.units,
                compliance_report_id=allocation_agreement.compliance_report_id,
                allocation_transaction_type=allocation_agreement.allocation_transaction_type.type,
                fuel_type=allocation_agreement.fuel_type.fuel_type,
                fuel_type_other=allocation_agreement.fuel_type_other,
                fuel_category=allocation_agreement.fuel_category.category,
                provision_of_the_act=allocation_agreement.provision_of_the_act.name,
                # Set fuel_code only if it exists
                fuel_code=(
                    allocation_agreement.fuel_code.fuel_code
                    if allocation_agreement.fuel_code
                    else None
                ),
                group_uuid=allocation_agreement.group_uuid,
                version=allocation_agreement.version,
                action_type=allocation_agreement.action_type,
            )
            for allocation_agreement in allocation_agreements
        ]

    @repo_handler
    async def get_allocation_agreements_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[AllocationAgreementSchema]:
        conditions = [AllocationAgreement.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size

        query = (
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
                joinedload(AllocationAgreement.compliance_report),
            )
            .where(*conditions)
        )

        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        result = await self.db.execute(
            query.offset(offset)
            .limit(limit)
            .order_by(AllocationAgreement.create_date.desc())
        )
        allocation_agreements = result.unique().scalars().all()

        return allocation_agreements, total_count

    @repo_handler
    async def get_allocation_agreement(
        self, allocation_agreement_id: int
    ) -> AllocationAgreement:
        """
        Get a specific allocation agreement by id.
        """
        return await self.db.scalar(
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
                joinedload(AllocationAgreement.compliance_report),
            )
            .where(
                AllocationAgreement.allocation_agreement_id == allocation_agreement_id
            )
        )

    @repo_handler
    async def update_allocation_agreement(
        self, allocation_agreement: AllocationAgreement
    ) -> AllocationAgreement:
        """
        Update an existing allocation agreement in the database.
        """
        updated_allocation_agreement = await self.db.merge(allocation_agreement)
        await self.db.flush()
        await self.db.refresh(
            allocation_agreement,
            [
                "fuel_category",
                "fuel_type",
                "allocation_transaction_type",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return updated_allocation_agreement

    @repo_handler
    async def create_allocation_agreement(
        self, allocation_agreement: AllocationAgreement
    ) -> AllocationAgreement:
        """
        Create a new allocation agreement in the database.
        """
        self.db.add(allocation_agreement)
        await self.db.flush()
        await self.db.refresh(
            allocation_agreement,
            [
                "fuel_category",
                "fuel_type",
                "allocation_transaction_type",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return allocation_agreement

    @repo_handler
    async def delete_allocation_agreement(self, allocation_agreement_id: int):
        """Delete an allocation agreement from the database"""
        await self.db.execute(
            delete(AllocationAgreement).where(
                AllocationAgreement.allocation_agreement_id == allocation_agreement_id
            )
        )
        await self.db.flush()

    @repo_handler
    async def get_allocation_transaction_type_by_name(
        self, type: str
    ) -> AllocationTransactionType:
        result = await self.db.execute(
            select(AllocationTransactionType).where(
                AllocationTransactionType.type == type
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_latest_allocation_agreement_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[AllocationAgreement]:
        """
        Retrieve the latest version of an allocation agreement by group UUID.
        Government records are prioritized over supplier records.
        """
        query = (
            select(AllocationAgreement)
            .where(AllocationAgreement.group_uuid == group_uuid)
            .order_by(
                AllocationAgreement.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.unique().scalars().first()

    async def delete_all_for_report(self, compliance_report_id: int):
        """
        Delete every AllocationAgreement linked to a compliance report
        """
        await self.db.execute(
            delete(AllocationAgreement).where(
                AllocationAgreement.compliance_report_id == compliance_report_id
            )
        )
        await self.db.flush()
