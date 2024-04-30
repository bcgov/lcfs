from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel

class AdminAdjustmentInternalComment(BaseModel):
    __tablename__ = 'admin_adjustment_internal_comment'
    __table_args__ = {'comment': 'Associates internal comments with admin adjustments.'}

    # Columns
    admin_adjustment_id = Column(Integer, ForeignKey('admin_adjustment.admin_adjustment_id'), primary_key=True,
                                     comment='Foreign key to admin_adjustment, part of the composite primary key.')
    internal_comment_id = Column(Integer, ForeignKey('internal_comment.internal_comment_id'), primary_key=True,
                                 comment='Foreign key to internal_comment, part of the composite primary key.')

    # Relationships
    admin_adjustment = relationship('AdminAdjustment', back_populates='admin_adjustment_internal_comments')
    internal_comment = relationship('InternalComment', back_populates='admin_adjustment_internal_comments')
