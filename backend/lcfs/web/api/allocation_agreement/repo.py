import structlog
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, delete, func, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.FuelCode import FuelCode

from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.allocation_agreement.schema import AllocationAgreementSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


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
            include_legacy=include_legacy,
            compliance_period=compliance_period
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
        self, compliance_report_id: int
    ) -> List[AllocationAgreementSchema]:
        """
        Queries allocation agreements from the database for a specific compliance report.
        """
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
            .where(AllocationAgreement.compliance_report_id == compliance_report_id)
            .order_by(AllocationAgreement.allocation_agreement_id)
        )
        result = await self.db.execute(query)
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
