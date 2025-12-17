"""
Tests for Line 2 renewable fuel eligibility logic per compliance year.

Business rules:
- 2024 (pre-2025): All renewable fuels are eligible, no Canadian production requirements
- 2025: Diesel requires Canadian production OR Q1 supplied; Gasoline and Jet fuel have NO requirements
- 2026+: Both Diesel and Gasoline require Canadian production; Jet fuel has NO requirements

Eligible renewable fuel types:
- Gasoline category: Ethanol, Renewable gasoline, Renewable naphtha, Other
- Diesel category: Biodiesel, HDRD, Other diesel fuel, Other
- Jet fuel category: Alternative jet fuel, Other
"""

import pytest
from unittest.mock import MagicMock

from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService


@pytest.fixture
def service():
    """Create a ComplianceReportSummaryService with mocked dependencies."""
    return ComplianceReportSummaryService(
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


def _make_record(category, fuel_type_name, *, renewable=True, canada=False, q1=False, country=None):
    """Helper to create a mock fuel record."""
    fuel_type = MagicMock()
    fuel_type.renewable = renewable
    fuel_type.fuel_type = fuel_type_name

    fuel_category = MagicMock()
    fuel_category.category = category

    record = MagicMock()
    record.fuel_type = fuel_type
    record.fuel_category = fuel_category
    record.is_canada_produced = canada
    record.is_q1_supplied = q1

    if country:
        fuel_code = MagicMock()
        fuel_code.fuel_production_facility_country = country
        record.fuel_code = fuel_code
    else:
        record.fuel_code = None

    return record


# =============================================================================
# Test 2024 (Pre-2025) - No Canadian production requirements
# =============================================================================

class TestYear2024NoRestrictions:
    """2024: All renewable fuels are eligible regardless of Canadian production status."""

    @pytest.mark.parametrize("fuel_type,category", [
        ("Ethanol", "Gasoline"),
        ("Renewable gasoline", "Gasoline"),
        ("Renewable naphtha", "Gasoline"),
        ("Other", "Gasoline"),
        ("Biodiesel", "Diesel"),
        ("HDRD", "Diesel"),
        ("Other diesel fuel", "Diesel"),
        ("Other", "Diesel"),
        ("Alternative jet fuel", "Jet fuel"),
        ("Other", "Jet fuel"),
    ])
    def test_all_renewable_fuels_eligible_2024(self, service, fuel_type, category):
        """All eligible renewable fuel types should be included in 2024 regardless of origin."""
        # Non-Canadian fuel should still be eligible in 2024
        record = _make_record(category, fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2024) is True

    def test_non_renewable_fuel_excluded_2024(self, service):
        """Non-renewable fuels should be excluded even in 2024."""
        record = _make_record("Gasoline", "Gasoline", renewable=False)
        assert service._is_eligible_renewable(record, 2024) is False


# =============================================================================
# Test 2025 - Diesel requires Canadian production or Q1, Gasoline has no requirement
# =============================================================================

class TestYear2025GasolineNoRestrictions:
    """2025: All gasoline renewable fuels are eligible regardless of Canadian production."""

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_eligible_without_canadian_production_2025(self, service, fuel_type):
        """Gasoline fuels should be eligible in 2025 without Canadian production."""
        # Non-Canadian gasoline should be eligible in 2025
        record = _make_record("Gasoline", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_eligible_with_canadian_production_2025(self, service, fuel_type):
        """Gasoline fuels with Canadian production should also be eligible in 2025."""
        record = _make_record("Gasoline", fuel_type, canada=True)
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_eligible_with_canadian_fuel_code_2025(self, service, fuel_type):
        """Gasoline fuels with Canadian fuel code should also be eligible in 2025."""
        record = _make_record("Gasoline", fuel_type, country="Canada")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_gasoline_ineligible_fuel_type_excluded_2025(self, service):
        """Gasoline fuel types not in eligible list should be excluded in 2025."""
        record = _make_record("Gasoline", "CNG", country="Canada")  # CNG is not eligible
        assert service._is_eligible_renewable(record, 2025) is False


class TestYear2025DieselCanadianRequired:
    """2025: Diesel requires Canadian production OR Q1 supplied."""

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_eligible_with_canadian_production_flag_2025(self, service, fuel_type):
        """Diesel with is_canada_produced=True should be eligible in 2025."""
        record = _make_record("Diesel", fuel_type, canada=True)
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_eligible_with_q1_supplied_2025(self, service, fuel_type):
        """Diesel with Q1 supplied should be eligible in 2025 (even if not Canadian)."""
        record = _make_record("Diesel", fuel_type, q1=True, country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_eligible_with_canadian_fuel_code_2025(self, service, fuel_type):
        """Diesel with Canadian fuel code should be eligible in 2025."""
        record = _make_record("Diesel", fuel_type, country="Canada")
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_ineligible_without_canadian_or_q1_2025(self, service, fuel_type):
        """Diesel without Canadian production or Q1 should be EXCLUDED in 2025."""
        record = _make_record("Diesel", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2025) is False

    def test_diesel_ineligible_fuel_type_excluded_2025(self, service):
        """Diesel fuel types not in eligible list should be excluded even with Canadian production."""
        record = _make_record("Diesel", "LNG", canada=True)  # LNG is not eligible
        assert service._is_eligible_renewable(record, 2025) is False


class TestYear2025JetFuelNoRestrictions:
    """2025: All jet fuel renewable fuels are eligible regardless of Canadian production."""

    @pytest.mark.parametrize("fuel_type", [
        "Alternative jet fuel",
        "Other",
    ])
    def test_jet_fuel_eligible_without_canadian_production_2025(self, service, fuel_type):
        """Jet fuel should be eligible in 2025 without Canadian production."""
        record = _make_record("Jet fuel", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    @pytest.mark.parametrize("fuel_type", [
        "Alternative jet fuel",
        "Other",
    ])
    def test_jet_fuel_eligible_with_canadian_production_2025(self, service, fuel_type):
        """Jet fuel with Canadian production should also be eligible in 2025."""
        record = _make_record("Jet fuel", fuel_type, canada=True)
        assert service._is_eligible_renewable(record, 2025) is True

    def test_jet_fuel_ineligible_fuel_type_excluded_2025(self, service):
        """Jet fuel types not in eligible list should be excluded."""
        record = _make_record("Jet fuel", "Hydrogen", country="Canada")  # Hydrogen is not eligible
        assert service._is_eligible_renewable(record, 2025) is False


# =============================================================================
# Test 2026+ - Both Diesel and Gasoline require Canadian production
# =============================================================================

class TestYear2026GasolineCanadianRequired:
    """2026+: Gasoline requires Canadian production (no Q1 exception)."""

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_eligible_with_canadian_production_flag_2026(self, service, fuel_type):
        """Gasoline with is_canada_produced=True should be eligible in 2026."""
        record = _make_record("Gasoline", fuel_type, canada=True)
        assert service._is_eligible_renewable(record, 2026) is True

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_eligible_with_canadian_fuel_code_2026(self, service, fuel_type):
        """Gasoline with Canadian fuel code should be eligible in 2026."""
        record = _make_record("Gasoline", fuel_type, country="Canada")
        assert service._is_eligible_renewable(record, 2026) is True

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_ineligible_without_canadian_2026(self, service, fuel_type):
        """Gasoline without Canadian production should be EXCLUDED in 2026."""
        record = _make_record("Gasoline", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2026) is False

    @pytest.mark.parametrize("fuel_type", [
        "Ethanol",
        "Renewable gasoline",
        "Renewable naphtha",
        "Other",
    ])
    def test_gasoline_q1_not_applicable_2026(self, service, fuel_type):
        """Gasoline with Q1 flag but no Canadian production should be EXCLUDED in 2026."""
        # Q1 exception only applies to Diesel in 2025, not Gasoline
        record = _make_record("Gasoline", fuel_type, q1=True, country="United States")
        assert service._is_eligible_renewable(record, 2026) is False


class TestYear2026DieselCanadianRequiredNoQ1Exception:
    """2026+: Diesel requires Canadian production (Q1 exception no longer applies)."""

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_eligible_with_canadian_production_flag_2026(self, service, fuel_type):
        """Diesel with is_canada_produced=True should be eligible in 2026."""
        record = _make_record("Diesel", fuel_type, canada=True)
        assert service._is_eligible_renewable(record, 2026) is True

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_eligible_with_canadian_fuel_code_2026(self, service, fuel_type):
        """Diesel with Canadian fuel code should be eligible in 2026."""
        record = _make_record("Diesel", fuel_type, country="Canada")
        assert service._is_eligible_renewable(record, 2026) is True

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_ineligible_without_canadian_2026(self, service, fuel_type):
        """Diesel without Canadian production should be EXCLUDED in 2026."""
        record = _make_record("Diesel", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2026) is False

    @pytest.mark.parametrize("fuel_type", [
        "Biodiesel",
        "HDRD",
        "Other diesel fuel",
        "Other",
    ])
    def test_diesel_q1_not_applicable_2026(self, service, fuel_type):
        """Diesel with Q1 flag but no Canadian production should be EXCLUDED in 2026."""
        # Q1 exception only applies in 2025, not 2026+
        record = _make_record("Diesel", fuel_type, q1=True, country="United States")
        assert service._is_eligible_renewable(record, 2026) is False


class TestYear2026JetFuelNoRestrictions:
    """2026+: Jet fuel still has no Canadian production requirements."""

    @pytest.mark.parametrize("fuel_type", [
        "Alternative jet fuel",
        "Other",
    ])
    def test_jet_fuel_eligible_without_canadian_production_2026(self, service, fuel_type):
        """Jet fuel should be eligible in 2026 without Canadian production."""
        record = _make_record("Jet fuel", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2026) is True

    @pytest.mark.parametrize("fuel_type", [
        "Alternative jet fuel",
        "Other",
    ])
    def test_jet_fuel_eligible_2027(self, service, fuel_type):
        """Jet fuel should be eligible in 2027 without Canadian production."""
        record = _make_record("Jet fuel", fuel_type, country="United States")
        assert service._is_eligible_renewable(record, 2027) is True


# =============================================================================
# Edge cases and special scenarios
# =============================================================================

class TestEdgeCases:
    """Test edge cases and special scenarios."""

    def test_non_renewable_fuel_always_excluded(self, service):
        """Non-renewable fuels should always be excluded regardless of year."""
        for year in [2024, 2025, 2026, 2027]:
            record = _make_record("Gasoline", "Gasoline", renewable=False)
            assert service._is_eligible_renewable(record, year) is False

    def test_unknown_category_included(self, service):
        """Unknown fuel categories should be included by default."""
        record = _make_record("Unknown", "Some fuel type")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_case_insensitive_category(self, service):
        """Category matching should be case-insensitive."""
        record = _make_record("GASOLINE", "Ethanol", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_case_insensitive_fuel_type(self, service):
        """Fuel type matching should be case-insensitive."""
        record = _make_record("Gasoline", "ETHANOL", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_case_insensitive_country(self, service):
        """Country matching should be case-insensitive."""
        record = _make_record("Diesel", "Biodiesel", country="CANADA")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_null_fuel_code(self, service):
        """Records with null fuel code should still work."""
        record = _make_record("Diesel", "Biodiesel")  # No country, no fuel code
        record.fuel_code = None
        # Should be excluded in 2025 because no Canadian proof
        assert service._is_eligible_renewable(record, 2025) is False

    def test_empty_category(self, service):
        """Records with empty category should be handled gracefully."""
        record = _make_record("", "Ethanol")
        # Empty category falls through to "unknown" which returns True
        assert service._is_eligible_renewable(record, 2025) is True

    def test_none_category(self, service):
        """Records with None category should be handled gracefully."""
        record = _make_record(None, "Ethanol")
        record.fuel_category.category = None
        # None becomes empty string which falls through to "unknown"
        assert service._is_eligible_renewable(record, 2025) is True


# =============================================================================
# Summary integration tests
# =============================================================================

class TestSummaryIntegration:
    """Test that the eligibility rules work correctly in context."""

    def test_2025_report_gasoline_ethanol_non_canadian_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, non-Canadian Ethanol should be included in Line 2 Gasoline.
        """
        record = _make_record("Gasoline", "Ethanol", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_2025_report_gasoline_renewable_gasoline_non_canadian_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, non-Canadian Renewable gasoline should be included in Line 2 Gasoline.
        """
        record = _make_record("Gasoline", "Renewable gasoline", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_2025_report_gasoline_renewable_naphtha_non_canadian_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, non-Canadian Renewable naphtha should be included in Line 2 Gasoline.
        """
        record = _make_record("Gasoline", "Renewable naphtha", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_2025_report_gasoline_other_non_canadian_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, non-Canadian 'Other' gasoline should be included in Line 2 Gasoline.
        """
        record = _make_record("Gasoline", "Other", country="United States")
        assert service._is_eligible_renewable(record, 2025) is True

    def test_2025_report_diesel_other_canadian_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, Canadian 'Other' diesel should be included in Line 2 Diesel.
        """
        record = _make_record("Diesel", "Other", canada=True)
        assert service._is_eligible_renewable(record, 2025) is True

    def test_2025_report_diesel_other_q1_included(self, service):
        """
        Regression test for bug #3607:
        In 2025, 'Other' diesel supplied in Q1 should be included in Line 2 Diesel.
        """
        record = _make_record("Diesel", "Other", q1=True, country="United States")
        assert service._is_eligible_renewable(record, 2025) is True
