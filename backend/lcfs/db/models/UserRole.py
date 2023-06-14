from sqlalchemy import Column, ForeignKey, Integer, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from lcfs.db.base import Auditable

class UserRole(Auditable):
    __tablename__ = 'user_role'
    __table_args__ = (
        UniqueConstraint('user_id', 'role_id', name='user_role_unique_constraint'),
        {'comment': 'Contains  the user and role relationships'}
    )
    # Columns
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(Integer, ForeignKey('user.id'))
    role_id = Column(Integer, ForeignKey('role.id'))
    # Relationships
    user = relationship('User', back_populates='user_roles')
    role = relationship('Role', back_populates='user_roles')
