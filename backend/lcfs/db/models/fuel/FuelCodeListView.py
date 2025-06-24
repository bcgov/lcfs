from sqlalchemy import ARRAY, Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class FuelCodeListView(Base):
    __tablename__ = "vw_fuel_code_base"
    __table_args__ = {
        "extend_existing": True,
        "info": {"is_view": True},
        "comment": "View to list fuel codes",
    }

    fuel_code_id = Column(Integer, primary_key=True)
    fuel_code_prefix_id = Column(Integer)
    prefix = Column(String)
    fuel_suffix = Column(String)
    fuel_code_status_id = Column(Integer)
    status = Column(String)
    fuel_type_id = Column(Integer)
    fuel_type = Column(String)
    company = Column(String)
    contact_name = Column(String)
    contact_email = Column(String)
    carbon_intensity = Column(Float)
    edrms = Column(String)
    last_updated = Column(DateTime)
    application_date = Column(DateTime)
    approval_date = Column(DateTime)
    create_date = Column(DateTime)
    effective_date = Column(DateTime)
    expiration_date = Column(DateTime)
    effective_status = Column(Boolean)
    feedstock = Column(String)
    feedstock_location = Column(String)
    feedstock_misc = Column(String)
    fuel_production_facility_city = Column(String)
    fuel_production_facility_province_state = Column(String)
    fuel_production_facility_country = Column(String)
    facility_nameplate_capacity = Column(Float)
    facility_nameplate_capacity_unit = Column(String)
    former_company = Column(String)
    finished_fuel_transport_modes = Column(ARRAY(String))
    feedstock_fuel_transport_modes = Column(ARRAY(String))
    notes = Column(String)
