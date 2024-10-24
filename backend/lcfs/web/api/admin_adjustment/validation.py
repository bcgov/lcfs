from fastapi import Depends, HTTPException, Request
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.role.schema import user_has_roles
from starlette import status

from lcfs.web.api.admin_adjustment.schema import (
    AdminAdjustmentCreateSchema,
    AdminAdjustmentSchema,
)
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatusEnum,
)


class AdminAdjustmentValidation:
    def __init__(
        self,
        request: Request = None,
        service: AdminAdjustmentServices = Depends(AdminAdjustmentServices),
    ) -> None:
        self.request = request
        self.service = service

    async def validate_admin_adjustment_create(
        self, request, adjustment_data: AdminAdjustmentCreateSchema
    ):
        pass

    async def validate_admin_adjustment_update(
        self, request, adjustment_data: AdminAdjustmentSchema
    ):
        # Retrieve the current admin adjustment data from the database
        admin_adjustment = await self.service.get_admin_adjustment(
            adjustment_data.admin_adjustment_id
        )

        if (
            admin_adjustment.current_status.status
            == AdminAdjustmentStatusEnum.Approved.name
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Editing a processed admin adjustment is not allowed.",
            )

    async def validate_organization_access(self, admin_adjustment_id: int):
        admin_adjustment = await self.service.get_admin_adjustment(admin_adjustment_id)
        if not admin_adjustment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found.",
            )

        organization_id = admin_adjustment.to_organization.organization_id
        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )

        if (
            not user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and organization_id != user_organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this transaction.",
            )
