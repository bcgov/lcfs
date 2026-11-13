from fastapi import Depends
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_export.schema import FuelExportCreateUpdateSchema
from lcfs.web.utils.schema_validators import other_fuel_energy_density_valid


class FuelExportValidation:
    def __init__(
        self,
        fc_repo: FuelCodeRepository = Depends(FuelCodeRepository),
    ):
        self.fc_repo = fc_repo

    async def validate_other(self, fuel_export: FuelExportCreateUpdateSchema):
        fuel_type = await self.fc_repo.get_fuel_type_by_id(fuel_export.fuel_type_id)

        if fuel_type.unrecognized:
            if not fuel_export.fuel_type_other:
                raise RequestValidationError(
                    [
                        {
                            "loc": ("fuelTypeOther",),
                            "msg": "required when using Other",
                            "type": "value_error",
                        }
                    ]
                )

            other_fuel_energy_density_valid(fuel_export.energy_density)