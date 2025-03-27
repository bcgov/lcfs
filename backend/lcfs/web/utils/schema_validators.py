import re
from fastapi.exceptions import RequestValidationError


def fuel_code_required(values: dict) -> dict:
    provision = values.get("provisionOfTheActId")
    fuel_code = values.get("fuelCodeId")

    if provision == 2 and fuel_code is None:
        errors = [
            {
                "loc": ("fuelCode",),
                "msg": "field required",
                "type": "value_error",
            }
        ]
        raise RequestValidationError(errors)

    return values


def fuel_code_required_label(values: dict) -> dict:
    provision = values.get("provisionOfTheAct")
    fuel_code = values.get("fuelCode")

    if provision == "Fuel code - section 19 (b) (i)" and fuel_code is None:
        errors = [
            {
                "loc": ("fuelCode",),
                "msg": "field required",
                "type": "value_error",
            }
        ]
        raise RequestValidationError(errors)

    return values


def fuel_suffix_format_validator(values: dict) -> dict:
    """
    Validates the format of the fuel suffix
    """
    fuel_suffix = values.get("fuelSuffix")

    if fuel_suffix is not None:
        pattern = r"^\d{3}\.\d{1}$"

        if not re.match(pattern, fuel_suffix):
            errors = [
                {
                    "loc": ("fuelSuffix",),
                    "msg": "format is invalid. Must be like '102.5'.",
                    "type": "value_error",
                }
            ]
            raise RequestValidationError(errors)

    return values
