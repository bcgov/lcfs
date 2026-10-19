"""
Authorization / access validation for CI application endpoints.

Suppliers can only see and mutate CI applications belonging to their own
organization. Government users can read every application that has been
submitted; a Draft stays the applicant's (#5231).
"""

from fastapi import Depends, HTTPException, Request, status

from lcfs.db.models.ci_application import CIApplication
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.ci_application.repo import CIApplicationRepository
from lcfs.web.api.ci_application.schema import CIApplicationStatusEnum
from lcfs.web.api.role.schema import user_has_roles


class CIApplicationValidation:
    def __init__(
        self,
        request: Request = None,
        repo: CIApplicationRepository = Depends(CIApplicationRepository),
    ) -> None:
        self.request = request
        self.repo = repo

    async def validate_access(self, ci_application_id: int) -> CIApplication:
        ci_application = await self.repo.get_by_id(ci_application_id)
        if not ci_application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CI application not found.",
            )

        is_government = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
        if is_government:
            # A Draft is the applicant's until it is submitted. Government
            # lists leave drafts out; a direct link must not reach one
            # either (#5231).
            status_value = (
                ci_application.ci_application_status.status
                if ci_application.ci_application_status
                else None
            )
            if status_value == CIApplicationStatusEnum.Draft.value:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="CI application not found.",
                )
            return ci_application

        user_org_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )
        if ci_application.organization_id != user_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this CI application.",
            )
        return ci_application

    def require_supplier_organization(self) -> int:
        """Returns the organization_id of the supplier user making the call."""
        org = self.request.user.organization
        if not org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organization users can create or edit CI applications.",
            )
        return org.organization_id
