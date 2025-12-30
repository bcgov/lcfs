from typing import Optional, List, Tuple

from pydantic import model_validator

from lcfs.web.api.base import BaseSchema


# Single source of truth for required organization fields with their display labels
# Used for both backend validation and error messaging
REQUIRED_ORG_FIELDS: List[Tuple[str, str]] = [
    ("name", "Legal name"),
    ("operating_name", "Operating name"),
    ("email", "Email address"),
    ("phone", "Phone number"),
    ("service_address", "Address for service"),
    ("records_address", "Address in B.C. where records are maintained"),
    ("head_office_address", "Head office address"),
]

# Extract just the field names for quick lookups
REQUIRED_ORG_FIELD_NAMES = [field_name for field_name, _ in REQUIRED_ORG_FIELDS]


class OrganizationSnapshotSchema(BaseSchema):
    """Schema for organization snapshot - all fields optional for GET/PUT operations."""

    compliance_report_id: int
    is_edited: bool
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    head_office_address: Optional[str] = None
    records_address: Optional[str] = None
    service_address: Optional[str] = None

    def get_missing_required_fields(self) -> List[str]:
        """
        Returns a list of human-readable labels for any required fields that are empty.
        Used for submission validation.
        """
        missing = []
        for field_name, label in REQUIRED_ORG_FIELDS:
            value = getattr(self, field_name, None)
            if not value or (isinstance(value, str) and not value.strip()):
                missing.append(label)
        return missing

    def is_complete_for_submission(self) -> bool:
        """Check if all required fields are filled for report submission."""
        return len(self.get_missing_required_fields()) == 0
