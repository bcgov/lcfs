from logging import getLogger
from fastapi import Depends
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.dashboard.repo import DashboardRepository
from lcfs.web.api.dashboard.schema import DirectorReviewCountsSchema

logger = getLogger("dashboard_services")

class DashboardServices:
    def __init__(self, repo: DashboardRepository = Depends(DashboardRepository)):
        self.repo = repo

    @service_handler
    async def get_director_review_counts(self) -> DirectorReviewCountsSchema:
        counts = await self.repo.get_director_review_counts()
        
        return DirectorReviewCountsSchema(
            transfers=counts.get('transfers', 0),
            compliance_reports=counts.get('compliance_reports', 0),
            initiative_agreements=counts.get('initiative_agreements', 0),
            admin_adjustments=counts.get('admin_adjustments', 0)
        )