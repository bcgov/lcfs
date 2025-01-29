from fastapi import Depends
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.admin_adjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import AdminAdjustmentStatus
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import (
    AdminAdjustmentHistory,
)
from lcfs.web.api.admin_adjustment.schema import CreateAdminAdjustmentHistorySchema

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler


class AdminAdjustmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_admin_adjustment_by_id(
        self, admin_adjustment_id: int
    ) -> Optional[AdminAdjustment]:
        query = (
            select(AdminAdjustment)
            .options(
                selectinload(AdminAdjustment.to_organization),
                selectinload(AdminAdjustment.current_status),
                selectinload(AdminAdjustment.history).selectinload(
                    AdminAdjustmentHistory.user_profile
                ),
                selectinload(AdminAdjustment.history).selectinload(
                    AdminAdjustmentHistory.admin_adjustment_status
                ),
            )
            .where(AdminAdjustment.admin_adjustment_id == admin_adjustment_id)
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def create_admin_adjustment(
        self, admin_adjustment: AdminAdjustment
    ) -> AdminAdjustment:
        self.db.add(admin_adjustment)
        await self.db.flush()
        await self.db.refresh(
            admin_adjustment,
            [
                "to_organization",
                "current_status",
                "history",
            ],
        )  # Ensures that all specified relations are up-to-date
        return admin_adjustment

    @repo_handler
    async def update_admin_adjustment(
        self, admin_adjustment: AdminAdjustment
    ) -> AdminAdjustment:
        merged_admin_adjustment = await self.db.merge(admin_adjustment)
        await self.db.flush()
        return merged_admin_adjustment

    @repo_handler
    async def get_admin_adjustment_status_by_name(
        self, status_name: str
    ) -> AdminAdjustmentStatus:
        """
        Fetches the Admin Adjustment status by its name.
        """
        query = await self.db.execute(
            select(AdminAdjustmentStatus).where(
                AdminAdjustmentStatus.status == status_name
            )
        )
        status = query.scalars().first()

        if not status:
            raise DataNotFoundException(
                f"Admin Adjustment status '{status_name}' not found"
            )

        return status

    @repo_handler
    async def add_admin_adjustment_history(
        self, history: CreateAdminAdjustmentHistorySchema
    ) -> AdminAdjustmentHistory:
        """
        Adds a new record to the admin adjustment history in the database.

        Args:
            admin_adjustment_id (int): The ID of the admin adjustment to which this history record relates.
            admin_adjustment_status_id (int): The status ID that describes the current state of the admin adjustment.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            AdminAdjustmentHistory: The newly created admin adjustment history record.
        """
        new_history_record = AdminAdjustmentHistory(
            admin_adjustment_id=history.admin_adjustment_id,
            admin_adjustment_status_id=history.admin_adjustment_status_id,
            user_profile_id=history.user_profile_id,
            display_name=history.display_name,
        )
        self.db.add(new_history_record)
        await self.db.flush()
        return new_history_record

    @repo_handler
    async def update_admin_adjustment_history(
        self, history: CreateAdminAdjustmentHistorySchema
    ) -> AdminAdjustmentHistory:
        """
        Updates an admin adjustment history record in the database.

        Args:
            admin_adjustment_id (int): The ID of the admin adjustment to which this history record relates.
            admin_adjustment_status_id (int): The status ID that describes the current state of the admin adjustment.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            AdminAdjustmentHistory: The updated admin adjustment history record.
        """
        existing_history = await self.db.scalar(
            select(AdminAdjustmentHistory).where(
                and_(
                    AdminAdjustmentHistory.admin_adjustment_id
                    == history.admin_adjustment_id,
                    AdminAdjustmentHistory.admin_adjustment_status_id
                    == history.admin_adjustment_status_id,
                )
            )
        )
        existing_history.create_date = datetime.now()
        existing_history.update_date = datetime.now()
        existing_history.user_profile_id = history.user_profile_id
        existing_history.display_name = history.display_name
        self.db.add(existing_history)
        await self.db.flush()
        return existing_history

    @repo_handler
    async def refresh_admin_adjustment(
        self, admin_adjustment: AdminAdjustment
    ) -> AdminAdjustment:
        """
        Commits and refreshes an administrative adjustment object in db session

        """
        await self.db.flush()
        await self.db.refresh(admin_adjustment)
        return admin_adjustment
