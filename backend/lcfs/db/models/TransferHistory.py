from sqlalchemy import Column, Integer, Sequence, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransferHistory(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'transfer_history'
    __table_args__ = {'comment': "Records of tranfer from Organization to Organization"}


    transfer_history_id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the org to org transfer record", primary_key=True, autoincrement=True)
    transfer_id = Column(Integer, ForeignKey('transfer.transfer_id'))
    from_organization = Column(Integer, ForeignKey('organization.id'))
    to_organization = Column(Integer, ForeignKey('organization.id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    transaction_effective_date = Column(DateTime, comment="Transaction effective date")
    # compliance_period = Column(Integer, )
    comment_id = Column(Integer, ForeignKey('comment.comment_id'))
    transfer_status = Column(Integer, ForeignKey('transfer_status.transfer_status_id'))
    transfer_category = Column(Integer, ForeignKey('category.category_id'))

    organizations = relationship('Organization', back_populates='transfer_history')
    transfer = relationship('Transfer', back_populates='transfer_history')
    transaction = relationship('Transaction', back_populates='transfer_history')
    comment = relationship('Comment', back_populates='transfer_history')
    transfer_status = relationship('TransferStatus', back_populates='transfer_history')
    transfer_category = relationship("Category", back_populates='transfer_history')


