from sqlalchemy.ext.declarative import AbstractConcreteBase
from sqlalchemy import String, Column, Integer, Date, text, TIMESTAMP, func, Boolean, MetaData
from sqlalchemy.orm import declarative_base

# Define naming conventions for all constraints
naming_convention = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",  # Index
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # Unique constraint
    "ck": "ck_%(table_name)s_%(constraint_name)s",  # Check constraint
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # Foreign key
    "pk": "pk_%(table_name)s"  # Primary key
}

# Apply this naming convention to the MetaData object
metadata = MetaData(naming_convention=naming_convention)

Base = declarative_base(metadata=metadata)


class BaseModel(AbstractConcreteBase, Base):
    """Base for all models."""

    __table_args__ = {"schema": "metadata"}

    create_date = Column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        comment="Date and time (UTC) when the physical record was created in the database.",
    )
    update_date = Column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=func.now(),
        comment="Date and time (UTC) when the physical record was updated in the"
        " database. "
        "It will be the same as the create_date until the record is first "
        "updated after creation.",
    )

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        # Import the module to ensure SQLAlchemy recognizes it
        __import__(cls.__module__)


class Auditable(AbstractConcreteBase, Base):
    __table_args__ = {"schema": "metadata"}

    create_user = Column(
        String, comment="The user who created this record in the database."
    )

    update_user = Column(
        String, comment="The user who last updated this record in the database."
    )


class DisplayOrder(Base):
    __abstract__ = True
    display_order = Column(Integer, comment="Relative rank in display sorting order")


class EffectiveDates(Base):
    __abstract__ = True

    effective_date = Column(
        Date, nullable=True, comment="The calendar date the value became valid."
    )
    effective_status = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="True if the value is currently valid, False if it is no longer valid.",
    )
    expiration_date = Column(
        Date, nullable=True, comment="The calendar date the value is no longer valid."
    )
