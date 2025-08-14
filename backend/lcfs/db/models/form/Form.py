from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    Index,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel


class Form(BaseModel):
    """
    Model for storing basic form definitions.
    """

    __tablename__ = "forms"
    __table_args__ = (
        Index("idx_forms_slug", "slug"),
        {"comment": "Stores form definitions and configurations"},
    )

    form_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the form",
    )

    name = Column(String(100), nullable=False, comment="Name of the form")

    slug = Column(
        String(50),
        nullable=False,
        unique=True,
        comment="URL-friendly identifier for the form",
    )

    description = Column(
        Text, nullable=True, comment="Detailed description of the form's purpose"
    )

    allows_anonymous = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Whether the form allows anonymous access via link key",
    )

    # Relationships
    link_keys = relationship(
        "OrganizationLinkKey", back_populates="form", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return (
            f"<Form("
            f"id={self.form_id}, "
            f"name='{self.name}', "
            f"slug='{self.slug}'"
            f")>"
        )
