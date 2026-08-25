from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class DocumentFolder(BaseModel, Auditable):
    """
    A folder in a per-parent document tree (#4925).

    Folders are a layer beside the document system, not a change to it: the
    document table and the six association tables carry no folder state, and
    dropping this table (with document_folder_item) removes the feature
    completely. parent_type/parent_id are polymorphic on purpose — extending
    folders to another surface is one string in FOLDER_ENABLED_PARENT_TYPES,
    not a migration.
    """

    __tablename__ = "document_folder"
    __table_args__ = (
        Index("ix_document_folder_parent", "parent_type", "parent_id"),
        # Case-insensitive sibling uniqueness. parent_folder_id is NULL at
        # the root, and NULLs never collide in a plain unique index, so the
        # root level coalesces to 0 to get the same guarantee.
        Index(
            "uq_document_folder_sibling_name",
            "parent_type",
            "parent_id",
            text("coalesce(parent_folder_id, 0)"),
            func.lower(text("name")),
            unique=True,
        ),
        {
            "comment": (
                "Folder tree for parent-scoped document organisation; "
                "documents place into folders via document_folder_item."
            )
        },
    )

    folder_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the folder",
    )
    parent_type = Column(
        String(50),
        nullable=False,
        comment="Owning surface, e.g. designatedAction; see FOLDER_ENABLED_PARENT_TYPES",
    )
    parent_id = Column(
        Integer,
        nullable=False,
        comment="Id of the owning record within parent_type",
    )
    parent_folder_id = Column(
        Integer,
        ForeignKey("document_folder.folder_id", ondelete="CASCADE"),
        nullable=True,
        comment="Containing folder; NULL at the root of the tree",
    )
    name = Column(String(255), nullable=False, comment="Folder display name")
    sort_order = Column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="Manual ordering among siblings",
    )
    is_system = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Seeded structure; system folders reject rename, move and delete",
    )

    parent_folder = relationship(
        "DocumentFolder", remote_side=[folder_id], back_populates="child_folders"
    )
    child_folders = relationship(
        "DocumentFolder",
        back_populates="parent_folder",
        cascade="all, delete-orphan",
    )
    items = relationship(
        "DocumentFolderItem",
        back_populates="folder",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<DocumentFolder id={self.folder_id} name={self.name!r}>"
