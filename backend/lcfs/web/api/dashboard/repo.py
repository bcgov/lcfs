from logging import getLogger
from fastapi import Depends
from sqlalchemy import select, func, union_all, join, literal
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus, ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import InitiativeAgreementStatus, InitiativeAgreementStatusEnum
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import AdminAdjustmentStatus, AdminAdjustmentStatusEnum
from lcfs.web.core.decorators import repo_handler

logger = getLogger("dashboard_repo")

class DashboardRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_director_review_counts(self):
        query = union_all(
            select(func.count().label('count'), literal('transfers').label('type'))
            .select_from(join(Transfer, TransferStatus, Transfer.current_status_id == TransferStatus.transfer_status_id))
            .where(TransferStatus.status == TransferStatusEnum.Recommended),

            select(func.count().label('count'), literal('compliance_reports').label('type'))
            .select_from(join(ComplianceReport, ComplianceReportStatus, ComplianceReport.status_id == ComplianceReportStatus.compliance_report_status_id))
            .where(ComplianceReportStatus.status == ComplianceReportStatusEnum.Recommended_by_manager),

            select(func.count().label('count'), literal('initiative_agreements').label('type'))
            .select_from(join(InitiativeAgreement, InitiativeAgreementStatus, InitiativeAgreement.current_status_id == InitiativeAgreementStatus.initiative_agreement_status_id))
            .where(InitiativeAgreementStatus.status == InitiativeAgreementStatusEnum.Recommended),

            select(func.count().label('count'), literal('admin_adjustments').label('type'))
            .select_from(join(AdminAdjustment, AdminAdjustmentStatus, AdminAdjustment.current_status_id == AdminAdjustmentStatus.admin_adjustment_status_id))
            .where(AdminAdjustmentStatus.status == AdminAdjustmentStatusEnum.Recommended)
        ).alias('counts')

        result = await self.db.execute(select(query.c.type, query.c.count))
        return dict(result.fetchall())