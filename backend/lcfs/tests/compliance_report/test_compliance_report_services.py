import pytest
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


@pytest.fixture
def compliance_report_repo(dbsession):
    return ComplianceReportRepository(db=dbsession)


@pytest.fixture
def compliance_report_service(compliance_report_repo):
    return ComplianceReportServices(repo=compliance_report_repo)


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary(compliance_report_service):

    summary = compliance_report_service.calculate_renewable_fuel_target_summary(
        fossil_quantities={'gasoline': 10000,
                           'diesel': 20000, 'jet_fuel': 30000},
        renewable_quantities={'gasoline': 15000,
                              'diesel': 10000, 'jet_fuel': 5000},
        previous_retained={'gasoline': 200, 'diesel': 400, 'jet_fuel': 100},
        notional_transfers_sums={'gasoline': 1250,
                                 'diesel': 2500, 'jet_fuel': 3750},
        compliance_period=2029
    )

    expected_results = [
        {'line': '1', 'gasoline': 10000, 'diesel': 20000, 'jet_fuel': 30000},
        {'line': '2', 'gasoline': 15000, 'diesel': 10000, 'jet_fuel': 5000},
        {'line': '3', 'gasoline': 25000, 'diesel': 30000, 'jet_fuel': 35000},
        {'line': '4', 'gasoline': 1250, 'diesel': 1200, 'jet_fuel': 700},
        {'line': '5', 'gasoline': 1250, 'diesel': 2500, 'jet_fuel': 3750},
        {'line': '6', 'gasoline': 62.5, 'diesel': 60, 'jet_fuel': 35},
        {'line': '7', 'gasoline': 200, 'diesel': 400, 'jet_fuel': 100},
        {'line': '8', 'gasoline': 9000, 'diesel': 2000, 'jet_fuel': 5000},
        {'line': '9', 'gasoline': 1000, 'diesel': 2000, 'jet_fuel': 3000},
        {'line': '10', 'gasoline': 24387.5, 'diesel': 12840, 'jet_fuel': 10815},
        {'line': '11', 'gasoline': 0, 'diesel': 0, 'jet_fuel': 0}
    ]

    for expected, row in zip(expected_results, summary):
        assert row.line == expected['line']
        assert row.gasoline == expected['gasoline']
        assert row.diesel == expected['diesel']
        assert row.jet_fuel == expected['jet_fuel']
