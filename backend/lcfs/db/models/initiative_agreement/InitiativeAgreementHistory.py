from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class InitiativeAgreementHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'initiative_agreement_history'
    __table_args__ = (UniqueConstraint('initiative_agreement_history_id'),
                      {'comment': "History record for initiative agreement status change."}
    )

    initiative_agreement_history_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the initiative agreement history record")
    initiative_agreement_id = Column(Integer, ForeignKey('initiative_agreement.initiative_agreement_id'))
    initiative_agreement_status_id = Column(Integer, ForeignKey('initiative_agreement_status.initiative_agreement_status_id'))
    user_profile_id = Column(Integer, ForeignKey("user_profile.user_profile_id"), comment="Foreign key to user_profile")

    initiative_agreement = relationship('InitiativeAgreement', back_populates='history')
    initiative_agreement_status = relationship('InitiativeAgreementStatus')
    user_profile = relationship("UserProfile")
