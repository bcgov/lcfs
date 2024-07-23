from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel

class InitiativeAgreementInternalComment(BaseModel):
    __tablename__ = 'initiative_agreement_internal_comment'
    __table_args__ = {'comment': 'Associates internal comments with initiative agreements.'}

    # Columns
    initiative_agreement_id = Column(Integer, ForeignKey('initiative_agreement.initiative_agreement_id'), primary_key=True,
                                     comment='Foreign key to initiative_agreement, part of the composite primary key.')
    internal_comment_id = Column(Integer, ForeignKey('internal_comment.internal_comment_id'), primary_key=True,
                                 comment='Foreign key to internal_comment, part of the composite primary key.')

    # Relationships
    initiative_agreement = relationship('InitiativeAgreement', back_populates='initiative_agreement_internal_comments')
    internal_comment = relationship('InternalComment', back_populates='initiative_agreement_internal_comments')
