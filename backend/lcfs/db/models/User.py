from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, DateTime,
                        UniqueConstraint, text, Sequence)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship


class User(BaseModel,Auditable):
    __tablename__ = 'user'
    __table_args__ = (
        UniqueConstraint('username'),
        {'comment': 'Users who may access the application'}
    )

    id = Column(Integer, Sequence('user_id_seq'), primary_key=True, autoincrement=True)

    keycloak_user_id = Column(String(150), nullable=True, comment='Unique id returned from Keycloak')
    keycloak_email = Column(String(255), nullable=True, comment='keycloak email address')
    keycloak_username = Column(String(150), unique=True, nullable=False,
                      comment='keycloak Username')
    email = Column(String(255), nullable=True, comment='Primary email address')
    username = Column(String(150), unique=True, nullable=False,
                      comment='Login Username')
    display_name = Column('display_name', String(500), nullable=True,
                          comment='Displayed name for user')
    title = Column(String(100), nullable=True, comment='Professional Title')
    phone = Column(String(50), nullable=True, comment='Primary phone number')
    mobile_phone = Column(String(50), nullable=True, comment='Mobile phone number')
    organization_id = Column(Integer, ForeignKey('organization.id'))

    organization = relationship('Organization', back_populates='users')
    user_roles = relationship('UserRole', back_populates='user')
