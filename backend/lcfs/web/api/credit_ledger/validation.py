from fastapi import HTTPException, Request
from starlette import status


class CreditLedgerValidation:
    def __init__(self, request: Request):
        self.request = request

    async def validate_organization_access(self, organization_id: int):
        """
        Allow if organization_id matches user's org.
        """
        user = self.request.user
        user_org = getattr(user.organization, "organization_id", None)

        if organization_id != user_org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this organization's credit ledger.",
            )
