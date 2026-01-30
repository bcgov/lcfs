import structlog
import pandas as pd
from pathlib import Path
from datetime import datetime, date
from sqlalchemy import select
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode

logger = structlog.get_logger(__name__)


async def seed_test_fuel_codes(session):
    """
    Seeds comprehensive realistic fuel codes into the database from CSV file,
    if they do not already exist.
    
    This seeder reads from data/fuel_codes.csv containing production-like fuel codes.

    Args:
        session: The database session for committing the new records.
    """
    
    # Load CSV file
    csv_path = Path(__file__).parent / "data" / "fuel_codes.csv"
    
    if not csv_path.exists():
        logger.warning(f"Fuel codes CSV not found at {csv_path}, skipping seed.")
        return
    
    df = pd.read_csv(csv_path)
    logger.info(f"Loading {len(df)} fuel codes from CSV...")
    
    # Mapping for prefixes and fuel types (match database IDs)
    prefix_map = {'BCLCF': 1, 'C-BCLCF': 2, 'PROXY': 3}
    fuel_type_map = {
        'Biodiesel': 1,
        'CNG': 2,
        'Compressed natural gas': 2,
        'Electricity': 3,
        'Ethanol': 4,
        'HDRD': 5,
        'Hydrogen': 6,
        'LNG': 7,
        'Natural gas': 7,
        'Alternative jet fuel': 11,
        'Propane': 13,
        'Renewable gasoline': 14,
        'Renewable naphtha': 15,
        'Fossil-derived diesel': 16,
        'Fossil-derived gasoline': 17,
        'Fossil-derived jet fuel': 18,
        'Other': 19,
        'Other diesel fuel': 20,
        'Renewable diesel': 5,  # Same as HDRD
    }
    
    def clean_str(val, default=''):
        """Clean string values from CSV"""
        if pd.isna(val) or val == 'nan':
            return default
        return str(val).strip()
    
    def parse_date(val):
        """Parse date from CSV and return Python date object"""
        if pd.isna(val):
            return date(2024, 1, 1)
        return pd.to_datetime(val).date()
    
    def parse_datetime(val):
        """Parse datetime from CSV and return timezone-aware datetime"""
        if pd.isna(val):
            return datetime(2024, 1, 1)
        # Convert pandas Timestamp to Python datetime (timezone-naive)
        return pd.to_datetime(val).to_pydatetime()
    
    # Query all existing fuel codes at once to avoid autoflush issues
    result = await session.execute(select(FuelCode))
    existing_codes = result.scalars().all()
    existing_ids = {code.fuel_code_id for code in existing_codes}
    
    # Query all transport modes and create a mapping
    transport_modes_result = await session.execute(select(TransportMode))
    transport_modes = transport_modes_result.scalars().all()
    transport_mode_map = {tm.transport_mode: tm for tm in transport_modes}
    
    logger.info(f"Found {len(transport_mode_map)} transport modes")
    
    # Prepare all fuel codes to add
    fuel_codes_to_add = []
    transport_mode_associations = []
    
    for idx, row in df.iterrows():
        fuel_code_id = idx + 1  # Start from 1
        
        # Skip if already exists
        if fuel_code_id in existing_ids:
            continue
        
        # Prepare data
        fuel_suffix = clean_str(row['random fuel code'], f"{idx+1}.0")
        carbon_intensity = float(row['Carbon intensity']) if pd.notna(row['Carbon intensity']) else 0.0
        
        # Parse facility nameplate capacity (cap at int32 max: 2,147,483,647)
        facility_capacity = None
        if pd.notna(row.get('Facility nameplate capacity random')):
            try:
                capacity_value = int(float(row['Facility nameplate capacity random']))
                # Cap at PostgreSQL INTEGER (int32) maximum
                max_int32 = 2147483647
                facility_capacity = min(capacity_value, max_int32)
            except (ValueError, TypeError):
                facility_capacity = None
        
        fuel_code_data = {
            "fuel_code_id": fuel_code_id,
            "fuel_suffix": fuel_suffix,
            "company": clean_str(row['Fake Company'], 'Unknown Company'),
            "carbon_intensity": carbon_intensity,
            "effective_date": parse_date(row['Effective date']),
            "expiration_date": parse_date(row['Expiry date']),
            "fuel_type_id": fuel_type_map.get(row['Fuel'], 1),
            "fuel_status_id": 2,  # Approved
            "prefix_id": prefix_map.get(row['Prefix'], 1),
            "contact_name": clean_str(row['Fake contact name'], 'Contact Name'),
            "contact_email": clean_str(row['Fake contact email'], 'contact@example.com'),
            "edrms": clean_str(row['EDRMS#'], 'EDRMS'),
            # last_updated will be set automatically by server_default
            "application_date": parse_date(row['Application date']),
            "approval_date": parse_date(row.get('Approval date')) if pd.notna(row.get('Approval date')) else None,
            "feedstock": clean_str(row['Feedstock'], 'Feedstock'),
            "feedstock_location": clean_str(row['Feedstock location'], 'Location'),
            "feedstock_misc": clean_str(row['Misc'], ''),
            "fuel_production_facility_city": clean_str(row['Fuel production facility city'], 'City'),
            "fuel_production_facility_province_state": clean_str(row['Fuel production facility province/state'], 'Province'),
            "fuel_production_facility_country": clean_str(row['Fuel production facility country'], 'Country'),
            "facility_nameplate_capacity": facility_capacity,
            "facility_nameplate_capacity_unit": clean_str(row.get('Unit'), None) if pd.notna(row.get('Unit')) else None,
            "former_company": clean_str(row['Former company'], ''),
            "notes": clean_str(row['Notes'], ''),
        }
        
        fuel_codes_to_add.append(FuelCode(**fuel_code_data))
        
        # Store transport mode info for later association
        feedstock_transport = clean_str(row.get('Feedstock transport mode'), '')
        finished_transport = clean_str(row.get('Finished fuel transport mode'), '')
        
        if feedstock_transport or finished_transport:
            transport_mode_associations.append({
                'fuel_code_id': fuel_code_id,
                'feedstock_modes': feedstock_transport,
                'finished_modes': finished_transport
            })
    
    # Add all new fuel codes at once
    if fuel_codes_to_add:
        session.add_all(fuel_codes_to_add)
        await session.flush()
        logger.info(f"Seeded {len(fuel_codes_to_add)} fuel codes from CSV.")
        
        # Now add transport mode associations
        feedstock_associations = []
        finished_associations = []
        
        for assoc in transport_mode_associations:
            fuel_code_id = assoc['fuel_code_id']
            
            # Parse feedstock transport modes (comma-separated)
            if assoc['feedstock_modes']:
                modes = [m.strip() for m in assoc['feedstock_modes'].split(',')]
                for mode_name in modes:
                    transport_mode = transport_mode_map.get(mode_name)
                    if transport_mode:
                        feedstock_associations.append(
                            FeedstockFuelTransportMode(
                                fuel_code_id=fuel_code_id,
                                transport_mode_id=transport_mode.transport_mode_id
                            )
                        )
            
            # Parse finished fuel transport modes (comma-separated)
            if assoc['finished_modes']:
                modes = [m.strip() for m in assoc['finished_modes'].split(',')]
                for mode_name in modes:
                    transport_mode = transport_mode_map.get(mode_name)
                    if transport_mode:
                        finished_associations.append(
                            FinishedFuelTransportMode(
                                fuel_code_id=fuel_code_id,
                                transport_mode_id=transport_mode.transport_mode_id
                            )
                        )
        
        if feedstock_associations:
            session.add_all(feedstock_associations)
            logger.info(f"Seeded {len(feedstock_associations)} feedstock transport mode associations.")
        
        if finished_associations:
            session.add_all(finished_associations)
            logger.info(f"Seeded {len(finished_associations)} finished fuel transport mode associations.")
        
        await session.flush()
    else:
        logger.info("All fuel codes already exist, skipping.")
