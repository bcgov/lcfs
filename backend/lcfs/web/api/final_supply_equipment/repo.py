from logging import getLogger
from typing import List
from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.db.models.compliance.FuelMeasurementType import FuelMeasurementType
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.compliance_report.schema import FinalSupplyEquipmentSchema
from sqlalchemy import and_, delete, select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session

logger = getLogger("compliance_reports_repo")


class FinalSupplyEquipmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_intended_use_types(self) -> List[EndUseType]:
        """
        Retrieve a list of intended use types from the database
        """
        return ((await self.db.execute(select(EndUseType).where(EndUseType.intended_use == True)))
            .scalars()
            .all())

    @repo_handler
    async def get_intended_use_by_name(self, intended_use: str) -> EndUseType:
        """
        Retrieve intended use type by name from the database
        """
        return (await self.db.execute(select(EndUseType).where(and_(EndUseType.type == intended_use, EndUseType.intended_use == True)))).unique().scalar_one_or_none()

    @repo_handler
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
        return ((await self.db.execute(select(LevelOfEquipment).where(LevelOfEquipment.name == name)))
            .unique().scalar_one_or_none())

    @repo_handler
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
        return (await self.db.execute(select(FuelMeasurementType).where(FuelMeasurementType.type == type))).unique().scalar_one_or_none()

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
        )
        return result.unique().scalars().all()
    
    @repo_handler
    async def get_final_supply_equipment_by_id(self, final_supply_equipment_id: int) -> FinalSupplyEquipment:
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
            .where(FinalSupplyEquipment.final_supply_equipment_id == final_supply_equipment_id)
        )
        return result.unique().scalar_one_or_none()
    
    @repo_handler
    async def update_final_supply_equipment(self, final_supply_equipment: FinalSupplyEquipment) -> FinalSupplyEquipment:
        """
        Update an existing final supply equipment in the database.
        """
        updated_final_supply_equipment = await self.db.merge(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(final_supply_equipment, ['fuel_measurement_type', 'level_of_equipment', 'intended_use_types'])
        return updated_final_supply_equipment

    @repo_handler
    async def create_final_supply_equipment(self, final_supply_equipment: FinalSupplyEquipment) -> FinalSupplyEquipment:
        """
        Create a new final supply equipment in the database.
        """
        self.db.add(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(final_supply_equipment, ['fuel_measurement_type', 'level_of_equipment', 'intended_use_types'])
        return final_supply_equipment
    
    @repo_handler
    async def delete_final_supply_equipment(self, final_supply_equipment_id: int):
        """Delete a final supply equipment from the database"""
        await self.db.execute(delete(FinalSupplyEquipment).where(FinalSupplyEquipment.final_supply_equipment_id == final_supply_equipment_id))
        await self.db.flush()
