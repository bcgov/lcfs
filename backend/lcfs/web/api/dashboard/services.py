import structlog
from fastapi import Depends
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.dashboard.repo import DashboardRepository
from lcfs.web.api.dashboard.schema import (
    DirectorReviewCountsSchema,
    TransactionCountsSchema,
    OrganizarionTransactionCountsSchema,
    OrgComplianceReportCountsSchema,
    ComplianceReportCountsSchema,
    FuelCodeCountsSchema,
)

logger = structlog.get_logger(__name__)


class DashboardServices:
    def __init__(self, repo: DashboardRepository = Depends(DashboardRepository)):
        self.repo = repo

    @service_handler
    async def get_director_review_counts(self) -> DirectorReviewCountsSchema:
        counts = await self.repo.get_director_review_counts()

        return DirectorReviewCountsSchema(
            transfers=counts.get("transfers", 0),
            compliance_reports=counts.get("compliance_reports", 0),
            initiative_agreements=counts.get("initiative_agreements", 0),
            admin_adjustments=counts.get("admin_adjustments", 0),
            fuel_codes=counts.get("fuel_codes", 0),
        )

    @service_handler
    async def get_transaction_counts(self) -> TransactionCountsSchema:
        counts = await self.repo.get_transaction_counts()

        return TransactionCountsSchema(
            transfers=counts.get("transfers", 0),
            initiative_agreements=counts.get("initiative_agreements", 0),
            admin_adjustments=counts.get("admin_adjustments", 0),
        )

    @service_handler
    async def get_org_transaction_counts(
        self, organization_id
    ) -> OrganizarionTransactionCountsSchema:
        counts = await self.repo.get_org_transaction_counts(organization_id)

        return OrganizarionTransactionCountsSchema(transfers=counts.get("transfers", 0))

    @service_handler
    async def get_org_compliance_report_counts(
        self, organization_id: int
    ) -> OrgComplianceReportCountsSchema:
        counts = await self.repo.get_org_compliance_report_counts(organization_id)

        return OrgComplianceReportCountsSchema(
            in_progress=counts.get("in_progress", 0),
            awaiting_gov_review=counts.get("awaiting_gov_review", 0),
        )

    @service_handler
    async def get_compliance_report_counts(self) -> ComplianceReportCountsSchema:
        counts = await self.repo.get_compliance_report_counts()

        return ComplianceReportCountsSchema(
            pending_reviews=counts.get("pending_reviews", 0)
        )

    @service_handler
    async def get_fuel_code_counts(self) -> FuelCodeCountsSchema:
        counts = await self.repo.get_fuel_code_counts()

        return FuelCodeCountsSchema(draft_fuel_codes=counts.get("draft_fuel_codes", 0))
