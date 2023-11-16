from sqlalchemy import Column, ForeignKey, Integer, text, UniqueConstraint, Sequence
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from lcfs.db.base import Auditable, BaseModel

class UserRole(BaseModel, Auditable):
    __tablename__ = 'user_role'
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', name='user_role_unique_constraint'),
        {'comment': 'Contains  the user and role relationships'}
    )
    # Columns
    user_role_id = Column(Integer, Sequence('user_role_id_seq'), primary_key=True, autoincrement=True, comment='Unique ID for the user role')
    user_id = Column(Integer, ForeignKey('user.id'))
    role_id = Column(Integer, ForeignKey('role.id'))
    # Relationships
    # user = relationship('User', back_populates='user_roles')
    # role = relationship('Role', back_populates='user_roles')
