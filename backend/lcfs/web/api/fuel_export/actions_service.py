import uuid
import structlog

import uuid
from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_export.schema import (
    DeleteFuelExportResponseSchema,
    FuelExportCreateUpdateSchema,
    FuelExportSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import ValidationErrorException
from lcfs.web.utils.calculations import calculate_compliance_units

logger = structlog.get_logger(__name__)

# Constants defining which fields to exclude during model operations
FUEL_EXPORT_EXCLUDE_FIELDS = {
    "id",
    "fuel_export_id",
    "compliance_period",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
    "units",
    "is_new_supplemental_entry",
    "provision_of_the_act",
}


class FuelExportActionService:
    """
    Service layer handling CRUD operations and versioning for Fuel Export records.
    This service manages the creation, update (versioned), and deletion of fuel exports
    and populates calculated fields required for each record.
    """

    def __init__(
        self,
        repo: FuelExportRepository = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo

    async def _populate_fuel_export_fields(
        self, fuel_export: FuelExport, fe_data: FuelExportCreateUpdateSchema
    ) -> FuelExport:
        """
        Populate additional calculated and referenced fields for a FuelExport instance.
        """
        # Fetch standardized fuel data
        fuel_data = await self.fuel_repo.get_standardized_fuel_data(
            fuel_type_id=fuel_export.fuel_type_id,
            fuel_category_id=fuel_export.fuel_category_id,
            end_use_id=fuel_export.end_use_id,
            fuel_code_id=fuel_export.fuel_code_id,
            compliance_period=fe_data.compliance_period,
            provision_of_the_act=fe_data.provision_of_the_act,
            export_date=fe_data.export_date,
        )

        fuel_export.units = QuantityUnitsEnum(fe_data.units)
        fuel_export.ci_of_fuel = fuel_data.effective_carbon_intensity
        fuel_export.target_ci = fuel_data.target_ci
        fuel_export.eer = fuel_data.eer
        fuel_export.energy_density = fuel_data.energy_density
        fuel_export.uci = fuel_data.uci

        # Calculate total energy if energy density is available
        calculated_energy = (
            round(fuel_export.energy_density * fuel_export.quantity)
            if fuel_export.energy_density
            else 0
        )

        if calculated_energy >= 9999999999:
            formatted_quantity = f"{fuel_export.quantity:,}"
            formatted_density = f"{fuel_export.energy_density}"

            raise ValidationErrorException(
                {
                    "errors": [
                        {
                            "fields": ["quantity"],
                            "message": f"Reduce quantity ({formatted_quantity}) or choose a fuel with lower energy density ({formatted_density}).",
                        }
                    ]
                }
            )

        fuel_export.energy = calculated_energy
        # Calculate compliance units using the direct utility function
        compliance_units = calculate_compliance_units(
            TCI=fuel_export.target_ci or 0,
            EER=fuel_export.eer or 1,
            RCI=fuel_export.ci_of_fuel or 0,
            UCI=0,  # Assuming Additional Carbon Intensity Attributable to Use is zero
            Q=fuel_export.quantity or 0,
            ED=fuel_export.energy_density or 0,
        )

        # Adjust compliance units to negative to represent exports
        compliance_units = -compliance_units
        fuel_export.compliance_units = compliance_units if compliance_units < 0 else 0

        return fuel_export

    @service_handler
    async def create_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema
    ) -> FuelExportSchema:
        """
        Create a new fuel export record.

        - Assigns a unique group UUID and sets the initial version to 0.
        - Uses `ActionTypeEnum.CREATE` to indicate a new record.
        - Populates calculated fields and saves the new record.

        Returns the newly created fuel export record as a response schema.
        """
        # Assign a unique group UUID for the new fuel export
        new_group_uuid = str(uuid.uuid4())
        fuel_export = FuelExport(
            **fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS),
            group_uuid=new_group_uuid,
            version=0,
            action_type=ActionTypeEnum.CREATE,
        )

        # Populate calculated and referenced fields
        fuel_export = await self._populate_fuel_export_fields(fuel_export, fe_data)

        # Save the populated fuel export record
        created_export = await self.repo.create_fuel_export(fuel_export)
        return FuelExportSchema.model_validate(created_export)

    @service_handler
    async def update_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema
    ) -> FuelExportSchema:
        """
        Update an existing fuel export record or create a new version if necessary.

        - Checks if a record exists for the given `fuel_export_id`.
        - If `compliance_report_id` matches, updates the existing record.
        - If `compliance_report_id` differs, creates a new version.
        - If no existing record is found, raises an HTTPException.

        Returns the updated or new version of the fuel export record.
        """
        existing_export = await self.repo.get_fuel_export_by_id(fe_data.fuel_export_id)

        if (
            existing_export
            and existing_export.compliance_report_id == fe_data.compliance_report_id
        ):
            # Update existing record if compliance report ID matches
            for field, value in fe_data.model_dump(
                exclude=FUEL_EXPORT_EXCLUDE_FIELDS
            ).items():
                setattr(existing_export, field, value)

            # Populate calculated fields
            existing_export = await self._populate_fuel_export_fields(
                existing_export, fe_data
            )

            updated_export = await self.repo.update_fuel_export(existing_export)
            return FuelExportSchema.model_validate(updated_export)

        elif existing_export:
            # Create a new version if compliance report ID differs
            fuel_export = FuelExport(
                compliance_report_id=fe_data.compliance_report_id,
                group_uuid=fe_data.group_uuid,
                version=existing_export.version + 1,
                action_type=ActionTypeEnum.UPDATE,
            )

            # Copy existing fields, then apply new data
            for field in existing_export.__table__.columns.keys():
                if field not in FUEL_EXPORT_EXCLUDE_FIELDS:
                    setattr(fuel_export, field, getattr(existing_export, field))

            for field, value in fe_data.model_dump(
                exclude=FUEL_EXPORT_EXCLUDE_FIELDS
            ).items():
                setattr(fuel_export, field, value)

            # Populate calculated fields
            fuel_export = await self._populate_fuel_export_fields(fuel_export, fe_data)

            # Save the new version
            new_export = await self.repo.create_fuel_export(fuel_export)
            return FuelExportSchema.model_validate(new_export)

        raise HTTPException(status_code=404, detail="Fuel export record not found.")

    @service_handler
    async def delete_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema
    ) -> DeleteFuelExportResponseSchema:
        """
        Delete a fuel export record by creating a new version marked as deleted.

        Returns a response schema confirming deletion.
        """
        existing_export = await self.repo.get_latest_fuel_export_by_group_uuid(
            fe_data.group_uuid
        )

        if existing_export.compliance_report_id == fe_data.compliance_report_id:
            await self.repo.delete_fuel_export(fe_data.fuel_export_id)
            return DeleteFuelExportResponseSchema(message="Marked as deleted.")
        else:
            delete_export = FuelExport(
                compliance_report_id=fe_data.compliance_report_id,
                group_uuid=fe_data.group_uuid,
                version=(existing_export.version + 1) if existing_export else 0,
                action_type=ActionTypeEnum.DELETE,
            )

            for field in existing_export.__table__.columns.keys():
                if field not in FUEL_EXPORT_EXCLUDE_FIELDS:
                    setattr(delete_export, field, getattr(existing_export, field))

        delete_export.compliance_report_id = fe_data.compliance_report_id

        delete_export.units = QuantityUnitsEnum(fe_data.units)

        await self.repo.create_fuel_export(delete_export)
        return DeleteFuelExportResponseSchema(message="Marked as deleted.")
