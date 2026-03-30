"""Maps form slugs to their schemas and exporters. Add new forms here."""

from dataclasses import dataclass
from typing import Type

from pydantic import BaseModel

from lcfs.web.api.forms.export import (
    FuelSupplierDeclarationDocxExporter,
    FuelSupplierDeclarationPdfExporter,
)
from lcfs.web.api.forms.schema import DeclarationExportRequest


@dataclass(frozen=True)
class FormHandler:
    """Schema and exporters for a single form type."""

    schema: Type[BaseModel]
    pdf_exporter: Type
    docx_exporter: Type


FORM_REGISTRY: dict[str, FormHandler] = {
    "fuel-supplier-declaration": FormHandler(
        schema=DeclarationExportRequest,
        pdf_exporter=FuelSupplierDeclarationPdfExporter,
        docx_exporter=FuelSupplierDeclarationDocxExporter,
    ),
    # "exemption-request": FormHandler(
    #     schema=ExemptionRequestExportRequest,
    #     pdf_exporter=ExemptionRequestPdfExporter,
    #     docx_exporter=ExemptionRequestDocxExporter,
    # ),
    # "fuel-code-application": FormHandler(
    #     schema=FuelCodeApplicationExportRequest,
    #     pdf_exporter=FuelCodeApplicationPdfExporter,
    #     docx_exporter=FuelCodeApplicationDocxExporter,
    # ),
    # "ci-application": FormHandler(
    #     schema=CiApplicationExportRequest,
    #     pdf_exporter=CiApplicationPdfExporter,
    #     docx_exporter=CiApplicationDocxExporter,
    # ),
}
