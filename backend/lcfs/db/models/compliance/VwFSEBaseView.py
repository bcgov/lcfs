from sqlalchemy import ARRAY, Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class VwFSEBaseView(Base):
    __tablename__ = "vw_fse_base"
    __table_args__ = {
        "extend_existing": True,
        "comment": "Final Supply Equipment base reporting view",
    }

    compliance_period_id = Column(Integer)
    compliance_year = Column(String)
    organization_id = Column(Integer)
    organization_name = Column(String)
    organization_operating_name = Column(String)
    charging_equipment_compliance_id = Column(Integer, primary_key=True)
    charging_equipment_id = Column(Integer, primary_key=True)
    charging_equipment_version = Column(Integer, primary_key=True)
    charging_site_id = Column(Integer)
    registration_number = Column(String)
    compliance_report_id = Column(Integer)
    compliance_report_group_uuid = Column(String)
    report_version = Column(Integer)
    report_type = Column(String)
    supplemental_initiator = Column(String)
    report_status = Column(String)
    site_name = Column(String)
    street_address = Column(String)
    city = Column(String)
    postal_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    supply_from_date = Column(DateTime)
    supply_to_date = Column(DateTime)
    kwh_usage = Column(Float)
    compliance_notes = Column(String)
    is_active = Column(Boolean)
    serial_number = Column(String)
    manufacturer = Column(String)
    model = Column(String)
    level_of_equipment = Column(String)
    level_of_equipment_id = Column(Integer)
    ports = Column(String)
    intended_uses = Column(ARRAY(String))
    intended_users = Column(ARRAY(String))
    allocating_organization_name = Column(String)
    equipment_notes = Column(String)
    power_output = Column(Float)
    capacity_utilization_percent = Column(Integer)
    charging_equipment_status = Column(String)
