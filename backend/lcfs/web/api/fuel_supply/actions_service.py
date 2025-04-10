import uuid
import structlog

import uuid
from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSupplyCreateUpdateSchema,
    FuelSupplyResponseSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = structlog.get_logger(__name__)

# Constants defining which fields to exclude during model operations
FUEL_SUPPLY_EXCLUDE_FIELDS = {
    "id",
    "fuel_supply_id",
    "compliance_period",
    "deleted",
    "group_uuid",
    "version",
    "action_type",
    "units",
    "is_new_supplemental_entry",
}


class FuelSupplyActionService:
    """
    Service layer handling CRUD operations and versioning for Fuel Supply records.
    This service manages the creation, update (versioned), and deletion of fuel supplies
    and populates calculated fields required for each record.
    """

    def __init__(
        self,
        repo: FuelSupplyRepository = Depends(),
        fuel_repo: FuelCodeRepository = Depends(),
        fuel_supply_service: FuelSupplyServices = Depends(),
    ):
        """
        Initialize the service with required repositories.

        Args:
            repo (FuelSupplyRepository): Repository for fuel supply operations.
            fuel_repo (FuelCodeRepository): Repository for fuel code operations.
            fuel_supply_service (FuelSupplyServices): Service for fuel supply operations.
        """
        self.repo = repo
        self.fuel_repo = fuel_repo
        self.fuel_supply_service = fuel_supply_service

    async def _populate_fuel_supply_fields(
        self,
        fuel_supply: FuelSupply,
        fs_data: FuelSupplyCreateUpdateSchema,
        compliance_period: str,
    ) -> FuelSupply:
        """
        Populate additional calculated and referenced fields for a FuelSupply instance.

        Args:
            fuel_supply (FuelSupply): The FuelSupply instance to populate.
            fs_data (FuelSupplyCreateUpdateSchema): The data provided for creation or update.

        Returns:
            FuelSupply: The populated FuelSupply instance.
        """
        # Fetch standardized fuel data
        fuel_data = await self.fuel_repo.get_standardized_fuel_data(
            fuel_type_id=fuel_supply.fuel_type_id,
            fuel_category_id=fuel_supply.fuel_category_id,
            end_use_id=fuel_supply.end_use_id,
            compliance_period=compliance_period,
            fuel_code_id=fuel_supply.fuel_code_id,
        )

        # Set units
        fuel_supply.units = QuantityUnitsEnum(fs_data.units)

        # Set calculated fields based on standardized fuel data
        fuel_supply.ci_of_fuel = fuel_data.effective_carbon_intensity
        fuel_supply.target_ci = fuel_data.target_ci
        fuel_supply.eer = fuel_data.eer
        fuel_supply.uci = fuel_data.uci
        fuel_supply.energy_density = (
            fuel_data.energy_density
            if fuel_data.energy_density
            else fs_data.energy_density
        )

        # Calculate total energy if energy density is available
        fuel_supply.energy = (
            int(fuel_supply.energy_density * fuel_supply.quantity)
            if fuel_supply.energy_density
            else 0
        )

        # Calculate compliance units using the direct utility function
        fuel_supply.compliance_units = calculate_compliance_units(
            TCI=fuel_supply.target_ci or 0,
            EER=fuel_supply.eer or 1,
            RCI=fuel_supply.ci_of_fuel or 0,
            UCI=fuel_supply.uci or 0,
            Q=fuel_supply.quantity or 0,
            ED=fuel_supply.energy_density or 0,
        )

        return fuel_supply

    @service_handler
    async def create_fuel_supply(
        self,
        fs_data: FuelSupplyCreateUpdateSchema,
        compliance_period: str,
    ) -> FuelSupplyResponseSchema:
        """
        Create a new fuel supply record.

        - Assigns a unique group UUID and sets the initial version to 0.
        - Uses `ActionTypeEnum.CREATE` to indicate a new record.
        - Populates calculated fields and saves the new record.

        Args:
            fs_data (FuelSupplyCreateUpdateSchema): The data for the new fuel supply.
            compliance_period (int): The compliance period for the new record.

        Returns:
            FuelSupplyResponseSchema: The newly created fuel supply record as a response schema.
        """
        # Assign a unique group UUID for the new fuel supply
        new_group_uuid = str(uuid.uuid4())
        fuel_supply = FuelSupply(
            **fs_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS),
            group_uuid=new_group_uuid,
            version=0,
            action_type=ActionTypeEnum.CREATE,
        )

        # Populate calculated and referenced fields
        fuel_supply = await self._populate_fuel_supply_fields(
            fuel_supply, fs_data, compliance_period
        )

        # Save the populated fuel supply record
        created_supply = await self.repo.create_fuel_supply(fuel_supply)
        return self.fuel_supply_service.map_entity_to_schema(created_supply)

    @service_handler
    async def update_fuel_supply(
        self,
        fs_data: FuelSupplyCreateUpdateSchema,
        compliance_period: str,
    ) -> FuelSupplyResponseSchema:
        """
        Update an existing fuel supply record or create a new version if necessary.

        - Checks if a record exists for the given `group_uuid` and `version`.
        - If `compliance_report_id` matches, updates the existing record.
        - If `compliance_report_id` differs, creates a new version.
        - If no existing record is found, raises an HTTPException.

        Args:
            fs_data (FuelSupplyCreateUpdateSchema): The data for the fuel supply update.
            compliance_period (str): The compliance period for the new record.

        Returns:
            FuelSupplyResponseSchema: The updated or new version of the fuel supply record.

        Raises:
            HTTPException: If the fuel supply record is not found.
        """
        existing_fuel_supply = await self.repo.get_fuel_supply_by_group_version(
            fs_data.group_uuid, fs_data.version
        )

        if (
            existing_fuel_supply
            and existing_fuel_supply.compliance_report_id
            == fs_data.compliance_report_id
        ):
            # Update existing record if compliance report ID matches
            for field, value in fs_data.model_dump(
                exclude=FUEL_SUPPLY_EXCLUDE_FIELDS
            ).items():
                setattr(existing_fuel_supply, field, value)

            # Populate calculated fields
            existing_fuel_supply = await self._populate_fuel_supply_fields(
                existing_fuel_supply, fs_data, compliance_period
            )

            updated_supply = await self.repo.update_fuel_supply(existing_fuel_supply)
            return self.fuel_supply_service.map_entity_to_schema(updated_supply)

        elif existing_fuel_supply:
            # Create a new version if compliance report ID differs
            fuel_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=existing_fuel_supply.version + 1,
                action_type=ActionTypeEnum.UPDATE,
            )

            # Copy existing fields, then apply new data
            for field in existing_fuel_supply.__table__.columns.keys():
                if field not in FUEL_SUPPLY_EXCLUDE_FIELDS:
                    setattr(fuel_supply, field, getattr(existing_fuel_supply, field))

            for field, value in fs_data.model_dump(
                exclude=FUEL_SUPPLY_EXCLUDE_FIELDS
            ).items():
                setattr(fuel_supply, field, value)

            # Populate calculated fields
            fuel_supply = await self._populate_fuel_supply_fields(
                fuel_supply, fs_data, compliance_period
            )

            # Save the new version
            new_supply = await self.repo.create_fuel_supply(fuel_supply)
            return self.fuel_supply_service.map_entity_to_schema(new_supply)

        # Raise an exception if no existing record is found
        raise HTTPException(status_code=404, detail="Fuel supply record not found.")

    @service_handler
    async def delete_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema
    ) -> DeleteFuelSupplyResponseSchema:
        """
        Delete a fuel supply record by creating a new version marked as deleted.

        - Fetches the latest version of the record by `group_uuid`.
        - If already deleted, returns success immediately.
        - Otherwise, creates a new version with `ActionTypeEnum.DELETE`.

        Args:
            fs_data (FuelSupplyCreateUpdateSchema): The data for the fuel supply deletion.

        Returns:
            DeleteFuelSupplyResponseSchema: A response schema confirming deletion.
        """
        existing_fuel_supply = await self.repo.get_latest_fuel_supply_by_group_uuid(
            fs_data.group_uuid
        )

        if existing_fuel_supply.compliance_report_id == fs_data.compliance_report_id:
            await self.repo.delete_fuel_supply(fuel_supply_id=fs_data.fuel_supply_id)
            return DeleteFuelSupplyResponseSchema(
                success=True, message="Marked as deleted."
            )
        else:
            # Create a new version with action_type DELETE
            delete_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=existing_fuel_supply.version + 1,
                action_type=ActionTypeEnum.DELETE,
            )

            # Copy fields from the latest version for the deletion record
            for field in existing_fuel_supply.__table__.columns.keys():
                if field not in FUEL_SUPPLY_EXCLUDE_FIELDS:
                    setattr(delete_supply, field, getattr(existing_fuel_supply, field))

            delete_supply.compliance_report_id = fs_data.compliance_report_id

            delete_supply.units = QuantityUnitsEnum(fs_data.units)

            # Save the deletion record
            await self.repo.create_fuel_supply(delete_supply)
            return DeleteFuelSupplyResponseSchema(
                success=True, message="Marked as deleted."
            )
