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

        # 1. Compliance unit balance changes from assessments (compliance reports)
        # Include assessed/reassessed compliance reports from the compliance period or prior
        assessment_balance = await self.db.scalar(
            select(func.coalesce(func.sum(Transaction.compliance_units), 0))
            .select_from(Transaction)
            .join(
                ComplianceReport,
                Transaction.transaction_id == ComplianceReport.transaction_id,
            )
            .join(
                ComplianceReportStatus,
                ComplianceReport.current_status_id
                == ComplianceReportStatus.compliance_report_status_id,
            )
            .where(
                and_(
                    Transaction.organization_id == organization_id,
                    ComplianceReportStatus.status.in_(
                        [
                            ComplianceReportStatusEnum.Assessed,
                        ]
                    ),
                    Transaction.create_date <= compliance_period_end_local,
                    Transaction.transaction_action == TransactionActionEnum.Adjustment,
                )
            )
        )

        # 2. Compliance units received through transfers (purchases)
        # Include recorded transfers where this org is the receiver, effective date <= end of compliance period
        transfer_purchases = await self.db.scalar(
            select(func.coalesce(func.sum(Transfer.quantity), 0)).where(
                and_(
                    Transfer.to_organization_id == organization_id,
                    Transfer.current_status_id == 6,  # Recorded status
                    Transfer.transaction_effective_date
                    <= compliance_period_end_local.date(),
                )
            )
        )

        # 3. Compliance units transferred away (sales)
        # Include recorded transfers where this org is the sender, effective date <= end of compliance period
        transfer_sales = await self.db.scalar(
            select(func.coalesce(func.sum(Transfer.quantity), 0)).where(
                and_(
                    Transfer.from_organization_id == organization_id,
                    Transfer.current_status_id == 6,  # Recorded status
                    Transfer.transaction_effective_date
                    <= compliance_period_end_local.date(),
                )
            )
        )

        # 4. Compliance units issued under IA/P3A (Initiative Agreements)
        # Include approved initiative agreements with effective date <= end of compliance period
        initiative_agreements = await self.db.scalar(
            select(
                func.coalesce(func.sum(InitiativeAgreement.compliance_units), 0)
            ).where(
                and_(
                    InitiativeAgreement.to_organization_id == organization_id,
                    InitiativeAgreement.current_status_id == 3,  # Approved status
                    InitiativeAgreement.transaction_effective_date
                    <= compliance_period_end_local.date(),
                )
            )
        )

        # 5. Admin adjustments
        # Include approved admin adjustments with effective date <= end of compliance period
        admin_adjustments = await self.db.scalar(
            select(func.coalesce(func.sum(AdminAdjustment.compliance_units), 0)).where(
                and_(
                    AdminAdjustment.to_organization_id == organization_id,
                    AdminAdjustment.current_status_id == 3,  # Approved status
                    AdminAdjustment.transaction_effective_date
                    <= compliance_period_end_local.date(),
                )
            )
        )

        # 6. Future debits (negative transactions after the compliance period end)
        # This includes future transfers out and other future negative transactions
        future_transfer_debits = await self.db.scalar(
            select(func.coalesce(func.sum(Transfer.quantity), 0)).where(
                and_(
                    Transfer.from_organization_id == organization_id,
                    Transfer.current_status_id == 6,  # Recorded status
                    Transfer.transaction_effective_date
                    > compliance_period_end_local.date(),
                )
            )
        )

        # Future negative adjustments and other transactions
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

        # Calculate the available balance using the TFRS formula
        available_balance = (
            (assessment_balance or 0)
            + (transfer_purchases or 0)
            - (transfer_sales or 0)
            + (initiative_agreements or 0)
            + (admin_adjustments or 0)
            - (future_transfer_debits or 0)
            - abs(future_negative_transactions or 0)
        )

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
        await self.db.commit()
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
