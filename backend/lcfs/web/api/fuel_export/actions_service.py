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
    FuelExportSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)

# Constants defining which fields to exclude during model operations
FUEL_EXPORT_EXCLUDE_FIELDS = {
    "id",
    "fuel_export_id",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
}


class FuelExportActionService:
    """
    Service layer handling CRUD operations and versioning for Fuel Export records.
    This service manages the creation, update (versioned), and deletion of fuel exports
    and populates calculated fields required for each record.
    """

    def __init__(self, repo: FuelExportRepository = Depends()) -> None:
        self.repo = repo

    @service_handler
    async def create_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelExportSchema:
        """
        Create a new fuel export record.

        - Assigns a unique group UUID and sets the initial version to 0.
        - Uses `ActionTypeEnum.CREATE` to indicate a new record.
        - Populates calculated fields and saves the new record.

        Returns the newly created fuel export record as a response schema.
        """
        new_group_uuid = str(uuid.uuid4())
        fuel_export = FuelExport(
            **fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS),
            group_uuid=new_group_uuid,
            version=0,
            user_type=user_type,
            action_type=ActionTypeEnum.CREATE,
        )

        # Calculate compliance units and save the record
        fuel_export.compliance_units = self.calculate_compliance_units_for_export(
            fuel_export
        )
        created_export = await self.repo.create_fuel_export(fuel_export)
        return FuelExportSchema.model_validate(created_export)

    @service_handler
    async def update_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelExportSchema:
        """
        Update an existing fuel export record or create a new version if necessary.

        - Checks if a record exists for the given `group_uuid` and `version`.
        - If a matching record exists, updates it; otherwise, creates a new version.

        Returns the updated or new version of the fuel export record.
        """
        existing_export = await self.repo.get_fuel_export_version_by_user(
            fe_data.group_uuid, fe_data.version, user_type
        )

        if existing_export:
            # Update existing record
            for field, value in fe_data.model_dump(exclude={"id", "deleted"}).items():
                setattr(existing_export, field, value)

            existing_export.compliance_units = (
                self.calculate_compliance_units_for_export(existing_export)
            )
            updated_export = await self.repo.update_fuel_export(existing_export)
            return FuelExportSchema.model_validate(updated_export)
        else:
            # Create a new version
            return await self._create_new_version(fe_data, user_type)

    @service_handler
    async def delete_fuel_export(
        self, fe_data: FuelExportCreateUpdateSchema, user_type: UserTypeEnum
    ) -> DeleteFuelExportResponseSchema:
        """
        Delete a fuel export record by creating a new version marked as deleted.

        Returns a response schema confirming deletion.
        """
        latest_export = await self.repo.get_latest_fuel_export_by_group_uuid(
            fe_data.group_uuid
        )

        if latest_export and latest_export.action_type == ActionTypeEnum.DELETE:
            return DeleteFuelExportResponseSchema(
                success=True, message="Fuel export record already deleted."
            )

        delete_export = FuelExport(
            compliance_report_id=fe_data.compliance_report_id,
            group_uuid=fe_data.group_uuid,
            version=(latest_export.version + 1) if latest_export else 0,
            action_type=ActionTypeEnum.DELETE,
            user_type=user_type,
        )
        await self.repo.create_fuel_export(delete_export)
        return DeleteFuelExportResponseSchema(
            success=True, message="Fuel export record marked as deleted."
        )

    async def _create_new_version(
        self,
        fe_data: FuelExportCreateUpdateSchema,
        user_type: UserTypeEnum,
    ) -> FuelExportSchema:
        """
        Helper to create a new version of a fuel export record.
        """
        latest_export = await self.repo.get_latest_fuel_export_by_group_uuid(
            fe_data.group_uuid
        )

        # If there is no existing export in previous versions, raise an error
        if not latest_export:
            raise HTTPException(
                status_code=404, detail="Fuel export not found in previous versions."
            )

        # Create the new version by copying fields and applying updates
        fuel_export = FuelExport(
            compliance_report_id=fe_data.compliance_report_id,
            group_uuid=fe_data.group_uuid,
            version=latest_export.version + 1,
            action_type=ActionTypeEnum.UPDATE,
            user_type=user_type,
        )
        for field in latest_export.__table__.columns.keys():
            if field not in FUEL_EXPORT_EXCLUDE_FIELDS:
                setattr(fuel_export, field, getattr(latest_export, field))

        for field, value in fe_data.model_dump(
            exclude=FUEL_EXPORT_EXCLUDE_FIELDS
        ).items():
            setattr(fuel_export, field, value)

        # Calculate compliance units and save the new version
        fuel_export.compliance_units = self.calculate_compliance_units_for_export(
            fuel_export
        )
        new_export = await self.repo.create_fuel_export(fuel_export)
        return FuelExportSchema.model_validate(new_export)

    def calculate_compliance_units_for_export(self, fuel_export: FuelExport) -> float:
        """
        Calculate the compliance units for a single fuel export record.
        """
        TCI = fuel_export.target_ci or 0  # Target Carbon Intensity
        EER = fuel_export.eer or 0  # Energy Efficiency Ratio
        RCI = fuel_export.ci_of_fuel or 0  # Recorded Carbon Intensity
        Q = fuel_export.quantity or 0  # Quantity of Fuel Exported
        ED = fuel_export.energy_density or 0  # Energy Density

        logger.debug(
            f"Calculating compliance units: TCI={TCI}, EER={EER}, RCI={RCI}, Q={Q}, ED={ED}"
        )
        return calculate_compliance_units(TCI, EER, RCI, 0, Q, ED)
