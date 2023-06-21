from typing import Generic, Any

from pydantic import BaseModel


class EntityResponse(BaseModel):
    status: int
    message: str
    data: Any = {}
    error: dict = {}
    page: int = 1
    total: int = 0
    limit: int = 10
    total_pages: int = 1
    next_page: int = 1
    prev_page: int = 1
    current_page: int = 1

    class Config:
        orm_mode = True
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            set: lambda v: list(v)
        }
        schema_extra = {
            "example": {
                "status": 200,
                "message": "Success",
                "data": [],
                "error": {},
                "page": 1,
                "total": 0,
                "limit": 10,
                "total_pages": 1,
                "next_page": 1,
                "prev_page": 1,
                "current_page": 1
            }
        }
