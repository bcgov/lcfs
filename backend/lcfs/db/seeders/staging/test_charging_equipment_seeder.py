import structlog
import pandas as pd
from pathlib import Path
from sqlalchemy import select
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus

logger = structlog.get_logger(__name__)


async def seed_test_charging_equipment(session):
    """
    Seeds charging equipment into the database from CSV file,
    linking them to their corresponding charging sites.
    
    This seeder reads from data/final_supply_equipment.csv containing
    charging equipment data that should be linked to charging sites.

    Args:
        session: The database session for committing the new records.
    """
    
    # Load CSV file
    csv_path = Path(__file__).parent / "data" / "final_supply_equipment.csv"
    
    if not csv_path.exists():
        logger.warning(f"Charging equipment CSV not found at {csv_path}, skipping seed.")
        return
    
    df = pd.read_csv(csv_path)
    logger.info(f"Loading {len(df)} charging equipment records from CSV...")
    
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
    
    # Query all existing charging equipment at once
    result = await session.execute(select(ChargingEquipment))
    existing_equipment = result.scalars().all()
    existing_serials = {eq.serial_number for eq in existing_equipment}
    
    # Query all charging sites and create a mapping by site name
    sites_result = await session.execute(select(ChargingSite))
    all_sites = sites_result.scalars().all()
    sites_by_name = {site.site_name: site for site in all_sites}
    
    logger.info(f"Found {len(sites_by_name)} charging sites in database")
    
    # Query all end use types and end user types once
    use_types_result = await session.execute(select(EndUseType))
    use_types_map = {ut.type: ut for ut in use_types_result.scalars().all()}
    
    user_types_result = await session.execute(select(EndUserType))
    user_types_map = {ut.type_name: ut for ut in user_types_result.scalars().all()}
    
    # Query equipment status - default to "Validated" (status_id 4)
    status_result = await session.execute(
        select(ChargingEquipmentStatus).where(ChargingEquipmentStatus.status == "Validated")
    )
    validated_status = status_result.scalar_one_or_none()
    if not validated_status:
        logger.warning("Validated status not found, using status_id 1 as default")
        default_status_id = 1
    else:
        default_status_id = validated_status.charging_equipment_status_id
    
    # Prepare all charging equipment to add
    equipment_to_add = []
    skipped_count = 0
    
    for idx, row in df.iterrows():
        # Extract serial number
        serial_number = clean_str(row['Serial Number'], f'SERIAL-{idx+1}')
        
        # Skip if already exists
        if serial_number in existing_serials:
            skipped_count += 1
            continue
        
        # Find the charging site by name
        charging_site_name = clean_str(row['Charging Site'], '')
        charging_site = sites_by_name.get(charging_site_name)
        
        if not charging_site:
            logger.warning(f"Charging site '{charging_site_name}' not found for equipment {serial_number}, skipping")
            skipped_count += 1
            continue
        
        equipment_data = {
            "charging_site_id": charging_site.charging_site_id,
            "status_id": default_status_id,
            "serial_number": serial_number,
            "manufacturer": clean_str(row['Manufacturer'], 'Manufacturer'),
            "model": clean_str(row['Model'], 'Model'),
            "level_of_equipment_id": level_map.get(row['Level of Equipment'], 2),
            "ports": clean_str(row['Ports'], 'Single port'),
            "latitude": float(row['Latitude']) if pd.notna(row['Latitude']) else None,
            "longitude": float(row['Longitude']) if pd.notna(row['Longitude']) else None,
            "notes": clean_str(row['Notes'], None) if pd.notna(row['Notes']) else None,
        }
        
        equipment = ChargingEquipment(**equipment_data)
        
        # Add intended use types
        intended_use = clean_str(row['Intended Uses'], 'Light duty motor vehicles')
        use_type = use_types_map.get(intended_use)
        if use_type:
            equipment.intended_uses.append(use_type)
        
        # Add intended user types
        intended_user = clean_str(row['Intended Users'], 'Public')
        user_type = user_types_map.get(intended_user)
        if user_type:
            equipment.intended_users.append(user_type)
        
        equipment_to_add.append(equipment)
    
    # Add all new charging equipment at once
    if equipment_to_add:
        session.add_all(equipment_to_add)
        await session.flush()
        logger.info(f"Seeded {len(equipment_to_add)} charging equipment records from CSV.")
    
    if skipped_count > 0:
        logger.info(f"Skipped {skipped_count} equipment records (already exist or site not found).")
    
    if not equipment_to_add and skipped_count == 0:
        logger.info("All charging equipment records already exist, skipping.")
