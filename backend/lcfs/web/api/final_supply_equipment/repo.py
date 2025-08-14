from typing import Any, List, Sequence

import structlog
from fastapi import Depends
from sqlalchemy import and_, delete, distinct, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, aliased

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import Organization
from lcfs.db.models.compliance import (
    AllocationAgreement,
    ComplianceReport,
    EndUserType,
    FinalSupplyEquipment,
)
from lcfs.db.models.compliance.FinalSupplyEquipmentRegNumber import (
    FinalSupplyEquipmentRegNumber,
)
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentCreateSchema,
    PortsEnum,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class FinalSupplyEquipmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fse_options(self, organization) -> tuple[
        Sequence[EndUseType],
        Sequence[LevelOfEquipment],
        Sequence[EndUserType],
        list[str],
        list[str],
    ]:
        """
        Retrieve all FSE options in a single database transaction
        """
        intended_use_types = await self.get_intended_use_types()
        levels_of_equipment = await self.get_levels_of_equipment()
        intended_user_types = await self.get_intended_user_types()
        organization_names = await self.get_organization_names(organization)
        ports = [PortsEnum.SINGLE.value, PortsEnum.DUAL.value]
        return (
            intended_use_types,
            levels_of_equipment,
            intended_user_types,
            ports,
            organization_names,
        )

    async def get_intended_use_types(self) -> Sequence[EndUseType]:
        """
        Retrieve a list of intended use types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUseType).where(EndUseType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_intended_use_by_name(self, intended_use: str) -> EndUseType:
        """
        Retrieve intended use type by name from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUseType).where(
                        and_(
                            EndUseType.type == intended_use,
                            EndUseType.intended_use == True,
                        )
                    )
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve a list of intended user types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(EndUserType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    async def get_organization_names(self, organization: Organization) -> List[str]:
        """
        Retrieve unique organization names for Final Supply Equipment dropdown including:
        1. User's own organization name (as default)
        2. Transaction partner names from allocation agreements
        3. Organization names from existing FSE records

        Args:
            organization (Organization): The user's organization.

        Returns:
            List[str]: A list of unique organization names, with user's org first.
        """
        try:
            if not organization or not organization.organization_id:
                return []

            organization_names = set()

            # 1. Add user's own organization name (primary option)
            if organization.name:
                organization_names.add(organization.name)

            # 2. Add transaction partner names from allocation agreements
            allocation_partners = (
                await self.db.execute(
                    select(distinct(AllocationAgreement.transaction_partner))
                    .join(
                        ComplianceReport,
                        AllocationAgreement.compliance_report_id
                        == ComplianceReport.compliance_report_id,
                    )
                    .filter(
                        ComplianceReport.organization_id == organization.organization_id
                    )
                    .filter(AllocationAgreement.transaction_partner.isnot(None))
                )
            ).all()

            for partner in allocation_partners:
                organization_names.add(partner[0])

            # 3. Add organization names from existing FSE records
            existing_fse_orgs = (
                await self.db.execute(
                    select(distinct(FinalSupplyEquipment.organization_name))
                    .join(
                        ComplianceReport,
                        FinalSupplyEquipment.compliance_report_id
                        == ComplianceReport.compliance_report_id,
                    )
                    .filter(
                        ComplianceReport.organization_id == organization.organization_id
                    )
                    .filter(FinalSupplyEquipment.organization_name.isnot(None))
                )
            ).all()

            for fse_org in existing_fse_orgs:
                organization_names.add(fse_org[0])

            # Convert to sorted list with user's organization first
            result = []
            if organization.name and organization.name in organization_names:
                result.append(organization.name)
                organization_names.remove(organization.name)

            # Add remaining organizations in alphabetical order
            result.extend(sorted(list(organization_names)))

            return result

        except Exception as e:
            logger.error("Error getting organization names", error=str(e))
            return []

    @repo_handler
    async def get_intended_user_by_name(self, intended_user: str) -> EndUserType | None:
        """
        Retrieve intended user type name from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(
                        and_(
                            EndUserType.type_name == intended_user,
                            EndUserType.intended_use == True,
                        )
                    )
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    async def get_levels_of_equipment(self) -> Sequence[LevelOfEquipment]:
        """
        Retrieve a list of levels of equipment from the database
        """
        return (await self.db.execute(select(LevelOfEquipment))).scalars().all()

    @repo_handler
    async def get_level_of_equipment_by_name(self, name: str) -> LevelOfEquipment:
        """
        Get the levels of equipment by name
        """
        return (
            (
                await self.db.execute(
                    select(LevelOfEquipment).where(LevelOfEquipment.name == name)
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    @repo_handler
    async def get_fse_list(self, report_id: int) -> Sequence[FinalSupplyEquipment]:
        """
        Retrieve a list of final supply equipment from the database
        """
        result = await self.db.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(FinalSupplyEquipment.compliance_report_id == report_id)
            .order_by(FinalSupplyEquipment.create_date.asc())
        )
        return result.unique().scalars().all()

    @repo_handler
    async def get_fse_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> tuple[Sequence[FinalSupplyEquipment], Any]:
        """
        Retrieve a list of final supply equipment from the database with pagination
        """
        conditions = [FinalSupplyEquipment.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        query = (
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(*conditions)
        )
        count_query = query.with_only_columns(
            func.count(FinalSupplyEquipment.final_supply_equipment_id)
        ).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.offset(offset)
            .limit(limit)
            .order_by(FinalSupplyEquipment.create_date.asc())
        )
        final_supply_equipments = result.unique().scalars().all()
        return final_supply_equipments, total_count

    @repo_handler
    async def get_final_supply_equipment_by_id(
        self, final_supply_equipment_id: int
    ) -> FinalSupplyEquipment:
        """
        Retrieve a final supply equipment from the database
        """
        result = await self.db.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(
                FinalSupplyEquipment.final_supply_equipment_id
                == final_supply_equipment_id
            )
        )
        return result.unique().scalar_one_or_none()

    @repo_handler
    async def update_final_supply_equipment(
        self, final_supply_equipment: FinalSupplyEquipment
    ) -> FinalSupplyEquipment:
        """
        Update an existing final supply equipment in the database.
        """
        updated_final_supply_equipment = await self.db.merge(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(
            final_supply_equipment,
            ["level_of_equipment", "intended_use_types", "intended_user_types"],
        )
        return updated_final_supply_equipment

    @repo_handler
    async def create_final_supply_equipment(
        self, final_supply_equipment: FinalSupplyEquipment
    ) -> FinalSupplyEquipment:
        """
        Create a new final supply equipment in the database.
        """
        self.db.add(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(
            final_supply_equipment,
            ["level_of_equipment", "intended_use_types"],
        )
        return final_supply_equipment

    @repo_handler
    async def delete_final_supply_equipment(self, final_supply_equipment_id: int):
        """Delete a final supply equipment from the database"""
        await self.db.execute(
            delete(FinalSupplyEquipment).where(
                FinalSupplyEquipment.final_supply_equipment_id
                == final_supply_equipment_id
            )
        )
        await self.db.flush()

    @repo_handler
    async def get_current_seq_by_org_and_postal_code(
        self, organization_code: str, postal_code: str
    ) -> int:
        """
        Retrieve the current sequence number for a given organization code and postal code.
        """
        result = await self.db.execute(
            select(FinalSupplyEquipmentRegNumber.current_sequence_number).where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                    FinalSupplyEquipmentRegNumber.postal_code == postal_code,
                )
            )
        )
        current_sequence_number = result.scalar()
        return current_sequence_number if current_sequence_number is not None else 0

    @repo_handler
    async def increment_seq_by_org_and_postal_code(
        self, organization_code: str, postal_code: str
    ) -> int:
        """
        Increment and return the next sequence number for a given organization code and postal code.
        """
        # Try to update the existing sequence
        result = await self.db.execute(
            update(FinalSupplyEquipmentRegNumber)
            .where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                    FinalSupplyEquipmentRegNumber.postal_code == postal_code,
                )
            )
            .values(
                current_sequence_number=FinalSupplyEquipmentRegNumber.current_sequence_number
                + 1
            )
            .returning(FinalSupplyEquipmentRegNumber.current_sequence_number)
        )
        sequence_number = result.scalar()

        if sequence_number is None:
            # If no existing sequence, insert a new one
            new_record = FinalSupplyEquipmentRegNumber(
                organization_code=organization_code,
                postal_code=postal_code,
                current_sequence_number=1,
            )
            self.db.add(new_record)
            await self.db.flush()
            sequence_number = 1

        return sequence_number

    @repo_handler
    async def reset_seq_by_org(self, organization_code: str):
        """
        Resets the sequence number for a given organization code.
        """
        await self.db.execute(
            update(FinalSupplyEquipmentRegNumber)
            .where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                )
            )
            .values(current_sequence_number=1)
        )

    @repo_handler
    async def check_uniques_of_fse_row(
        self, row: FinalSupplyEquipmentCreateSchema
    ) -> bool:
        """
        Check if a duplicate final supply equipment row exists in the database based on the provided data.
        Returns True if a duplicate is found, False otherwise.
        Only checks within the current compliance report to avoid false duplicates across versions.
        """
        conditions = [
            FinalSupplyEquipment.compliance_report_id == row.compliance_report_id,
            FinalSupplyEquipment.supply_from_date == row.supply_from_date,
            FinalSupplyEquipment.supply_to_date == row.supply_to_date,
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
            FinalSupplyEquipment.postal_code == row.postal_code,
            FinalSupplyEquipment.latitude == row.latitude,
            FinalSupplyEquipment.longitude == row.longitude,
        ]

        if row.final_supply_equipment_id is not None:
            conditions.append(
                FinalSupplyEquipment.final_supply_equipment_id
                != row.final_supply_equipment_id
            )
            logger.debug(
                "FSE uniqueness check - excluding self",
                excluding_fse_id=row.final_supply_equipment_id,
                compliance_report_id=row.compliance_report_id
            )
        else:
            logger.debug(
                "FSE uniqueness check - no exclusion (new record)",
                compliance_report_id=row.compliance_report_id
            )

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)
        found_duplicate = result.scalar()
        
        logger.debug(
            "FSE uniqueness result",
            found_duplicate=found_duplicate,
            final_supply_equipment_id=row.final_supply_equipment_id,
            compliance_report_id=row.compliance_report_id
        )

        return found_duplicate

    @repo_handler
    async def check_overlap_of_fse_row(
        self, row: FinalSupplyEquipmentCreateSchema
    ) -> bool:
        """
        Check if there's an overlapping final supply equipment row in the database based on the provided data.
        Returns True if an overlap is found, False otherwise.
        Only checks within the current compliance report to avoid false overlaps across versions.
        """
        conditions = [
            FinalSupplyEquipment.compliance_report_id == row.compliance_report_id,
            and_(
                FinalSupplyEquipment.supply_from_date <= row.supply_to_date,
                FinalSupplyEquipment.supply_to_date >= row.supply_from_date,
            ),
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
        ]

        if row.final_supply_equipment_id is not None:
            conditions.append(
                FinalSupplyEquipment.final_supply_equipment_id
                != row.final_supply_equipment_id
            )

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)

        return result.scalar()

    @repo_handler
    async def search_manufacturers(self, query: str) -> Sequence[str]:
        """
        Search for manufacturers based on the provided query.
        """
        result = await self.db.execute(
            select(distinct(FinalSupplyEquipment.manufacturer)).where(
                FinalSupplyEquipment.manufacturer.ilike(f"%{query}%")
            )
        )
        return result.scalars().all()

    @repo_handler
    async def delete_all(self, compliance_report_id):
        """
        Deletes all FinalSupplyEquipment records corresponding to a specific
        compliance_report_id.

        :param compliance_report_id: The target compliance report ID.
        :return: The number of deleted records.
        """
        result = await self.db.execute(
            delete(FinalSupplyEquipment).where(
                FinalSupplyEquipment.compliance_report_id == compliance_report_id
            )
        )

        return result.rowcount
