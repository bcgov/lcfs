from sqlalchemy import Column, Integer, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class OrganizationBalance(BaseModel, Auditable, EffectiveDates):
    """
    Credit Trade Balance for the Fuel Supplier
    """
    __tablename__ = 'organization_balance'
    __table_args__ = {'comment': "Represents a fuel supplier organization's credit balance at a given point in time. The government organization does not have an actual credit balance, but rather one was set artificially high to enable the awarding or validating of credits to fuel suppliers within TFRS."}

    organization_id = Column(Integer, ForeignKey('organization.id'), nullable=False)
    validated_credits = Column(BigInteger, comment='The actual balance of validated Low Carbon Fuel credits held by a fuel supplier between the effective_date and the expiration_date. If expiration_date is NULL then we assume that it is the current balance.')
    # credit_trade_id = Column(Integer, ForeignKey('metadata.credit_trade.id'), nullable=True)

    organization = relationship('Organization', back_populates='balances')
    # credit_trade = relationship('CreditTrade', back_populates='balances')

