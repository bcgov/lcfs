from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint

from lcfs.db.base import Auditable, BaseModel


class OrganizationTypeAssociation(BaseModel, Auditable):
    __tablename__ = "organization_type_association"
    __table_args__ = (
        UniqueConstraint("organization_id", "organization_type_id"),
        {"comment": "Associates organizations with one or more organization types."},
    )

    organization_type_association_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the organization type association",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Organization assigned this type",
    )
    organization_type_id = Column(
        Integer,
        ForeignKey("organization_type.organization_type_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Organization type assigned to the organization",
    )
