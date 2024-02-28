# transactions/repo.py

from typing import List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select
from fastapi import Depends

from sqlalchemy import select, func, desc, asc, and_, case

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.TransactionView import TransactionView
from lcfs.db.models.TransactionStatusView import TransactionStatusView


class TransactionRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_transactions_paginated(self, offset: int, limit: int, conditions: list, sort_orders: list):
        """
        Fetch paginated, filtered, and sorted transactions.
        
        Args:
            offset (int): Pagination offset.
            limit (int): Pagination limit.
            conditions (list): Filtering conditions.
            sort_orders (list): Sorting orders.
        
        Returns:
            A tuple of (list of TransactionView instances, total count).
        """

        # Construct the base query
        query = select(TransactionView).where(and_(*conditions))

        # Apply sorting
        for order in sort_orders:
            direction = asc if order.direction == 'asc' else desc
            query = query.order_by(direction(getattr(TransactionView, order.field)))

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
        query = select(TransactionStatusView).order_by(asc(TransactionStatusView.status)).distinct()
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
                    (Transaction.transaction_action == TransactionActionEnum.Adjustment, Transaction.compliance_units),
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
                (func.sum(case(
                    (Transaction.transaction_action == TransactionActionEnum.Reserved, Transaction.compliance_units),
                    else_=0
                )) - func.sum(case(
                    (Transaction.transaction_action == TransactionActionEnum.Released, Transaction.compliance_units),
                    else_=0
                ))).label('reserved_balance')
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
        available_balance_query = select(
            (func.sum(case(
                (Transaction.transaction_action == TransactionActionEnum.Adjustment, Transaction.compliance_units),
                else_=0
            )) - (
                func.sum(case(
                    (Transaction.transaction_action == TransactionActionEnum.Reserved, Transaction.compliance_units),
                    else_=0
                )) - func.sum(case(
                    (Transaction.transaction_action == TransactionActionEnum.Released, Transaction.compliance_units),
                    else_=0
                ))
            )).label('available_balance')
        ).where(Transaction.organization_id == organization_id)

        available_balance = await self.db.scalar(available_balance_query)
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
            transaction_action = transaction_action,
            compliance_units = compliance_units,
            organization_id = organization_id
         )

        self.db.add(new_transaction)
        await self.db.commit()
