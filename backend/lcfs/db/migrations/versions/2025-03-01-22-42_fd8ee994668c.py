"""Re-calculate Summaries

Revision ID: fd8ee994668c
Revises: 4a34a52085f2
Create Date: 2025-03-01 22:42:23.356954

"""

import asyncio
import threading
from sqlalchemy import create_engine, select, and_, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import Session
from typing import Dict

from lcfs.db.dependencies import db_url
from lcfs.db.models import (
    ComplianceReport,
    CompliancePeriod,
    FuelSupply,
    TargetCarbonIntensity,
    FuelExport,
    ComplianceReportSummary,
)
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.utils.calculations import calculate_compliance_units

# revision identifiers, used by Alembic.
revision = "fd8ee994668c"
down_revision = "4a34a52085f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    engine = create_engine(db_url, future=True)
    with Session(engine) as session:
        intensities = (
            session.execute(
                select(TargetCarbonIntensity).filter_by(compliance_period_id=15)
            )
            .scalars()
            .all()
        )
        intensity_map: Dict[int, float] = {
            intensity.fuel_category_id: intensity.target_carbon_intensity
            for intensity in intensities
        }

        compliance_report_ids = (
            session.execute(
                select(ComplianceReport.compliance_report_id)
                .join(CompliancePeriod)
                .where(CompliancePeriod.description == "2024")
            )
            .scalars()
            .all()
        )

        fuel_supplies = (
            session.execute(
                select(FuelSupply).where(
                    FuelSupply.compliance_report_id.in_(compliance_report_ids)
                )
            )
            .scalars()
            .all()
        )

        fuel_exports = (
            session.execute(
                select(FuelExport).where(
                    FuelExport.compliance_report_id.in_(compliance_report_ids)
                )
            )
            .scalars()
            .all()
        )

        for supply in fuel_supplies:
            supply.target_ci = intensity_map.get(supply.fuel_category_id, 0)
            supply.compliance_units = calculate_compliance_units(
                TCI=supply.target_ci or 0,
                EER=supply.eer or 1,
                RCI=supply.ci_of_fuel or 0,
                UCI=supply.uci or 0,
                Q=supply.quantity or 0,
                ED=supply.energy_density or 0,
            )

        for export in fuel_exports:
            export.target_ci = intensity_map.get(export.fuel_category_id, 0)
            export.compliance_units = calculate_compliance_units(
                TCI=export.target_ci or 0,
                EER=export.eer or 1,
                RCI=export.ci_of_fuel or 0,
                UCI=0,  # Always 0 for export
                Q=export.quantity or 0,
                ED=export.energy_density or 0,
            )

        session.commit()

    new_loop = asyncio.new_event_loop()
    t = threading.Thread(target=_start_loop, args=(new_loop,), daemon=True)
    t.start()

    future = asyncio.run_coroutine_threadsafe(_update_summaries(), new_loop)
    result = future.result()
    print(result)


def downgrade() -> None:
    # This is a one way ticket
    pass


async def _update_summaries() -> bool:
    engine = create_async_engine(db_url, future=True)
    async with AsyncSession(engine) as session:
        async with session.begin():
            fs_repo = FuelSupplyRepository(session)
            fc_repo = FuelCodeRepository(session)
            cr_repo = ComplianceReportRepository(session, fs_repo)
            fe_repo = FuelExportRepository(session)
            trxn_repo = TransactionRepository(session)
            nt_repo = NotionalTransferRepository(session, fc_repo)
            nt_services = NotionalTransferServices(nt_repo, fc_repo, cr_repo)
            allocation_agreement_repo = AllocationAgreementRepository(session, fc_repo)
            other_uses_repo = OtherUsesRepository(session, fc_repo)
            summary_service = ComplianceReportSummaryService(
                repo=cr_repo,
                trxn_repo=trxn_repo,
                fuel_supply_repo=fs_repo,
                notional_transfer_service=nt_services,
                fuel_export_repo=fe_repo,
                allocation_agreement_repo=allocation_agreement_repo,
                other_uses_repo=other_uses_repo,
            )

            # Load 2024 Reports
            ids_to_update = await session.execute(
                select(ComplianceReport.compliance_report_id).where(
                    and_(
                        CompliancePeriod.description == "2024",
                        ComplianceReport.compliance_period_id
                        == CompliancePeriod.compliance_period_id,
                    )
                )
            )

            for compliance_report_id in ids_to_update.scalars():
                summary = await cr_repo.get_summary_by_report_id(compliance_report_id)

                # Unlock
                was_locked = summary.is_locked
                if summary.is_locked:
                    await session.execute(
                        (
                            update(ComplianceReportSummary)
                            .where(
                                ComplianceReportSummary.compliance_report_id
                                == compliance_report_id
                            )
                            .values(is_locked=False)
                        )
                    )
                    await session.flush()

                await summary_service.calculate_compliance_report_summary(
                    compliance_report_id
                )

                # Re-lock
                if was_locked:
                    await session.execute(
                        (
                            update(ComplianceReportSummary)
                            .where(
                                ComplianceReportSummary.compliance_report_id
                                == compliance_report_id
                            )
                            .values(is_locked=True)
                        )
                    )
                    await session.flush()
            await session.commit()
            await session.close()
            await engine.dispose()
            return True


def _start_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()
