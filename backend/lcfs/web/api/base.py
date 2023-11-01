from typing import Any

from pydantic import BaseModel


def row_to_dict(row, schema):
    d = {}
    for field in schema.__fields__.values():
        if isinstance(field.type_, BaseModel):
            d[field.name] = row_to_dict(d[field.name], field.type_)
            continue
        d[field.name] = getattr(row, field.name)
    return d


class EntityResponse(BaseModel):
    status: int
    message: str
    error: dict = {}
    total: int = 0
    limit: int = 1
    offset: int = 0
    total_pages: int = 1
    current_page: int = 1
    data: Any = {}

    class Config:
        from_attributes = True
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            set: lambda v: list(v)
        }
        json_schema_extra = {
            "example": {
                "status": 200,
                "message": "Success",
                "error": {},
                "total": 0,
                "limit": 1,
                "offset": 0,
                "total_pages": 1,
                "current_page": 1,
                "data": []
            }
        }
