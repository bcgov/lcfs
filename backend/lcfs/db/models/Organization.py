import enum

from sqlalchemy import Column, Integer, String, Sequence, Enum, ForeignKey
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates
# from lcfs.db.models import OrganizationType

class Organization(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'organization'
    __table_args__ = {'comment': "Contains a list of all of the recognized Part 3 "
                                 "fuel suppliers, both past and present, as well as "
                                 "an entry for the government which is also "
                                 "considered an organization."}

    id = Column(Integer, Sequence('organization_id_seq'), comment="Unique identifier for the organization", primary_key=True, autoincrement=True)
    name = Column(String(500), comment="Organization's legal name")
    status = Column(Integer, ForeignKey('organization_status.id'))
    type = Column(Integer, ForeignKey('organization_type.organization_type_id'), comment="Organization's type")
    address = Column(Integer, ForeignKey('organization_address.id'))
    attorney_address = Column(Integer, ForeignKey('organization_attorney_address.id'))

    org_type = relationship('OrganizationType', back_populates='organization')
    organization_address = relationship('OrganizationAddress', back_populates='organization')
    org_attorney_addr = relationship('OrganizationAttorneyAddress', back_populates='organization')
    org_status = relationship('OrganizationStatus', back_populates='organization')
    org_type = relationship('OrganizationType', back_populates='organization')
    transaction = relationship('Transaction', back_populates='organizations')
    issuance_history = relationship('IssuanceHistory', back_populates='organizations')
    transfer_history = relationship('TransferHistory', back_populates='organizations')

    def __repr__(self):
        return self.name


