from lcfs.db.models.fuel.FuelProductionFacility import FuelProductionFacility


def sync_fuel_code_contacts(facility: FuelProductionFacility) -> None:
    for fuel_code in facility.fuel_codes:
        fuel_code.contact_name = facility.contact_name
        fuel_code.contact_email = facility.contact_email
