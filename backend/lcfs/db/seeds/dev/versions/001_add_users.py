"""adding dev users

Revision ID: 001
Revises: 
Create Date: 2023-11-21 15:12:04.731880

"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Insert users
    op.execute("""
    INSERT INTO user_profile (keycloak_email, keycloak_username, email, username, display_name, title, phone, mobile_phone, organization_id)
    VALUES ('alex@thecruxstudios.com', 'ALZORKIN', 'alex@thecruxstudios.com', 'azorkin', 'Alex Zorkin', 'Developer', '1234567890', '1234567890', 1);
    """)

def downgrade():
    op.execute("DELETE FROM user_profile WHERE keycloak_username = 'ALZORKIN';")
