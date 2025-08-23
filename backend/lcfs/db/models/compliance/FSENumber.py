from lcfs.db.base import BaseModel
from sqlalchemy import Column, Integer, PrimaryKeyConstraint, text

# SUGGESTION: Consider removing this table as it is no longer necessary to track the latest FSE number for a charging site.
# We are now using versioning for FSE, which retains the latest ID generated even if a record is deleted.


class FSENumber(BaseModel):
    """
    Model for tracking the highest sequence numbers for auto-generating
    FSE numbers by charging site.
    """

    __tablename__ = "fse_number"
    __table_args__ = (
        PrimaryKeyConstraint("charging_site_id"),
        {
            "comment": "Tracks the highest sequence numbers for FSE number generation by charging site."
        },
    )

    charging_site_id = Column(
        Integer,
        nullable=False,
        comment="The charging site ID for the FSE sequence.",
    )

    current_sequence_number = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        comment="Current sequence number used for FSE number generation.",
    )

    def __repr__(self):
        return (
            f"<FSENumber("
            f"site_id={self.charging_site_id}, "
            f"seq={self.current_sequence_number}"
            f")>"
        )
