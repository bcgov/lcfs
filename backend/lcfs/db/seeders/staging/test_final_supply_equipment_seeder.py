import structlog
import pandas as pd
from pathlib import Path
from datetime import date
from sqlalchemy import select
from lcfs.db.models.compliance.FinalSupplyEquipment import FinalSupplyEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType

logger = structlog.get_logger(__name__)


async def seed_test_final_supply_equipment(session):
    """
    Seeds final supply equipment (FSE) records into the database from CSV file,
    if they do not already exist.
    
    This seeder reads from data/final_supply_equipment.csv containing production-like FSE data.

    Args:
        session: The database session for committing the new records.
    """
    
    # Load CSV file
    csv_path = Path(__file__).parent / "data" / "final_supply_equipment.csv"
    
    if not csv_path.exists():
        logger.warning(f"FSE CSV not found at {csv_path}, skipping seed.")
        return
    
    df = pd.read_csv(csv_path)
    logger.info(f"Loading {len(df)} final supply equipment records from CSV...")
    
    # Mapping for level of equipment
    level_map = {
        'Level 2 - High voltage, operating above level 1': 2,
        'Level 3 - Direct current fast charging': 3
    }
    
    def clean_str(val, default=''):
        """Clean string values from CSV"""
        if pd.isna(val) or val == 'nan':
            return default
        return str(val).strip()
    
    # Query all existing FSE records at once to avoid autoflush issues
    result = await session.execute(select(FinalSupplyEquipment))
    existing_fse = result.scalars().all()
    existing_ids = {fse.final_supply_equipment_id for fse in existing_fse}
    
    # Query all end use types and end user types once
    use_types_result = await session.execute(select(EndUseType))
    use_types_map = {ut.type: ut for ut in use_types_result.scalars().all()}
    
    user_types_result = await session.execute(select(EndUserType))
    user_types_map = {ut.type: ut for ut in user_types_result.scalars().all()}
    
    # Prepare all FSE records to add
    fse_to_add = []
    
    for idx, row in df.iterrows():
        fse_id = idx + 1  # Start from 1
        
        # Skip if already exists
        if fse_id in existing_ids:
            continue
        
        # Assign to different compliance reports (cycle through reports 1-6)
        compliance_report_id = (idx % 6) + 1
        
        # Generate location data
        charging_site = clean_str(row['Charging Site'], f'Site #{idx+1}')
        street_address = charging_site.split('#')[0].strip() + ' Street'
        city = 'Victoria'
        postal_code = f'V{(idx % 9 + 1)}V {(idx % 9 + 1)}V{(idx % 9 + 1)}'
        
        fse_data = {
            "final_supply_equipment_id": fse_id,
            "compliance_report_id": compliance_report_id,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0 + (idx * 100.0),
            "registration_nbr": f"FSE-{fse_id:04d}",
            "serial_nbr": clean_str(row['Serial Number'], f'SERIAL-{fse_id}'),
            "manufacturer": clean_str(row['Manufacturer'], 'Manufacturer'),
            "model": clean_str(row['Model'], 'Model'),
            "level_of_equipment_id": level_map.get(row['Level of Equipment'], 2),
            "ports": clean_str(row['Ports'], 'Single port'),
            "street_address": street_address,
            "city": city,
            "postal_code": postal_code,
            "latitude": float(row['Latitude']) if pd.notna(row['Latitude']) else 48.4284,
            "longitude": float(row['Longitude']) if pd.notna(row['Longitude']) else -123.3656,
            "notes": clean_str(row['Notes'], None) if pd.notna(row['Notes']) else None,
            "organization_name": clean_str(row['Manufacturer'], 'Manufacturer'),
        }
        
        fse = FinalSupplyEquipment(**fse_data)
        
        # Add intended use types
        intended_use = clean_str(row['Intended Uses'], 'Light duty motor vehicles')
        use_type = use_types_map.get(intended_use)
        if use_type:
            fse.intended_use_types.append(use_type)
        
        # Add intended user types
        intended_user = clean_str(row['Intended Users'], 'Public')
        user_type = user_types_map.get(intended_user)
        if user_type:
            fse.intended_user_types.append(user_type)
        
        fse_to_add.append(fse)
    
    # Add all new FSE records at once
    if fse_to_add:
        session.add_all(fse_to_add)
        await session.flush()
        logger.info(f"Seeded {len(fse_to_add)} final supply equipment records from CSV.")
    else:
        logger.info("All final supply equipment records already exist, skipping.")
