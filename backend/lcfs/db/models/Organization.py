from sqlalchemy import Column, Integer, String, ForeignKey, Sequence
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class Organization(BaseModel,Auditable):
    __tablename__ = 'organization'
    __table_args__ = {'comment': "Contains a list of all of the recognized Part 3 "
                                 "fuel suppliers, both past and present, as well as "
                                 "an entry for the government which is also "
                                 "considered an organization."}

    id = Column(Integer, Sequence('organization_id_seq'), comment="Unique identifier for the organization", primary_key=True, autoincrement=True)
    name = Column(String(500), comment="Organization's legal name")
    status_id = Column(Integer, ForeignKey('organization_status.id'))
    actions_type_id = Column(Integer, ForeignKey('organization_actions_type.id'))
    # type_id = Column(Integer, ForeignKey('organization_type.id'), nullable=True)

    status = relationship('OrganizationStatus', back_populates='organizations')
    actions_type = relationship('OrganizationActionsType', back_populates='organizations')
    type = relationship('OrganizationType', back_populates='organizations')
    addresses = relationship('OrganizationAddress', back_populates='organization')
    history = relationship('OrganizationHistory', back_populates='organization')

    def __repr__(self):
        return self.name


