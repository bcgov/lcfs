from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Transfer(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer'
    __table_args__ = (UniqueConstraint('transfer_id'),
                      {'comment': "Records of tranfer from Organization to Organization"}
    )

    transfer_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the org to org transfer record")
    from_organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    to_organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    agreement_date = Column(DateTime, comment="Agreement date of the transfer")
    transaction_effective_date = Column(DateTime, comment="transaction effective date")
    price_per_unit = Column(Integer, comment="Price per unit")
    quantity = Column(Integer, comment="Quantity of units")
    # compliance_period = Column(Integer, )
    comment_id = Column(Integer, ForeignKey('comment.comment_id'))
    transfer_status_id = Column(Integer, ForeignKey('transfer_status.transfer_status_id'))
    transfer_category_id = Column(Integer, ForeignKey('transfer_category.transfer_category_id'))
    signing_authority_declaration = Column(Boolean, default=False)

    transaction = relationship('Transaction')
    transfer_status = relationship('TransferStatus')
    transfer_category = relationship('TransferCategory')
    comments = relationship('Comment', back_populates='transfer')
    transfer_history_records = relationship('TransferHistory', back_populates='transfer')

    from_organization = relationship(
        'Organization', 
        foreign_keys=[from_organization_id]
    )
    to_organization = relationship(
        'Organization', 
        foreign_keys=[to_organization_id]
    )
