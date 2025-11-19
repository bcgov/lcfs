"""
Seed data for charging power output associations.
"""

from decimal import Decimal
from typing import Iterable, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import ChargingPowerOutput, EndUserType, LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType


# Allow multiple labels to resolve to the same level of equipment name.
LEVEL_ALIASES = {
    "Level 1": [
        "Level 1",
        "Level 1 - Low voltage, operating at 120V AC or less",
    ],
    "Level 2": [
        "Level 2",
        "Level 2 - High voltage, operating above level 1",
    ],
    "Level 3": [
        "Level 3",
        "Level 3 - Direct current fast charging",
        "DC Fast Charging",
    ],
}

# Provide friendly labels that map to existing end use types.
END_USE_ALIASES = {
    "Light duty motor vehicles": [
        "Light duty motor vehicle",
        "Light duty motor vehicles",
    ],
    "Battery bus": ["Battery bus", "Battery bus/battery truck"],
    "Battery truck": ["Battery truck", "Battery bus/battery truck"],
    "Any": ["Any", "all"],
}


async def _get_level_of_equipment(
    session: AsyncSession, level_label: str
) -> LevelOfEquipment:
    """Return an existing level of equipment record, creating a simple one if missing."""
    names_to_try = LEVEL_ALIASES.get(level_label, [])
    names_to_try = [level_label, *names_to_try]

    for name in names_to_try:
        result = await session.execute(
            select(LevelOfEquipment).where(LevelOfEquipment.name == name)
        )
        record = result.scalar_one_or_none()
        if record:
            return record

    level = LevelOfEquipment(
        name=level_label,
        description=f"{level_label} charging level",
    )
    session.add(level)
    await session.flush()
    return level


async def _get_end_use_type(session: AsyncSession, label: str) -> EndUseType:
    """Resolve an end use type by common aliases."""
    names_to_try: List[str] = [label, *END_USE_ALIASES.get(label, [])]
    for name in names_to_try:
        result = await session.execute(
            select(EndUseType).where(EndUseType.type == name)
        )
        record = result.scalar_one_or_none()
        if record:
            return record
    raise ValueError(f"End use type '{label}' not found")


async def _get_end_user_types_by_label(
    session: AsyncSession, label: str
) -> List[EndUserType]:
    """
    Resolve seeded labels to one or more existing end user types without creating new rows.
    """
    records: List[EndUserType] = []
    result = await session.execute(select(EndUserType))
    records = result.unique().scalars().all()
    return records


async def _upsert_power_output(
    session: AsyncSession,
    *,
    end_use_type_id: int,
    end_user_type_id: int,
    level_of_equipment_id: int,
    charger_power_output: Decimal,
    display_order: int,
) -> None:
    """Insert or update the charger power output mapping."""
    result = await session.execute(
        select(ChargingPowerOutput).where(
            ChargingPowerOutput.end_use_type_id == end_use_type_id,
            ChargingPowerOutput.end_user_type_id == end_user_type_id,
            ChargingPowerOutput.level_of_equipment_id == level_of_equipment_id,
        )
    )
    record = result.scalar_one_or_none()
    if record:
        record.charger_power_output = charger_power_output
        record.display_order = display_order
        return

    session.add(
        ChargingPowerOutput(
            end_use_type_id=end_use_type_id,
            end_user_type_id=end_user_type_id,
            level_of_equipment_id=level_of_equipment_id,
            charger_power_output=charger_power_output,
            display_order=display_order,
        )
    )


async def seed_charging_power_output(session: AsyncSession):
    """Seed charging power output reference data."""
    existing = await session.execute(
        select(ChargingPowerOutput.charging_power_output_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        print("✓ Charging power output associations already seeded, skipping")
        return

    association_rows = [
        {
            "end_user_type": "Multi-unit residential building",
            "level": "Level 2",
            "end_use_labels": ["Light duty motor vehicles"],
            "power": Decimal("6.33"),
            "display_order": 1,
        },
        {
            "end_user_type": "Employee",
            "level": "Level 2",
            "end_use_labels": ["Light duty motor vehicles"],
            "power": Decimal("6.33"),
            "display_order": 2,
        },
        {
            "end_user_type": "Public",
            "level": "Level 2",
            "end_use_labels": ["Light duty motor vehicles"],
            "power": Decimal("6.33"),
            "display_order": 3,
        },
        {
            "end_user_type": "Fleet",
            "level": "Level 2",
            "end_use_labels": ["Light duty motor vehicles"],
            "power": Decimal("6.33"),
            "display_order": 4,
        },
        {
            "end_user_type": "Fleet",
            "level": "Level 2",
            "end_use_labels": ["Battery bus", "Battery truck"],
            "power": Decimal("16.8"),
            "display_order": 5,
        },
        {
            "end_user_type": "Employee",
            "level": "Level 2",
            "end_use_labels": ["Battery bus", "Battery truck"],
            "power": Decimal("16.8"),
            "display_order": 6,
        },
        {
            "end_user_type": "Public",
            "level": "Level 2",
            "end_use_labels": ["Battery bus", "Battery truck"],
            "power": Decimal("16.8"),
            "display_order": 7,
        },
        {
            "end_user_type": "Fleet",
            "level": "Level 2",
            "end_use_labels": ["Battery bus", "Battery truck"],
            "power": Decimal("16.8"),
            "display_order": 8,
        },
        {
            "end_user_type": "Employee",
            "level": "Level 3",
            "end_use_labels": ["Any"],
            "power": Decimal("100"),
            "display_order": 9,
        },
        {
            "end_user_type": "Public",
            "level": "Level 3",
            "end_use_labels": ["Any"],
            "power": Decimal("100"),
            "display_order": 10,
        },
        {
            "end_user_type": "Fleet",
            "level": "Level 3",
            "end_use_labels": ["Any"],
            "power": Decimal("100"),
            "display_order": 11,
        },
        {
            "end_user_type": "Employee",
            "level": "Level 1",
            "end_use_labels": ["Any"],
            "power": Decimal("1.5"),
            "display_order": 12,
        },
        {
            "end_user_type": "Public",
            "level": "Level 1",
            "end_use_labels": ["Any"],
            "power": Decimal("1.5"),
            "display_order": 13,
        },
        {
            "end_user_type": "Fleet",
            "level": "Level 1",
            "end_use_labels": ["Any"],
            "power": Decimal("1.5"),
            "display_order": 14,
        },
    ]

    inserted_or_updated = 0

    for idx, row in enumerate(association_rows, start=1):
        end_user_types = await _get_end_user_types_by_label(
            session, row["end_user_type"]
        )
        level = await _get_level_of_equipment(session, row["level"])

        end_uses: Iterable[str] = row["end_use_labels"]
        display_order = row["display_order"]
        for end_user_type in end_user_types:
            for end_use_label in end_uses:
                end_use = await _get_end_use_type(session, end_use_label)
                await _upsert_power_output(
                    session,
                    end_use_type_id=end_use.end_use_type_id,
                    end_user_type_id=end_user_type.end_user_type_id,
                    level_of_equipment_id=level.level_of_equipment_id,
                    charger_power_output=row["power"],
                    display_order=display_order,
                )
                inserted_or_updated += 1

    print(
        f"✓ Charging power output associations seeded ({inserted_or_updated} upserted)"
    )


__all__ = ["seed_charging_power_output"]
