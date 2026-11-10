from datetime import date

import pytest
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.fuel_code.schema import FuelCodeCreateUpdateSchema
from lcfs.web.utils.schema_validators import fuel_suffix_format_validator


@pytest.mark.parametrize(
    "suffix",
    [
        "001.0",
        "102.5",
        "999.0",
        "1000.0",
        "2147483648.0",
        "999999999999999999.9",
    ],
)
def test_fuel_suffix_validator_accepts_supported_digit_range(suffix):
    values = {"fuelSuffix": suffix}

    assert fuel_suffix_format_validator(values) is values


@pytest.mark.parametrize(
    "suffix",
    [
        "1000",
        "1000.10",
        "10.0",
        "abc",
        "0001.0",
        "0102.0",
        "01000.0",
        "1000000000000000000.0",
        "999999999999999999.9\n",
    ],
)
def test_fuel_suffix_validator_rejects_malformed_values_with_example(suffix):
    with pytest.raises(RequestValidationError) as exc:
        fuel_suffix_format_validator({"fuelSuffix": suffix})

    assert "1000.0" in str(exc.value)
    assert "exactly 3 digits, or 4 to 18 digits" in str(exc.value)


@pytest.mark.parametrize("suffix", ["001.0", "102.5", "1000.0", "2147483648.0"])
def test_create_update_schema_accepts_suffix_within_storage_range(suffix):
    schema = FuelCodeCreateUpdateSchema.model_validate(
        {
            "prefixId": 1,
            "fuelSuffix": suffix,
            "carbonIntensity": 10.5,
            "edrms": "EDRMS-TEST",
            "company": "Example Fuel Co",
            "applicationDate": date(2026, 1, 1),
            "approvalDate": date(2026, 1, 2),
            "effectiveDate": date(2026, 1, 3),
            "expirationDate": date(2027, 1, 3),
            "fuelTypeId": 1,
            "feedstock": "Canola",
            "feedstockLocation": "Saskatchewan",
            "fuelProductionFacilityCity": "Example City",
            "fuelProductionFacilityProvinceState": "BC",
            "fuelProductionFacilityCountry": "Canada",
        }
    )

    assert schema.fuel_suffix == suffix
