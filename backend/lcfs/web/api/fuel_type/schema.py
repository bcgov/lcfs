from enum import Enum


class FuelTypeQuantityUnitsEnumSchema(str, Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Gigajoules = "Gj"
    Cubic_metres = "m³ (15°C and 1 atm)"
