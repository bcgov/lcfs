from logging import getLogger
from typing import List, Tuple
from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.db.models.compliance.FinalSupplyEquipmentRegNumber import (
    FinalSupplyEquipmentRegNumber,
)
from lcfs.db.models.compliance.FuelMeasurementType import FuelMeasurementType
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.final_supply_equipment.schema import FinalSupplyEquipmentCreateSchema
from sqlalchemy import and_, delete, distinct, exists, select, update
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from sqlalchemy import func

logger = getLogger("final_supply_equipment_repo")


class FinalSupplyEquipmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fse_options(
        self,
    ) -> Tuple[List[EndUseType], List[LevelOfEquipment], List[FuelMeasurementType]]:
        """
        Retrieve all FSE options in a single database transaction
        """
        async with self.db.begin_nested():
            intended_use_types = await self.get_intended_use_types()
            levels_of_equipment = await self.get_levels_of_equipment()
            fuel_measurement_types = await self.get_fuel_measurement_types()
        return intended_use_types, levels_of_equipment, fuel_measurement_types

    async def get_intended_use_types(self) -> List[EndUseType]:
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

    async def get_levels_of_equipment(self) -> List[LevelOfEquipment]:
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

    async def get_fuel_measurement_types(self) -> List[FuelMeasurementType]:
        """
        Retrieve a list of levels of equipment from the database
        """
        return (await self.db.execute(select(FuelMeasurementType))).scalars().all()

    @repo_handler
    async def get_fuel_measurement_type_by_type(self, type: str) -> FuelMeasurementType:
        """
        Get the levels of equipment by name
        """
        return (
            (
                await self.db.execute(
                    select(FuelMeasurementType).where(FuelMeasurementType.type == type)
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    @repo_handler
    async def get_fse_list(self, report_id: int) -> List[FinalSupplyEquipment]:
        """
        Retrieve a list of final supply equipment from the database
        """
        result = await self.db.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.fuel_measurement_type),
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(FinalSupplyEquipment.compliance_report_id == report_id)
            .order_by(FinalSupplyEquipment.final_supply_equipment_id)
        )
        return result.unique().scalars().all()

    @repo_handler
    async def get_fse_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[FinalSupplyEquipment]:
        """
        Retrieve a list of final supply equipment from the database with pagination
        """
        conditions = [FinalSupplyEquipment.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        query = (
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.fuel_measurement_type),
                joinedload(FinalSupplyEquipment.intended_use_types),
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
            .order_by(FinalSupplyEquipment.create_date.desc())
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
                joinedload(FinalSupplyEquipment.fuel_measurement_type),
                joinedload(FinalSupplyEquipment.intended_use_types),
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
            ["fuel_measurement_type", "level_of_equipment", "intended_use_types"],
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
            ["fuel_measurement_type", "level_of_equipment", "intended_use_types"],
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
    async def check_uniques_of_fse_row(self, row: FinalSupplyEquipmentCreateSchema) -> bool:
        """
        Check if a duplicate final supply equipment row exists in the database based on the provided data.
        Returns True if a duplicate is found, False otherwise.
        """
        conditions = [
            FinalSupplyEquipment.supply_from_date == row.supply_from_date,
            FinalSupplyEquipment.supply_to_date == row.supply_to_date,
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
            FinalSupplyEquipment.postal_code == row.postal_code,
            FinalSupplyEquipment.latitude == row.latitude,
            FinalSupplyEquipment.longitude == row.longitude,
        ]
        
        if row.final_supply_equipment_id is not None:
            conditions.append(FinalSupplyEquipment.final_supply_equipment_id != row.final_supply_equipment_id)

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)

        return result.scalar()

    @repo_handler
    async def check_overlap_of_fse_row(self, row: FinalSupplyEquipmentCreateSchema) -> bool:
        """
        Check if there's an overlapping final supply equipment row in the database based on the provided data.
        Returns True if an overlap is found, False otherwise.
        """
        conditions = [
            and_(
                FinalSupplyEquipment.supply_from_date <= row.supply_to_date,
                FinalSupplyEquipment.supply_to_date >= row.supply_from_date
            ),
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
        ]
        
        if row.final_supply_equipment_id is not None:
            conditions.append(FinalSupplyEquipment.final_supply_equipment_id != row.final_supply_equipment_id)

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)

        return result.scalar()

    @repo_handler
    async def search_manufacturers(self, query: str) -> list[str]:
        """
        Search for manufacturers based on the provided query.
        """
        result = await self.db.execute(
            select(distinct(FinalSupplyEquipment.manufacturer)).where(
                FinalSupplyEquipment.manufacturer.ilike(f"%{query}%")
            )
        )
        return result.scalars().all()