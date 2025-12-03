"""
Tests for Line 6 (Retention) and Line 8 (Deferral) logic per LCFA s.10
Ticket #3329 - Line 6 and Line 8 Bug Fix
"""

import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService


@pytest.fixture
def mock_service():
    """Create a ComplianceReportSummaryService with mocked dependencies"""
    service = ComplianceReportSummaryService(
        repo=MagicMock(),
        cr_repo=MagicMock(),
        trxn_repo=MagicMock(),
        notional_transfer_service=MagicMock(),
        fuel_supply_repo=MagicMock(),
        fuel_export_repo=MagicMock(),
        allocation_agreement_repo=MagicMock(),
        other_uses_repo=MagicMock(),
        compliance_data_service=MagicMock(),
    )
    return service


def create_mock_summary(**kwargs):
    """Helper to create a mock ComplianceReportSummary with given attributes"""
    summary = MagicMock(spec=ComplianceReportSummary)

    # Set default values for all line 6 and line 8 attributes
    default_attrs = {
        'line_6_renewable_fuel_retained_gasoline': 0,
        'line_6_renewable_fuel_retained_diesel': 0,
        'line_6_renewable_fuel_retained_jet_fuel': 0,
        'line_8_obligation_deferred_gasoline': 0,
        'line_8_obligation_deferred_diesel': 0,
        'line_8_obligation_deferred_jet_fuel': 0,
    }

    # Update with provided kwargs
    default_attrs.update(kwargs)

    # Set attributes with proper values
    for key, value in default_attrs.items():
        setattr(summary, key, value)

    return summary


@pytest.mark.anyio
async def test_line_6_retention_small_excess_less_than_prescribed(mock_service):
    """
    Test Line 6: Small excess (< 5% of Line 4) - LCFA s.10(2)

    Given:
    - Renewable supplied (Line 2): 10,000 L
    - Required (Line 4): 40,000 L

    Calculate:
    - Excess = 10,000 - 40,000 = -30,000 (no excess, this is a deficiency)
    - 5% of Line 4 = 0.05 × 40,000 = 2,000 L

    Expected:
    - Line 6 maximum = 0 L (no excess to retain)
    - Line 8 maximum = min(30,000, 2,000) = 2,000 L
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=1000,  # User entered 1000
        line_8_obligation_deferred_diesel=0,
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 10000, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    # Find Line 6 and Line 8 in result
    line_6 = next((row for row in result if row.line == 6), None)
    line_8 = next((row for row in result if row.line == 8), None)

    assert line_6 is not None
    assert line_8 is not None

    # Line 6: No excess exists, so maximum should be 0
    assert line_6.diesel == 0, "Line 6 should be 0 when no excess exists"

    # Line 8: Deficiency exists, maximum should be min(30000, 2000) = 2000
    # Note: User input was 0, so it stays 0
    assert line_8.diesel == 0, "Line 8 preserved user input of 0"


@pytest.mark.anyio
async def test_line_6_retention_large_excess_greater_than_prescribed(mock_service):
    """
    Test Line 6: Large excess (> 5% of Line 4) - LCFA s.10(2)

    Given:
    - Fossil (Line 1): 1,000,000 L
    - Renewable supplied (Line 2): 100,000 L
    - Total tracked (Line 3): 1,100,000 L
    - Required (Line 4): 1,100,000 × 0.04 = 44,000 L

    Calculate:
    - Excess = 100,000 - 44,000 = 56,000 L
    - 5% of Line 4 = 0.05 × 44,000 = 2,200 L

    Expected:
    - Line 6 maximum = min(56,000, 2,200) = 2,200 L (prescribed portion is lesser)
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=5000,  # User wants to retain 5000
        line_8_obligation_deferred_diesel=0,
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 100000, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_6 = next((row for row in result if row.line == 6), None)

    assert line_6 is not None
    # Line 6: excess = 100000 - 44000 = 56000
    # min(56000, 2200) = 2200 maximum
    # User entered 5000, so it should be capped at 2200
    assert line_6.diesel == 2200, "Line 6 should be capped at min(excess, 5% of Line 4) = 2200"


@pytest.mark.anyio
async def test_line_6_retention_exact_five_percent_excess(mock_service):
    """
    Test Line 6: Excess equals exactly 5% of Line 4

    Given:
    - Fossil (Line 1): 1,000,000 L
    - Renewable supplied (Line 2): 8,000 L
    - Total tracked (Line 3): 1,008,000 L
    - Required (Line 4): 1,008,000 × 0.04 = 40,320 L

    Calculate:
    - We want excess = 5% of Line 4
    - So we need Line 2 - Line 4 = 0.05 × Line 4
    - Line 2 = 1.05 × Line 4
    - But Line 4 = (Line 1 + Line 2) × 0.04
    - Solving: Line 2 = 43,478 L, Line 4 = 41,739 L
    - Excess = 1,739 L, 5% of Line 4 = 2,087 L
    - Using simpler numbers: Line 2 = 6,400, Line 3 = 1,006,400, Line 4 = 40,256
    - Excess = 6,400 - 40,256 < 0 (not enough)

    Let's use: Fossil = 1,000,000, Renewable = 6,400
    - Line 3 = 1,006,400
    - Line 4 = 1,006,400 × 0.04 = 40,256
    - We need excess = 5% of 40,256 = 2,013
    - So Line 2 needs to be 40,256 + 2,013 = 42,269
    - But that changes Line 3 to 1,042,269 and Line 4 to 41,691
    - 5% of 41,691 = 2,085, excess = 42,269 - 41,691 = 578

    Easier: Work backwards from a nice number
    - Target: Excess = prescribed portion = X
    - Line 2 - Line 4 = X = 0.05 × Line 4
    - Line 2 = 1.05 × Line 4
    - Line 4 = (Line 1 + Line 2) × 0.04 = (Line 1 + 1.05 × Line 4) × 0.04
    - Line 4 = Line 1 × 0.04 + 1.05 × Line 4 × 0.04
    - Line 4 - 0.042 × Line 4 = Line 1 × 0.04
    - 0.958 × Line 4 = Line 1 × 0.04
    - Line 4 = Line 1 × 0.04 / 0.958 = Line 1 × 0.041753
    - For Line 1 = 1,000,000: Line 4 = 41,753, Line 2 = 1.05 × 41,753 = 43,841
    - Check: Line 3 = 1,043,841, Line 4 = 1,043,841 × 0.04 = 41,754 (close enough)
    - Excess = 43,841 - 41,754 = 2,087, 5% of 41,754 = 2,088 (matches!)

    Expected:
    - Line 6 maximum = min(2,087, 2,088) ≈ 2,087 L
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=2500,  # User wants more than cap
        line_8_obligation_deferred_diesel=0,
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 43841, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_6 = next((row for row in result if row.line == 6), None)

    assert line_6 is not None
    # Line 3 = 1,043,841, Line 4 = 41,754, excess = 2,087, 5% = 2,088
    # Should cap at min(2087, 2088) ≈ 2087
    assert line_6.diesel >= 2087 and line_6.diesel <= 2088, f"Line 6 should be ≈2087 when excess equals prescribed portion, got {line_6.diesel}"


@pytest.mark.anyio
async def test_line_8_deferral_small_deficiency_less_than_prescribed(mock_service):
    """
    Test Line 8: Small deficiency (< 5% of Line 4) - LCFA s.10(3)

    Given:
    - Renewable supplied: 38,000 L
    - Required (Line 4): 40,000 L

    Calculate:
    - Deficiency = 40,000 - 38,000 = 2,000 L
    - 5% of Line 4 = 0.05 × 40,000 = 2,000 L

    Expected:
    - Line 8 maximum = min(2,000, 2,000) = 2,000 L
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=0,
        line_8_obligation_deferred_diesel=2000,  # User wants to defer 2000
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 38000, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_8 = next((row for row in result if row.line == 8), None)

    assert line_8 is not None
    assert line_8.diesel == 2000, "Line 8 should allow full deferral when deficiency equals prescribed portion"


@pytest.mark.anyio
async def test_line_8_deferral_large_deficiency_greater_than_prescribed(mock_service):
    """
    Test Line 8: Large deficiency (> 5% of Line 4) - LCFA s.10(3)

    Given:
    - Fossil (Line 1): 1,000,000 L
    - Renewable supplied (Line 2): 10,000 L
    - Total tracked (Line 3): 1,010,000 L
    - Required (Line 4): 1,010,000 × 0.04 = 40,400 L

    Calculate:
    - Deficiency = 40,400 - 10,000 = 30,400 L
    - 5% of Line 4 = 0.05 × 40,400 = 2,020 L

    Expected:
    - Line 8 maximum = min(30,400, 2,020) = 2,020 L (prescribed portion is lesser)
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=0,
        line_8_obligation_deferred_diesel=5000,  # User wants to defer 5000
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 10000, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_8 = next((row for row in result if row.line == 8), None)

    assert line_8 is not None
    # Deficiency = 30,400, prescribed = 2,020
    # User entered 5000, should be capped at 2020
    assert line_8.diesel == 2020, "Line 8 should be capped at min(deficiency, 5% of Line 4) = 2020"


@pytest.mark.anyio
async def test_line_8_deferral_no_deficiency_when_compliant(mock_service):
    """
    Test Line 8: No deferral allowed when renewable supply meets or exceeds requirement

    Given:
    - Renewable supplied: 50,000 L
    - Required (Line 4): 40,000 L

    Calculate:
    - Deficiency = max(0, 40,000 - 50,000) = 0

    Expected:
    - Line 8 maximum = 0 (no deficiency exists)
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=0,
        line_8_obligation_deferred_diesel=1000,  # User entered some value
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 50000, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_8 = next((row for row in result if row.line == 8), None)

    assert line_8 is not None
    assert line_8.diesel == 0, "Line 8 should be 0 when supplier is compliant (no deficiency)"


@pytest.mark.anyio
async def test_line_6_and_line_8_gasoline_and_jet_fuel(mock_service):
    """
    Test Line 6 and Line 8 logic across all fuel types

    Scenarios:
    - Gasoline: Has excess (retention allowed)
    - Diesel: Has deficiency (deferral allowed)
    - Jet Fuel: Exactly meets requirement (neither retention nor deferral)
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_gasoline=1000,
        line_6_renewable_fuel_retained_diesel=0,
        line_6_renewable_fuel_retained_jet_fuel=0,
        line_8_obligation_deferred_gasoline=0,
        line_8_obligation_deferred_diesel=1500,
        line_8_obligation_deferred_jet_fuel=0,
    )

    # Gasoline: 60,000 supplied vs 50,000 required = 10,000 excess
    # Diesel: 30,000 supplied vs 40,000 required = 10,000 deficiency
    # Jet Fuel: 30,000 supplied vs 30,000 required = 0 (exact match)
    fossil_quantities = {"gasoline": 1000000, "diesel": 1000000, "jet_fuel": 1000000}
    renewable_quantities = {"gasoline": 60000, "diesel": 30000, "jet_fuel": 30000}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_6 = next((row for row in result if row.line == 6), None)
    line_8 = next((row for row in result if row.line == 8), None)

    assert line_6 is not None
    assert line_8 is not None

    # Gasoline Line 6: min(10000 excess, 2500 prescribed) = 1000 (user input capped)
    # Required = 1000000 * 0.05 = 50000
    # 5% of 50000 = 2500
    assert line_6.gasoline == 1000, "Gasoline Line 6 should preserve user input within limits"

    # Diesel Line 6: No excess, so should be 0
    assert line_6.diesel == 0, "Diesel Line 6 should be 0 (no excess)"

    # Jet Fuel Line 6: No excess, so should be 0
    assert line_6.jet_fuel == 0, "Jet Fuel Line 6 should be 0 (no excess)"

    # Gasoline Line 8: No deficiency, so should be 0
    assert line_8.gasoline == 0, "Gasoline Line 8 should be 0 (no deficiency)"

    # Diesel Line 8: min(10000 deficiency, 2000 prescribed) = 1500 (user input)
    # Required = 1000000 * 0.04 = 40000
    # 5% of 40000 = 2000
    assert line_8.diesel == 1500, "Diesel Line 8 should preserve user input within limits"

    # Jet Fuel Line 8: No deficiency, so should be 0
    assert line_8.jet_fuel == 0, "Jet Fuel Line 8 should be 0 (no deficiency)"


@pytest.mark.anyio
async def test_user_input_preserved_within_new_constraints(mock_service):
    """
    Test that user input is preserved when it's within the calculated constraints
    but values are adjusted if they exceed the new maximums

    Given:
    - Fossil (Line 1): 1,000,000 L
    - Renewable (Line 2): 41,800 L
    - Total tracked (Line 3): 1,041,800 L
    - Required (Line 4): 1,041,800 × 0.04 = 41,672 L

    Calculate:
    - Excess = 41,800 - 41,672 = 128 L
    - 5% of Line 4 = 0.05 × 41,672 = 2,084 L
    - Maximum retention = min(128, 2,084) = 128 L

    User enters 1500 L, but max is only 128 L, so it should cap at 128 L
    """
    prev_summary = create_mock_summary(
        line_6_renewable_fuel_retained_diesel=1500,  # User input
        line_8_obligation_deferred_diesel=0,
    )

    fossil_quantities = {"gasoline": 0, "diesel": 1000000, "jet_fuel": 0}
    renewable_quantities = {"gasoline": 0, "diesel": 41800, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    result = mock_service.calculate_renewable_fuel_target_summary(
        fossil_quantities=fossil_quantities,
        renewable_quantities=renewable_quantities,
        previous_retained=previous_retained,
        previous_obligation=previous_obligation,
        notional_transfers_sums=notional_transfers_sums,
        compliance_period=2024,
        prev_summary=prev_summary,
    )

    line_6 = next((row for row in result if row.line == 6), None)

    assert line_6 is not None
    # Excess = 128, prescribed = 2084
    # min(128, 2084) = 128 maximum
    # User input 1500 exceeds 128, so it should be capped at 128
    assert line_6.diesel == 128, f"User input should be capped at calculated maximum of 128, got {line_6.diesel}"
