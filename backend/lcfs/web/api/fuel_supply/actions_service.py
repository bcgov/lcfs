# File: fuel_supply_actions.py

import uuid
from logging import getLogger
from typing import Optional

from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSupplyCreateUpdateSchema,
    FuelSupplyResponseSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)


class FuelSupplyActionService:
    def __init__(self, repo: FuelSupplyRepository = Depends()) -> None:
        self.repo = repo

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
            version=1,
            user_type=user_type,
            action_type=ActionTypeEnum.CREATE,
        )

        # Calculate compliance units
        compliance_units = self.calculate_compliance_units_for_supply(fuel_supply)
        fuel_supply.compliance_units = compliance_units

        # Save new record
        created_supply = await self.repo.create_fuel_supply(fuel_supply)

        return FuelSupplyResponseSchema.model_validate(created_supply)

    @service_handler
    async def update_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelSupplyResponseSchema:
        """Update an existing fuel supply record or create a new version if necessary."""
        # Get the compliance report version
        report_version = await self.repo.get_report_version(
            fs_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        # Fetch existing FuelSupply record for this compliance report version and group_uuid
        existing_fuel_supply = (
            await self.repo.get_fuel_supply_by_group_uuid_and_report_version(
                fs_data.group_uuid, report_version
            )
        )

        if existing_fuel_supply:
            # Record exists in current compliance report version; update it
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
                setattr(existing_fuel_supply, field, value)

            # Recalculate compliance units
            compliance_units = self.calculate_compliance_units_for_supply(
                existing_fuel_supply
            )
            existing_fuel_supply.compliance_units = compliance_units

            # Save updates
            updated_supply = await self.repo.update_fuel_supply(existing_fuel_supply)
            return FuelSupplyResponseSchema.model_validate(updated_supply)
        else:
            # Record does not exist for current version; create a new version
            # Fetch the latest record from previous versions
            previous_fuel_supply = (
                await self.repo.get_latest_fuel_supply_by_group_uuid_before_version(
                    fs_data.group_uuid, report_version
                )
            )
            if not previous_fuel_supply:
                raise HTTPException(
                    status_code=404,
                    detail="Fuel supply not found in previous versions.",
                )

            # Create a new FuelSupply instance
            fuel_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=report_version,
                action_type=ActionTypeEnum.UPDATE,
                user_type=user_type,
            )

            # Copy data from previous version
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

            # Update fields with new data
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

            # Recalculate compliance units
            compliance_units = self.calculate_compliance_units_for_supply(fuel_supply)
            fuel_supply.compliance_units = compliance_units

            # Save the new version
            new_supply = await self.repo.create_fuel_supply(fuel_supply)
            return FuelSupplyResponseSchema.model_validate(new_supply)

    @service_handler
    async def delete_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> DeleteFuelSupplyResponseSchema:
        """Delete a fuel supply record appropriately based on the report version."""
        # Get the compliance report version
        report_version = await self.repo.get_report_version(
            fs_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        if report_version == 1:
            # Original report, physically delete the record
            success = await self.repo.delete_fuel_supply_by_group_uuid(
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
            existing_delete = await self.repo.get_fuel_supply_by_group_uuid_and_action(
                fs_data.group_uuid, report_version, ActionTypeEnum.DELETE
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

        # Apply the compliance units formula
        compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
        return compliance_units
