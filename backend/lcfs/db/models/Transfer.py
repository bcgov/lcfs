from sqlalchemy import Column, Integer, Sequence, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Transfer(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'transfer'
    __table_args__ = (UniqueConstraint('transfer_id'),
                      {'comment': "Records of tranfer from Organization to Organization"}
    )


    transfer_id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the org to org transfer record", primary_key=True, autoincrement=True)
    from_organization = Column(Integer, ForeignKey('organization.id'))
    to_organization = Column(Integer, ForeignKey('organization.id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    transaction_effective_date = Column(DateTime, comment="transaction effective date")
    # compliance_period = Column(Integer, )
    comment_id = Column(Integer, ForeignKey('comment.comment_id'))
    transfer_status = Column(Integer, ForeignKey('transfer_status.transfer_status_id'))
    transfer_category = Column(Integer, ForeignKey('category.category_id'))

    organizations = relationship('Organization', back_populates='transaction')
    transactions = relationship('Transaction', back_populates='transfer')
    comment = relationship('Comment', back_populates='transfer')
    transfer_status = relationship('TransferStatus', back_populates='transfer')
    category = relationship('Category', back_populates='transfer')
    transfer_history = relationship('TransferHistory', back_populates='transfer')



