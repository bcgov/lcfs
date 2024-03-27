from sqlalchemy.ext.declarative import declarative_base, AbstractConcreteBase
from sqlalchemy import String, Column, Integer, Date, text, TIMESTAMP, func
from datetime import datetime

Base = declarative_base()


class BaseModel(AbstractConcreteBase, Base):
    """Base for all models."""

    __table_args__ = {'schema': 'metadata'}

    create_date = Column(
        TIMESTAMP(timezone=True),
        server_default=text('now()'),
        comment='Date and time (UTC) when the physical record was created in the database.')
    update_date = Column(TIMESTAMP(timezone=True),
                         server_default=text('now()'),
                         onupdate=func.now(),
                         comment='Date and time (UTC) when the physical record was updated in the'
                                 ' database. '
                                 'It will be the same as the create_date until the record is first '
                                 'updated after creation.')
    
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        # Import the module to ensure SQLAlchemy recognizes it
        __import__(cls.__module__)


class Auditable(AbstractConcreteBase, Base):
    __table_args__ = {'schema': 'metadata'}

    create_user = Column(
        String,
        comment='The user who created this record in the database.')

    update_user = Column(
        String,
        comment='The user who last updated this record in the database.')

class DisplayOrder(Base):
    __abstract__ = True
    display_order = Column(Integer, comment='Relative rank in display sorting order')


class EffectiveDates(Base):
    __abstract__ = True

    effective_date = Column(Date, nullable=True,
                            comment='The calendar date the value became valid.')
    expiration_date = Column(Date, nullable=True,
                             comment='The calendar date the value is no longer valid.')
