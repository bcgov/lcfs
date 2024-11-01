"""Volumes (gasoline, diesel, jet fuel) need to be integer in ComplianceReportSummary

Revision ID: 56b6ddf45a24
Revises: bf26425d2a14
Create Date: 2024-11-01 16:43:29.321718

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "56b6ddf45a24"
down_revision = "bf26425d2a14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_10_net_renewable_fuel_supplied_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_9_obligation_added_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_8_obligation_deferred_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_7_previously_retained_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_6_renewable_fuel_retained_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_5_net_notionally_transferred_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_4_eligible_renewable_fuel_required_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_3_total_tracked_fuel_supplied_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_2_eligible_renewable_fuel_supplied_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_jet_fuel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_diesel",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_1_fossil_derived_base_fuel_gasoline",
        existing_type=sa.Integer(),
        type_=sa.DOUBLE_PRECISION(precision=53),
        existing_nullable=False,
    )
    # ### end Alembic commands ###

