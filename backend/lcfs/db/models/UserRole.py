from sqlalchemy import Column, ForeignKey, Integer, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from lcfs.db.base import Auditable, BaseModel

class UserRole(BaseModel, Auditable):
    __tablename__ = 'user_role'
    __table_args__ = (
        UniqueConstraint('user_profile_id', 'role_id', name='user_role_unique_constraint'),
        {'comment': 'Contains the user and role relationships'}
    )
    # Columns
    user_role_id = Column(Integer, primary_key=True, autoincrement=True, comment='Unique ID for the user role')
    user_profile_id = Column(Integer, ForeignKey('user_profile.user_profile_id'), comment='Foreign key to user_profile')
    role_id = Column(Integer, ForeignKey('role.role_id'), comment='Foreign key to role')
    # Relationships
    user_profile = relationship('UserProfile', back_populates='user_roles')
    role = relationship('Role', back_populates='user_roles')
