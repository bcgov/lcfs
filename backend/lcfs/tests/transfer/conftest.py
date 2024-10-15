import pytest
from unittest.mock import MagicMock, AsyncMock
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.transfer.validation import TransferValidation
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_transfer_services():
    return MagicMock(spec=TransferServices)


@pytest.fixture
def mock_transfer_validation():
    return MagicMock(spec=TransferValidation)


@pytest.fixture
def mock_transfer_repo():
    return MagicMock(spec=TransferRepository)


@pytest.fixture
def mock_request(mock_user_profile):
    request = MagicMock()
    request.user = mock_user_profile
    request.user.organization = 1
    request.user.user_profile_id = 1
    return request


@pytest.fixture
def mock_orgs_repo():
    return MagicMock(spec=OrganizationsRepository)


@pytest.fixture
def mock_orgs_service():
    return MagicMock(spec=OrganizationsService)


@pytest.fixture
def mock_transaction_repo():
    return MagicMock(spec=TransactionRepository)


@pytest.fixture
def transfer_service(
    mock_request,
    mock_transfer_validation,
    mock_transfer_repo,
    mock_orgs_repo,
    mock_orgs_service,
    mock_transaction_repo,
):
    service = TransferServices()
    service.validate = mock_transfer_validation
    service.repo = mock_transfer_repo
    service.request = mock_request
    service.org_repo = mock_orgs_repo
    service.org_service = mock_orgs_service
    service.transaction_repo = mock_transaction_repo
    return service


@pytest.fixture
def transfer_repo(mock_db):
    repo = TransferRepository()
    repo.db = mock_db
    return repo
