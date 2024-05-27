import logging
import json
from pathlib import Path
from sqlalchemy import select

# database models
from lcfs.db.models.EnergyDensity import EnergyDensity
from lcfs.db.models.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.EndUseType import EndUseType
from lcfs.db.models.FuelCategory import FuelCategory
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.ProvisionAct import ProvisionAct
from lcfs.db.models.TransportMode import TransportMode
from lcfs.db.models.UnitOfMeasure import UnitOfMeasure
from lcfs.db.models.FuelType import FuelType

logger = logging.getLogger(__name__)


async def seed_static_fuel_data(session):
    """
    Seeds the static fuel data into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    try:
        with open(Path(__file__).parent / "seed_fuel_data.json") as f_data:
            exists = await session.execute(
                select(TransportMode).where(TransportMode.transport_mode_id == 1)
            )
            if not exists.scalars().first():
                data = json.load(f_data)
                transport_modes_to_seed = [
                    TransportMode(**transport_mode)
                    for transport_mode in data["transport_modes"]
                ]
                provision_of_the_acts_to_seed = [
                    ProvisionAct(**provision) for provision in data["provision_acts"]
                ]
                fuel_types_to_seed = [
                    FuelType(**fuel_type) for fuel_type in data["fuel_types"]
                ]
                fuel_code_prefixes_to_seed = [
                    FuelCodePrefix(**prefix) for prefix in data["fuel_code_prefixes"]
                ]
                fuel_code_statuses_to_seed = [
                    FuelCodeStatus(**status) for status in data["fuel_code_statuses"]
                ]
                fuel_categories_to_seed = [
                    FuelCategory(**category) for category in data["fuel_categories"]
                ]
                end_use_types_to_seed = [
                    EndUseType(**end_use_type) for end_use_type in data["end_use_types"]
                ]
                unit_of_measures_to_seed = [
                    UnitOfMeasure(**unit_of_measure)
                    for unit_of_measure in data["unit_of_measures"]
                ]
                uci_to_seed = [AdditionalCarbonIntensity(**uci) for uci in data["ucis"]]
                eer_to_seed = [EnergyEffectivenessRatio(**eer) for eer in data["eers"]]
                energy_densities_to_seed = [
                    EnergyDensity(**energy_density)
                    for energy_density in data["energy_densities"]
                ]
                # Load static data
                session.add_all(provision_of_the_acts_to_seed)
                session.add_all(transport_modes_to_seed)
                session.add_all(fuel_types_to_seed)
                session.add_all(fuel_code_prefixes_to_seed)
                session.add_all(fuel_code_statuses_to_seed)
                session.add_all(fuel_categories_to_seed)
                session.add_all(end_use_types_to_seed)
                session.add_all(unit_of_measures_to_seed)
                # Load relational data
                session.add_all(uci_to_seed)
                session.add_all(eer_to_seed)
                session.add_all(energy_densities_to_seed)
                await session.commit()
            f_data.close()

    except Exception as e:
        logger.error("Error occurred while seeding transport modes: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
