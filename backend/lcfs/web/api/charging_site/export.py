import io
from typing import List

from fastapi import Depends
from openpyxl.worksheet.datavalidation import DataValidation
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization, UserProfile
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.core.decorators import service_handler

CS_EXPORT_FILENAME = "ChargingSites"
CS_EXPORT_SHEETNAME = "ChargingSites"
VALIDATION_SHEETNAME = "VALUES"
CS_EXPORT_COLUMNS = [
    SpreadsheetColumn("Site Name", "text"),
    SpreadsheetColumn("Street Address", "text"),
    SpreadsheetColumn("City", "text"),
    SpreadsheetColumn("Postal Code", "text"),
    SpreadsheetColumn("Latitude", "decimal6"),
    SpreadsheetColumn("Longitude", "decimal6"),
    SpreadsheetColumn("Allocating Organization", "text"),
    SpreadsheetColumn("Notes", "text"),
]


class ChargingSiteExporter:
    def __init__(
        self,
        repo: ChargingSiteRepository = Depends(ChargingSiteRepository),
    ) -> None:
        self.repo = repo

    @service_handler
    async def export(
        self,
        organization_id: int,
        user: UserProfile,
        organization: Organization,
        include_data=True,
        charging_site_ids: List[int] = None,
    ) -> StreamingResponse:
        """
        Prepares a list of charging sites in a file that is downloadable
        """
        export_format = "xlsx"

        builder = SpreadsheetBuilder(file_format=export_format)

        validators = await self._create_validators(organization, builder)

        data = []
        if include_data:
            data = await self.load_charging_site_data(charging_site_ids)
        else:
            # Add default row with empty values for user to fill
            default_row = [
                "",  # Site Name
                "",  # Street Address
                "",  # City
                "",  # Postal Code
                "",  # Latitude
                "",  # Longitude
                "",  # Allocating Organization
                "",  # Notes
            ]
            data = [default_row]

        builder.add_sheet(
            sheet_name=CS_EXPORT_SHEETNAME,
            columns=CS_EXPORT_COLUMNS,
            rows=data,
            styles={
                "bold_headers": True,
            },
            validators=validators,
        )
        file_content = builder.build_spreadsheet()

        filename = f"{CS_EXPORT_FILENAME}_template.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def _create_validators(self, organization, builder):
        validators: List[DataValidation] = []

        # Get allocating organization options (from allocation agreements)
        allocating_org_options = await self.repo.get_allocation_agreement_organizations(
            organization.organization_id
        )
        allocating_org_names = [org.name for org in allocating_org_options]

        # Site Name column - helpful prompt
        site_name_validator = DataValidation(
            type="textLength",
            operator="greaterThan",
            formula1=0,
            showInputMessage=True,
            promptTitle="Site Name",
            prompt="Enter a descriptive name for this charging site (e.g., 'Downtown Mall Parking', 'Highway Rest Stop'). Site names must be unique within your organization.",
            allow_blank=False,
        )
        site_name_validator.add("A2:A10000")  # Column A (Site Name)
        validators.append(site_name_validator)

        # Postal code validator (Canadian format A1A 1A1)
        postal_code_validator = DataValidation(
            type="custom",
            formula1='=AND(LEN(D2)=7,OR(CODE(MID(D2,1,1))>=65,CODE(MID(D2,1,1))<=90),ISNUMBER(--MID(D2,2,1)),OR(CODE(MID(D2,3,1))>=65,CODE(MID(D2,3,1))<=90),MID(D2,4,1)=" ",ISNUMBER(--MID(D2,5,1)),OR(CODE(MID(D2,6,1))>=65,CODE(MID(D2,6,1))<=90),ISNUMBER(--MID(D2,7,1)))',
            showErrorMessage=True,
            errorTitle="Invalid Postal Code",
            error="Please enter a valid Canadian postal code in the format 'A1A 1A1'",
        )
        postal_code_validator.add("D2:D10000")  # Column D (Postal Code)
        validators.append(postal_code_validator)

        # Decimal validators for coordinates
        decimal_validator = DataValidation(
            type="decimal",
            showErrorMessage=True,
            error="Please enter a valid decimal.",
        )
        decimal_validator.add("E2:E10000")  # Column E (Latitude)
        decimal_validator.add("F2:F10000")  # Column F (Longitude)
        validators.append(decimal_validator)

        # Create dropdown for allocating organization
        if allocating_org_names:
            range_end = len(allocating_org_names)
            allocating_org_validator = DataValidation(
                type="list",
                formula1=f"'{VALIDATION_SHEETNAME}'!$G$2:$G${range_end + 1}",
                showErrorMessage=False,
                showInputMessage=True,
                promptTitle="Allocating Organization",
                prompt="Allocating organizations tied to your allocation agreements. If an organization isn't listed you must first enter an allocation agreement in your compliance report.",
                allow_blank=True,
            )
            allocating_org_validator.add(
                "G2:G10000"
            )  # Column G (Allocating Organization)
            validators.append(allocating_org_validator)
        else:
            # If no allocation agreements, show informational message
            no_alloc_validator = DataValidation(
                type="textLength",
                operator="greaterThan",
                formula1=0,
                showInputMessage=True,
                promptTitle="Allocating Organization",
                prompt="No allocation agreements found. You must first enter an allocation agreement in your compliance report to use this field.",
                allow_blank=True,
            )
            no_alloc_validator.add("G2:G10000")  # Column G (Allocating Organization)
            validators.append(no_alloc_validator)

        # Create validation sheet data (only for columns with dropdowns)
        data = [
            [],  # Site Name
            [],  # Street Address
            [],  # City
            [],  # Postal Code
            [],  # Latitude
            [],  # Longitude
            allocating_org_names,  # Allocating Organization options (Column G)
            [],  # Notes
        ]

        # Determine the maximum length among all columns
        max_length = max(len(options) for options in data) if data else 0

        # Build rows ensuring each row has an entry for each column
        rows = []
        if max_length > 0:
            rows = [
                [col[i] if i < len(col) else None for col in data]
                for i in range(max_length)
            ]

        builder.add_sheet(
            sheet_name=VALIDATION_SHEETNAME,
            columns=CS_EXPORT_COLUMNS,
            rows=rows,
            styles={"bold_headers": True},
            validators=[],
            position=1,
        )

        return validators

    async def load_charging_site_data(self, charging_site_ids):
        results = await self.repo.get_charging_sites_by_ids(charging_site_ids)
        data = []
        for charging_site in results:
            data.append(
                [
                    charging_site.site_name,
                    charging_site.street_address,
                    charging_site.city,
                    charging_site.postal_code,
                    charging_site.latitude,
                    charging_site.longitude,
                    (
                        charging_site.allocating_organization.name
                        if charging_site.allocating_organization
                        else ""
                    ),
                    charging_site.notes,
                ]
            )
        return data
