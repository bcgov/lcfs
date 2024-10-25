# File: fuel_export_actions.py

import uuid
from logging import getLogger
from typing import Optional

from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_export.schema import (
    DeleteFuelExportResponseSchema,
    FuelExportCreateUpdateSchema,
    FuelExportResponseSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)


class FuelExportActionService:
    def __init__(self, repo: FuelExportRepository = Depends()) -> None:
        self.repo = repo

    @service_handler
    async def create_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelExportResponseSchema:
        """Create a new fuel export record"""
        new_group_uuid = str(uuid.uuid4())

        # Create new FuelExport record
        fuel_export = FuelExport(
            **fe_data.model_dump(
                exclude={
                    "id",
                    "fuel_export_id",
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
        compliance_units = self.calculate_compliance_units_for_export(fuel_export)
        fuel_export.compliance_units = compliance_units

        # Save new record
        created_export = await self.repo.create_fuel_export(fuel_export)

        return FuelExportResponseSchema.model_validate(created_export)

    @service_handler
    async def update_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelExportResponseSchema:
        """Update an existing fuel export record or create a new version if necessary."""
        # Get the compliance report version
        report_version = await self.repo.get_report_version(
            fe_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        # Fetch existing FuelExport record for this compliance report version and group_uuid
        existing_fuel_export = (
            await self.repo.get_fuel_export_by_group_uuid_and_report_version(
                fe_data.group_uuid, report_version
            )
        )

        if existing_fuel_export:
            # Record exists in current compliance report version; update it
            update_data = fe_data.model_dump(
                exclude={
                    "id",
                    "fuel_export_id",
                    "deleted",
                    "user_type",
                    "version",
                    "compliance_report_id",
                }
            )
            for field, value in update_data.items():
                setattr(existing_fuel_export, field, value)

            # Recalculate compliance units
            compliance_units = self.calculate_compliance_units_for_export(
                existing_fuel_export
            )
            existing_fuel_export.compliance_units = compliance_units

            # Save updates
            updated_export = await self.repo.update_fuel_export(existing_fuel_export)
            return FuelExportResponseSchema.model_validate(updated_export)
        else:
            # Record does not exist for current version; create a new version
            # Fetch the latest record from previous versions
            previous_fuel_export = (
                await self.repo.get_latest_fuel_export_by_group_uuid_before_version(
                    fe_data.group_uuid, report_version
                )
            )
            if not previous_fuel_export:
                raise HTTPException(
                    status_code=404,
                    detail="Fuel export not found in previous versions.",
                )

            # Create a new FuelExport instance
            fuel_export = FuelExport(
                compliance_report_id=fe_data.compliance_report_id,
                group_uuid=fe_data.group_uuid,
                version=report_version,
                action_type=ActionTypeEnum.UPDATE,
                user_type=user_type,
            )

            # Copy data from previous version
            for field in previous_fuel_export.__table__.columns.keys():
                if field not in [
                    "fuel_export_id",
                    "create_date",
                    "update_date",
                    "version",
                    "compliance_report_id",
                    "action_type",
                    "user_type",
                ]:
                    setattr(fuel_export, field, getattr(previous_fuel_export, field))

            # Update fields with new data
            update_data = fe_data.model_dump(
                exclude={
                    "id",
                    "fuel_export_id",
                    "deleted",
                    "user_type",
                    "version",
                    "compliance_report_id",
                }
            )
            for field, value in update_data.items():
                setattr(fuel_export, field, value)

            # Recalculate compliance units
            compliance_units = self.calculate_compliance_units_for_export(fuel_export)
            fuel_export.compliance_units = compliance_units

            # Save the new version
            new_export = await self.repo.create_fuel_export(fuel_export)
            return FuelExportResponseSchema.model_validate(new_export)

    @service_handler
    async def delete_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> DeleteFuelExportResponseSchema:
        """Delete a fuel export record appropriately based on the report version."""
        # Get the compliance report version
        report_version = await self.repo.get_report_version(
            fe_data.compliance_report_id
        )
        if report_version is None:
            raise HTTPException(status_code=404, detail="Compliance report not found.")

        if report_version == 1:
            # Original report, physically delete the record
            success = await self.repo.delete_fuel_export_by_group_uuid(
                fe_data.group_uuid
            )
            if success:
                return DeleteFuelExportResponseSchema(
                    success=True, message="Fuel export record deleted successfully."
                )
            else:
                raise HTTPException(status_code=404, detail="Fuel export not found.")
        else:
            # Supplemental report, create a DELETE action record

            # Check if a DELETE action already exists for this version
            existing_delete = await self.repo.get_fuel_export_by_group_uuid_and_action(
                fe_data.group_uuid, report_version, ActionTypeEnum.DELETE
            )
            if existing_delete:
                # Record already marked as deleted in this version
                return DeleteFuelExportResponseSchema(
                    success=True, message="Fuel export record already deleted."
                )

            # Create a new FuelExport instance with action_type DELETE
            delete_export = FuelExport(
                compliance_report_id=fe_data.compliance_report_id,
                group_uuid=fe_data.group_uuid,
                version=report_version,
                action_type=ActionTypeEnum.DELETE,
                user_type=user_type,
            )

            # Save the DELETE action record
            new_delete = await self.repo.create_fuel_export(delete_export)

            return DeleteFuelExportResponseSchema(
                success=True, message="Fuel export record marked as deleted."
            )

    def calculate_compliance_units_for_export(self, fuel_export: FuelExport) -> float:
        """
        Calculate the compliance units for a single fuel export record.
        """
        # Implement the calculation logic specific to fuel export
        TCI = fuel_export.target_ci or 0  # Target Carbon Intensity
        EER = fuel_export.eer or 0  # Energy Efficiency Ratio
        RCI = fuel_export.ci_of_fuel or 0  # Recorded Carbon Intensity
        UCI = 0  # Additional carbon intensity attributable to use (assumed 0)
        Q = fuel_export.quantity or 0  # Quantity of Fuel Exported
        ED = fuel_export.energy_density or 0  # Energy Density

        # Apply the compliance units formula
        compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
        return compliance_units
