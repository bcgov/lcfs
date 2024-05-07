from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema

class AdminAdjustmentValidation:
    def __init__(self, request: Request = None) -> None:
        self.request = request

    async def validate_admin_adjustment(self, request: Request, admin_adjustment_create: AdminAdjustmentCreateSchema):
        # Add any specific validation logic needed for Admin Adjustments here.
        pass
