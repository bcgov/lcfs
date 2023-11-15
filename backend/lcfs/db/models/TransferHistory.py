from sqlalchemy import Column, Integer, Sequence, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransferHistory(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'transfer_history'
    __table_args__ = {'comment': "Records of tranfer from Organization to Organization"}


    id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the org to org transfer record", primary_key=True, autoincrement=True)
    transfer_id = Column(Integer, ForeignKey('transfer.id'))
    from_organization = Column(Integer, ForeignKey('organization.id'))
    to_organization = Column(Integer, ForeignKey('organization.id'))
    transaction_id = Column(Integer, ForeignKey('transaction.id'))
    transaction_effective_date = Column(DateTime, comment="Transaction effective date")
    # compliance_period = Column(Integer, )
    comment_id = Column(Integer, ForeignKey('comment.id'))
    transfer_status = Column(Integer, ForeignKey('transfer_status.id'))
    transfer_category = Column(Integer, ForeignKey('category.id'))

    organizations = relationship('Organization', back_populates='transfer_history')
    transfer = relationship('Transfer', back_populates='transfer_history')
    transaction = relationship('Transaction', back_populates='transfer_history')
    comment = relationship('Comment', back_populates='transfer_history')
    transfer_status = relationship('TransferStatus', back_populates='transfer_history')
    transfer_category = relationship("Category", back_populates='transfer_history')


