from sqlalchemy.ext.declarative import declarative_base, AbstractConcreteBase
from sqlalchemy import String, Column, DateTime, Integer
from datetime import datetime

Base = declarative_base()

class BaseModel(AbstractConcreteBase, Base):
    """Base for all models."""

    __table_args__ = {'schema': 'metadata'}

    id = Column(Integer, primary_key=True)
    create_date = Column(
        DateTime,
        default=datetime.now,
        comment='Date and time (UTC) when the physical record was created in the database.')
    update_date = Column(DateTime,
                         default=datetime.now,
                         onupdate=datetime.now,
                         comment='Date and time (UTC) when the physical record was updated in the'
                                 ' database. '
                                 'It will be the same as the create_date until the record is first '
                                 'updated after creation.')


class Auditable(AbstractConcreteBase, Base):
    __table_args__ = {'schema': 'metadata'}

    create_user = Column(
        String,
        comment='The user who created this record in the database.')
    create_date = Column(
        DateTime,
        default=datetime.now,
        comment='Date and time (UTC) when the physical record was created in the database.')
    update_user = Column(
        String,
        comment='The user who last updated this record in the database.')
    update_date = Column(DateTime,
                         default=datetime.now,
                         onupdate=datetime.now,
                         comment='Date and time (UTC) when the physical record was updated in the database. '
                                 'It will be the same as the create_date until the record is first '
                                 'updated after creation.')
    effective_date = Column(
        DateTime, comment='The date and time that the code became valid and could be used.')
    expiry_date = Column(DateTime,
                         comment='The date and time after which the code is no longer valid and '
                                 'should not be used.')
