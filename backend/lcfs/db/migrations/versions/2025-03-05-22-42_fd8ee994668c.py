"""Update Target CI in Schedules to 5 Decimal

Revision ID: fd8ee994668c
Revises: 937c793bf7b8
Create Date: 2025-03-05 22:42:23.356954

"""

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from typing import Dict

from lcfs.db.dependencies import db_url
from lcfs.db.models import (
    ComplianceReport,
    CompliancePeriod,
    FuelSupply,
    TargetCarbonIntensity,
    FuelExport,
)
from lcfs.web.utils.calculations import calculate_compliance_units

# revision identifiers, used by Alembic.
revision = "fd8ee994668c"
down_revision = "937c793bf7b8"
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


def downgrade() -> None:
    # This is a one way ticket
    pass
