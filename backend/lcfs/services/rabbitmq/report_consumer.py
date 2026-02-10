import asyncio
import json
import structlog
from typing import Optional

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import async_engine
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.user import UserProfile
from lcfs.services.rabbitmq.base_consumer import BaseConsumer
from lcfs.services.tfrs.redis_balance import RedisBalanceService
from lcfs.settings import settings
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportCreateSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.exception.exceptions import ServiceException

logger = structlog.get_logger()

consumer = None
consumer_task = None

VALID_ACTIONS = {"Created", "Submitted", "Approved"}


async def setup_report_consumer(app: FastAPI):
    """
    Set up the report consumer and start consuming messages.
    """
    global consumer, consumer_task
    consumer = ReportConsumer(app)
    await consumer.connect()
    consumer_task = asyncio.create_task(consumer.start_consuming())


async def close_report_consumer():
    """
    Cancel the consumer task if it exists and close the consumer connection.
    """
    global consumer, consumer_task

    if consumer_task:
        consumer_task.cancel()

    if consumer:
        await consumer.close_connection()


class ReportConsumer(BaseConsumer):
    """
    A consumer for handling TFRS compliance report messages from a RabbitMQ queue.
    """

    def __init__(
        self, app: FastAPI, queue_name: str = settings.rabbitmq_transaction_queue
    ):
        super().__init__(app, queue_name)

    async def process_message(self, body: bytes):
        """
        Process an incoming message from the queue.

        Expected message structure:
        {
            "tfrs_id": int,
            "root_report_id": int,
            "organization_id": int,
            "compliance_period": str,
            "action": "Created"|"Submitted"|"Approved",
            "credits": int (optional),
            "user_id": int
        }
        """
        message = self._parse_message(body)
        if not message:
            return  # Invalid message already logged

        action = message["action"]
        org_id = message["organization_id"]

        if action not in VALID_ACTIONS:
            logger.error(f"Invalid action '{action}' in message.")
            return

        logger.info(f"Received '{action}' action from TFRS for Org {org_id}")

        try:
            await self.handle_message(
                action=action,
                compliance_period=message.get("compliance_period"),
                compliance_units=message.get("credits"),
                root_report_id=message["root_report_id"],
                legacy_id=message["tfrs_id"],
                org_id=org_id,
                user_id=message["user_id"],
            )
        except Exception:
            logger.exception("Failed to handle message")

    def _parse_message(self, body: bytes) -> Optional[dict]:
        """
        Parse the message body into a dictionary.
        Log and return None if parsing fails or required fields are missing.
        """
        try:
            message_content = json.loads(body.decode())
        except json.JSONDecodeError:
            logger.error("Failed to decode message body as JSON.")
            return None

        required_fields = ["tfrs_id", "organization_id", "action", "user_id"]
        if any(field not in message_content for field in required_fields):
            logger.error("Message missing required fields.")
            return None

        return message_content

    async def handle_message(
        self,
        action: str,
        compliance_period: str,
        compliance_units: Optional[int],
        root_report_id: int,
        legacy_id: int,
        org_id: int,
        user_id: int,
    ):
        """
        Handle a given message action by loading dependencies and calling the respective handler.
        """
        redis_client = self.app.state.redis_client

        async with AsyncSession(async_engine) as session:
            async with session.begin():
                # Initialize repositories and services with the same session
                fuel_supply_repo = FuelSupplyRepository(db=session)
                org_repo = OrganizationsRepository(db=session)
                transaction_repo = TransactionRepository(db=session)
                redis_balance_service = RedisBalanceService(
                    transaction_repo=transaction_repo, redis_client=redis_client
                )
                org_service = OrganizationsService(
                    repo=org_repo,
                    transaction_repo=transaction_repo,
                    redis_balance_service=redis_balance_service,
                )
                compliance_report_repo = ComplianceReportRepository(
                    db=session, fuel_supply_repo=fuel_supply_repo
                )
                compliance_report_service = ComplianceReportServices(
                    request=None,
                    repo=compliance_report_repo
                )
                user = await UserRepository(db=session).get_user_by_id(user_id)

                if not user:
                    logger.error(
                        f"Cannot parse Report {legacy_id} from TFRS, no user with ID {user_id}"
                    )

                if action == "Created":
                    await self._handle_created(
                        org_id,
                        root_report_id,
                        legacy_id,
                        compliance_period,
                        user,
                        compliance_report_repo,
                        compliance_report_service,
                    )
                elif action == "Submitted":
                    await self._handle_submitted(
                        compliance_report_repo,
                        compliance_units,
                        legacy_id,
                        org_id,
                        org_service,
                        session,
                        user,
                    )
                elif action == "Approved":
                    await self._handle_approved(
                        legacy_id,
                        compliance_report_repo,
                        transaction_repo,
                        user,
                        session,
                    )

    async def _handle_created(
        self,
        org_id: int,
        root_report_id: int,
        legacy_id: int,
        compliance_period: str,
        user: UserProfile,
        compliance_report_repo: ComplianceReportRepository,
        compliance_report_service: ComplianceReportServices,
    ):
        """
        Handle the 'Created' action by creating a new compliance report draft.
        """
        if root_report_id == legacy_id:  # this is a new initial report
            lcfs_report = ComplianceReportCreateSchema(
                legacy_id=legacy_id,
                compliance_period=compliance_period,
                organization_id=org_id,
                nickname="Original Report",
                status=ComplianceReportStatusEnum.Draft.value,
            )
            await compliance_report_service.create_compliance_report(
                org_id, lcfs_report, user
            )
        else:
            # Process a new supplemental report
            root_report = (
                await compliance_report_repo.get_compliance_report_by_legacy_id(
                    root_report_id
                )
            )
            if not root_report:
                raise ServiceException(
                    f"No original compliance report found for legacy ID {root_report_id}"
                )
            await compliance_report_service.create_supplemental_report(
                root_report_id, user, legacy_id
            )

    async def _handle_approved(
        self,
        legacy_id: int,
        compliance_report_repo: ComplianceReportRepository,
        transaction_repo: TransactionRepository,
        user: UserProfile,
        session: AsyncSession,
    ):
        """
        Handle the 'Approved' action by updating the report status to 'Assessed'
        and confirming the associated transaction.
        """
        existing_report = (
            await compliance_report_repo.get_compliance_report_by_legacy_id(legacy_id)
        )
        if not existing_report:
            raise ServiceException(
                f"No compliance report found for legacy ID {legacy_id}"
            )

        new_status = await compliance_report_repo.get_compliance_report_status_by_desc(
            ComplianceReportStatusEnum.Assessed.value
        )
        existing_report.current_status_id = new_status.compliance_report_status_id
        session.add(existing_report)
        await session.flush()

        await compliance_report_repo.add_compliance_report_history(
            existing_report, user
        )

        existing_transaction = await transaction_repo.get_transaction_by_id(
            existing_report.transaction_id
        )
        if not existing_transaction:
            raise ServiceException(
                "Compliance Report does not have an associated transaction"
            )

        if existing_transaction.transaction_action != TransactionActionEnum.Reserved:
            raise ServiceException(
                f"Transaction {existing_transaction.transaction_id} is not in 'Reserved' status"
            )

        await transaction_repo.confirm_transaction(existing_transaction.transaction_id)

    async def _handle_submitted(
        self,
        compliance_report_repo: ComplianceReportRepository,
        compliance_units: int,
        legacy_id: int,
        org_id: int,
        org_service: OrganizationsService,
        session: AsyncSession,
        user: UserProfile,
    ):
        """
        Handle the 'Submitted' action by linking a reserved transaction
        to the compliance report and updating its status.
        """
        existing_report = (
            await compliance_report_repo.get_compliance_report_by_legacy_id(legacy_id)
        )
        if not existing_report:
            raise ServiceException(
                f"No compliance report found for legacy ID {legacy_id}"
            )

        transaction = await org_service.adjust_balance(
            TransactionActionEnum.Reserved, compliance_units, org_id
        )
        existing_report.transaction_id = transaction.transaction_id

        new_status = await compliance_report_repo.get_compliance_report_status_by_desc(
            ComplianceReportStatusEnum.Submitted.value
        )
        existing_report.current_status_id = new_status.compliance_report_status_id
        session.add(existing_report)
        await session.flush()

        await compliance_report_repo.add_compliance_report_history(
            existing_report, user
        )
