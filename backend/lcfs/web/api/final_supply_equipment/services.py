from logging import getLogger
import math
import re
from fastapi import Depends, Request

from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.schema import FinalSupplyEquipmentSchema
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentCreateSchema,
    FinalSupplyEquipmentsSchema,
    FuelMeasurementTypeSchema,
    LevelOfEquipmentSchema,
)
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema
from lcfs.web.core.decorators import service_handler

logger = getLogger(__name__)


class FinalSupplyEquipmentServices:
    def __init__(
        self, request: Request = None, repo: FinalSupplyEquipmentRepository = Depends()
    ) -> None:
        self.request = request
        self.repo = repo

    @service_handler
    async def get_fse_options(self):
        """Fetches all FSE options."""
        intended_use_types = await self.repo.get_intended_use_types()
        levels_of_equipment = await self.repo.get_levels_of_equipment()
        fuel_measurement_types = await self.repo.get_fuel_measurement_types()

        return {
            "intended_use_types": [
                EndUseTypeSchema.model_validate(intended_use_type)
                for intended_use_type in intended_use_types
            ],
            "levels_of_equipment": [
                LevelOfEquipmentSchema.model_validate(level_of_equipment)
                for level_of_equipment in levels_of_equipment
            ],
            "fuel_measurement_types": [
                FuelMeasurementTypeSchema.model_validate(fuel_measurement_type)
                for fuel_measurement_type in fuel_measurement_types
            ],
        }

    async def convert_to_fse_model(self, fse: FinalSupplyEquipmentCreateSchema):
        fse_model = FinalSupplyEquipment(**fse.model_dump(exclude={"id","level_of_equipment","fuel_measurement_type","intended_uses","deleted"}))
        fse_model.level_of_equipment = await self.repo.get_level_of_equipment_by_name(fse.level_of_equipment)
        fse_model.fuel_measurement_type = (await self.repo.get_fuel_measurement_type_by_type(fse.fuel_measurement_type))
        for intended_use in fse.intended_uses:
            fse_model.intended_use_types.append(await self.repo.get_intended_use_by_name(intended_use))
        return fse_model


    @service_handler
    async def get_fse_list(self, compliance_report_id: int) -> FinalSupplyEquipmentsSchema:
        """
        Get the list of FSEs for a given report.
        """
        logger.info(f"Getting FSE list for report {compliance_report_id}")
        fse_models = await self.repo.get_fse_list(compliance_report_id)
        fse_list = [FinalSupplyEquipmentSchema.model_validate(fse) for fse in fse_models]
        return FinalSupplyEquipmentsSchema(final_supply_equipments=fse_list)

    @service_handler
    async def get_final_supply_equipments_paginated(self, pagination: PaginationRequestSchema, compliance_report_id: int) -> FinalSupplyEquipmentsSchema:
        """
        Get the list of FSEs for a given report.
        """
        logger.info(f"Getting FSE list paginated for report {compliance_report_id}")
        final_supply_equipments, total_count = await self.repo.get_fse_paginated(pagination, compliance_report_id)
        return FinalSupplyEquipmentsSchema(
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total_count,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            final_supply_equipments=[FinalSupplyEquipmentSchema.model_validate(fse) for fse in final_supply_equipments],
        )
    
    @service_handler
    async def update_final_supply_equipment(self, fse_data: FinalSupplyEquipmentCreateSchema) -> FinalSupplyEquipmentSchema:
        """Update an existing final supply equipment"""

        existing_fse = await self.repo.get_final_supply_equipment_by_id(fse_data.final_supply_equipment_id)
        if not existing_fse:
            raise ValueError("final supply equipment not found")
        
        existing_fse.serial_nbr = fse_data.serial_nbr
        existing_fse.manufacturer = fse_data.manufacturer
        if existing_fse.fuel_measurement_type.type != fse_data.fuel_measurement_type:
            fuel_measurement_type = await self.repo.get_fuel_measurement_type_by_type(fse_data.fuel_measurement_type)
            existing_fse.fuel_measurement_type = fuel_measurement_type
        if existing_fse.level_of_equipment.name != fse_data.level_of_equipment:
            level_of_equipment = await self.repo.get_level_of_equipment_by_name(fse_data.level_of_equipment)
            existing_fse.level_of_equipment = level_of_equipment
        intended_use_types = []
        for intended_use in fse_data.intended_uses:
            if intended_use not in [intended_use_type.type for intended_use_type in existing_fse.intended_use_types]:
                intended_use_type = await self.repo.get_intended_use_by_name(intended_use)
                intended_use_types.append(intended_use_type)
            else:
                intended_use_types.append(next((intended_use_type for intended_use_type in existing_fse.intended_use_types if intended_use_type.type == intended_use), None))
        existing_fse.intended_use_types = intended_use_types
        existing_fse.street_address = fse_data.street_address
        existing_fse.city = fse_data.city
        existing_fse.postal_code = fse_data.postal_code
        existing_fse.latitude = fse_data.latitude
        existing_fse.longitude = fse_data.longitude
        existing_fse.notes = fse_data.notes

        updated_transfer = await self.repo.update_final_supply_equipment(existing_fse)
        return FinalSupplyEquipmentSchema.model_validate(updated_transfer)

    @service_handler
    async def create_final_supply_equipment(self, fse_data: FinalSupplyEquipmentCreateSchema) -> FinalSupplyEquipmentSchema:
        """Create a new final supply equipment"""
        # Generate the registration number
        registration_nbr = await self.generate_registration_number(fse_data.postal_code)

        final_supply_equipment = await self.convert_to_fse_model(fse_data)
        final_supply_equipment.registration_nbr = registration_nbr
        created_equipment = await self.repo.create_final_supply_equipment(final_supply_equipment)

        # Increment the sequence number for the postal code if creation was successful
        if created_equipment:
            await self.repo.increment_sequence_by_postal_code(fse_data.postal_code)

        return FinalSupplyEquipmentSchema.model_validate(created_equipment)


    @service_handler
    async def delete_final_supply_equipment(self, final_supply_equipment_id: int) -> str:
        """Delete a final supply equipment"""
        return await self.repo.delete_final_supply_equipment(final_supply_equipment_id)


    @service_handler
    async def generate_registration_number(self, postal_code: str) -> str:
        """
        Generate a unique registration number for a Final Supply Equipment (FSE).

        The registration number is composed of the organization ID, the last three characters of the postal code, 
        and a sequential number. The sequential number resets for each new postal code.

        Args:
            postal_code (str): The postal code of the FSE.

        Returns:
            str: The generated unique registration number.

        Raises:
            ValueError: If the postal code is not a valid Canadian postal code, if the organization ID is not available, 
                        or if the maximum registration numbers for the given postal code is exceeded.
        """
        # Validate the postal code format
        postal_code_pattern = re.compile(r"^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$")
        if not postal_code_pattern.match(postal_code):
            raise ValueError("Invalid Canadian postal code format")

        # Retrieve the organization ID from the user's request
        org_code = self.request.user.organization.organization_code
        if not org_code:
            raise ValueError("Organization ID is not available")

        # Extract the last 3 characters of the postal code
        last_three_postal = postal_code[-3:].upper()

        # Retrieve the current sequence number for a given postal code
        current_number = await self.repo.get_current_sequence_by_postal_code(postal_code)
        next_number = current_number + 1

        # Ensure the sequential number is within the 001-999 range
        if next_number > 999:
            raise ValueError("Exceeded maximum registration numbers for the given postal code")

        formatted_next_number = f"{next_number:03d}"

        # Concatenate to form the registration number and return it
        return f"{org_code}-{last_three_postal}-{formatted_next_number}"
