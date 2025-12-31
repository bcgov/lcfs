import pytest
from unittest.mock import MagicMock, AsyncMock, Mock
from starlette.responses import StreamingResponse
import io

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus
from lcfs.db.models import Organization, CompliancePeriod
from lcfs.web.api.compliance_report.export import ComplianceReportExporter
from lcfs.web.api.compliance_report.schema import (
    FUEL_SUPPLY_COLUMNS,
    FUEL_SUPPLY_QUARTERLY_COLUMNS,
    NOTIONAL_TRANSFER_COLUMNS,
    NOTIONAL_TRANSFER_QUARTERLY_COLUMNS,
    ALLOCATION_AGREEMENT_COLUMNS,
    ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS,
    EXPORT_FUEL_COLUMNS,
    OTHER_USES_COLUMNS,
    FSE_EXPORT_COLUMNS,
    ExportColumn,
)


@pytest.fixture
def mock_fse_repo():
    """Mock FinalSupplyEquipmentRepository."""
    repo = AsyncMock()
    # get_fse_paginated returns a tuple (data, total_count)
    repo.get_fse_paginated = AsyncMock(return_value=([], 0))
    return repo


@pytest.fixture
def mock_fs_repo():
    """Mock FuelSupplyRepository."""
    repo = AsyncMock()
    repo.get_effective_fuel_supplies = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_cr_repo():
    """Mock ComplianceReportRepository."""
    repo = AsyncMock()
    # Create a default mock report for methods that need compliance year
    mock_report = Mock()
    mock_period = Mock()
    mock_period.description = "2025"
    mock_report.compliance_period = mock_period
    repo.get_compliance_report_by_id.return_value = mock_report
    return repo


@pytest.fixture
def mock_nt_repo():
    """Mock NotionalTransferRepository."""
    repo = AsyncMock()
    repo.get_effective_notional_transfers = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_ou_repo():
    """Mock OtherUsesRepository."""
    repo = AsyncMock()
    repo.get_effective_other_uses = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_ef_repo():
    """Mock FuelExportRepository."""
    repo = AsyncMock()
    repo.get_effective_fuel_exports = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_aa_repo():
    """Mock AllocationAgreementRepository."""
    repo = AsyncMock()
    repo.get_allocation_agreements = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_summary_service():
    """Mock ComplianceReportSummaryService."""
    service = AsyncMock()
    summary_mock = Mock()
    summary_mock.renewable_fuel_target_summary = []
    summary_mock.low_carbon_fuel_target_summary = []
    summary_mock.non_compliance_penalty_summary = []
    service.calculate_compliance_report_summary = AsyncMock(return_value=summary_mock)
    return service


@pytest.fixture
def mock_annual_report():
    """Mock annual compliance report."""
    report = Mock()
    report.compliance_report_id = 1
    report.compliance_report_group_uuid = "test-uuid"
    report.version = 0
    report.reporting_frequency = ReportingFrequency.ANNUAL

    # Mock organization
    organization = Mock()
    organization.name = "Test Organization"
    report.organization = organization

    # Mock compliance period
    period = Mock()
    period.description = "2024"
    report.compliance_period = period

    # Mock status
    status = Mock()
    status.status = Mock()
    status.status.value = "Draft"
    report.current_status = status

    return report


@pytest.fixture
def mock_quarterly_report():
    """Mock quarterly compliance report."""
    report = Mock()
    report.compliance_report_id = 2
    report.compliance_report_group_uuid = "test-uuid-quarterly"
    report.version = 0
    report.reporting_frequency = ReportingFrequency.QUARTERLY

    # Mock organization
    organization = Mock()
    organization.name = "Early Issuance Org"
    report.organization = organization

    # Mock compliance period
    period = Mock()
    period.description = "2024"
    report.compliance_period = period

    # Mock status
    status = Mock()
    status.status = Mock()
    status.status.value = "Submitted"
    report.current_status = status

    return report


@pytest.fixture
def mock_fuel_supply_data():
    """Mock fuel supply data for testing."""
    fs1 = Mock()
    fs1.compliance_units = 1000.0
    fs1.fuel_type = Mock()
    fs1.fuel_type.fuel_type = "Biodiesel"
    fs1.fuel_type_other = None
    fs1.fuel_category = Mock()
    fs1.fuel_category.category = "Diesel"
    fs1.end_use_type = Mock()
    fs1.end_use_type.type = "Transport"
    fs1.provision_of_the_act = Mock()
    fs1.provision_of_the_act.name = "Section 19(b)(i)"
    fs1.fuel_code = Mock()
    fs1.fuel_code.fuel_code = "FC001"
    fs1.is_canada_produced = True
    fs1.is_q1_supplied = False
    fs1.quantity = 10000
    fs1.q1_quantity = 2500
    fs1.q2_quantity = 3000
    fs1.q3_quantity = 2000
    fs1.q4_quantity = 2500
    fs1.units = Mock()
    fs1.units.value = "L"
    fs1.target_ci = 85.5
    fs1.ci_of_fuel = 25.3
    fs1.uci = 15.2
    fs1.energy_density = 35.0
    fs1.eer = 1.0
    fs1.energy = 350000

    return [fs1]


@pytest.fixture
def mock_notional_transfer_data():
    """Mock notional transfer data for testing."""
    nt1 = Mock()
    nt1.legal_name = "Partner Organization"
    nt1.address_for_service = "123 Main St, Vancouver, BC"
    nt1.fuel_category = "Diesel"
    nt1.received_or_transferred = Mock()
    nt1.received_or_transferred.value = "Received"
    nt1.quantity = 5000
    nt1.q1_quantity = 1250
    nt1.q2_quantity = 1500
    nt1.q3_quantity = 1000
    nt1.q4_quantity = 1250

    return [nt1]


@pytest.fixture
def mock_allocation_agreement_data():
    """Mock allocation agreement data for testing."""
    aa1 = Mock()
    aa1.allocation_transaction_type = "Allocated to"
    aa1.transaction_partner = "Partner Corp"
    aa1.postal_address = "456 Oak Ave, Victoria, BC"
    aa1.transaction_partner_email = "partner@example.com"
    aa1.transaction_partner_phone = "250-555-1234"
    aa1.fuel_type = "Renewable Diesel"
    aa1.fuel_type_other = None
    aa1.fuel_category = "Diesel"
    aa1.provision_of_the_act = "Section 19(b)(i)"
    aa1.fuel_code = "FC002"
    aa1.ci_of_fuel = 20.5
    aa1.quantity = 8000
    aa1.q1_quantity = 2000
    aa1.q2_quantity = 2400
    aa1.q3_quantity = 1600
    aa1.q4_quantity = 2000
    aa1.units = "L"

    return [aa1]


@pytest.fixture
def compliance_report_exporter(
    mock_fse_repo,
    mock_fs_repo,
    mock_cr_repo,
    mock_nt_repo,
    mock_ou_repo,
    mock_ef_repo,
    mock_aa_repo,
    mock_summary_service,
):
    """Create ComplianceReportExporter instance with mocked dependencies."""
    exporter = ComplianceReportExporter(
        fse_repo=mock_fse_repo,
        fs_repo=mock_fs_repo,
        cr_repo=mock_cr_repo,
        nt_repo=mock_nt_repo,
        ou_repo=mock_ou_repo,
        ef_repo=mock_ef_repo,
        aa_repo=mock_aa_repo,
        summary_service=mock_summary_service,
    )
    return exporter


class TestComplianceReportExporter:
    """Test cases for ComplianceReportExporter."""

    def test_column_definitions_initialization(self, compliance_report_exporter):
        """Test that column definitions are properly initialized for both annual and quarterly reports."""
        exporter = compliance_report_exporter

        # Test annual column definitions
        assert "Fuel supply" in exporter.annual_column_definitions
        assert exporter.annual_column_definitions["Fuel supply"] == FUEL_SUPPLY_COLUMNS
        assert (
            exporter.annual_column_definitions["Notional transfer"]
            == NOTIONAL_TRANSFER_COLUMNS
        )
        assert (
            exporter.annual_column_definitions["Allocation agreements"]
            == ALLOCATION_AGREEMENT_COLUMNS
        )

        # Test quarterly column definitions
        assert "Fuel supply" in exporter.quarterly_column_definitions
        assert (
            exporter.quarterly_column_definitions["Fuel supply"]
            == FUEL_SUPPLY_QUARTERLY_COLUMNS
        )
        assert (
            exporter.quarterly_column_definitions["Notional transfer"]
            == NOTIONAL_TRANSFER_QUARTERLY_COLUMNS
        )
        assert (
            exporter.quarterly_column_definitions["Allocation agreements"]
            == ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS
        )

        # Test that sheets without quarterly data use annual columns
        assert exporter.quarterly_column_definitions["Other uses"] == OTHER_USES_COLUMNS
        assert (
            exporter.quarterly_column_definitions["Export fuel"] == EXPORT_FUEL_COLUMNS
        )
        assert (
            exporter.quarterly_column_definitions["Final supply equipment"]
            == FSE_EXPORT_COLUMNS
        )

    @pytest.mark.anyio
    async def test_export_annual_report_filename(
        self,
        compliance_report_exporter,
        mock_annual_report,
    ):
        """Test that annual reports generate correct filename with CR prefix."""
        exporter = compliance_report_exporter
        exporter.cr_repo.get_compliance_report_by_id.return_value = mock_annual_report

        response = await exporter.export(1)

        assert isinstance(response, StreamingResponse)
        assert (
            response.headers["Content-Disposition"]
            == 'attachment; filename="CR-Test Organization-2024-Draft.xlsx"'
        )

    @pytest.mark.anyio
    async def test_export_quarterly_report_filename(
        self,
        compliance_report_exporter,
        mock_quarterly_report,
    ):
        """Test that quarterly reports generate correct filename with EIR prefix."""
        exporter = compliance_report_exporter
        exporter.cr_repo.get_compliance_report_by_id.return_value = (
            mock_quarterly_report
        )

        response = await exporter.export(2)

        assert isinstance(response, StreamingResponse)
        assert (
            response.headers["Content-Disposition"]
            == 'attachment; filename="EIR-Early Issuance Org-2024-Submitted.xlsx"'
        )

    @pytest.mark.anyio
    async def test_load_fuel_supply_data_annual(
        self,
        compliance_report_exporter,
        mock_fuel_supply_data,
    ):
        """Test loading fuel supply data for annual reports."""
        exporter = compliance_report_exporter
        exporter.fs_repo.get_effective_fuel_supplies.return_value = (
            mock_fuel_supply_data
        )

        result = await exporter._load_fuel_supply_data("uuid", 1, 0, False)

        # Check headers match annual columns
        expected_headers = [col.label for col in FUEL_SUPPLY_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains annual quantity field
        # Position shifted due to "Fuel produced in Canada" column added at position 7
        data_row = result[1]
        assert data_row[7] == "Yes"  # is_canada_produced field (2025 report)
        assert data_row[8] == 10000  # quantity field
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_fuel_supply_data_quarterly(
        self,
        compliance_report_exporter,
        mock_fuel_supply_data,
    ):
        """Test loading fuel supply data for quarterly reports."""
        exporter = compliance_report_exporter
        exporter.fs_repo.get_effective_fuel_supplies.return_value = (
            mock_fuel_supply_data
        )

        result = await exporter._load_fuel_supply_data("uuid", 1, 0, True)

        # Check headers match quarterly columns
        expected_headers = [col.label for col in FUEL_SUPPLY_QUARTERLY_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains quarterly fields and total
        # Positions shifted due to "Fuel produced in Canada" and "Supplied in Q1" columns added
        data_row = result[1]
        assert data_row[7] == "Yes"  # is_canada_produced field (2025 report)
        assert data_row[8] == ""  # is_q1_supplied field (2025 report, False = "")
        assert data_row[9] == 2500  # Q1 quantity
        assert data_row[10] == 3000  # Q2 quantity
        assert data_row[11] == 2000  # Q3 quantity
        assert data_row[12] == 2500  # Q4 quantity
        assert data_row[13] == 10000  # Total quantity (sum of quarters)
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_notional_transfer_data_annual(
        self,
        compliance_report_exporter,
        mock_notional_transfer_data,
    ):
        """Test loading notional transfer data for annual reports."""
        exporter = compliance_report_exporter
        exporter.nt_repo.get_effective_notional_transfers.return_value = (
            mock_notional_transfer_data
        )

        result = await exporter._load_notional_transfer_data("uuid", 1, 0, False)

        # Check headers match annual columns
        expected_headers = [col.label for col in NOTIONAL_TRANSFER_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains annual quantity field
        data_row = result[1]
        assert data_row[4] == 5000  # quantity field
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_notional_transfer_data_quarterly(
        self,
        compliance_report_exporter,
        mock_notional_transfer_data,
    ):
        """Test loading notional transfer data for quarterly reports."""
        exporter = compliance_report_exporter
        exporter.nt_repo.get_effective_notional_transfers.return_value = (
            mock_notional_transfer_data
        )

        result = await exporter._load_notional_transfer_data("uuid", 1, 0, True)

        # Check headers match quarterly columns
        expected_headers = [col.label for col in NOTIONAL_TRANSFER_QUARTERLY_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains quarterly fields and total
        data_row = result[1]
        assert data_row[4] == 1250  # Q1 quantity
        assert data_row[5] == 1500  # Q2 quantity
        assert data_row[6] == 1000  # Q3 quantity
        assert data_row[7] == 1250  # Q4 quantity
        assert data_row[8] == 5000  # Total quantity (sum of quarters)
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_allocation_agreement_data_annual(
        self,
        compliance_report_exporter,
        mock_allocation_agreement_data,
    ):
        """Test loading allocation agreement data for annual reports."""
        exporter = compliance_report_exporter
        exporter.aa_repo.get_allocation_agreements.return_value = (
            mock_allocation_agreement_data
        )

        result = await exporter._load_allocation_agreement_data(1, False)

        # Check headers match annual columns
        expected_headers = [col.label for col in ALLOCATION_AGREEMENT_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains annual quantity field
        data_row = result[1]
        assert data_row[11] == 8000  # quantity field
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_allocation_agreement_data_quarterly(
        self,
        compliance_report_exporter,
        mock_allocation_agreement_data,
    ):
        """Test loading allocation agreement data for quarterly reports."""
        exporter = compliance_report_exporter
        exporter.aa_repo.get_allocation_agreements.return_value = (
            mock_allocation_agreement_data
        )

        result = await exporter._load_allocation_agreement_data(1, True)

        # Check headers match quarterly columns
        expected_headers = [col.label for col in ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS]
        assert result[0] == expected_headers

        # Check data row contains quarterly fields and total
        data_row = result[1]
        assert data_row[11] == 2000  # Q1 quantity
        assert data_row[12] == 2400  # Q2 quantity
        assert data_row[13] == 1600  # Q3 quantity
        assert data_row[14] == 2000  # Q4 quantity
        assert data_row[15] == 8000  # Total quantity (sum of quarters)
        assert len(data_row) == len(expected_headers)

    @pytest.mark.anyio
    async def test_load_other_uses_data_no_quarterly_support(
        self,
        compliance_report_exporter,
    ):
        """Test that other uses data loading doesn't change for quarterly reports."""
        exporter = compliance_report_exporter
        exporter.ou_repo.get_effective_other_uses.return_value = []

        # Test both annual and quarterly - should be the same
        annual_result = await exporter._load_fuels_for_other_use_data(
            "uuid", 1, 0, False
        )
        quarterly_result = await exporter._load_fuels_for_other_use_data(
            "uuid", 1, 0, True
        )

        # Headers should be identical since other uses doesn't support quarterly
        assert annual_result[0] == quarterly_result[0]
        expected_headers = [col.label for col in OTHER_USES_COLUMNS]
        assert annual_result[0] == expected_headers

    def test_quarterly_total_calculation(self):
        """Test the quarterly total calculation logic."""
        # Test normal case
        q1, q2, q3, q4 = 1000, 1500, 800, 1200
        total = q1 + q2 + q3 + q4
        assert total == 4500

        # Test with None values (should be treated as 0)
        q1, q2, q3, q4 = 1000, None, 800, None
        total = (q1 or 0) + (q2 or 0) + (q3 or 0) + (q4 or 0)
        assert total == 1800

        # Test with all None values
        q1, q2, q3, q4 = None, None, None, None
        total = (q1 or 0) + (q2 or 0) + (q3 or 0) + (q4 or 0)
        assert total == 0

    def test_column_count_consistency(self):
        """Test that quarterly columns have the correct number of additional columns."""
        # Fuel supply: should have 5 extra columns (Supplied in Q1, Q1, Q2, Q3, Q4, Total) replacing 1 (Quantity)
        # Annual has "Fuel produced in Canada" + Quantity = 16 total
        # Quarterly has "Fuel produced in Canada" + "Supplied in Q1" + Q1-Q4 + Total = 21 total
        annual_fs_count = len(FUEL_SUPPLY_COLUMNS)
        quarterly_fs_count = len(FUEL_SUPPLY_QUARTERLY_COLUMNS)
        assert quarterly_fs_count == annual_fs_count + 5

        # Notional transfer: should have 4 extra columns
        annual_nt_count = len(NOTIONAL_TRANSFER_COLUMNS)
        quarterly_nt_count = len(NOTIONAL_TRANSFER_QUARTERLY_COLUMNS)
        assert quarterly_nt_count == annual_nt_count + 4

        # Allocation agreement: should have 4 extra columns
        annual_aa_count = len(ALLOCATION_AGREEMENT_COLUMNS)
        quarterly_aa_count = len(ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS)
        assert quarterly_aa_count == annual_aa_count + 4

    def test_column_labels_quarterly(self):
        """Test that quarterly columns have the expected labels."""
        # Test fuel supply quarterly columns
        fs_labels = [col.label for col in FUEL_SUPPLY_QUARTERLY_COLUMNS]
        assert "Fuel produced in Canada" in fs_labels
        assert "Supplied in Q1" in fs_labels
        assert "Q1 Quantity" in fs_labels
        assert "Q2 Quantity" in fs_labels
        assert "Q3 Quantity" in fs_labels
        assert "Q4 Quantity" in fs_labels
        assert "Total Quantity" in fs_labels

        # Test notional transfer quarterly columns
        nt_labels = [col.label for col in NOTIONAL_TRANSFER_QUARTERLY_COLUMNS]
        assert "Q1 Quantity" in nt_labels
        assert "Q2 Quantity" in nt_labels
        assert "Q3 Quantity" in nt_labels
        assert "Q4 Quantity" in nt_labels
        assert "Total Quantity" in nt_labels

        # Test allocation agreement quarterly columns
        aa_labels = [col.label for col in ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS]
        assert "Q1 Quantity" in aa_labels
        assert "Q2 Quantity" in aa_labels
        assert "Q3 Quantity" in aa_labels
        assert "Q4 Quantity" in aa_labels
        assert "Total Quantity" in aa_labels
        
        # Test other uses columns (annual only, but includes new fields for 2025+)
        ou_labels = [col.label for col in OTHER_USES_COLUMNS]
        assert "Fuel produced in Canada" in ou_labels
        assert "Supplied in Q1" in ou_labels


class TestReportingFrequencyDetection:
    """Test reporting frequency detection logic."""

    def test_annual_reporting_frequency(self):
        """Test annual reporting frequency detection."""
        frequency = ReportingFrequency.ANNUAL
        is_quarterly = frequency == ReportingFrequency.QUARTERLY
        assert not is_quarterly

        # Test filename prefix
        prefix = "EIR" if is_quarterly else "CR"
        assert prefix == "CR"

    def test_quarterly_reporting_frequency(self):
        """Test quarterly reporting frequency detection."""
        frequency = ReportingFrequency.QUARTERLY
        is_quarterly = frequency == ReportingFrequency.QUARTERLY
        assert is_quarterly

        # Test filename prefix
        prefix = "EIR" if is_quarterly else "CR"
        assert prefix == "EIR"

    def test_reporting_frequency_values(self):
        """Test reporting frequency enum values."""
        assert ReportingFrequency.ANNUAL.value == "Annual"
        assert ReportingFrequency.QUARTERLY.value == "Quarterly"


class TestExportColumnSchema:
    """Test ExportColumn schema functionality."""

    def test_export_column_creation(self):
        """Test ExportColumn creation."""
        column = ExportColumn("Test Label")
        assert column.label == "Test Label"
        assert column.key is None

        column_with_key = ExportColumn("Test Label", "test_key")
        assert column_with_key.label == "Test Label"
        assert column_with_key.key == "test_key"

    def test_export_column_in_lists(self):
        """Test ExportColumn usage in column definition lists."""
        # Test that our column definitions are properly structured
        for column in FUEL_SUPPLY_COLUMNS:
            assert hasattr(column, "label")
            assert isinstance(column.label, str)
            assert len(column.label) > 0

        for column in FUEL_SUPPLY_QUARTERLY_COLUMNS:
            assert hasattr(column, "label")
            assert isinstance(column.label, str)
            assert len(column.label) > 0
