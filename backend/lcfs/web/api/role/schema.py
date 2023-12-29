from pydantic import BaseModel


class RoleSchema(BaseModel):
    role_id: int
    name: str
    description: str
    display_order: int
    is_government_role: bool

    class Config:
        from_attributes = True
