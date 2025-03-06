from typing import Optional

from lcfs.web.api.base import BaseSchema


class OrganizationSnapshotSchema(BaseSchema):
    compliance_report_id: int
    is_edited: bool
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    head_office_address: Optional[str] = None
    records_address: Optional[str] = None
    service_address: Optional[str] = None
