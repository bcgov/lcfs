import logging
import json
from pathlib import Path
from sqlalchemy import select

# database models
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.db.models.fuel.FuelType import FuelType, QuantityUnitsEnum
from lcfs.db.models.fuel.TargetCarbonIntensity import TargetCarbonIntensity
from lcfs.db.models.fuel.FuelClass import FuelClass
from lcfs.db.models.compliance import FuelMeasurementType, LevelOfEquipment

logger = logging.getLogger(__name__)

UNITS_MAPPING = {
    "L": QuantityUnitsEnum.Litres,
    "kg": QuantityUnitsEnum.Kilograms,
    "kWh": QuantityUnitsEnum.Kilowatt_hour,
    "m3": QuantityUnitsEnum.Cubic_metres
}

async def seed_static_fuel_data(session):
    """
    Seeds the static fuel data into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    try:
        with open(Path(__file__).parent / "seed_fuel_data.json") as f_data:
            data = json.load(f_data)

            async def add_if_not_exists(model, unique_field, records):
                for record in records:
                    exists = await session.execute(
                        select(model).where(getattr(model, unique_field) == record[unique_field])
                    )
                    if not exists.scalars().first():
                        session.add(model(**record))

            # Ensure fuel_type units are correctly formatted
            for fuel_type in data["fuel_types"]:
                fuel_type["units"] = QuantityUnitsEnum(fuel_type["units"])

            await add_if_not_exists(TransportMode, 'transport_mode_id', data["transport_modes"])
            await add_if_not_exists(ProvisionOfTheAct, 'provision_of_the_act_id', data["provision_acts"])
            await add_if_not_exists(FuelType, 'fuel_type_id', data["fuel_types"])
            await add_if_not_exists(FuelCodePrefix, 'fuel_code_prefix_id', data["fuel_code_prefixes"])
            await add_if_not_exists(FuelCodeStatus, 'fuel_code_status_id', data["fuel_code_statuses"])
            await add_if_not_exists(FuelCategory, 'fuel_category_id', data["fuel_categories"])
            await add_if_not_exists(EndUseType, 'end_use_type_id', data["end_use_types"])
            await add_if_not_exists(UnitOfMeasure, 'uom_id', data["unit_of_measures"])
            await add_if_not_exists(AdditionalCarbonIntensity, 'additional_uci_id', data["ucis"])
            await add_if_not_exists(EnergyEffectivenessRatio, 'eer_id', data["eers"])
            await add_if_not_exists(EnergyDensity, 'energy_density_id', data["energy_densities"])
            await add_if_not_exists(TargetCarbonIntensity, 'target_carbon_intensity_id', data["target_carbon_intensities"])
            await add_if_not_exists(FuelClass, 'fuel_class_id', data["fuel_classes"])
            await add_if_not_exists(FuelMeasurementType, 'fuel_measurement_type_id', data["fuel_measurement_types"])
            await add_if_not_exists(LevelOfEquipment, 'level_of_equipment_id', data["levels_of_equipment"])

            f_data.close()

    except Exception as e:
        logger.error("Error occurred while seeding static fuel data: %s", e)
        raise
