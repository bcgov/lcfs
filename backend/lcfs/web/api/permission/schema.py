from pydantic import BaseModel


class PermissionSchema(BaseModel):

    """
    DTO for permissions
    """
    id:  int
    code: str
    name: str
    description: str