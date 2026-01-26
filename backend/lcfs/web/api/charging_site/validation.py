from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from fastapi import Depends, HTTPException, Request
from lcfs.web.api.charging_site.schema import ChargingSiteCreateSchema
from lcfs.web.api.role.schema import user_has_roles
from starlette import status


class ChargingSiteValidation:
    def __init__(
        self,
        request: Request,
        cs_repo: ChargingSiteRepository = Depends(ChargingSiteRepository),
    ):
        self.request = request
        self.cs_repo = cs_repo

    async def get_charging_site(self, organization_id: int, charging_site_id: int):
        """
        Validates if the user has access to the charging site.
        """
        if (
            self.request.user.organization
            and self.request.user.organization.organization_id != organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )

    async def charging_site_create_access(
        self, organization_id: int, data: ChargingSiteCreateSchema
    ):
        """
        Validates if the user has access to create the charging site.
        """
        if self.request.user.organization.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )
        site_name = (data.site_name or "").strip()
        if not site_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Charging site name cannot be blank.",
            )

        if await self.cs_repo.charging_site_name_exists(site_name, organization_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A charging site with this name already exists for your organization. Please use a unique site name.",
            )
        if organization_id != data.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization ID in URL and request body do not match",
            )

        return True

    async def charging_site_delete_update_access(
        self,
        charging_site_id: int,
        organization_id: int,
        data: ChargingSiteCreateSchema = None,
        delete: bool = False,
    ):
        """
        Validates if the user has access to update/delete the charging site.
        """
        charging_site = await self.cs_repo.get_charging_site_by_id(charging_site_id)
        if charging_site is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Charging site not found.",
            )
        if (
            self.request.user.organization.organization_id
            != charging_site.organization_id
            and charging_site.organization_id == organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )
        if delete and charging_site.status.status not in ["Draft", "Submitted"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only charging sites with 'Draft' or 'Submitted' status can be deleted.",
            )
        # Validate duplicate site name on update
        if data and data.site_name:
            new_site_name = data.site_name.strip()
            existing_site_name = charging_site.site_name.strip()

            # Only check if the name is actually being changed
            if new_site_name.lower() != existing_site_name.lower():
                if await self.cs_repo.charging_site_name_exists(
                    new_site_name, organization_id, exclude_site_id=charging_site_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A charging site with this name already exists for your organization. Please use a unique site name.",
                    )

        return True

    async def validate_organization_access(self, charging_site_id: int):
        """
        Validates that the charging site exists and the user has access to it.
        """
        charging_site = await self.cs_repo.get_charging_site_by_id(charging_site_id)

        if not charging_site:
            raise HTTPException(
                status_code=404,
                detail=f"Charging site with ID {charging_site_id} not found",
            )
        organization_id = charging_site.organization_id
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
                detail="User does not have access to this site.",
            )

        return charging_site
