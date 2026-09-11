from sqlalchemy import Column, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class DocumentFolderItem(BaseModel, Auditable):
    """
    Placement of a document inside a folder (#4925).

    A document with no row here sits at the root of its parent's tree, so
    pre-existing documents need no backfill. The document FK cascades so
    the existing delete path — which knows nothing about folders — can
    never leave a placement row behind.
    """

    __tablename__ = "document_folder_item"
    __table_args__ = (
        Index("ix_document_folder_item_folder_id", "folder_id"),
        {"comment": "Places a document in a document_folder; absence means root."},
    )

    document_id = Column(
        Integer,
        ForeignKey("document.document_id", ondelete="CASCADE"),
        primary_key=True,
        comment="The placed document; one folder per document",
    )
    folder_id = Column(
        Integer,
        ForeignKey("document_folder.folder_id", ondelete="CASCADE"),
        nullable=False,
        comment="The containing folder",
    )

    folder = relationship("DocumentFolder", back_populates="items")
