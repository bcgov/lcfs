"""
Seed data for Charging Equipment (FSE) system.
Run this after migrations to populate reference data.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.seeders.seed_charging_power_output import seed_charging_power_output


async def seed_charging_equipment_statuses(session: AsyncSession):
    """Seed charging equipment status values."""
    statuses = [
        {"status": "Draft", "description": "Equipment information is being prepared", "display_order": 1},
        {"status": "Updated", "description": "Validated equipment has been modified and needs re-validation", "display_order": 2},
        {"status": "Submitted", "description": "Equipment has been submitted for validation", "display_order": 3},
        {"status": "Validated", "description": "Equipment has been validated by government", "display_order": 4},
        {"status": "Decommissioned", "description": "Equipment is no longer in service", "display_order": 5},
    ]
    
    for status_data in statuses:
        # Check if status already exists
        result = await session.execute(
            select(ChargingEquipmentStatus).where(
                ChargingEquipmentStatus.status == status_data["status"]
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            status = ChargingEquipmentStatus(**status_data)
            session.add(status)
    
    await session.commit()
    print("✓ Charging equipment statuses seeded")


async def seed_charging_site_statuses(session: AsyncSession):
    """Seed charging site status values."""
    statuses = [
        {"status": "Draft", "description": "Site information is being prepared", "display_order": 1},
        {"status": "Updated", "description": "Validated site has been modified and needs re-validation", "display_order": 2},
        {"status": "Submitted", "description": "Site has been submitted for validation", "display_order": 3},
        {"status": "Validated", "description": "Site has been validated by government", "display_order": 4},
        {"status": "Decommissioned", "description": "Site is no longer in service", "display_order": 5},
    ]
    
    for status_data in statuses:
        # Check if status already exists
        result = await session.execute(
            select(ChargingSiteStatus).where(
                ChargingSiteStatus.status == status_data["status"]
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            status = ChargingSiteStatus(**status_data)
            session.add(status)
    
    await session.commit()
    print("✓ Charging site statuses seeded")


async def seed_levels_of_equipment(session: AsyncSession):
    """Seed levels of equipment for charging stations."""
    levels = [
        {
            "name": "Level 1",
            "description": "120V AC charging, typically 1.4-1.9 kW",
            "display_order": 1
        },
        {
            "name": "Level 2", 
            "description": "240V AC charging, typically 3.3-19.2 kW",
            "display_order": 2
        },
        {
            "name": "DC Fast Charging",
            "description": "DC fast charging, typically 50-350 kW",
            "display_order": 3
        },
        {
            "name": "Ultra-Fast Charging",
            "description": "Ultra-fast DC charging, typically >350 kW",
            "display_order": 4
        }
    ]
    
    for level_data in levels:
        # Check if level already exists
        result = await session.execute(
            select(LevelOfEquipment).where(
                LevelOfEquipment.name == level_data["name"]
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            level = LevelOfEquipment(**level_data)
            session.add(level)
    
    await session.commit()
    print("✓ Levels of equipment seeded")


async def seed_all_charging_equipment_data(session: AsyncSession):
    """Run all charging equipment seed functions."""
    await seed_charging_equipment_statuses(session)
    await seed_charging_site_statuses(session)
    await seed_levels_of_equipment(session)
    await seed_charging_power_output(session)
    print("\n✅ All charging equipment reference data seeded successfully!")


if __name__ == "__main__":
    # This can be run standalone with proper database connection
    import asyncio
    from lcfs.db.dependencies import get_async_db_session
    
    async def main():
        async with get_async_db_session() as session:
            await seed_all_charging_equipment_data(session)
    
    asyncio.run(main())
