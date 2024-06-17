import sqlalchemy as sa
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey
from lcfs.db.base import BaseModel, Auditable
from sqlalchemy.orm import relationship


class FuelClass(BaseModel, Auditable):
    
    __tablename__ = "fuel_class"
    __table_args__ = {"comment": "Table linking fuel types and fuel categories"}

    fuel_class_id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    fuel_type_id = Column(Integer, ForeignKey("fuel_type.fuel_type_id"), nullable=False, comment="ID of the fuel type")
    fuel_category_id = Column(Integer, ForeignKey("fuel_category.fuel_category_id"), nullable=False, comment="ID of the fuel category")
    create_user = Column(String, nullable=True, comment="User who created this record in the database")
    update_user = Column(String, nullable=True, comment="User who last updated this record in the database")
    create_date = Column(TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=True, comment="Date and time (UTC) when the record was created")
    update_date = Column(TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=True, comment="Date and time (UTC) when the record was last updated")

    fuel_type = relationship("FuelType", back_populates="fuel_classes")
    fuel_category = relationship("FuelCategory", back_populates="fuel_classes")
