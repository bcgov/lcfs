from lcfs.web.api.charging_site.repo import ChargingSiteRepo
from fastapi import Depends, HTTPException, Request
from lcfs.web.api.charging_site.schema import ChargingSiteCreateSchema
from starlette import status


class ChargingSiteValidation:
    def __init__(
        self,
        request: Request,
        cs_repo: ChargingSiteRepo = Depends(ChargingSiteRepo),
    ):
        self.request = request
        self.cs_repo = cs_repo

    async def validate_charging_site_create_access(
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
        if (
            await self.cs_repo.get_charging_site_by_site_name(data.site_name)
        ) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate charging site name.",
            )

        return True

    async def validate_charging_site_delete_update_access(
        self, charging_site_id: int, organization_id: int
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

        return True
