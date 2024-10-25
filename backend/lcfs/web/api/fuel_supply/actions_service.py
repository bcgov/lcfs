# File: fuel_supply_actions.py

import uuid
from logging import getLogger
from typing import Optional

from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.models.compliance.FuelSupply import (
    FuelSupply,
    QuantityUnitsEnum,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.actions_repo import FuelSupplyActionRepo
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSupplyCreateUpdateSchema,
    FuelSupplyResponseSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)


class FuelSupplyActionService:
    def __init__(
        self,
        repo: FuelSupplyRepository = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
        actions_repo: FuelSupplyActionRepo = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo
        self.actions_repo = actions_repo

    # TODO fuel supply logic needs to be fixed
    async def _populate_fuel_supply_fields(
        self, fuel_supply: FuelSupply, fs_data: FuelSupplyCreateUpdateSchema
    ) -> FuelSupply:
        """
        Populate all calculated and looked-up fields for a fuel supply record.
        Returns the updated FuelSupply object.
        """
        # Set units
        fuel_supply.units = QuantityUnitsEnum(fs_data.units)

        # Get fuel type and set basic fields
        fuel_type = await self.fuel_repo.get_fuel_type_by_id(fuel_supply.fuel_type_id)
        if fuel_type.unrecognized:
            fuel_supply.ci_of_fuel = None
            fuel_supply.energy_density = None
            fuel_supply.eer = None
            fuel_supply.energy = 0
        else:
            fuel_supply.ci_of_fuel = fuel_type.default_carbon_intensity

        # Set energy effectiveness ratio
        if fuel_supply.fuel_type_id and fuel_supply.fuel_category_id:
            energy_effectiveness = await self.fuel_repo.get_energy_effectiveness_ratio(
                fuel_supply.fuel_type_id,
                fuel_supply.fuel_category_id,
                fuel_supply.end_use_id,
            )
            fuel_supply.eer = energy_effectiveness.ratio if energy_effectiveness else 1

        # Override CI if fuel code exists
        if fuel_supply.fuel_code_id:
            fuel_code = await self.fuel_repo.get_fuel_code(
                fuel_code_id=fuel_supply.fuel_code_id
            )
            fuel_supply.ci_of_fuel = fuel_code.carbon_intensity

        # Set energy density and calculate energy
        energy_density = await self.fuel_repo.get_energy_density(
            fuel_supply.fuel_type_id
        )
        fuel_supply.energy_density = energy_density.density

        if fuel_supply.energy_density:
            fuel_supply.energy = int(fuel_supply.energy_density * fuel_supply.quantity)

        # Calculate compliance units
        fuel_supply.compliance_units = self.calculate_compliance_units_for_supply(
            fuel_supply
        )

        return fuel_supply

    @service_handler
    async def create_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelSupplyResponseSchema:
        """Create a new fuel supply record"""
        new_group_uuid = str(uuid.uuid4())

        # Create new FuelSupply record
        fuel_supply = FuelSupply(
            **fs_data.model_dump(
                exclude={
                    "id",
                    "fuel_supply_id",
                    "deleted",
                    "group_uuid",
                    "user_type",
                    "version",
                    "action_type",
                }
            ),
            group_uuid=new_group_uuid,
            version=0,
            user_type=user_type,
            action_type=ActionTypeEnum.CREATE,
        )

        # Populate all calculated fields
        fuel_supply = await self._populate_fuel_supply_fields(fuel_supply, fs_data)

        # Save new record
        created_supply = await self.repo.create_fuel_supply(fuel_supply)
        return FuelSupplyResponseSchema.model_validate(created_supply)

    @service_handler
    async def update_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelSupplyResponseSchema:
        """Update an existing fuel supply record or create a new version if necessary."""
        # Get the compliance report version
        report_version = await self.actions_repo.get_report_version(
            fs_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        # Fetch existing FuelSupply record for this compliance report version and group_uuid
        existing_fuel_supply = (
            await self.actions_repo.get_fuel_supply_by_group_uuid_and_report_version(
                fs_data.group_uuid, report_version
            )
        )

        if existing_fuel_supply:
            # Update existing record with new data
            update_data = fs_data.model_dump(
                exclude={
                    "id",
                    "deleted",
                }
            )
            for field, value in update_data.items():
                setattr(existing_fuel_supply, field, value)

            # Populate all calculated fields
            existing_fuel_supply = await self._populate_fuel_supply_fields(
                existing_fuel_supply, fs_data
            )

            # Save updates
            updated_supply = await self.repo.update_fuel_supply(existing_fuel_supply)
            return FuelSupplyResponseSchema.model_validate(updated_supply)
        else:
            # Handle new version creation
            previous_fuel_supply = await self.actions_repo.get_latest_fuel_supply_by_group_uuid_before_version(
                fs_data.group_uuid, report_version
            )
            if not previous_fuel_supply:
                raise HTTPException(
                    status_code=404,
                    detail="Fuel supply not found in previous versions.",
                )

            # Initialize a new FuelSupply instance with copied and updated data
            fuel_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=report_version,
                action_type=ActionTypeEnum.UPDATE,
                user_type=user_type,
            )

            # Copy fields from previous version
            for field in previous_fuel_supply.__table__.columns.keys():
                if field not in [
                    "fuel_supply_id",
                    "create_date",
                    "update_date",
                    "version",
                    "compliance_report_id",
                    "action_type",
                    "user_type",
                ]:
                    setattr(fuel_supply, field, getattr(previous_fuel_supply, field))

            # Apply the updates from fs_data
            update_data = fs_data.model_dump(
                exclude={
                    "id",
                    "fuel_supply_id",
                    "deleted",
                    "user_type",
                    "version",
                    "compliance_report_id",
                }
            )
            for field, value in update_data.items():
                setattr(fuel_supply, field, value)

            # Populate all calculated fields
            fuel_supply = await self._populate_fuel_supply_fields(fuel_supply, fs_data)

            # Save the new version
            new_supply = await self.repo.create_fuel_supply(fuel_supply)
            return FuelSupplyResponseSchema.model_validate(new_supply)

    @service_handler
    async def delete_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> DeleteFuelSupplyResponseSchema:
        """Delete a fuel supply record appropriately based on the report version."""
        # Get the compliance report version
        report_version = await self.actions_repo.get_report_version(
            fs_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        if report_version == 0:
            # Original report, physically delete the record
            success = await self.actions_repo.delete_fuel_supply_by_group_uuid(
                fs_data.group_uuid
            )
            if success:
                return DeleteFuelSupplyResponseSchema(
                    success=True, message="Fuel supply record deleted successfully."
                )
            else:
                raise HTTPException(status_code=404, detail="Fuel supply not found.")
        else:
            # Supplemental report, create a DELETE action record

            # Check if a DELETE action already exists for this version
            existing_delete = (
                await self.actions_repo.get_fuel_supply_by_group_uuid_and_action(
                    fs_data.group_uuid, report_version, ActionTypeEnum.DELETE
                )
            )
            if existing_delete:
                # Record already marked as deleted in this version
                return DeleteFuelSupplyResponseSchema(
                    success=True, message="Fuel supply record already deleted."
                )

            # Create a new FuelSupply instance with action_type DELETE
            delete_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=report_version,
                action_type=ActionTypeEnum.DELETE,
                user_type=user_type,
            )

            # Save the DELETE action record
            new_delete = await self.repo.create_fuel_supply(delete_supply)

            return DeleteFuelSupplyResponseSchema(
                success=True, message="Fuel supply record marked as deleted."
            )

    def calculate_compliance_units_for_supply(self, fuel_supply: FuelSupply) -> float:
        """
        Calculate the compliance units for a single fuel supply record.
        """
        TCI = fuel_supply.target_ci or 0  # Target Carbon Intensity
        EER = fuel_supply.eer or 0  # Energy Efficiency Ratio
        RCI = fuel_supply.ci_of_fuel or 0  # Recorded Carbon Intensity
        UCI = 0  # Additional carbon intensity attributable to use (assumed 0)
        Q = fuel_supply.quantity or 0  # Quantity of Fuel Supplied
        ED = fuel_supply.energy_density or 0  # Energy Density

        # Print out all values used in the calculation for debugging
        print(f"Calculating compliance units with the following values:")
        print(f"  Target Carbon Intensity (TCI): {TCI}")
        print(f"  Energy Efficiency Ratio (EER): {EER}")
        print(f"  Recorded Carbon Intensity (RCI): {RCI}")
        print(f"  Additional Carbon Intensity (UCI): {UCI}")
        print(f"  Quantity of Fuel Supplied (Q): {Q}")
        print(f"  Energy Density (ED): {ED}")

        # Apply the compliance units formula
        compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
        return compliance_units
