from sqlalchemy import (Column, Integer, String, Boolean, UniqueConstraint, Sequence)

from lcfs.db.base import Auditable


class Role(Auditable):
    __tablename__ = 'role'
    __table_args__ = (
        UniqueConstraint('name'),
        {'comment': 'To hold all the available roles and  their descriptions.'}
    )
    id = Column(Integer,  Sequence('role_id_seq'), primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False,
                  comment="Role code. Natural key. Used internally. eg Admin, GovUser, GovDirector, etc")
    description = Column(String(1000),
                         comment="Descriptive text explaining this role. This is what's shown to the user.")
    is_government_role = Column(Boolean, default=False,
                                comment="Flag. True if this is a government role (eg. Analyst, Administrator)")
    display_order = Column(Integer, comment="Relative rank in display sorting order")

    def __repr__(self):
        return '<Role %r>' % self.name

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'isGovernmentRole': self.is_government_role
        }
