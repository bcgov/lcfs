"""Rename m3 to m cubed

Revision ID: 3c07f891435d
Revises: 1974af823b80
Create Date: 2024-11-22 18:20:01.487012

"""

from alembic import op
from sqlalchemy.orm import Session

from lcfs.db.models import UnitOfMeasure, OtherUses

# revision identifiers, used by Alembic.
revision = "3c07f891435d"
down_revision = "1974af823b80"
branch_labels = None
depends_on = None


def upgrade():
    # Use a session to interact with the database
    bind = op.get_bind()
    session = Session(bind=bind)

    # Query and update the entity
    uom = session.query(UnitOfMeasure).filter_by(name="MJ/m3").one_or_none()
    if uom:
        uom.name = "MJ/m³"
        session.add(uom)

    uom = session.query(UnitOfMeasure).filter_by(name="gCO2e/MJ").one_or_none()
    if uom:
        uom.name = "gCO²e/MJ"
        session.add(uom)

    session.query(OtherUses).filter_by(units="m3").update({"units": "m³"})

    session.commit()


def downgrade():
    # Use a session to reverse the change
    bind = op.get_bind()
    session = Session(bind=bind)

    # Query and update the entity
    uom = session.query(UnitOfMeasure).filter_by(name="MJ/m³").one_or_none()
    if uom:
        uom.name = "MJ/m3"
        session.add(uom)

    uom = session.query(UnitOfMeasure).filter_by(name="gCO²e/MJ").one_or_none()
    if uom:
        uom.name = "gCO2e/MJ"
        session.add(uom)

    session.query(OtherUses).filter_by(units="m³").update({"units": "m3"})

    session.commit()
