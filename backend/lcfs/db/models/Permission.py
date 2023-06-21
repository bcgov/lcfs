from sqlalchemy import Column, String, Integer, UniqueConstraint, Sequence

from lcfs.db.base import Auditable

class Permission(Auditable):
    __tablename__ = 'permission'
    __table_args__ = (
        UniqueConstraint('code', name='_code_uc'),
        {'comment': 'Contains the list of permissions to grant access to certain actions of areas for the system.'}
    )
    id = Column(Integer, Sequence('permission_id_seq'), primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, comment='Permission Code')
    name = Column(String(100), comment='descriptive name')
    description = Column(String(1000), comment='description of each permission')
