from fastapi import Depends
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema


class FuelSupplyValidation:
    def __init__(
        self,
        fs_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        fc_repo: FuelCodeRepository = Depends(FuelCodeRepository),
    ):
        self.fs_repo = fs_repo
        self.fc_repo = fc_repo

    async def check_duplicate(self, fuel_supply: FuelSupplyCreateUpdateSchema):
        return await self.fs_repo.check_duplicate(fuel_supply)

    # Ensure that if a row being added or updated is later undone, its previous data does not conflict with existing rows.
    async def check_duplicate_of_prev_data(
        self, fuel_supply: FuelSupplyCreateUpdateSchema
    ):
        prev_fs = await self.fs_repo.get_prev_fuel_supply_by_group_uuid(
            fuel_supply.group_uuid
        )
        if prev_fs:
            prev_fs_data = FuelSupplyCreateUpdateSchema.model_validate(
                prev_fs, context={"skip_quantity_validation": True}
            )
            return await self.fs_repo.check_duplicate(prev_fs_data)
        return None

    async def validate_other(
        self,
        fuel_supply: FuelSupplyCreateUpdateSchema,
        compliance_period_year: int = None,
    ):
        fuel_type = await self.fc_repo.get_fuel_type_by_id(fuel_supply.fuel_type_id)

        if fuel_type.unrecognized:
            if not fuel_supply.fuel_type_other:
                raise RequestValidationError(
                    [
                        {
                            "loc": ("fuelTypeOther",),
                            "msg": "required when using Other",
                            "type": "value_error",
                        }
                    ]
                )

            if fuel_supply.energy_density is None or fuel_supply.energy_density <= 0:
                raise RequestValidationError(
                    [
                        {
                            "loc": ("energyDensity",),
                            "msg": "Energy Density must be greater than zero when using Other fuel type",
                            "type": "value_error",
                        }
                    ]
                )

        # End use is required for 2024 and later compliance periods
        if (
            compliance_period_year is not None
            and compliance_period_year >= 2024
            and fuel_supply.end_use_id is None
        ):
            raise RequestValidationError(
                [
                    {
                        "loc": ("endUseId",),
                        "msg": "End use is required for compliance periods 2024 and later",
                        "type": "value_error",
                    }
                ]
            )
