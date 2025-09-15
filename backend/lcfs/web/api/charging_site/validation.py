from fastapi import Depends, HTTPException
from lcfs.web.api.charging_site.repo import ChargingSiteRepository


class ChargingSiteValidation:
    def __init__(self, repo: ChargingSiteRepository = Depends()):
        self.repo = repo

    async def validate_organization_access(self, charging_site_id: int):
        """
        Validates that the charging site exists.
        """
        charging_site = await self.repo.get_charging_site_by_id(charging_site_id)

        if not charging_site:
            raise HTTPException(
                status_code=404,
                detail=f"Charging site with ID {charging_site_id} not found",
            )

        return charging_site
