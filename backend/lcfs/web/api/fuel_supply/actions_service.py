import uuid
from logging import getLogger
from typing import Optional

from fastapi import Depends, HTTPException

from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply, QuantityUnitsEnum
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSupplyCreateUpdateSchema,
    FuelSupplyResponseSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.utils.calculations import calculate_compliance_units

logger = getLogger(__name__)

# Constants defining which fields to exclude during model operations
FUEL_SUPPLY_EXCLUDE_FIELDS = {
    "id",
    "fuel_supply_id",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
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
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo

    async def _populate_fuel_supply_fields(
        self, fuel_supply: FuelSupply, fs_data: FuelSupplyCreateUpdateSchema
    ) -> FuelSupply:
        """
        Populate additional calculated and referenced fields for a FuelSupply instance.

        This method:
        - Sets unit types
        - Populates default and overridden carbon intensities (CI)
        - Calculates energy density, effectiveness ratios, and compliance units

        Returns the updated FuelSupply object with calculated fields populated.
        """
        # Set quantity units
        fuel_supply.units = QuantityUnitsEnum(fs_data.units)

        # Get the fuel type details to check if it's unrecognized and set basic properties
        fuel_type = await self.fuel_repo.get_fuel_type_by_id(fuel_supply.fuel_type_id)
        if fuel_type.unrecognized:
            # Unrecognized fuel type, reset specific properties
            fuel_supply.ci_of_fuel = None
            fuel_supply.energy_density = None
            fuel_supply.eer = None
            fuel_supply.energy = 0
        else:
            # Standard fuel type, set default carbon intensity
            fuel_supply.ci_of_fuel = fuel_type.default_carbon_intensity

        # Set the Energy Effectiveness Ratio (EER) based on fuel type, category, and end-use
        if (
            fuel_supply.fuel_type_id
            and fuel_supply.fuel_category_id
            and fuel_supply.end_use_id
        ):
            energy_effectiveness = await self.fuel_repo.get_energy_effectiveness_ratio(
                fuel_supply.fuel_type_id,
                fuel_supply.fuel_category_id,
                fuel_supply.end_use_id,
            )
            fuel_supply.eer = energy_effectiveness.ratio if energy_effectiveness else 1

        # Override carbon intensity if a specific fuel code is assigned
        if fuel_supply.fuel_code_id:
            fuel_code = await self.fuel_repo.get_fuel_code(fuel_supply.fuel_code_id)
            fuel_supply.ci_of_fuel = fuel_code.carbon_intensity

        # Determine energy density based on fuel type or custom value
        if (
            fuel_type.fuel_type
            == "Other"  # TODO this should be an enum/constant lookup
        ):
            energy_density = (
                fs_data.energy_density
            )  # Use provided energy density for custom types
        else:
            energy_density = (
                await self.fuel_repo.get_energy_density(fuel_supply.fuel_type_id)
            ).density

        fuel_supply.energy_density = energy_density

        # Calculate total energy
        if fuel_supply.energy_density:
            fuel_supply.energy = int(fuel_supply.energy_density * fuel_supply.quantity)

        # Calculate compliance units for this fuel supply record
        fuel_supply.compliance_units = self.calculate_compliance_units_for_supply(
            fuel_supply
        )

        return fuel_supply

    async def _populate_and_save_fuel_supply(self, fuel_supply, fs_data):
        """
        Helper function to populate fields and save a fuel supply record.

        Uses _populate_fuel_supply_fields to add calculated fields, then saves the populated record.
        """
        fuel_supply = await self._populate_fuel_supply_fields(fuel_supply, fs_data)
        return await self.repo.create_fuel_supply(fuel_supply)

    @service_handler
    async def create_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelSupplyResponseSchema:
        """
        Create a new fuel supply record.

        - Assigns a unique group UUID and sets the initial version to 0.
        - Uses `ActionTypeEnum.CREATE` to indicate a new record.
        - Calls `_populate_and_save_fuel_supply` to add calculated fields and save.

        Returns the newly created fuel supply record as a response schema.
        """
        new_group_uuid = str(uuid.uuid4())
        fuel_supply = FuelSupply(
            **fs_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS),
            group_uuid=new_group_uuid,
            version=0,
            user_type=user_type,
            action_type=ActionTypeEnum.CREATE,
        )
        created_supply = await self._populate_and_save_fuel_supply(fuel_supply, fs_data)
        return FuelSupplyResponseSchema.model_validate(created_supply)

    @service_handler
    async def update_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> FuelSupplyResponseSchema:
        """
        Update an existing fuel supply record or create a new version if necessary.

        - Checks if a record exists for the given `group_uuid` and `version`.
        - If `compliance_report_id` matches, updates the existing record.
        - If `compliance_report_id` differs, a new version is created.

        Returns the updated or new version of the fuel supply record.
        """
        existing_fuel_supply = await self.repo.get_fuel_supply_version_by_user(
            fs_data.group_uuid, fs_data.version, user_type
        )

        if (
            existing_fuel_supply
            and existing_fuel_supply.compliance_report_id
            == fs_data.compliance_report_id
        ):
            # Update existing record if compliance report ID matches
            for field, value in fs_data.model_dump(exclude={"id", "deleted"}).items():
                setattr(existing_fuel_supply, field, value)

            updated_supply = await self.repo.update_fuel_supply(
                await self._populate_fuel_supply_fields(existing_fuel_supply, fs_data)
            )
            return FuelSupplyResponseSchema.model_validate(updated_supply)

        elif existing_fuel_supply:
            # Create a new version if compliance report ID differs
            fuel_supply = FuelSupply(
                compliance_report_id=fs_data.compliance_report_id,
                group_uuid=fs_data.group_uuid,
                version=existing_fuel_supply.version + 1,
                action_type=ActionTypeEnum.UPDATE,
                user_type=user_type,
            )

            # Copy existing fields, then apply new data
            for field in existing_fuel_supply.__table__.columns.keys():
                if field not in FUEL_SUPPLY_EXCLUDE_FIELDS:
                    setattr(fuel_supply, field, getattr(existing_fuel_supply, field))

            for field, value in fs_data.model_dump(
                exclude=FUEL_SUPPLY_EXCLUDE_FIELDS
            ).items():
                setattr(fuel_supply, field, value)

            new_supply = await self._populate_and_save_fuel_supply(fuel_supply, fs_data)
            return FuelSupplyResponseSchema.model_validate(new_supply)

        raise HTTPException(status_code=404, detail="Fuel supply record not found.")

    @service_handler
    async def delete_fuel_supply(
        self, fs_data: FuelSupplyCreateUpdateSchema, user_type: UserTypeEnum
    ) -> DeleteFuelSupplyResponseSchema:
        """
        Delete a fuel supply record by creating a new version marked as deleted.

        - Fetches the latest version of the record by `group_uuid`.
        - If already deleted, returns success immediately.
        - Otherwise, creates a new version with `ActionTypeEnum.DELETE`.

        Returns a response schema confirming deletion.
        """
        existing_fuel_supply = await self.repo.get_latest_fuel_supply_by_group_uuid(
            fs_data.group_uuid
        )

        if existing_fuel_supply.action_type == ActionTypeEnum.DELETE:
            return DeleteFuelSupplyResponseSchema(
                success=True, message="Already deleted."
            )

        delete_supply = FuelSupply(
            compliance_report_id=fs_data.compliance_report_id,
            group_uuid=fs_data.group_uuid,
            version=existing_fuel_supply.version + 1,
            action_type=ActionTypeEnum.DELETE,
            user_type=user_type,
        )

        # Copy fields from the latest version for the deletion record
        for field in existing_fuel_supply.__table__.columns.keys():
            if field not in FUEL_SUPPLY_EXCLUDE_FIELDS:
                setattr(delete_supply, field, getattr(existing_fuel_supply, field))

        await self.repo.create_fuel_supply(delete_supply)
        return DeleteFuelSupplyResponseSchema(
            success=True, message="Marked as deleted."
        )

    def calculate_compliance_units_for_supply(self, fuel_supply: FuelSupply) -> float:
        """
        Calculate compliance units based on fuel supply properties.

        Uses a formula incorporating Target Carbon Intensity (TCI), Recorded Carbon Intensity (RCI),
        Energy Effectiveness Ratio (EER), and fuel properties like quantity and energy density.

        Logs the calculation inputs for debugging and returns the computed compliance units.
        """
        TCI = fuel_supply.target_ci or 0
        EER = fuel_supply.eer or 0
        RCI = fuel_supply.ci_of_fuel or 0
        Q = fuel_supply.quantity or 0
        ED = fuel_supply.energy_density or 0

        logger.debug(
            f"Calculating compliance units: TCI={TCI}, EER={EER}, RCI={RCI}, Q={Q}, ED={ED}"
        )
        return calculate_compliance_units(TCI, EER, RCI, 0, Q, ED)
