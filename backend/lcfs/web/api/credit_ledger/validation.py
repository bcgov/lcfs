from fastapi import HTTPException, Request
from starlette import status
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.role.schema import user_has_roles


class CreditLedgerValidation:
    def __init__(self, request: Request):
        self.request = request

    async def validate_organization_access(self, organization_id: int):
        """
        Allow if organization_id matches user's org (for suppliers) or if user is government (for IDIR users).
        """
        user = self.request.user
        
        # Allow government users to access any organization's credit ledger
        if user_has_roles(user, [RoleEnum.GOVERNMENT]):
            return
        
        # For suppliers, restrict to their own organization
        user_org = getattr(user.organization, "organization_id", None)
        if organization_id != user_org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this organization's credit ledger.",
            )
