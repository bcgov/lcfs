"""Add fields for Low Carbon fuel requirement summary

Revision ID: 0d59d56ca310
Revises: e50534b604f2
Create Date: 2025-02-10 13:13:50.046160

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0d59d56ca310"
down_revision = "775db18a959a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('compliance_report_summary',
        sa.Column('line_23_total_credits_from_fuel_supplied', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Total credits from fuel supplied (from Schedule B)',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_24_total_debits_from_fuel_supplied', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Total debits from fuel exported (from Schedule B)',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_25_total_credit_debit_balance', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Net credit or debit balance for compliance period',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_26_total_banked_credits', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Total banked credits to offset outstanding debits',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_26a_banked_credits_used_prev_reports', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Banked credits used - Previous Reports',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_26b_banked_credits_used_supplemental_report', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Banked credits used - Supplemental Report #2',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_26c_banked_credits_spent', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Banked credits spent that will be returned',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_27_outstanding_debit_balance', 
                  sa.Integer(), 
                  nullable=False,
                  comment='Outstanding debit balance',
                  server_default='0'))
                  
    op.add_column('compliance_report_summary',
        sa.Column('line_28_non_compliance_penalty_payable', 
                  sa.Float(), 
                  nullable=False,
                  comment='Part 3 non-compliance penalty payable',
                  server_default='0'))

def downgrade() -> None:
    op.drop_column('compliance_report_summary', 'line_28_non_compliance_penalty_payable')
    op.drop_column('compliance_report_summary', 'line_27_outstanding_debit_balance')
    op.drop_column('compliance_report_summary', 'line_26c_banked_credits_spent')
    op.drop_column('compliance_report_summary', 'line_26b_banked_credits_used_supplemental_report')
    op.drop_column('compliance_report_summary', 'line_26a_banked_credits_used_prev_reports')
    op.drop_column('compliance_report_summary', 'line_26_total_banked_credits')
    op.drop_column('compliance_report_summary', 'line_25_total_credit_debit_balance')
    op.drop_column('compliance_report_summary', 'line_24_total_debits_from_fuel_supplied')
    op.drop_column('compliance_report_summary', 'line_23_total_credits_from_fuel_supplied')
    # ### end Alembic commands ###
