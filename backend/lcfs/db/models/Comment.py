from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Comment(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'comment'
    __table_args__ = (UniqueConstraint('comment_id'),
                      {'comment': "Comment for transaction"}
    )


    comment_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for comment")
    comment = Column(String(500), comment="Comment")

    transfer = relationship('Transfer', back_populates='comments')
    admin_adjustment = relationship('AdminAdjustment', back_populates='comments')
    initiative_agreement = relationship('InitiativeAgreement', back_populates='comments')


    def __repr__(self):
        return self.comment

