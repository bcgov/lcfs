import json
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from lcfs.db.models.transaction.Transaction import TransactionActionEnum, Transaction
from lcfs.services.rabbitmq.report_consumer import ReportConsumer
from lcfs.web.api.compliance_report.schema import ComplianceReportCreateSchema
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType


@pytest.fixture
def mock_app():
    """Fixture to provide a mocked FastAPI app."""
    return MagicMock()


@pytest.fixture
def mock_redis():
    """Fixture to mock Redis client."""
    return AsyncMock()


@pytest.fixture
def mock_session():
    # Create a mock session that behaves like an async context manager.
    # Specifying `spec=AsyncSession` helps ensure it behaves like the real class.
    from sqlalchemy.ext.asyncio import AsyncSession

    mock_session = AsyncMock(spec=AsyncSession)

    # `async with mock_session:` should work, so define behavior for enter/exit
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None

    # Mock the transaction context manager returned by `session.begin()`
    mock_transaction = AsyncMock()
    mock_transaction.__aenter__.return_value = mock_transaction
    mock_transaction.__aexit__.return_value = None
    mock_session.begin.return_value = mock_transaction

    return mock_session


@pytest.fixture
def mock_repositories():
    """Fixture to mock all repositories and services."""

    mock_compliance_report_repo = MagicMock()
    mock_compliance_report_repo.get_compliance_report_by_legacy_id = AsyncMock(
        return_value=MagicMock()
    )
    mock_compliance_report_repo.get_compliance_report_status_by_desc = AsyncMock(
        return_value=MagicMock()
    )
    mock_compliance_report_repo.add_compliance_report_history = AsyncMock()

    org_service = MagicMock()
    org_service.adjust_balance = AsyncMock()

    mock_transaction_repo = MagicMock()
    mock_transaction_repo.get_transaction_by_id = AsyncMock(
        return_value=MagicMock(
            spec=Transaction, transaction_action=TransactionActionEnum.Reserved
        )
    )

    return {
        "compliance_report_repo": mock_compliance_report_repo,
        "transaction_repo": mock_transaction_repo,
        "user_repo": AsyncMock(),
        "org_service": org_service,
        "compliance_service": AsyncMock(),
    }


@pytest.fixture
def setup_patches(mock_redis, mock_session, mock_repositories):
    """Fixture to apply patches for dependencies."""
    with ExitStack() as stack:
        stack.enter_context(
            patch("redis.asyncio.Redis.from_url", return_value=mock_redis)
        )

        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.AsyncSession",
                return_value=mock_session,
            )
        )
        stack.enter_context(
            patch("lcfs.services.rabbitmq.report_consumer.async_engine", MagicMock())
        )

        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.ComplianceReportRepository",
                return_value=mock_repositories["compliance_report_repo"],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.TransactionRepository",
                return_value=mock_repositories["transaction_repo"],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.UserRepository",
                return_value=mock_repositories["user_repo"],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.OrganizationsService",
                return_value=mock_repositories["org_service"],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.services.rabbitmq.report_consumer.ComplianceReportServices",
                return_value=mock_repositories["compliance_service"],
            )
        )
        yield stack


@pytest.mark.anyio
async def test_process_message_created_new_initial_report(
    mock_app, setup_patches, mock_repositories
):
    """Test the 'Created' action when root_report_id == legacy_id, indicating a new initial report."""
    consumer = ReportConsumer(mock_app)

    # Prepare a sample message for "Created" action (new report)
    # Note root_report_id == tfrs_id => new initial report
    message = {
        "tfrs_id": 123,
        "root_report_id": 123,
        "organization_id": 1,
        "compliance_period": "2023",
        "action": "Created",
        "user_id": 42,
    }
    body = json.dumps(message).encode()

    mock_user = MagicMock()
    mock_repositories["user_repo"].get_user_by_id.return_value = mock_user

    await consumer.process_message(body)

    # Assertions for "Created" action, new initial report
    mock_repositories[
        "compliance_service"
    ].create_compliance_report.assert_called_once_with(
        1,  # org_id
        ComplianceReportCreateSchema(
            legacy_id=123,
            compliance_period="2023",
            organization_id=1,
            nickname="Original Report",
            status="Draft",
        ),
        mock_user,
    )


@pytest.mark.anyio
async def test_process_message_created_supplemental_report(
    mock_app, setup_patches, mock_repositories
):
    """
    Test the 'Created' action when root_report_id != legacy_id, indicating a supplemental report.
    """
    consumer = ReportConsumer(mock_app)

    # Prepare a sample message for "Created" action (supplemental)
    message = {
        "tfrs_id": 999,  # This is the new supplemental's legacy ID
        "root_report_id": 123,  # The original (root) report ID
        "organization_id": 1,
        "compliance_period": "2023",
        "action": "Created",
        "user_id": 42,
    }
    body = json.dumps(message).encode()

    mock_user = MagicMock()
    mock_repositories["user_repo"].get_user_by_id.return_value = mock_user

    # Mock root report so the repository call returns a valid object
    mock_root_report = MagicMock()
    mock_root_report.version = 2
    mock_root_report.compliance_report_group_uuid = "test-uuid"
    mock_repositories[
        "compliance_report_repo"
    ].get_compliance_report_by_legacy_id.return_value = mock_root_report

    await consumer.process_message(body)

    # The code should create a supplemental report using the root report's group UUID
    # and increment the version by 1
    mock_repositories[
        "compliance_service"
    ].create_supplemental_report.assert_called_once()

    called_args = mock_repositories[
        "compliance_service"
    ].create_supplemental_report.call_args[0]
    root_report_id_arg = called_args[0]
    user_arg = called_args[1]
    legacy_id_arg = called_args[2]

    assert root_report_id_arg == 123
    assert user_arg == mock_user
    # Check that the new supplemental report schema was built correctly
    assert legacy_id_arg == 999


@pytest.mark.anyio
async def test_process_message_submitted(mock_app, setup_patches, mock_repositories):
    consumer = ReportConsumer(mock_app)

    # Prepare a sample message for "Submitted" action
    message = {
        "tfrs_id": 123,
        "root_report_id": 123,
        "organization_id": 1,
        "compliance_period": "2023",
        "action": "Submitted",
        "credits": 50,
        "user_id": 42,
    }
    body = json.dumps(message).encode()

    await consumer.process_message(body)

    # Assertions for "Submitted" action
    mock_repositories[
        "compliance_report_repo"
    ].get_compliance_report_by_legacy_id.assert_called_once_with(123)
    mock_repositories["org_service"].adjust_balance.assert_called_once_with(
        TransactionActionEnum.Reserved, 50, 1
    )
    mock_repositories[
        "compliance_report_repo"
    ].add_compliance_report_history.assert_called_once()


@pytest.mark.anyio
async def test_process_message_approved(mock_app, setup_patches, mock_repositories):
    consumer = ReportConsumer(mock_app)

    # Prepare a sample message for "Approved" action
    message = {
        "tfrs_id": 123,
        "root_report_id": 123,
        "organization_id": 1,
        "action": "Approved",
        "user_id": 42,
    }
    body = json.dumps(message).encode()

    await consumer.process_message(body)

    # Assertions for "Approved" action
    mock_repositories[
        "compliance_report_repo"
    ].get_compliance_report_by_legacy_id.assert_called_once_with(123)
    mock_repositories["transaction_repo"].confirm_transaction.assert_called_once()
