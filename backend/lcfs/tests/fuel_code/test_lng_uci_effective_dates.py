"""Regression test for LNG End-use UCI values effective May 6, 2026 (#4571).

Verifies the seeded additional_carbon_intensity data across all nine LNG marine
end uses:
  - reporting year <= 2025 : "before" values only
  - reporting year  = 2026 : both "before" and "after" values
  - reporting year >= 2027 : "after" values only

The "after" rows use the existing ("before") label text verbatim plus the
" (after May 6, 2026)" suffix.
"""

import pytest
from sqlalchemy import select

from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod

LNG_FUEL_TYPE_ID = 7
SUFFIX = " (after May 6, 2026)"

# before-label -> (before_uci, after_uci)
LNG_END_USES = {
    "Compression-ignition engine- Marine, general": (27.3, 22.2),
    "Compression-ignition engine- Marine, operated within 51 to 75% of load range": (
        17.8,
        12.7,
    ),
    "Compression-ignition engine- Marine, operated within 76 to 100% of load range": (
        12.2,
        7.1,
    ),
    "Compression-ignition engine- Marine, with methane slip reduction kit- General": (
        10.6,
        5.5,
    ),
    "Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 26 to 75% of load range": (
        8.4,
        3.3,
    ),
    "Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 76 to 100% of load range": (
        8.0,
        2.9,
    ),
    "Compression-ignition engine- Marine, unknown whether kit is installed or average operating load range": (
        27.3,
        22.2,
    ),
    "Unknown engine type": (27.3, 22.2),
    "Other (i.e. road transportation)": (0, 0),
}


async def _uci(dbsession, end_use_label, year):
    result = await dbsession.execute(
        select(AdditionalCarbonIntensity.intensity)
        .join(
            EndUseType,
            EndUseType.end_use_type_id
            == AdditionalCarbonIntensity.end_use_type_id,
        )
        .join(
            CompliancePeriod,
            CompliancePeriod.compliance_period_id
            == AdditionalCarbonIntensity.compliance_period_id,
        )
        .where(
            AdditionalCarbonIntensity.fuel_type_id == LNG_FUEL_TYPE_ID,
            EndUseType.type == end_use_label,
            CompliancePeriod.description == str(year),
        )
    )
    return result.scalar_one_or_none()


def _approx(value, expected):
    return value is not None and float(value) == pytest.approx(expected)


@pytest.mark.anyio
async def test_lng_uci_before_values_only_for_2025(dbsession):
    for before_label, (before_uci, _after) in LNG_END_USES.items():
        assert _approx(await _uci(dbsession, before_label, 2025), before_uci), (
            before_label
        )
        # the "after" option must not exist for 2025
        assert await _uci(dbsession, before_label + SUFFIX, 2025) is None, before_label


@pytest.mark.anyio
async def test_lng_uci_both_values_for_2026(dbsession):
    for before_label, (before_uci, after_uci) in LNG_END_USES.items():
        assert _approx(await _uci(dbsession, before_label, 2026), before_uci), (
            before_label
        )
        assert _approx(
            await _uci(dbsession, before_label + SUFFIX, 2026), after_uci
        ), before_label


@pytest.mark.anyio
async def test_lng_uci_after_values_only_for_2027(dbsession):
    for before_label, (_before, after_uci) in LNG_END_USES.items():
        assert _approx(
            await _uci(dbsession, before_label + SUFFIX, 2027), after_uci
        ), before_label
        # the "before" option must not exist for 2027
        assert await _uci(dbsession, before_label, 2027) is None, before_label
