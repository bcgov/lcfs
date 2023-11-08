import enum

from sqlalchemy import Column, Integer, String, Sequence, Enum
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class StatusEnum(enum.Enum):
    Active = "Active"
    Archived = "Archived"

class ActionsTypeEnum(enum.Enum):
    BuyAndSell = "Buy And Sell"
    SellOnly = "Sell Only"
    NA = "None"

class OrganizationTypeEnum(enum.Enum):
    Government = "Government of British Columbia"
    Part3FuelSupplier = "Part 3 Fuel Supplier"

class Organization(BaseModel, Auditable):
    __tablename__ = 'organization'
    __table_args__ = {'comment': "Contains a list of all of the recognized Part 3 "
                                 "fuel suppliers, both past and present, as well as "
                                 "an entry for the government which is also "
                                 "considered an organization."}

    id = Column(Integer, Sequence('organization_id_seq'), comment="Unique identifier for the organization", primary_key=True, autoincrement=True)
    name = Column(String(500), comment="Organization's legal name")
    status = Column(Enum(StatusEnum, name="status_enum", create_type=True), default=StatusEnum.Active, comment="Organization's status")
    actions_type = Column(Enum(ActionsTypeEnum, name="actions_type_enum", create_type=True), default=ActionsTypeEnum.NA, comment="Organization's actions type")
    organization_type = Column(Enum(OrganizationTypeEnum, name="organization_type_enum", create_type=True), nullable=False, default=OrganizationTypeEnum.Part3FuelSupplier, comment="Organization's type")

    addresses = relationship('OrganizationAddress', back_populates='organization')
    history = relationship('OrganizationHistory', back_populates='organization')
    # users = relationship('user', back_populates='organization')

    def __repr__(self):
        return self.name

