from sqlalchemy import (Column, ForeignKey, Integer, text, UniqueConstraint, Sequence)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from lcfs.db.base import Auditable

class RolePermission(Auditable):
    __tablename__ = 'role_permission'
    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='_role_permission_uc'),
        {'comment': 'Relationship between roles and permissions'}
    )
    # Columns
    id = Column(Integer, Sequence('role_permission_id_seq'), primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey('role.id'), nullable=False)
    permission_id = Column(Integer, ForeignKey('permission.id'), nullable=False)
    # Relationships
    role = relationship('Role', backref='role_permissions')
    permission = relationship('Permission', backref='role_permissions')
