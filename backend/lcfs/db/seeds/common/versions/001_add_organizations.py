"""adding organizations

Revision ID: 001
Revises: 
Create Date: 2023-11-21 15:12:04.731880

"""
from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Insert organization
    op.execute("""
    INSERT INTO organization (name)
    VALUES ('BC Government');
    """)

def downgrade():
    
    op.execute("DELETE FROM organization WHERE name = 'BC Government';")
