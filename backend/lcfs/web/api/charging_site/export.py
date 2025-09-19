import io
from typing import List

from fastapi import Depends
from openpyxl.worksheet.datavalidation import DataValidation
from starlette.responses import StreamingResponse
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models import Organization, UserProfile
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.core.decorators import service_handler

CS_EXPORT_FILENAME = "ChargingSites"
CS_EXPORT_SHEETNAME = "ChargingSites"
VALIDATION_SHEETNAME = "VALUES"
CS_EXPORT_COLUMNS = [
    SpreadsheetColumn("Organization", "text"),
    SpreadsheetColumn("Site Code", "text"),
    SpreadsheetColumn("Site Name", "text"),
    SpreadsheetColumn("Street Address", "text"),
    SpreadsheetColumn("City", "text"),
    SpreadsheetColumn("Postal Code", "text"),
    SpreadsheetColumn("Latitude", "decimal6"),
    SpreadsheetColumn("Longitude", "decimal6"),
    SpreadsheetColumn("Intended Users", "text"),
    SpreadsheetColumn("Status", "text"),
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
    ) -> StreamingResponse:
        """
        Prepares a list of charging sites in a file that is downloadable
        """
        export_format = "xlsx"

        builder = SpreadsheetBuilder(file_format=export_format)

        validators = await self._create_validators(organization, builder)

        data = []
        if include_data:
            data = await self.load_charging_site_data(organization_id)

        builder.add_sheet(
            sheet_name=CS_EXPORT_SHEETNAME,
            columns=CS_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
            validators=validators,
        )
        file_content = builder.build_spreadsheet()

        filename = f"{CS_EXPORT_FILENAME}_{organization.name}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def _create_validators(self, organization, builder):
        validators: List[DataValidation] = []
        table_options = await self.repo.get_charging_site_options(organization)

        # Organization validator
        org_options = [organization.name]
        org_validator = DataValidation(
            type="list",
            formula1="=VALUES!$A$2:$A$10",
        )
        org_validator.add("A2:A10000")
        validators.append(org_validator)

        # Status validator
        status_options = [obj.status for obj in table_options[0]]
        status_validator = DataValidation(
            type="list",
            formula1="=VALUES!$J$2:$J$10",
            error="Please select a valid option from the list",
            showDropDown=False,
            showErrorMessage=True,
        )
        status_validator.add("J2:J10000")
        validators.append(status_validator)

        # Intended users validator
        intended_user_options = [obj.type_name for obj in table_options[1]]
        intended_user_validator = DataValidation(
            type="list",
            formula1="=VALUES!$I$2:$I$10",
            showDropDown=False,
        )
        intended_user_validator.add("I2:I10000")
        validators.append(intended_user_validator)

        # Decimal validators for coordinates
        decimal_validator = DataValidation(
            type="decimal",
            showErrorMessage=True,
            error="Please enter a valid decimal.",
        )
        decimal_validator.add("G2:G10000")  # Latitude
        decimal_validator.add("H2:H10000")  # Longitude
        validators.append(decimal_validator)

        # Postal code validator (Canadian format A1A 1A1)
        postal_code_validator = DataValidation(
            type="custom",
            formula1='=AND(LEN(F2)=7,OR(CODE(MID(F2,1,1))>=65,CODE(MID(F2,1,1))<=90),ISNUMBER(--MID(F2,2,1)),OR(CODE(MID(F2,3,1))>=65,CODE(MID(F2,3,1))<=90),MID(F2,4,1)=" ",ISNUMBER(--MID(F2,5,1)),OR(CODE(MID(F2,6,1))>=65,CODE(MID(F2,6,1))<=90),ISNUMBER(--MID(F2,7,1)))',
            showErrorMessage=True,
            errorTitle="Invalid Postal Code",
            error="Please enter a valid Canadian postal code in the format 'A1A 1A1'",
        )
        postal_code_validator.add("F2:F10000")
        validators.append(postal_code_validator)

        # Create validation sheet data
        data = [
            org_options,
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            intended_user_options,
            status_options,
            [],
        ]

        # Determine the maximum length among all columns
        max_length = max(len(options) for options in data)

        # Build rows ensuring each row has an entry for each column
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

    async def load_charging_site_data(self, organization_id):
        results = await self.repo.get_all_charging_sites_by_organization_id(
            organization_id
        )
        data = []
        for charging_site in results:
            data.append(
                [
                    charging_site.organization.name if charging_site.organization else "",
                    # charging_site.site_code,
                    charging_site.site_name,
                    charging_site.street_address,
                    charging_site.city,
                    charging_site.postal_code,
                    charging_site.latitude,
                    charging_site.longitude,
                    ", ".join(
                        user.type_name for user in charging_site.intended_users
                    ),
                    charging_site.status.status if charging_site.status else "",
                    charging_site.notes,
                ]
            )
        return data