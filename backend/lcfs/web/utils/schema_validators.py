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


def unknown_provision_requires_date(values: dict) -> dict:
    provision_of_the_act = values.get("provisionOfTheAct")
    export_date = values.get("exportDate")

    if (
        provision_of_the_act
        and provision_of_the_act.lower() == "unknown"
        and not export_date
    ):
        errors = [
            {
                "loc": ("exportDate",),
                "msg": "is required when the provision of the act is set to 'Unknown'.",
                "type": "value_error",
            }
        ]
        raise RequestValidationError(errors)

    return values


def quantity_must_be_positive(values: dict) -> dict:
    quantity = values.get("quantity")

    if quantity is not None and quantity <= 0:
        raise RequestValidationError(
            [
                {
                    "loc": ("quantity",),
                    "msg": "must be greater than zero",
                    "type": "value_error",
                }
            ]
        )
    return values


def energy_must_be_within_range(values: dict) -> dict:
    energy = values.get("energy")

    if energy is not None and abs(energy) >= 9999999999:
        formatted_value = f"{energy:,.2f}"
        raise RequestValidationError(
            [
                {
                    "loc": ("energy",),
                    "msg": f"value must be less than 9,999,999,999 but got {formatted_value}",
                    "type": "value_error",
                }
            ]
        )
    return values
