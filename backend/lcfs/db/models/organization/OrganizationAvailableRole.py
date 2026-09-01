from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint

from lcfs.db.base import Auditable, BaseModel


class OrganizationAvailableRole(BaseModel, Auditable):
    __tablename__ = "organization_available_role"
    __table_args__ = (
        UniqueConstraint("organization_id", "role_id"),
        {
            "comment": (
                "Roles that BCeID users of the organization may be assigned. "
                "Only org-controllable roles are stored here; base roles such "
                "as Manage Users and Signing Authority are always available."
            )
        },
    )

    organization_available_role_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the organization available role",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Organization the role is available to",
    )
    role_id = Column(
        Integer,
        ForeignKey("role.role_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Role available for assignment within the organization",
    )
