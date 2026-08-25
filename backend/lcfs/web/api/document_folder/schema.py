from datetime import datetime
from typing import List, Optional

from lcfs.web.api.base import BaseSchema


class FolderDocumentSchema(BaseSchema):
    """A document row inside the tree.

    Deliberately its own schema rather than FileResponseSchema: the shared
    contract stays untouched by the folder layer.
    """

    document_id: int
    file_name: str
    file_size: int
    create_date: Optional[datetime] = None
    create_user: Optional[str] = None


class FolderNodeSchema(BaseSchema):
    folder_id: int
    name: str
    parent_folder_id: Optional[int] = None
    sort_order: int = 0
    is_system: bool = False
    document_count: int = 0
    documents: List[FolderDocumentSchema] = []
    children: List["FolderNodeSchema"] = []


class DocumentFolderTreeSchema(BaseSchema):
    folders: List[FolderNodeSchema] = []
    # Documents of the parent with no placement row.
    root_documents: List[FolderDocumentSchema] = []


class FolderCreateSchema(BaseSchema):
    name: str
    parent_folder_id: Optional[int] = None


class FolderUpdateSchema(BaseSchema):
    name: Optional[str] = None
    parent_folder_id: Optional[int] = None
    sort_order: Optional[int] = None
    # Distinguishes "move to root" (explicit null) from "leave in place"
    # (field absent); pydantic drops that difference otherwise.
    move_to_root: bool = False


class FolderItemsMoveSchema(BaseSchema):
    document_ids: List[int]
    # None places the documents at the root (removes their placement rows).
    folder_id: Optional[int] = None


class FolderSchema(BaseSchema):
    folder_id: int
    parent_type: str
    parent_id: int
    parent_folder_id: Optional[int] = None
    name: str
    sort_order: int = 0
    is_system: bool = False

    class Config:
        from_attributes = True
