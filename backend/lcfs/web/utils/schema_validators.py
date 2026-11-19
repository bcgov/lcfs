import re
from fastapi.exceptions import RequestValidationError

# `fuel_suffix` is VARCHAR(20), allowing 18 main-number digits, a dot, and one
# iteration digit.
MAX_FUEL_SUFFIX_MAIN_DIGITS = 18

# An unrecognized ("Other") fuel is reported in litres with the energy density
# the supplier enters. The densest standard liquid fuel is about 39 MJ/L, so a
# value above this is a typo or an inflated figure, not a real fuel.
MAX_OTHER_FUEL_ENERGY_DENSITY = 100


def other_fuel_energy_density_valid(energy_density) -> None:
    """422 unless an Other fuel's energy density is above zero and in range."""
    if energy_density is None or energy_density <= 0:
        message = "Energy Density must be greater than zero when using Other fuel type"
    elif energy_density > MAX_OTHER_FUEL_ENERGY_DENSITY:
        message = (
            "Energy Density must be at most "
            f"{MAX_OTHER_FUEL_ENERGY_DENSITY} when using Other fuel type"
        )
    else:
        return
    raise RequestValidationError(
        [{"loc": ("energyDensity",), "msg": message, "type": "value_error"}]
    )


def fuel_quantity_required(values: dict) -> dict:
    quantity = values.get("quantity")
    if not quantity:
        q1 = values.get("q1Quantity") or values.get("q1_quantity")
        q2 = values.get("q2Quantity") or values.get("q2_quantity")
        q3 = values.get("q3Quantity") or values.get("q3_quantity")
        q4 = values.get("q4Quantity") or values.get("q4_quantity")
        if not q1 and not q2 and not q3 and not q4:
            errors = [
                {
                    "loc": ("quantity",),
                    "msg": "field required",
                    "type": "value_error",
                }
            ]
            raise RequestValidationError(errors)
        compliance_units = values.get("compliance_units") or values.get(
            "complianceUnits"
        )
        if compliance_units is not None and compliance_units < 0:
            errors = [
                {
                    "loc": ("quantity",),
                    "msg": "- For early issuance, any fuel generating negative compliance units is not permitted.",
                    "type": "value_error",
                }
            ]
            raise RequestValidationError(errors)

    return values


def fuel_code_required(values: dict) -> dict:
    # Make this function work with both dictionaries and objects
    if hasattr(values, "get"):
        provision = values.get("provisionOfTheActId")
        fuel_code = values.get("fuelCodeId")
    else:
        # Handle the case when values is not a dictionary
        provision = getattr(values, "provisionOfTheActId", None)
        fuel_code = getattr(values, "fuelCodeId", None)

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


def other_expected_use_required(values: dict) -> dict:
    expected_use = values.get("expected_use") or values.get("expectedUse")
    rationale = values.get("rationale")

    if expected_use == "Other" and (
        rationale is None or not str(rationale).strip()
    ):
        errors = [
            {
                "loc": ("rationale",),
                "msg": "required when Expected use is Other",
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


def fuel_suffix_format_validator(values: dict) -> dict:
    """
    Validates the format of the fuel suffix
    """
    fuel_suffix = values.get("fuelSuffix")

    if fuel_suffix is not None:
        pattern = rf"(?:\d{{3}}|[1-9]\d{{3,{MAX_FUEL_SUFFIX_MAIN_DIGITS - 1}}})\.\d"

        if not re.fullmatch(pattern, fuel_suffix):
            errors = [
                {
                    "loc": ("fuelSuffix",),
                    "msg": (
                        "format is invalid. Use exactly 3 digits, or 4 to 18 digits "
                        "without a leading zero, followed by a decimal point and "
                        "one iteration digit (e.g. '102.5' or '1000.0')."
                    ),
                    "type": "value_error",
                }
            ]
            raise RequestValidationError(errors)

    return values
