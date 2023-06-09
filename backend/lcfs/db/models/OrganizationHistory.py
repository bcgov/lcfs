from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class OrganizationHistory(BaseModel, Auditable):
    __tablename__ = 'organization_history'
    
    organization_id = Column(Integer, ForeignKey('organization.id'), nullable=False)
    history_text = Column(String(1000), comment='Details for this history entry')

    organization = relationship('Organization', back_populates='history')
