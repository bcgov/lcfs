import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock
from lcfs.web.api.organization.services import OrganizationService
from lcfs.web.api.organization.validation import OrganizationValidation
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.user.services import UserServices
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.transaction.repo import TransactionRepository


@pytest.fixture
def mock_organization_services():
    return MagicMock(spec=OrganizationService)


@pytest.fixture
def mock_user_services():
    return MagicMock(spec=UserServices)


@pytest.fixture
def mock_transactions_services():
    return MagicMock(spec=TransactionsService)


@pytest.fixture
def mock_transfer_services():
    return MagicMock(spec=TransferServices)


@pytest.fixture
def mock_organization_validation():
    return MagicMock(spec=OrganizationValidation)


@pytest.fixture
def mock_compliance_report_services():
    return MagicMock(spec=ComplianceReportServices)


@pytest.fixture
def mock_user_repo():
    return AsyncMock(spec=UserRepository)


@pytest.fixture
def mock_transaction_repo():
    return AsyncMock(spec=TransactionRepository)


@pytest.fixture
def mock_orgs_repo():
    return AsyncMock(spec=OrganizationsRepository)


@pytest.fixture
def mock_report_repo():
    return AsyncMock(spec=ComplianceReportRepository)


@pytest.fixture
def mock_report_opening_repo():
    repo = AsyncMock()
    repo.ensure_year = AsyncMock(
        return_value=SimpleNamespace(
            compliance_year=2024,
            compliance_reporting_enabled=True,
            early_issuance_enabled=False,
            supplemental_report_role="BCeID",
        )
    )
    return repo


@pytest.fixture
def mock_request(mock_user_profile):
    request = MagicMock()
    request.user = mock_user_profile
    return request


@pytest.fixture
def organization_service(mock_user_repo, mock_transaction_repo):
    service = OrganizationService()
    service.transaction_repo = mock_transaction_repo
    service.user_repo = mock_user_repo
    return service


@pytest.fixture
def organization_validation(
    mock_orgs_repo,
    mock_transaction_repo,
    mock_report_repo,
    mock_request,
    mock_report_opening_repo,
):
    validation = OrganizationValidation()
    validation.org_repo = mock_orgs_repo
    validation.transaction_repo = mock_transaction_repo
    validation.report_repo = mock_report_repo
    validation.request = mock_request
    validation.report_opening_repo = mock_report_opening_repo
    return validation
