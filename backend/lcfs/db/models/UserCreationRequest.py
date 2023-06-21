from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, UniqueConstraint,
                        text, Sequence)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable


class UserCreationRequest(Auditable):
    __tablename__ = 'user_creation_request'
    __table_args__ = (
        UniqueConstraint('keycloak_email', 'user_id', name='_keycloak_email_user_uc'),
        {'comment': 'Contains a list of users that were created by the system. This is used to map out the relationship between the email used via keycloak and the actual user in the system.'}
    )

    # Columns
    id = Column(Integer, Sequence('user_creation_request_id_seq'), primary_key=True, comment='id of the user creation request', autoincrement=True)
    keycloak_email = Column(String, nullable=False, comment='email used by keycloak')
    external_username = Column(String, nullable=False, comment='external username used by the system')
    user_id = Column(Integer, ForeignKey('user.id'), unique=True, nullable=False, comment='user id of the user that was created')
    is_mapped = Column(Boolean, nullable=False, default=False, comment='whether or not the user has been mapped to the system')

    # Relationships
    user = relationship('User', back_populates='user_creation_request')

    def __repr__(self):
        return f"UserCreationRequest(id={self.id}, keycloak_email={self.keycloak_email}, external_username={self.external_username}, user={self.user}, is_mapped={self.is_mapped})"
