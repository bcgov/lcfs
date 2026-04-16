from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, Enum, Integer, UniqueConstraint, text

from lcfs.db.base import Auditable, BaseModel


class SupplementalReportAccessRole(str, PyEnum):
    """Enumerates which user role may create supplemental reports for a year."""

    BCeID = "BCeID"
    IDIR = "IDIR"


class ReportOpening(BaseModel, Auditable):
    __tablename__ = "report_opening"
    __table_args__ = (
        UniqueConstraint(
            "compliance_year", name="uq_report_opening_compliance_year"
        ),
        {
            "comment": "Stores per-year configuration for compliance reporting availability and permissions.",
        },
    )

    report_opening_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the report opening row",
    )
    compliance_year = Column(
        Integer,
        nullable=False,
        comment="Compliance year that this configuration applies to",
    )
    compliance_reporting_enabled = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        default=True,
        comment="If True, suppliers can create compliance reports for this year",
    )
    early_issuance_enabled = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        default=False,
        comment="Indicates whether early issuance is enabled for this year",
    )
    supplemental_report_role = Column(
        Enum(
            SupplementalReportAccessRole,
            name="supplemental_report_access_role_enum",
        ),
        nullable=False,
        default=SupplementalReportAccessRole.BCeID,
        server_default=text("'BCeID'"),
        comment="Which role (BCeID or IDIR) may create supplemental reports for the year",
    )

    def __repr__(self) -> str:  # pragma: no cover - simple repr
        return (
            f"<ReportOpening(year={self.compliance_year}, "
            f"enabled={self.compliance_reporting_enabled})>"
        )
