# transactions/repo.py

from enum import Enum
from typing import List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select
from fastapi import Depends

from sqlalchemy import select, update, func, desc, asc, and_, case, or_

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.TransactionView import TransactionViewTypeEnum, TransactionView
from lcfs.db.models.TransactionStatusView import TransactionStatusView
from lcfs.db.models.TransferStatus import TransferStatus


class EntityType(Enum):
    Government = 'Government'
    Transferor = 'Transferor'
    Transferee = 'Transferee'


class TransactionRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_transactions_paginated(self, offset: int, limit: int, conditions: list = [], sort_orders: list = [], organization_id: int = None):
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
        transfer_type_condition = TransactionView.transaction_type == 'Transfer'

        if organization_id is not None:
            # Fetch visible statuses for both roles for "Transfer" transactions
            visible_statuses_transferor = await self.get_visible_statuses(EntityType.Transferor)
            visible_statuses_transferee = await self.get_visible_statuses(EntityType.Transferee)

            # Construct role-specific conditions, applying them only to "Transfer" transactions
            transferor_condition = and_(
                transfer_type_condition,
                TransactionView.from_organization_id == organization_id,
                TransactionView.status.in_(
                    [status.value for status in visible_statuses_transferor])
            )
            transferee_condition = and_(
                transfer_type_condition,
                TransactionView.to_organization_id == organization_id,
                TransactionView.status.in_(
                    [status.value for status in visible_statuses_transferee])
            )

            # TODO: Additional visibility checks needed for other transaction types.
            # For transactions that are not of type "Transfer", include them without visibility filtering
            non_transfer_condition = and_(
                TransactionView.transaction_type != 'Transfer',
                TransactionView.to_organization_id == organization_id
            )

            # Combine conditions since an organization can be both transferor and transferee, or neither for non-"Transfer" transactions
            combined_role_condition = or_(
                transferor_condition, transferee_condition, non_transfer_condition)
            query_conditions.append(combined_role_condition)
        else:
            # Fetch visible statuses for government, but only for "Transfer" transactions
            visible_statuses_government = await self.get_visible_statuses(EntityType.Government)
            government_condition = and_(
                transfer_type_condition,
                TransactionView.status.in_(
                    [status.value for status in visible_statuses_government])
            )

            # TODO: Additional visibility checks needed for other transaction types.
            # Include non-"Transfer" transactions for government without applying visibility filtering
            gov_non_transfer_condition = TransactionView.transaction_type != 'Transfer'

            combined_government_condition = or_(
                government_condition, gov_non_transfer_condition)
            query_conditions.append(combined_government_condition)

        # Add additional conditions
        if conditions:
            query_conditions.extend(conditions)

        query = select(TransactionView).where(and_(*query_conditions))

        # Apply sorting
        for order in sort_orders:
            direction = asc if order.direction == 'asc' else desc
            query = query.order_by(
                direction(getattr(TransactionView, order.field)))

        # Execute count query for total records matching the filter
        count_query = select(func.count()).select_from(query.subquery())
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar_one()

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute the query
        result = await self.db.execute(query)
        transactions = result.scalars().all()

        return transactions, total_count

    @repo_handler
    async def get_transaction_statuses(self) -> List[TransactionStatusView]:
        """
        Get all available statuses for transactions from the database.

        Returns:
            List[TransactionStatusView]: A list of TransactionStatusView objects containing the basic transaction status details.
        """
        query = select(TransactionStatusView).order_by(
            asc(TransactionStatusView.status)).distinct()
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
                func.sum(case(
                    (Transaction.transaction_action ==
                     TransactionActionEnum.Adjustment, Transaction.compliance_units),
                    else_=0
                )).label('total_balance')
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
                func.sum(case(
                    (Transaction.transaction_action ==
                     TransactionActionEnum.Reserved, Transaction.compliance_units),
                    else_=0
                )).label('reserved_balance')
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
                (func.sum(case(
                    (Transaction.transaction_action ==
                     TransactionActionEnum.Adjustment, Transaction.compliance_units),
                    else_=0
                )) - func.sum(case(
                    (Transaction.transaction_action ==
                     TransactionActionEnum.Reserved, Transaction.compliance_units),
                    else_=0
                ))).label('available_balance')
            ).where(Transaction.organization_id == organization_id)
        )
        return available_balance or 0

    @repo_handler
    async def create_transaction(
        self,
        transaction_action: TransactionActionEnum,
        compliance_units: int,
        organization_id: int
    ):
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
            organization_id=organization_id
        )
        self.db.add(new_transaction)
        await self.db.flush()
        await self.db.refresh(new_transaction, ['organization'])
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
            .values(transaction_action=TransactionActionEnum.Adjustment)
        )

        # Commit the update to make it permanent
        await self.db.commit()

        # Check if the update statement affected any rows
        if result.rowcount > 0:
            # Retrieve the updated transaction instance
            query = select(Transaction).where(
                Transaction.transaction_id == transaction_id)
            updated_transaction = await self.db.scalar(query)

            # If the transaction is found, refresh it and return True
            if updated_transaction:
                await self.db.refresh(updated_transaction)
                # await self.db.refresh(updated_transaction.organization)
                return True
        # If no rows were affected or transaction could not be retrieved, return False
        return False

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
