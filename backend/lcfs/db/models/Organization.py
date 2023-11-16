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

    organization_id = Column(Integer, Sequence('organization_id_seq'), comment="Unique identifier for the organization", primary_key=True, autoincrement=True)
    name = Column(String(500), comment="Organization's legal name")
    organization_status_id = Column(Integer, ForeignKey('organization_status.organization_status_id'))
    organization_type_id = Column(Integer, ForeignKey('organization_type.organization_type_id'), comment="Organization's type")
    organization_address_id = Column(Integer, ForeignKey('organization_address.organization_address_id'))
    organization_attorney_address_id = Column(Integer, ForeignKey('organization_attorney_address.organization_attorney_address_id'))

    org_type = relationship('OrganizationType', back_populates='organizations')
    org_status = relationship('OrganizationStatus', back_populates='organizations')
    org_address = relationship('OrganizationAddress', back_populates='organization')
    org_attorney_address = relationship('OrganizationAttorneyAddress', back_populates='organization')
    users = relationship('User', back_populates='organization')
