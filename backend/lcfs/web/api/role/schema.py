from pydantic import BaseModel


class RoleSchema(BaseModel):
    role_id: int
    name: str
    description: str
    is_government_role: bool
