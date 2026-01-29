import structlog
import pandas as pd
from pathlib import Path
from sqlalchemy import select
from lcfs.db.models.compliance.ChargingSite import ChargingSite

logger = structlog.get_logger(__name__)


async def seed_test_charging_sites(session):
    """
    Seeds charging sites into the database from CSV file,
    if they do not already exist.
    
    This seeder reads from data/charging_sites.csv containing production-like site data.

    Args:
        session: The database session for committing the new records.
    """
    
    # Load CSV file
    csv_path = Path(__file__).parent / "data" / "charging_sites.csv"
    
    if not csv_path.exists():
        logger.warning(f"Charging sites CSV not found at {csv_path}, skipping seed.")
        return
    
    df = pd.read_csv(csv_path)
    logger.info(f"Loading {len(df)} charging sites from CSV...")
    
    def clean_str(val, default=''):
        """Clean string values from CSV"""
        if pd.isna(val) or val == 'nan':
            return default
        return str(val).strip()
    
    # Query all existing charging sites at once to avoid autoflush issues
    result = await session.execute(select(ChargingSite))
    existing_sites = result.scalars().all()
    existing_ids = {site.charging_site_id for site in existing_sites}
    
    # Prepare all charging sites to add
    sites_to_add = []
    
    for idx, row in df.iterrows():
        charging_site_id = idx + 1  # Start from 1
        
        # Skip if already exists
        if charging_site_id in existing_ids:
            continue
        
        # Assign to different organizations (cycle through orgs 1-10)
        organization_id = (idx % 10) + 1
        
        # Set status to Validated (4) for most sites, Draft (1) for every 5th
        status_id = 4 if idx % 5 != 0 else 1
        
        # Generate unique site code (base-36 format, 5 characters)
        site_code = f"{idx+1:05d}"  # Zero-padded numeric code
        
        site_data = {
            "charging_site_id": charging_site_id,
            "organization_id": organization_id,
            "allocating_organization_id": None,
            "allocating_organization_name": clean_str(row['Allocating Organization'], None),
            "status_id": status_id,
            "site_code": site_code,
            "site_name": clean_str(row['Site Name'], f'Charging Site #{idx+1}'),
            "street_address": clean_str(row['Street Address'], '123 Main St'),
            "city": clean_str(row['City'], 'Victoria'),
            "postal_code": clean_str(row['Postal Code'], 'V8V 1V1'),
            "latitude": float(row['Latitude']) if pd.notna(row['Latitude']) else 48.4284,
            "longitude": float(row['Longitude']) if pd.notna(row['Longitude']) else -123.3656,
            "notes": clean_str(row['Notes'], None) if pd.notna(row['Notes']) else None,
        }
        
        sites_to_add.append(ChargingSite(**site_data))
    
    # Add all new charging sites at once
    if sites_to_add:
        session.add_all(sites_to_add)
        await session.flush()
        logger.info(f"Seeded {len(sites_to_add)} charging sites from CSV.")
    else:
        logger.info("All charging sites already exist, skipping.")
