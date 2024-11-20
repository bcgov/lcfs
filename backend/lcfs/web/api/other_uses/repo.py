import structlog
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, delete, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import repo_handler

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
    async def get_table_options(self) -> dict:
        """Get all table options"""
        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        fuel_types = await self.fuel_code_repo.get_formatted_fuel_types()
        expected_uses = await self.fuel_code_repo.get_expected_use_types()
        units_of_measure = [unit.value for unit in QuantityUnitsEnum]
        provisions_of_the_act = (
            (await self.db.execute(select(ProvisionOfTheAct))).scalars().all()
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
    async def get_other_uses(self, compliance_report_id: int) -> List[OtherUsesSchema]:
        """
        Queries other uses from the database for a specific compliance report.
        """
        query = (
            select(OtherUses)
            .options(
                joinedload(OtherUses.fuel_category),
                joinedload(OtherUses.fuel_type),
                joinedload(OtherUses.expected_use),
                joinedload(OtherUses.provision_of_the_act),
                joinedload(OtherUses.fuel_code),
            )
            .where(OtherUses.compliance_report_id == compliance_report_id)
            .order_by(OtherUses.other_uses_id)
        )

        result = await self.db.execute(query)
        other_uses = result.unique().scalars().all()

        return [
            OtherUsesSchema(
                other_uses_id=ou.other_uses_id,
                compliance_report_id=ou.compliance_report_id,
                ci_of_fuel=ou.ci_of_fuel,
                fuel_type=ou.fuel_type.fuel_type if ou.fuel_type else None,
                fuel_category=ou.fuel_category.category if ou.fuel_category else None,
                provision_of_the_act=(
                    ou.provision_of_the_act.name if ou.provision_of_the_act else None
                ),
                expected_use=ou.expected_use.name if ou.expected_use else None,
                units=ou.units,
                quantity_supplied=ou.quantity_supplied,
                rationale=ou.rationale,
                fuel_code=(ou.fuel_code.fuel_code if ou.fuel_code else None),
            )
            for ou in other_uses
        ]

    async def get_other_uses_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[OtherUsesSchema]:
        conditions = [OtherUses.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size

        query = (
            select(OtherUses)
            .options(
                joinedload(OtherUses.fuel_category),
                joinedload(OtherUses.fuel_type),
                joinedload(OtherUses.expected_use),
                joinedload(OtherUses.provision_of_the_act),
                joinedload(OtherUses.fuel_code),
            )
            .where(*conditions)
        )

        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        result = await self.db.execute(
            query.offset(offset).limit(limit).order_by(OtherUses.create_date.desc())
        )
        other_uses = result.unique().scalars().all()

        return other_uses, total_count

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
        await self.db.refresh(other_use, ["fuel_category", "fuel_type", "expected_use"])
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
