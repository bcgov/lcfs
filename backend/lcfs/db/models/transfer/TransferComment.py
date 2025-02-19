import enum

from sqlalchemy import Column, Integer, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class TransferCommentSourceEnum(enum.Enum):
    FROM_ORG = "FROM_ORG"
    TO_ORG = "TO_ORG"
    GOVERNMENT = "GOVERNMENT"


class TransferComment(BaseModel, Auditable):
    __tablename__ = "transfer_comment"
    __table_args__ = {
        "comment": "Transfer comments made by organizations or government."
    }

    transfer_comment_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the transfer comment.",
    )
    transfer_id = Column(
        Integer,
        ForeignKey("transfer.transfer_id"),
        nullable=False,
        comment="Foreign key to the transfer table.",
    )
    comment = Column(Text, nullable=True, comment="Text content of the comment.")
    comment_source = Column(
        Enum(
            TransferCommentSourceEnum,
            name="transfer_comment_source_enum",
            create_type=False,
        ),
        nullable=False,
        comment="Defines who made the comment (FROM_ORG, TO_ORG, or GOVERNMENT).",
    )

    # Relationship back to the Transfer
    transfer = relationship("Transfer", back_populates="transfer_comments")
    user_profile = relationship(
        "UserProfile",
        primaryjoin="foreign(TransferComment.create_user) == remote(UserProfile.keycloak_username)",
        viewonly=True,
        uselist=False,
    )

    @property
    def created_by(self) -> str:
        """
        Returns the full name of the user who made the comment.
        """
        if self.user_profile and (
            self.user_profile.first_name or self.user_profile.last_name
        ):
            return f"{self.user_profile.first_name or ''} {self.user_profile.last_name or ''}".strip()
        return self.create_user or ""

    @property
    def created_by_org(self) -> str:
        """
        Returns the name of the organization the user belongs to.
        """
        if self.user_profile and self.user_profile.organization:
            return self.user_profile.organization.name

        # If no org, assume government user
        return "Government of British Columbia"
