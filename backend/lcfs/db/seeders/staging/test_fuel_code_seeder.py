import structlog
import pandas as pd
from pathlib import Path
from datetime import datetime, date
from sqlalchemy import select
from lcfs.db.models.fuel.FuelCode import FuelCode

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
    
    # Prepare all fuel codes to add
    fuel_codes_to_add = []
    
    for idx, row in df.iterrows():
        fuel_code_id = idx + 1  # Start from 1
        
        # Skip if already exists
        if fuel_code_id in existing_ids:
            continue
        
        # Prepare data
        fuel_suffix = clean_str(row['random fuel code'], f"{idx+1}.0")
        carbon_intensity = float(row['Carbon intensity']) if pd.notna(row['Carbon intensity']) else 0.0
        
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
            "feedstock": clean_str(row['Feedstock'], 'Feedstock'),
            "feedstock_location": clean_str(row['Feedstock location'], 'Location'),
            "feedstock_misc": clean_str(row['Misc'], ''),
            "fuel_production_facility_city": clean_str(row['Fuel production facility city'], 'City'),
            "fuel_production_facility_province_state": clean_str(row['Fuel production facility province/state'], 'Province'),
            "fuel_production_facility_country": clean_str(row['Fuel production facility country'], 'Country'),
            "former_company": clean_str(row['Former company'], ''),
            "notes": clean_str(row['Notes'], ''),
        }
        
        fuel_codes_to_add.append(FuelCode(**fuel_code_data))
    
    # Add all new fuel codes at once
    if fuel_codes_to_add:
        session.add_all(fuel_codes_to_add)
        await session.flush()
        logger.info(f"Seeded {len(fuel_codes_to_add)} fuel codes from CSV.")
    else:
        logger.info("All fuel codes already exist, skipping.")
