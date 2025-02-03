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
