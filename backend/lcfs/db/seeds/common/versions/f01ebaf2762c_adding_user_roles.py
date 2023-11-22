"""adding user roles

Revision ID: f01ebaf2762c
Revises: 
Create Date: 2023-11-21 15:12:04.731880

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f01ebaf2762c"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Insert roles into the 'role' table
    role_table = sa.table('role',
        sa.column('name', sa.Enum('ADMINISTRATOR',
                                  'ANALYST',
                                  'COMPLIANCE_MANAGER',
                                  'DIRECTOR',
                                  'MANAGE_USERS',
                                  'TRANSFER',
                                  'COMPLIANCE_REPORTING',
                                  'SIGNING_AUTHORITY',
                                  'READ_ONLY',
                                  name='role_enum')),
        sa.column('description', sa.String),
        sa.column('is_government_role', sa.Boolean),
        sa.column('display_order', sa.Integer)
    )

    op.bulk_insert(role_table, [
        {'name': 'ADMINISTRATOR', 'description': 'Can add/edit IDIR users and assign roles, add/edit organizations, BCeID users, and assign roles', 'is_government_role': True, 'display_order': 1},
        {'name': 'ANALYST', 'description': 'Can make recommendations on transfers, transactions, and compliance reports, manage file submissions, and add/edit fuel codes', 'is_government_role': True, 'display_order': 2},
        {'name': 'COMPLIANCE_MANAGER', 'description': 'Can make recommendations on compliance reports', 'is_government_role': True, 'display_order': 3},
        {'name': 'DIRECTOR', 'description': 'Can assess compliance reports and approve transactions', 'is_government_role': True, 'display_order': 4},
        {'name': 'MANAGE_USERS', 'description': 'Can add/edit BCeID users and assign roles', 'is_government_role': False, 'display_order': 5},
        {'name': 'TRANSFER', 'description': 'Can create/save transfers and submit files', 'is_government_role': False, 'display_order': 6},
        {'name': 'COMPLIANCE_REPORTING', 'description': 'Can create/save compliance reports and submit files', 'is_government_role': False, 'display_order': 7},
        {'name': 'SIGNING_AUTHORITY', 'description': 'Can sign and submit compliance reports to government and transfers to trade partners/government', 'is_government_role': False, 'display_order': 8},
        {'name': 'READ_ONLY', 'description': 'Can view transactions, compliance reports, and files', 'is_government_role': False, 'display_order': 9},
    ])

def downgrade():
    op.execute('TRUNCATE TABLE role;')
    pass