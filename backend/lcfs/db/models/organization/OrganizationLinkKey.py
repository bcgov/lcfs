from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    UniqueConstraint,
    Index,
    DateTime,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel


class OrganizationLinkKey(BaseModel):
    """
    Model for storing secure link keys that allow anonymous access to organization forms.

    Each organization can have multiple link keys for different form types.
    Link keys are unique across the entire system.
    """

    __tablename__ = "organization_link_keys"
    __table_args__ = (
        UniqueConstraint("link_key", name="uq_organization_link_keys_link_key"),
        UniqueConstraint(
            "organization_id", "form_id", name="uq_organization_link_keys_org_form"
        ),
        Index("idx_organization_link_keys_org_id", "organization_id"),
        Index("idx_organization_link_keys_form_id", "form_id"),
        {"comment": "Stores secure link keys for anonymous organization form access"},
    )

    link_key_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the link key record",
    )

    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Foreign key reference to organization",
    )

    form_id = Column(
        Integer,
        ForeignKey("forms.form_id"),
        nullable=False,
        comment="Foreign key reference to form",
    )

    link_key = Column(
        String(64),
        nullable=False,
        unique=True,
        comment="Secure link key for anonymous form access",
    )

    expiry_date = Column(
        DateTime,
        nullable=True,
        comment=(
            "Optional expiry date for the link key. When not null and in the past, "
            "the link key is considered expired and should not grant access."
        ),
    )

    # Relationships
    organization = relationship(
        "Organization", back_populates="link_keys", lazy="joined"
    )
    form = relationship("Form", back_populates="link_keys", lazy="joined")

    @property
    def form_name(self) -> str:
        return self.form.name if self.form else "Unknown Form"

    @property
    def form_slug(self) -> str:
        return self.form.slug if self.form else "unknown"

    @property
    def form_description(self) -> str:
        return self.form.description if self.form else ""

    def __repr__(self):
        return (
            f"<OrganizationLinkKey("
            f"id={self.link_key_id}, "
            f"org_id={self.organization_id}, "
            f"form_id={self.form_id}, "
            f"form_slug='{self.form_slug}'"
            f")>"
        )
