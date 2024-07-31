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
                           'diesel': 20000, 'jet_fuel': 3000},
        renewable_quantities={'gasoline': 5000,
                              'diesel': 15000, 'jet_fuel': 1000},
        previous_retained={'gasoline': 200, 'diesel': 400, 'jet_fuel': 100},
        notional_transfers_sums={'gasoline': 0, 'diesel': 0, 'jet_fuel': 0}
    )

    expected_results = [
        {'line': '1', 'gasoline': 10000, 'diesel': 20000, 'jet_fuel': 3000},
        {'line': '2', 'gasoline': 5000, 'diesel': 15000, 'jet_fuel': 1000},
        {'line': '3', 'gasoline': 15000, 'diesel': 35000, 'jet_fuel': 4000},
        {'line': '4', 'gasoline': 40000, 'diesel': 40000, 'jet_fuel': 40000},
        {'line': '5', 'gasoline': 0, 'diesel': 0, 'jet_fuel': 0},
        {'line': '6', 'gasoline': 200, 'diesel': 400, 'jet_fuel': 100},
        {'line': '7', 'gasoline': 200, 'diesel': 400, 'jet_fuel': 100},
        {'line': '8', 'gasoline': 9000, 'diesel': 2000, 'jet_fuel': 5000},
        {'line': '9', 'gasoline': 1000, 'diesel': 2000, 'jet_fuel': 3000},
        {'line': '10', 'gasoline': 14000, 'diesel': 16500, 'jet_fuel': 5000},
        {'line': '11', 'gasoline': 7800, 'diesel': 10575, 'jet_fuel': 17500}
    ]

    for expected, row in zip(expected_results, summary):
        assert row.line == expected['line']
        assert row.gasoline == expected['gasoline']
        assert row.diesel == expected['diesel']
        assert row.jet_fuel == expected['jet_fuel']
