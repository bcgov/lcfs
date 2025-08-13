# transactions/repo.py
import zoneinfo

import structlog
from datetime import datetime
from enum import Enum
from typing import List, Optional

from fastapi import Depends
from sqlalchemy import (
    exists,
    select,
    update,
    func,
    desc,
    asc,
    and_,
    case,
    or_,
    extract,
    delete,
    join,
)
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import ComplianceReport
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.transaction.TransactionStatusView import TransactionStatusView
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.db.models.transfer import TransferHistory
from lcfs.db.models.transfer.TransferStatus import TransferStatus
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.core.decorators import repo_handler


class EntityType(Enum):
    Government = "Government"
    Transferor = "Transferor"
    Transferee = "Transferee"


logger = structlog.get_logger(__name__)


class TransactionRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_transactions_paginated(
        self,
        offset: int,
        limit: Optional[int] = None,
        conditions: list = [],
        sort_orders: list = [],
        organization_id: Optional[int] = None,
    ):
        """
        Fetches paginated, filtered, and sorted transactions.
        Adjusts visibility based on the requester's role: transferor, transferee, or government.

        Args:
            offset (int): Pagination offset.
            limit (int): Pagination limit.
            conditions (list): Filtering conditions.
            sort_orders (list): Sorting orders.
            organization_id (int, optional): ID of the requesting organization; determines visibility rules. Defaults to government view if None.

        Returns:
            A tuple of (list of TransactionView instances, total count).
        """
        query_conditions = conditions

        # Base condition for transaction type "Transfer"
        transfer_type_condition = TransactionView.transaction_type == "Transfer"

        if organization_id is not None:
            # Fetch visible statuses for both roles for "Transfer" transactions
            visible_statuses_transferor = await self.get_visible_statuses(
                EntityType.Transferor
            )
            visible_statuses_transferee = await self.get_visible_statuses(
                EntityType.Transferee
            )

            # Construct role-specific conditions, applying them only to "Transfer" transactions
            transferor_condition = and_(
                transfer_type_condition,
                TransactionView.from_organization_id == organization_id,
                TransactionView.status.in_(
                    [status.value for status in visible_statuses_transferor]
                ),
            )
            transferee_condition = and_(
                transfer_type_condition,
                TransactionView.to_organization_id == organization_id,
                TransactionView.status.in_(
                    [status.value for status in visible_statuses_transferee]
                ),
            )

            # Conditions for non-transfer transactions, only "Approved" for suppliers
            non_transfer_condition = and_(
                TransactionView.transaction_type != "Transfer",
                TransactionView.to_organization_id == organization_id,
                TransactionView.status.in_(["Approved", "Assessed"]),
            )

            # Combine conditions since an organization can be both transferor and transferee, or neither for non-"Transfer" transactions
            combined_role_condition = or_(
                transferor_condition, transferee_condition, non_transfer_condition
            )
            query_conditions.append(combined_role_condition)
        else:
            # Government view should see all non-transfer transactions regardless of status
            gov_transfer_condition = and_(
                transfer_type_condition,
                TransactionView.status.in_(
                    [
                        status.value
                        for status in await self.get_visible_statuses(
                            EntityType.Government
                        )
                    ]
                ),
                # Add condition for rescinded transfers
                or_(
                    TransactionView.status != "Rescinded",
                    and_(
                        TransactionView.status == "Rescinded",
                        exists()
                        .select_from(
                            join(
                                TransferHistory,
                                TransferStatus,
                                TransferHistory.transfer_status_id
                                == TransferStatus.transfer_status_id,
                            )
                        )
                        .where(
                            and_(
                                TransferHistory.transfer_id
                                == TransactionView.transaction_id,
                                TransferStatus.status == "Submitted",
                                TransferHistory.create_date
                                < TransactionView.update_date,
                            )
                        ),
                    ),
                ),
            )
            gov_non_transfer_condition = TransactionView.transaction_type != "Transfer"

            query_conditions.append(
                or_(gov_transfer_condition, gov_non_transfer_condition)
            )

        # Add additional conditions
        if conditions:
            query_conditions.extend(conditions)

        query = select(TransactionView).where(and_(*query_conditions))

        # Apply sorting
        for order in sort_orders:
            direction = asc if order.direction == "asc" else desc

            # Special handling for transaction_id sorting to sort by type first, then by id
            if order.field == "transaction_id":
                query = query.order_by(
                    direction(TransactionView.transaction_type),
                    direction(TransactionView.transaction_id),
                )
            else:
                query = query.order_by(direction(getattr(TransactionView, order.field)))

        # Execute count query for total records matching the filter
        count_query = select(func.count(TransactionView.transaction_id)).where(
            and_(*query_conditions)
        )
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar_one()

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute the query
        result = await self.db.execute(query)
        transactions = result.scalars().all()

        return transactions, total_count

    @repo_handler
    async def get_transaction_by_id(self, transaction_id: int) -> Transaction:
        """
        Retrieves a transaction by its ID.

        Args:
            transaction_id (int): The ID of the transaction to retrieve.

        Returns:
            Transaction: The transaction view object.
        """
        query = select(Transaction).where(Transaction.transaction_id == transaction_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    @repo_handler
    async def get_transaction_statuses(self) -> List[TransactionStatusView]:
        """
        Get all available statuses for transactions from the database.

        Returns:
            List[TransactionStatusView]: A list of TransactionStatusView objects containing the basic transaction status details.
        """
        query = (
            select(TransactionStatusView)
            .distinct(TransactionStatusView.status)
            .order_by(asc(TransactionStatusView.status))
        )
        status_results = await self.db.execute(query)
        return status_results.scalars().all()

    @repo_handler
    async def calculate_total_balance(self, organization_id: int):
        """
        Calculate the total balance for a specific organization based on adjustments.

        This method computes the sum of compliance units for all transactions marked as adjustments for the given organization.

        Args:
            organization_id (int): The ID of the organization for which to calculate the total balance.

        Returns:
            int: The total balance of compliance units as adjustments for the specified organization. Returns 0 if no balance is calculated.
        """
        total_balance = await self.db.scalar(
            select(
                func.sum(
                    case(
                        (
                            Transaction.transaction_action
                            == TransactionActionEnum.Adjustment,
                            Transaction.compliance_units,
                        ),
                        else_=0,
                    )
                ).label("total_balance")
            ).where(Transaction.organization_id == organization_id)
        )
        return total_balance or 0

    @repo_handler
    async def calculate_reserved_balance(self, organization_id: int):
        """
        Calculate the reserved balance for a specific organization.

        Args:
            organization_id (int): The ID of the organization for which to calculate the reserved balance.

        Returns:
            int: The reserved balance of compliance units for the specified organization. Returns 0 if no balance is calculated.
        """
        reserved_balance = await self.db.scalar(
            select(
                func.abs(
                    func.sum(
                        case(
                            (
                                and_(
                                    Transaction.transaction_action
                                    == TransactionActionEnum.Reserved,
                                    Transaction.compliance_units < 0,
                                ),
                                Transaction.compliance_units,
                            ),
                            else_=0,
                        )
                    )
                ).label("reserved_balance")
            ).where(Transaction.organization_id == organization_id)
        )
        return reserved_balance or 0

    @repo_handler
    async def calculate_available_balance(self, organization_id: int):
        """
        Calculate the available balance for a specific organization.

        Args:
            organization_id (int): The ID of the organization for which to calculate the available balance.

        Returns:
            int: The available balance of compliance units for the specified organization. Returns 0 if no balance is calculated.
        """
        available_balance = await self.db.scalar(
            select(
                (
                    func.sum(
                        case(
                            (
                                Transaction.transaction_action
                                == TransactionActionEnum.Adjustment,
                                Transaction.compliance_units,
                            ),
                            else_=0,
                        )
                    )
                    + func.sum(
                        case(
                            (
                                and_(
                                    Transaction.transaction_action
                                    == TransactionActionEnum.Reserved,
                                    Transaction.compliance_units < 0,
                                ),
                                Transaction.compliance_units,
                            ),
                            else_=0,
                        )
                    )
                ).label("available_balance")
            ).where(Transaction.organization_id == organization_id)
        )
        return available_balance or 0

    @repo_handler
    async def calculate_available_balance_for_period(
        self, organization_id: int, compliance_period: int
    ):
        """
        Calculate the available balance for a specific organization available to a specific compliance period.

        Args:
            organization_id (int): The ID of the organization for which to calculate the available balance.
            compliance_period (int): The compliance period year in integer

        Returns:
            int: The available balance of compliance units for the specified organization and period. Returns 0 if no balance is calculated.
        """
        vancouver_timezone = zoneinfo.ZoneInfo("America/Vancouver")
        compliance_period_end = datetime.strptime(
            f"{str(compliance_period + 1)}-03-31", "%Y-%m-%d"
        )
        compliance_period_end_local = compliance_period_end.replace(
            hour=23, minute=59, second=59, microsecond=999999, tzinfo=vancouver_timezone
        )
        # Calculate the sum of all transactions up to the specified date
        balance_to_date = await self.db.scalar(
            select(func.coalesce(func.sum(Transaction.compliance_units), 0)).where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.create_date <= compliance_period_end_local,
                    Transaction.transaction_action != TransactionActionEnum.Released,
                )
            )
        )

        # Calculate the sum of future negative transactions
        future_negative_transactions = await self.db.scalar(
            select(func.coalesce(func.sum(Transaction.compliance_units), 0)).where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.create_date > compliance_period_end_local,
                    Transaction.compliance_units < 0,
                    Transaction.transaction_action != TransactionActionEnum.Released,
                )
            )
        )

        # Calculate the available balance, round to the nearest whole number, and if negative, set to zero
        available_balance = max(
            round(balance_to_date - abs(future_negative_transactions)), 0
        )

        return available_balance

    @repo_handler
    async def calculate_line_17_available_balance_for_period(
        self, organization_id: int, compliance_period: int
    ):
        """
        Calculate the available balance for Line 17 using the specific period end formula.

        This formula includes:
        - validations or compliance unit balance changes from assessments listed with compliance period or prior
        - minus reductions listed with compliance period or prior
        - plus compliance units purchased through credit transfers with effective date on or before end of compliance period
        - minus compliance units sold through credit transfer with effective date on or before end of compliance period
        - plus compliance units issued under IA/P3A with effective date on or before end of compliance period
        - plus/minus admin adjustments with effective date on or before end of compliance period
        - minus all future debits (such as transfers or reductions)

        Args:
            organization_id (int): The ID of the organization
            compliance_period (int): The compliance period year

        Returns:
            int: The available balance for Line 17
        """
        vancouver_timezone = zoneinfo.ZoneInfo("America/Vancouver")
        compliance_period_end = datetime.strptime(
            f"{str(compliance_period + 1)}-03-31", "%Y-%m-%d"
        )
        compliance_period_end_local = compliance_period_end.replace(
            hour=23, minute=59, second=59, microsecond=999999, tzinfo=vancouver_timezone
        )

        # Query all transactions for this organization, joining with parent entities to check effective dates
        # This approach ensures we count each transaction only once based on its parent entity's effective date
        TransferTo = aliased(Transfer)

        transactions_query = (
            select(
                Transaction.transaction_id,
                Transaction.compliance_units,
                Transaction.create_date,
                # Check if transaction is from a compliance report
                ComplianceReport.compliance_report_id.isnot(None).label(
                    "is_compliance_report"
                ),
                # Check if transaction is from a transfer (as sender)
                case(
                    (
                        Transfer.from_transaction_id.isnot(None),
                        Transfer.transaction_effective_date,
                    ),
                    else_=None,
                ).label("transfer_from_effective_date"),
                # Check if transaction is from a transfer (as receiver)
                case(
                    (
                        TransferTo.to_transaction_id.isnot(None),
                        TransferTo.transaction_effective_date,
                    ),
                    else_=None,
                ).label("transfer_to_effective_date"),
                # Check if transaction is from an initiative agreement
                case(
                    (
                        InitiativeAgreement.transaction_id.isnot(None),
                        InitiativeAgreement.transaction_effective_date,
                    ),
                    else_=None,
                ).label("ia_effective_date"),
                # Check if transaction is from an admin adjustment
                case(
                    (
                        AdminAdjustment.transaction_id.isnot(None),
                        AdminAdjustment.transaction_effective_date,
                    ),
                    else_=None,
                ).label("admin_effective_date"),
                # Include status checks
                Transfer.current_status_id.label("transfer_from_status"),
                TransferTo.current_status_id.label("transfer_to_status"),
                InitiativeAgreement.current_status_id.label("ia_status"),
                AdminAdjustment.current_status_id.label("admin_status"),
                ComplianceReportStatus.status.label("compliance_status"),
            )
            .select_from(Transaction)
            # Left join to compliance reports
            .outerjoin(
                ComplianceReport,
                Transaction.transaction_id == ComplianceReport.transaction_id,
            )
            .outerjoin(
                ComplianceReportStatus,
                ComplianceReport.current_status_id
                == ComplianceReportStatus.compliance_report_status_id,
            )
            # Left join to transfers (as sender)
            .outerjoin(
                Transfer,
                and_(
                    Transaction.transaction_id == Transfer.from_transaction_id,
                    Transfer.from_organization_id == organization_id,
                ),
            )
            # Left join to transfers (as receiver) - using aliased Transfer
            .outerjoin(
                TransferTo,
                and_(
                    Transaction.transaction_id == TransferTo.to_transaction_id,
                    TransferTo.to_organization_id == organization_id,
                ),
            )
            # Left join to initiative agreements
            .outerjoin(
                InitiativeAgreement,
                and_(
                    Transaction.transaction_id == InitiativeAgreement.transaction_id,
                    InitiativeAgreement.to_organization_id == organization_id,
                ),
            )
            # Left join to admin adjustments
            .outerjoin(
                AdminAdjustment,
                and_(
                    Transaction.transaction_id == AdminAdjustment.transaction_id,
                    AdminAdjustment.to_organization_id == organization_id,
                ),
            )
            .where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.transaction_action == TransactionActionEnum.Adjustment,
                )
            )
        )

        # Execute query and process results
        result = await self.db.execute(transactions_query)

        past_balance = 0
        future_negative = 0

        for row in result:
            transaction_id = row.transaction_id
            compliance_units = row.compliance_units
            create_date = row.create_date

            # Determine if this transaction should be counted as past or future
            count_as_past = False

            # 1. Compliance report transactions
            if (
                row.is_compliance_report
                and row.compliance_status == ComplianceReportStatusEnum.Assessed
            ):
                if create_date <= compliance_period_end_local:
                    count_as_past = True

            # 2. Transfer transactions (from)
            elif (
                row.transfer_from_effective_date is not None
                and row.transfer_from_status == 6
            ):  # Recorded
                # Convert to date for comparison if it's a datetime
                transfer_date = row.transfer_from_effective_date
                if hasattr(transfer_date, "date"):
                    transfer_date = transfer_date.date()
                if transfer_date <= compliance_period_end_local.date():
                    count_as_past = True

            # 3. Transfer transactions (to)
            elif (
                row.transfer_to_effective_date is not None
                and row.transfer_to_status == 6
            ):  # Recorded
                # Convert to date for comparison if it's a datetime
                transfer_date = row.transfer_to_effective_date
                if hasattr(transfer_date, "date"):
                    transfer_date = transfer_date.date()
                if transfer_date <= compliance_period_end_local.date():
                    count_as_past = True

            # 4. Initiative agreement transactions
            elif row.ia_effective_date is not None and row.ia_status == 3:  # Approved
                # Convert to date for comparison if it's a datetime
                ia_date = row.ia_effective_date
                if hasattr(ia_date, "date"):
                    ia_date = ia_date.date()
                if ia_date <= compliance_period_end_local.date():
                    count_as_past = True

            # 5. Admin adjustment transactions
            elif (
                row.admin_effective_date is not None and row.admin_status == 3
            ):  # Approved
                # Convert to date for comparison if it's a datetime
                admin_date = row.admin_effective_date
                if hasattr(admin_date, "date"):
                    admin_date = admin_date.date()
                if admin_date <= compliance_period_end_local.date():
                    count_as_past = True

            # Apply the transaction to the appropriate balance
            if count_as_past:
                past_balance += compliance_units
            elif create_date > compliance_period_end_local and compliance_units < 0:
                # This is a future negative transaction - but only count it if it's not
                # associated with any parent entity that has a future effective date
                is_future_debit = True
                
                # Check if this transaction belongs to a transfer with future effective date
                if row.transfer_from_effective_date is not None:
                    transfer_date = row.transfer_from_effective_date
                    if hasattr(transfer_date, "date"):
                        transfer_date = transfer_date.date()
                    if transfer_date > compliance_period_end_local.date():
                        is_future_debit = False
                        
                if row.transfer_to_effective_date is not None:
                    transfer_date = row.transfer_to_effective_date
                    if hasattr(transfer_date, "date"):
                        transfer_date = transfer_date.date()
                    if transfer_date > compliance_period_end_local.date():
                        is_future_debit = False
                        
                # Check if this transaction belongs to an IA with future effective date
                if row.ia_effective_date is not None:
                    ia_date = row.ia_effective_date
                    if hasattr(ia_date, "date"):
                        ia_date = ia_date.date()
                    if ia_date > compliance_period_end_local.date():
                        is_future_debit = False
                        
                # Check if this transaction belongs to an admin adjustment with future effective date
                if row.admin_effective_date is not None:
                    admin_date = row.admin_effective_date
                    if hasattr(admin_date, "date"):
                        admin_date = admin_date.date()
                    if admin_date > compliance_period_end_local.date():
                        is_future_debit = False
                
                if is_future_debit:
                    future_negative += compliance_units

        # Calculate the available balance
        available_balance = past_balance - abs(future_negative)

        # Return the balance, ensuring it doesn't go below zero
        return max(available_balance, 0)

    @repo_handler
    async def create_transaction(
        self,
        transaction_action: TransactionActionEnum,
        compliance_units: int,
        organization_id: int,
    ) -> Transaction:
        """
        Creates and saves a new transaction to the database.

        Args:
            transaction_action (TransactionActionEnum): The type of action the transaction represents (e.g., Adjustment, Reserved, Released).
            compliance_units (int): The number of compliance units involved in the transaction.
            organization_id (int): The ID of the organization related to this transaction.

        Returns:
            Transaction: The newly created and saved transaction with its unique ID.
        """
        new_transaction = Transaction(
            transaction_action=transaction_action,
            compliance_units=compliance_units,
            organization_id=organization_id,
        )
        self.db.add(new_transaction)
        await self.db.flush()
        await self.db.refresh(new_transaction, ["organization"])
        return new_transaction

    @repo_handler
    async def reserve_transaction(self, transaction_id: int) -> bool:
        """
        Attempt to reserve a transaction by updating its transaction_action to Reserved.

        Args:
            transaction_id (int): The ID of the transaction to reserve.

        Returns:
            bool: True if the action was successfully applied, False otherwise.
        """
        result = await self.db.execute(
            update(Transaction)
            .where(Transaction.transaction_id == transaction_id)
            .values(transaction_action=TransactionActionEnum.Reserved)
        )
        # Check if the update statement affected any rows
        return result.rowcount > 0

    @repo_handler
    async def release_transaction(self, transaction_id: int) -> bool:
        """
        Attempt to release a transaction by updating its transaction_action to Released.

        Args:
            transaction_id (int): The ID of the transaction to release.

        Returns:
            bool: True if the action was successfully applied, False otherwise.
        """
        result = await self.db.execute(
            update(Transaction)
            .where(Transaction.transaction_id == transaction_id)
            .values(transaction_action=TransactionActionEnum.Released)
        )
        # Check if the update statement affected any rows
        return result.rowcount > 0

    @repo_handler
    async def confirm_transaction(self, transaction_id: int) -> bool:
        """
        Attempt to confirm a transaction by updating its transaction_action to Adjustment.

        Args:
            transaction_id (int): The ID of the transaction to release.

        Returns:
            bool: True if the action was successfully applied, False otherwise.
        """
        # Execute the update statement
        result = await self.db.execute(
            update(Transaction)
            .where(Transaction.transaction_id == transaction_id)
            .values(
                transaction_action=TransactionActionEnum.Adjustment,
            )
        )
        # Commit the update to make it permanent
        # await self.db.commit()

        # Check if the update statement affected any rows
        if result.rowcount > 0:
            # Retrieve the updated transaction instance
            query = select(Transaction).where(
                Transaction.transaction_id == transaction_id
            )
            updated_transaction = await self.db.scalar(query)

            # If the transaction is found, refresh it and return True
            if updated_transaction:
                await self.db.refresh(updated_transaction)
                # await self.db.refresh(updated_transaction.organization)
                return True
        # If no rows were affected or transaction could not be retrieved, return False
        return False

    @repo_handler
    async def reinstate_transaction(self, transaction_id: int) -> bool:
        """
        Sets a transaction's action back to 'Reserved'. This is used when a
        superseding report is deleted, putting the previous report back in play.
        """
        transaction = await self.get_transaction_by_id(transaction_id)
        if not transaction:
            return False
        transaction.transaction_action = TransactionActionEnum.Reserved
        self.db.add(transaction)
        await self.db.flush()
        return True

    @repo_handler
    async def get_visible_statuses(self, entity_type: EntityType) -> List[str]:
        """
        Fetches transaction statuses visible to the specified entity type.

        Args:
            entity_type (EntityType): The entity type (transferor, transferee, government).

        Returns:
            List[str]: Visible status strings for the entity.

        Raises:
            ValueError: For invalid entity type.
        """
        # Map entity types to their corresponding conditions
        conditions = {
            EntityType.Transferor: TransferStatus.visible_to_transferor.is_(True),
            EntityType.Transferee: TransferStatus.visible_to_transferee.is_(True),
            EntityType.Government: TransferStatus.visible_to_government.is_(True),
        }

        # Fetch the condition for the given entity type
        condition = conditions.get(entity_type)

        # Ensure a valid entity type was provided
        if condition is None:
            raise ValueError(f"Invalid entity type: {entity_type}")

        query = select(TransferStatus.status).where(condition)
        result = await self.db.execute(query)

        # Directly fetching string representations of the statuses
        return [status[0] for status in result.fetchall()]

    @repo_handler
    async def get_transaction_start_year(self):
        """
        Returns the year of the oldest transaction in the system

        Returns:
            oldest_year (int): the year of the oldest transaction in the system
        """

        oldest_year = await self.db.scalar(
            select(extract("year", Transaction.create_date).label("year"))
            .order_by(Transaction.create_date.asc())
            .limit(1)
        )

        return oldest_year

    @repo_handler
    async def delete_transaction(self, transaction_id, attached_report_id):
        """Deletes a transaction with the given ID"""
        await self.db.execute(
            update(ComplianceReport)
            .where(ComplianceReport.compliance_report_id == attached_report_id)
            .values(transaction_id=None)
        )
        await self.db.execute(
            delete(Transaction).where(Transaction.transaction_id == transaction_id)
        )
