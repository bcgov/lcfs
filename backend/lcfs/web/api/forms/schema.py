from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class DeclarationExportRequest(BaseModel):
    organization_name: str = Field(..., min_length=1, max_length=500)
    reporting_period:  str = Field(..., min_length=4, max_length=9)
    declaration_type:  Literal["Full", "Partial", "Amended"]
    contact_name:      str = Field(..., min_length=1, max_length=200)
    contact_email:     EmailStr = Field(..., max_length=254)
    fuel_type:         str = Field(..., min_length=1, max_length=200)
    quantity:          float = Field(..., gt=0, lt=1e15, allow_inf_nan=False)
    units:             str = Field(..., min_length=1, max_length=50)
    notes:             Optional[str] = Field(default=None, max_length=2000)
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
