from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class Organization(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'organization'
    __table_args__ = {'comment': "Contains a list of all of the recognized Part 3 "
                                 "fuel suppliers, both past and present, as well as "
                                 "an entry for the government which is also "
                                 "considered an organization."}

    organization_id = Column(Integer, primary_key=True, autoincrement=True,
                             comment="Unique identifier for the organization")
    name = Column(String(500), comment="Organization's legal name")
    operating_name = Column(
        String(500), comment="Organization's Operating name")
    email = Column(String(255), comment="Organization's email address")
    phone = Column(String(50), comment="Organization's phone number")
    edrms_record = Column(
        String(100), comment="Organization's EDRMS record number")

    organization_status_id = Column(Integer, ForeignKey(
        'organization_status.organization_status_id'))
    organization_type_id = Column(Integer, ForeignKey(
        'organization_type.organization_type_id'), comment="Organization's type")
    organization_address_id = Column(Integer, ForeignKey(
        'organization_address.organization_address_id'))
    organization_attorney_address_id = Column(Integer, ForeignKey(
        'organization_attorney_address.organization_attorney_address_id'))

    org_type = relationship(
        'OrganizationType', back_populates='organizations', lazy='joined')
    org_status = relationship('OrganizationStatus',
                              back_populates='organizations', lazy='joined')
    org_address = relationship(
        'OrganizationAddress', back_populates='organization')
    org_attorney_address = relationship(
        'OrganizationAttorneyAddress', back_populates='organization')
    user_profiles = relationship('UserProfile', back_populates='organization')
    transactions = relationship('Transaction', back_populates='organization')
    issuances = relationship('Issuance', back_populates='organization')
