from pydantic import BaseModel


class PermissionSchema(BaseModel):

    """
    DTO for permissions
    """
    permission_id:  int
    code: str
    name: str
    description: str