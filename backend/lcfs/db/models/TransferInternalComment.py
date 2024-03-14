from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel

class TransferInternalComment(BaseModel):
    __tablename__ = 'transfer_internal_comment'
    __table_args__ = {'comment': 'Associates internal comments with transfers.'}

    # Columns
    transfer_id = Column(Integer, ForeignKey('transfer.transfer_id'), primary_key=True,
                         comment='Foreign key to transfer, part of the composite primary key.')
    internal_comment_id = Column(Integer, ForeignKey('internal_comment.internal_comment_id'), primary_key=True,
                                 comment='Foreign key to internal_comment, part of the composite primary key.')

    # Relationships
    transfer = relationship('Transfer', back_populates='transfer_internal_comments')
    internal_comment = relationship('InternalComment', back_populates='transfer_internal_comments')
