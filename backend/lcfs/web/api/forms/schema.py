from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class DeclarationExportRequest(BaseModel):
    organization_name: str = Field(..., min_length=1)
    reporting_period:  str = Field(..., min_length=4, max_length=9)
    declaration_type:  Literal["Full", "Partial", "Amended"]
    contact_name:      str = Field(..., min_length=1)
    contact_email:     EmailStr
    fuel_type:         str = Field(..., min_length=1)
    quantity:          float = Field(..., gt=0)
    units:             str = Field(..., min_length=1)
    notes:             Optional[str] = None
    certified:         bool

    model_config = {"str_strip_whitespace": True}


class FormResponse(BaseModel):
    form_id:           int
    name:              str
    slug:              str
    description:       Optional[str] = None
    organization_name: Optional[str] = None
    status:            Literal["loaded"]
    message:           str
