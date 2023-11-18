from pydantic import BaseModel

from lcfs.web.api.permission.schema import PermissionSchema


class RoleSchema(BaseModel):
    role_id: int
    name: str
    description: str
    is_government_role: bool
    permissions: list[PermissionSchema]
