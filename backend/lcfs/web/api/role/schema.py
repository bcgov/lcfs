from pydantic import BaseModel


class RoleSchema(BaseModel):
    id: int
    name: str
    description: str
    is_government_role: bool
