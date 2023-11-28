from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransferHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer_history'
    __table_args__ = {'comment': "Records of tranfer from Organization to Organization"}


    transfer_history_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the org to org transfer record")
    transfer_id = Column(Integer, ForeignKey('transfer.transfer_id'))
    from_organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    to_organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    transaction_effective_date = Column(DateTime, comment="Transaction effective date")
    # compliance_period = Column(Integer, )
    transfer_status_id = Column(Integer, ForeignKey('transfer_status.transfer_status_id'))
    transfer_category_id = Column(Integer, ForeignKey('category.category_id'))

    transfer = relationship('Transfer', back_populates='transfer_history_records')
    transaction = relationship('Transaction', back_populates='transfer_history_record')
    transfer_category = relationship("Category")
    transfer_status = relationship('TransferStatus')

    from_organization = relationship(
        'Organization', 
        foreign_keys=[from_organization_id]
    )
    to_organization = relationship(
        'Organization', 
        foreign_keys=[to_organization_id]
    )


