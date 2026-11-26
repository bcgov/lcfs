"""
Access checks for LCJFIP applications (#5532).

Applicants reach only their own organization's applications. Government users
can read an application once it is submitted: a Draft is the applicant's, and
reads as missing to them (#5231). Government users never edit.
"""

from fastapi import Depends, HTTPException, Request, status

from lcfs.db.models.lcjfip import LCJFIPApplication, LCJFIPApplicationStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.lcjfip.repo import LCJFIPRepository
from lcfs.web.api.role.schema import is_government_user

# BCeID roles that apply for the program (#5290).
APPLICANT_ROLES = [RoleEnum.LCJFIP_APPLICANT, RoleEnum.LCJFIP_ADMINISTRATOR]
# IDIR roles that see the program area (#5488).
GOVERNMENT_ROLES = [RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR]
READ_ROLES = APPLICANT_ROLES + GOVERNMENT_ROLES

NOT_FOUND = "LCJFIP application not found."


class LCJFIPValidation:
    def __init__(
        self,
        request: Request = None,
        repo: LCJFIPRepository = Depends(LCJFIPRepository),
    ) -> None:
        self.request = request
        self.repo = repo

    def require_organization(self) -> int:
        organization = self.request.user.organization
        if organization is None or is_government_user(self.request.user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only applicant organization users can manage LCJFIP applications.",
            )
        return organization.organization_id

    async def get_application(
        self, application_id: int, write: bool = False
    ) -> LCJFIPApplication:
        application = await self.repo.get_by_id(application_id)
        if application is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)

        if is_government_user(self.request.user):
            if application.status.status == LCJFIPApplicationStatusEnum.Draft.value:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND
                )
            if write:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Government users cannot edit LCJFIP applications.",
                )
            return application

        organization = self.request.user.organization
        if organization is None or (
            application.organization_id != organization.organization_id
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
        return application
