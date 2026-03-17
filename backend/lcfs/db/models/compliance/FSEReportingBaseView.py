from sqlalchemy import ARRAY, Column, DateTime, Float, Integer, String, Boolean
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class FSEReportingBaseView(Base):
    __tablename__ = "v_fse_reporting_base"
    __table_args__ = {
        "extend_existing": True,
        "info": {"is_view": True},
        "comment": "View for charging equipment reporting base rows",
    }

    charging_equipment_id = Column(Integer, primary_key=True)
    charging_equipment_version = Column(Integer, primary_key=True)
    charging_equipment_compliance_id = Column(Integer, primary_key=True, nullable=True)
    organization_id = Column(Integer)
    serial_number = Column(String)
    manufacturer = Column(String)
    model = Column(String)
    registration_number = Column(String)
    site_name = Column(String)
    charging_site_id = Column(Integer)
    equipment_notes = Column(String)
    supply_from_date = Column(DateTime)
    supply_to_date = Column(DateTime)
    kwh_usage = Column(Float)
    compliance_notes = Column(String)
    compliance_report_id = Column(Integer)
    compliance_report_group_uuid = Column(String)
    is_active = Column(Boolean)
    street_address = Column(String)
    city = Column(String)
    postal_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    level_of_equipment = Column(String)
    level_of_equipment_id = Column(Integer)
    ports = Column(String)
    allocating_organization_name = Column(String)
    intended_uses = Column(ARRAY(String))
    intended_users = Column(ARRAY(String))
    power_output = Column(Float)
    capacity_utilization_percent = Column(Integer)
    charging_equipment_status = Column(String)
