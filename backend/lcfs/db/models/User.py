from lcfs.db.base import Auditable
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship


class User(Auditable):
    __tablename__ = 'user'
    __table_args__ = {'comment': 'Users who may access the application'}

    id = Column(Integer, primary_key=True)
    username = Column(String(150), unique=True, nullable=False, comment='Login Username')
    keycloak_user_id = Column(String(150), nullable=True, comment='Unique id returned from Keycloak')
    password = Column(String(128), nullable=True, comment='Password hash')
    email = Column(String, nullable=True, comment='Primary email address')
    title = Column(String(100), nullable=True, comment='Professional Title')
    phone = Column(String(50), nullable=True, comment='Primary phone number')
    cell_phone = Column(String(50), nullable=True, comment='Mobile phone number')
    organization_id = Column(Integer, ForeignKey('organization.id'))
    organization = relationship('Organization', back_populates='users')
    _display_name = Column('display_name', String(500), nullable=True, comment='Displayed name for user')

    # Additional fields from Django's AbstractUser model
    first_name = Column(String(30), nullable=True, comment='First name (retrieved from Siteminder')
    last_name = Column(String(150), nullable=True, comment='Last name (retrieved from Siteminder)')
    is_staff = Column(Boolean, nullable=False, default=False, comment='True if staff user')
    is_superuser = Column(Boolean, nullable=False, default=False, comment='True if superuser')
    is_active = Column(Boolean, nullable=False, default=True, comment='True if can login')
    date_joined = Column(DateTime, nullable=True, comment='Date account created')
    last_login = Column(DateTime, nullable=True, comment='Last login time')
