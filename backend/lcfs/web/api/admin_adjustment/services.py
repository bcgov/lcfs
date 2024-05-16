from datetime import datetime
from fastapi import Depends, Request, HTTPException
from lcfs.db.models.AdminAdjustment import AdminAdjustment
from lcfs.db.models.AdminAdjustmentStatus import AdminAdjustmentStatusEnum
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema, AdminAdjustmentSchema, AdminAdjustmentUpdateSchema
from lcfs.web.api.admin_adjustment.repo import AdminAdjustmentRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.role.schema import user_has_roles
from lcfs.db.models.Transaction import TransactionActionEnum
from lcfs.web.api.organizations.services import OrganizationsService

class AdminAdjustmentServices:
    def __init__(
        self, 
        repo: AdminAdjustmentRepository = Depends(AdminAdjustmentRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        request: Request = None,
    ) -> None:
        self.repo = repo
        self.org_service = org_service
        self.request = request

    @service_handler
    async def get_admin_adjustment(self, admin_adjustment_id: int) -> AdminAdjustmentSchema:
        """Fetch an admin adjustment by its ID."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(admin_adjustment_id)
        return AdminAdjustmentSchema.from_orm(admin_adjustment)

    @service_handler
    async def update_admin_adjustment(
        self, admin_adjustment_data: AdminAdjustmentUpdateSchema
    ) -> AdminAdjustmentSchema:
        """Update an existing admin adjustment."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(admin_adjustment_data.admin_adjustment_id)
        if not admin_adjustment:
            raise DataNotFoundException(f"Admin Adjustment with ID {admin_adjustment_data.admin_adjustment_id} not found.")
        
        new_status = await self.repo.get_admin_adjustment_status_by_name(admin_adjustment_data.current_status)
        # Check if the status has changed
        status_has_changed = admin_adjustment.current_status != new_status
        
        # Update other fields
        for field, value in admin_adjustment_data.dict(exclude_unset=True).items():
            if field != 'current_status':  # Skip the current_status field
                setattr(admin_adjustment, field, value) 

        # Handle the current_status field separately
        if status_has_changed:
            admin_adjustment.current_status = new_status
            # If approving transaction, issue compliance units by Director
            if new_status.status == AdminAdjustmentStatusEnum.Approved:
                await self.director_approve_admin_adjustment(admin_adjustment)

        # Pass updated object to repository for saving
        updated_admin_adjustment = await self.repo.update_admin_adjustment(admin_adjustment)

        if status_has_changed:
            await self.repo.add_admin_adjustment_history(
                admin_adjustment.admin_adjustment_id,
                new_status.admin_adjustment_status_id,
                self.request.user.user_profile_id
            )
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
        
        if current_status.status == AdminAdjustmentStatusEnum.Recommended:
            await self.repo.add_admin_adjustment_history(
                admin_adjustment.admin_adjustment_id,
                current_status.admin_adjustment_status_id,
                self.request.user.user_profile_id
            )

        return AdminAdjustmentSchema.from_orm(admin_adjustment)


    async def director_approve_admin_adjustment(self, admin_adjustment: AdminAdjustment):
        """Create ledger transaction for approved admin adjustment"""

        user = self.request.user
        has_director_role = user_has_roles(user, ["GOVERNMENT", "DIRECTOR"])

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")
        
        if admin_adjustment.transaction != None:
            raise HTTPException(status_code=403, detail="Transaction already exists.")

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=admin_adjustment.compliance_units,
            organization_id=admin_adjustment.to_organization_id,
        )
        admin_adjustment.transaction = to_transaction

        # Set effective date to today if the analyst left it blank
        if admin_adjustment.transaction_effective_date == None:
            admin_adjustment.transaction_effective_date = datetime.now().date().isoformat()

        await self.repo.refresh_admin_adjustment(admin_adjustment)
