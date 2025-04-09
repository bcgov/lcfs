import structlog
from fastapi import Depends, Request
from typing import List
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.fuel_type.repo import FuelTypeRepository

logger = structlog.get_logger(__name__)


class FuelTypeServices:
    def __init__(
        self,
        request: Request = None,
        repo: FuelTypeRepository = Depends(),
    ) -> None:
        self.request = request
        self.repo = repo

    @service_handler
    async def get_fuel_type_others(self) -> List[str]:
        """Get fuel type others"""
        return await self.repo.get_fuel_type_others()
