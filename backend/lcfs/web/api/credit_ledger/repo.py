from datetime import date
from typing import Optional, List

import structlog
from fastapi import Depends
from sqlalchemy import (
    func,
    select,
    and_,
    or_,
    cast,
    desc,
    distinct,
    Date,
    Integer,
    String,
)
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary

log = structlog.get_logger(__name__)

# A compliance report only carries an assessed balance once it reaches one of
# these statuses. "Reassessed" is a legacy (TFRS) status that still exists in
# compliance_report_status, so match the materialized views and accept both.
_ASSESSED_STATUSES = ("Assessed", "Reassessed")

# The date a transaction lands on, matching the fallback order the service uses
# for display. Each column is cast to a plain date first: the aggregate view
# emits a mix of date, naive and tz-aware timestamps, which Postgres refuses to
# coalesce together.
_EFFECTIVE_DATE_SQL = func.coalesce(
    cast(TransactionView.transaction_effective_date, Date),
    cast(TransactionView.recorded_date, Date),
    cast(TransactionView.approved_date, Date),
    cast(TransactionView.create_date, Date),
)


class CreditLedgerRepository:

    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
    ):
        self.db = db

    @repo_handler
    async def get_rows_paginated(
        self,
        *,
        offset: int,
        limit: Optional[int],
        conditions: List[any],
        sort_orders: List[any],
    ) -> tuple[List[tuple], int]:
        stmt = (
            select(
                CreditLedgerView,
                ComplianceReport.version.label("compliance_report_version"),
                func.count().over().label("_wf_total"),
            )
            .outerjoin(
                ComplianceReport,
                and_(
                    CreditLedgerView.transaction_id
                    == ComplianceReport.compliance_report_id,
                    CreditLedgerView.transaction_type == "ComplianceReport",
                ),
            )
            .where(and_(*conditions))
            .order_by(CreditLedgerView.update_date.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        all_rows = result.all()
        total = all_rows[0]._wf_total if all_rows else 0
        # Strip _wf_total so callers can still unpack as (ledger_view, version)
        rows = [(row[0], row[1]) for row in all_rows]
        return rows, total

    @repo_handler
    async def get_distinct_years(
        self,
        *,
        organization_id: int,
    ) -> List[str]:
        """
        Get distinct compliance years that have data for the organization.
        Returns years sorted in descending order.
        """
        stmt = (
            select(distinct(CreditLedgerView.compliance_period))
            .where(CreditLedgerView.organization_id == organization_id)
            .where(CreditLedgerView.compliance_period.isnot(None))
            .order_by(desc(CreditLedgerView.compliance_period))
        )

        result = await self.db.execute(stmt)
        years = result.scalars().all()
        return [str(year) for year in years if year]

    @repo_handler
    async def get_first_assessed_year(
        self,
        *,
        organization_id: int,
    ) -> Optional[int]:
        """
        Earliest compliance year in which this organization has an assessed
        report. That year's ledger envelope is widened to open on January 1
        (#4832), since no earlier envelope exists to hold January–March.

        ``None`` when the organization has no assessed report at all.
        """
        stmt = (
            select(func.min(cast(CompliancePeriod.description, Integer)))
            .select_from(ComplianceReport)
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == ComplianceReport.compliance_period_id,
            )
            .join(
                ComplianceReportStatus,
                ComplianceReportStatus.compliance_report_status_id
                == ComplianceReport.current_status_id,
            )
            .where(
                ComplianceReport.organization_id == organization_id,
                cast(ComplianceReportStatus.status, String).in_(_ASSESSED_STATUSES),
                CompliancePeriod.description.op("~")("^[0-9]{4}$"),
            )
        )
        first_year = await self.db.scalar(stmt)
        return None if first_year is None else int(first_year)

    @repo_handler
    async def get_period_rows(
        self,
        *,
        organization_id: int,
        compliance_period: int,
        envelope_start: date,
        envelope_end: date,
    ) -> List[tuple]:
        """
        Fetch every transaction-aggregate row involving this organization within
        one compliance-year envelope, regardless of status. Status filtering,
        signed-unit derivation, running balance and totals are handled in the
        service so completed/pending selection stays a pure application concern.

        Two different rules decide what belongs to a compliance year (#4832):

        * Compliance reports stay with the year they report on, whatever date
          they were assessed — a 2024 report assessed in 2026 is 2024 ledger.
        * Every other transaction falls into the April 1 – March 31 envelope
          that contains its effective date. This also picks up pending
          transfers, which carry no compliance period until they are recorded.

        Returns rows as ``(TransactionView, compliance_report_version)`` tuples.
        """
        stmt = (
            select(
                TransactionView,
                ComplianceReport.version.label("compliance_report_version"),
            )
            .outerjoin(
                ComplianceReport,
                and_(
                    TransactionView.transaction_id
                    == ComplianceReport.compliance_report_id,
                    TransactionView.transaction_type == "ComplianceReport",
                ),
            )
            .where(
                or_(
                    and_(
                        TransactionView.transaction_type == "ComplianceReport",
                        TransactionView.compliance_period == str(compliance_period),
                    ),
                    and_(
                        TransactionView.transaction_type != "ComplianceReport",
                        _EFFECTIVE_DATE_SQL.between(envelope_start, envelope_end),
                    ),
                ),
                or_(
                    TransactionView.from_organization_id == organization_id,
                    TransactionView.to_organization_id == organization_id,
                ),
            )
        )
        result = await self.db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    @repo_handler
    async def get_assessed_line_22(
        self,
        *,
        organization_id: int,
        compliance_period: int,
    ) -> Optional[int]:
        """
        Line 22 (available compliance unit balance at period end) from the most
        recent assessed report for this organization and compliance year (#4831).

        "Most recent" is the highest version in the report chain — a supplemental
        supersedes the original regardless of when either was assessed. Returns
        ``None`` when the year has no assessed report, so the ledger can leave
        the balance blank instead of showing a misleading zero.
        """
        stmt = (
            select(ComplianceReportSummary.line_22_compliance_units_issued)
            .join(
                ComplianceReport,
                ComplianceReport.compliance_report_id
                == ComplianceReportSummary.compliance_report_id,
            )
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == ComplianceReport.compliance_period_id,
            )
            .join(
                ComplianceReportStatus,
                ComplianceReportStatus.compliance_report_status_id
                == ComplianceReport.current_status_id,
            )
            .where(
                ComplianceReport.organization_id == organization_id,
                CompliancePeriod.description == str(compliance_period),
                # Compared as text: "Reassessed" exists in the database but not
                # in ComplianceReportStatusEnum, so binding it as an enum value
                # would raise before the query ever ran.
                cast(ComplianceReportStatus.status, String).in_(_ASSESSED_STATUSES),
            )
            .order_by(desc(ComplianceReport.version))
            .limit(1)
        )
        line_22 = await self.db.scalar(stmt)
        return None if line_22 is None else int(line_22)
