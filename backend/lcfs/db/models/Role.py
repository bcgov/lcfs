from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint
from lcfs.db.base import Auditable

class Role(Auditable):
    __tablename__ = 'role'
    __table_args__ = (
        UniqueConstraint('name'),
        {'comment': 'To hold all the available roles and  their descriptions.'}
    )
    id = Column(Integer, primary_key=True)
    name = Column(String(200), unique=True, nullable=False, comment="Role code. Natural key. Used internally. eg Admin, GovUser, GovDirector, etc")
    description = Column(String(1000), comment="Descriptive text explaining this role. This is what's shown to the user.")
    is_government_role = Column(Boolean, default=False, comment="Flag. True if this is a government role (eg. Analyst, Administrator)")
    display_order = Column(Integer, comment="Relative rank in display sorting order")
