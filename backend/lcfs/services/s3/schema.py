from typing import Optional, List, Union
from datetime import datetime, date
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema

from lcfs.web.api.base import BaseSchema, FilterModel, SortOrder
from lcfs.web.api.base import PaginationResponseSchema
from pydantic import Field, Extra

class FileResponseSchema(BaseSchema):
    document_id: int
    file_name: str
    file_size: int

class UrlResponseSchema(BaseSchema):
    url: str
