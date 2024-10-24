from fastapi import Depends, Request
from lcfs.web.api.fuel_export.repo import FuelExportRepository


class FuelExportValidation:
    def __init__(
        self,
        request: Request = None,
        fs_repo: FuelExportRepository = Depends(FuelExportRepository),
    ):
        self.fse_repo = fs_repo
        self.request = request
