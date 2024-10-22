import pytest
import json
from unittest.mock import patch
from lcfs.db.models.user.Role import RoleEnum
from httpx import AsyncClient
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder

from lcfs.web.api.fuel_export.schema import (
    FuelExportSchema,
    FuelExportCreateSchema,
    FuelTypeOptionsResponse,
    CommonPaginatedReportRequestSchema,
    FuelCategoryResponseSchema,
    FuelTypeSchema,
    ProvisionOfTheActSchema,
    FuelTypeSchema,
    FuelExportsSchema,
    FuelTypeOptionsResponse,
)


# get_fuel_export_table_options
@pytest.mark.anyio
async def test_get_fuel_export_table_options_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_export_options"
    ) as mock_get_fuel_export_options:

        mock_fuel_export_options = FuelTypeOptionsResponse(fuel_types=[])

        mock_get_fuel_export_options.return_value = mock_fuel_export_options

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        url = fastapi_app.url_path_for("get_fuel_export_table_options")

        response = await client.get(url, params={"compliancePeriod": "2024"})

        assert response.status_code == 200

        expected_response = json.loads(mock_fuel_export_options.json(by_alias=True))

        assert response.json() == expected_response


# get_fuel_exports
@pytest.mark.anyio
async def test_get_fuel_exports_invalid_payload(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("get_fuel_exports")

    payload = {}

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_exports_paginated"
    ) as mock_get_fuel_exports_paginated:

        mock_get_fuel_exports_paginated.return_value = FuelExportsSchema(
            fuel_exports=[]
        )

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        url = fastapi_app.url_path_for("get_fuel_exports")

        payload = CommonPaginatedReportRequestSchema(
            compliance_report_id=1, page=1, size=1, sort_orders=[], filters=[]
        ).dict()

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200


@pytest.mark.anyio
async def test_get_fuel_exports_list_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_export_list"
    ) as mock_get_fuel_export_list:

        mock_get_fuel_export_list.return_value = FuelExportsSchema(fuel_exports=[])

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        url = fastapi_app.url_path_for("get_fuel_exports")

        payload = CommonPaginatedReportRequestSchema(compliance_report_id=1).dict()

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200


# save_fuel_export_row
@pytest.mark.anyio
async def test_save_fuel_export_row_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):

    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("save_fuel_export_row")

    payload = {
        "compliance_report_id": 1,
        "fuel_type": "",
        "fuel_type_id": 1,
        "fuel_category": "",
        "fuel_category_id": 1,
        "provision_of_the_act": "",
        "provision_of_the_act_id": 1,
        "quantity": 1,
        "units": "",
        "export_date": "2024-01-01",
    }

    response = await client.post(
        url,
        json=payload,
    )
    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_save_fuel_export_row_invalid_payload(
    client: AsyncClient, fastapi_app: FastAPI
):

    url = fastapi_app.url_path_for("save_fuel_export_row")

    payload = {}

    response = await client.post(
        url,
        json=payload,
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_save_fuel_export_row_delete_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.delete_fuel_export"
    ) as mock_delete_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

        mock_validate_organization_access.return_value = None
        mock_delete_fuel_export.return_value = None

        url = fastapi_app.url_path_for("save_fuel_export_row")

        payload = jsonable_encoder(
            FuelExportCreateSchema(
                compliance_report_id=1,
                fuel_type="",
                fuel_type_id=1,
                fuel_category="",
                fuel_category_id=1,
                provision_of_the_act="",
                provision_of_the_act_id=1,
                quantity=1,
                units="",
                export_date="2024-01-01",
                deleted=True,
            )
        )

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 201
        assert response.json() == {
            "success": True,
            "message": "fuel export row deleted successfully",
        }


@pytest.mark.anyio
async def test_save_fuel_export_row_update_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.update_fuel_export"
    ) as mock_update_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

        mock_fuel_exports = FuelExportSchema(
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=FuelTypeSchema(
                fuel_type_id=1, fuel_type="", units="L", default_carbon_intensity=1
            ),
            quantity=1,
            units="L",
            export_date="2024-01-01",
            fuel_category_id=1,
            fuel_category=FuelCategoryResponseSchema(category="Gasoline"),
        )

        mock_validate_organization_access.return_value = None
        mock_update_fuel_export.return_value = mock_fuel_exports

        url = fastapi_app.url_path_for("save_fuel_export_row")

        payload = jsonable_encoder(
            FuelExportCreateSchema(
                fuel_export_id=1,
                compliance_report_id=1,
                fuel_type=FuelTypeSchema(
                    fuel_type_id=1, fuel_type="", units="L", default_carbon_intensity=1
                ),
                fuel_type_id=1,
                fuel_category=FuelCategoryResponseSchema(category="Gasoline"),
                fuel_category_id=1,
                provision_of_the_act=ProvisionOfTheActSchema(
                    provision_of_the_act_id=1,
                    name="Prescribed carbon intensity - section 19 (a)",
                ),
                provision_of_the_act_id=1,
                quantity=1,
                units="L",
                export_date="2024-01-01",
                deleted=False,
            )
        )

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 201

        expected_response = json.loads(mock_fuel_exports.json(by_alias=True))

        assert response.json() == expected_response


@pytest.mark.anyio
async def test_save_fuel_export_row_create_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.create_fuel_export"
    ) as mock_create_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

        mock_fuel_exports = FuelExportSchema(
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=FuelTypeSchema(
                fuel_type_id=1, fuel_type="", units="L", default_carbon_intensity=1
            ),
            quantity=1,
            units="L",
            export_date="2024-01-01",
            fuel_category_id=1,
            fuel_category=FuelCategoryResponseSchema(category="Gasoline"),
        )

        mock_validate_organization_access.return_value = None
        mock_create_fuel_export.return_value = mock_fuel_exports

        url = fastapi_app.url_path_for("save_fuel_export_row")

        payload = jsonable_encoder(
            FuelExportCreateSchema(
                compliance_report_id=1,
                fuel_type=FuelTypeSchema(
                    fuel_type_id=1, fuel_type="", units="L", default_carbon_intensity=1
                ),
                fuel_type_id=1,
                fuel_category=FuelCategoryResponseSchema(category="Gasoline"),
                fuel_category_id=1,
                provision_of_the_act=ProvisionOfTheActSchema(
                    provision_of_the_act_id=1,
                    name="Prescribed carbon intensity - section 19 (a)",
                ),
                provision_of_the_act_id=1,
                quantity=1,
                units="L",
                export_date="2024-01-01",
                deleted=False,
            )
        )

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 201

        expected_response = json.loads(mock_fuel_exports.json(by_alias=True))

        assert response.json() == expected_response
