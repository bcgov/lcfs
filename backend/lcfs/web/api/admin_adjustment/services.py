from fastapi import Depends
from lcfs.db.models.AdminAdjustment import AdminAdjustment
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema, AdminAdjustmentSchema
from lcfs.web.api.admin_adjustment.repo import AdminAdjustmentRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.core.decorators import service_handler

class AdminAdjustmentServices:
    def __init__(self, repo: AdminAdjustmentRepository = Depends(AdminAdjustmentRepository)):
        self.repo = repo

    @service_handler
    async def get_admin_adjustment(self, admin_adjustment_id: int) -> AdminAdjustmentSchema:
        """Fetch an admin adjustment by its ID."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(admin_adjustment_id)
        return AdminAdjustmentSchema.from_orm(admin_adjustment)

    @service_handler
    async def update_admin_adjustment(self, admin_adjustment_data: AdminAdjustmentSchema) -> AdminAdjustmentSchema:
        """Update an existing admin adjustment."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(admin_adjustment_data.admin_adjustment_id)
        if not admin_adjustment:
            raise DataNotFoundException(f"Admin Adjustment with ID {admin_adjustment_data.admin_adjustment_id} not found.")
        
        # Handle status change
        new_status = await self.repo.get_admin_adjustment_status_by_name(admin_adjustment_data.current_status)
        
        # Check if the status has changed
        status_has_changed = admin_adjustment.current_status != new_status
        
        # Update other fields
        for field, value in admin_adjustment_data.dict(exclude_unset=True).items():
            setattr(admin_adjustment, field, value)

        # Update status
        if status_has_changed:
            admin_adjustment.current_status = new_status
            # TODO create history records on future status changes

        # Pass updated object to repository for saving
        updated_admin_adjustment = await self.repo.update_admin_adjustment(admin_adjustment)

        return AdminAdjustmentSchema.from_orm(updated_admin_adjustment)

    @service_handler
    async def create_admin_adjustment(
        self, admin_adjustment_data: AdminAdjustmentCreateSchema
    ) -> AdminAdjustmentSchema:
        """
        Handles creating an admin adjustment, including creating a comment (if provided).
        """
        # Fetch the status for the admin adjustment
        current_status = await self.repo.get_admin_adjustment_status_by_name(
            admin_adjustment_data.current_status
        )

        # Create the admin adjustment
        admin_adjustment = AdminAdjustment(
            **admin_adjustment_data.model_dump(exclude={"current_status"})
        )

        admin_adjustment.current_status = current_status

        # Save the admin adjustment
        admin_adjustment = await self.repo.create_admin_adjustment(admin_adjustment)

        return admin_adjustment