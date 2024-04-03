import enum
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, Enum, String
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class TransferRecommendationEnum(enum.Enum):
    Record = "Record"
    Refuse = "Refuse"


class Transfer(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer'
    __table_args__ = (UniqueConstraint('transfer_id'),
                      {'comment': "Records of tranfer from Organization to Organization"}
                      )

    transfer_id = Column(Integer, primary_key=True, autoincrement=True,
                         comment="Unique identifier for the org to org transfer record")
    from_organization_id = Column(
        Integer, ForeignKey('organization.organization_id'))
    to_organization_id = Column(
        Integer, ForeignKey('organization.organization_id'))
    from_transaction_id = Column(
        Integer, ForeignKey('transaction.transaction_id'))
    to_transaction_id = Column(
        Integer, ForeignKey('transaction.transaction_id'))
    agreement_date = Column(DateTime, comment="Agreement date of the transfer")
    transaction_effective_date = Column(
        DateTime, comment="transaction effective date")
    price_per_unit = Column(Integer, comment="Price per unit")
    quantity = Column(Integer, comment="Quantity of units")
    # compliance_period = Column(Integer, )
    from_org_comment = Column(String(1000), comment="Comment from the from-organization")
    to_org_comment = Column(String(1000), comment="Comment from the to-organization")
    gov_comment = Column(String(1500), comment="Comment from the government to organizations")
    transfer_category_id = Column(Integer, ForeignKey(
        'transfer_category.transfer_category_id'))
    current_status_id = Column(Integer, ForeignKey(
        'transfer_status.transfer_status_id'))
    recommendation = Column(Enum(TransferRecommendationEnum, name="transfer_recommendation_enum",
                            create_type=True), comment="Analyst recommendation for the transfer.")

    # relationships
    transfer_category = relationship('TransferCategory')
    transfer_history = relationship(
        'TransferHistory', back_populates='transfer')
    current_status = relationship('TransferStatus')
    transfer_internal_comments = relationship('TransferInternalComment', back_populates='transfer')

    from_transaction = relationship(
        'Transaction',
        foreign_keys=[from_transaction_id]
    )
    to_transaction = relationship(
        'Transaction',
        foreign_keys=[to_transaction_id]
    )
    from_organization = relationship(
        'Organization',
        foreign_keys=[from_organization_id],
        back_populates='transfers_sent'
    )
    to_organization = relationship(
        'Organization',
        foreign_keys=[to_organization_id],
        back_populates='transfers_received'
    )
