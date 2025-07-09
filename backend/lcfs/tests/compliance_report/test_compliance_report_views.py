from unittest import mock

import json
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportUpdateSchema,
    ComplianceReportSummaryUpdateSchema,
    ChainedComplianceReportSchema,
)
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException
from fastapi import status


@pytest.fixture
def mock_email_repo():
    return AsyncMock(spec=CHESEmailRepository)


@pytest.fixture
def mock_environment_vars():
    with patch("lcfs.web.api.email.services.settings") as mock_settings:
        mock_settings.ches_auth_url = "http://mock_auth_url"
        mock_settings.ches_email_url = "http://mock_email_url"
        mock_settings.ches_client_id = "mock_client_id"
        mock_settings.ches_client_secret = "mock_client_secret"
        mock_settings.ches_sender_email = "noreply@gov.bc.ca"
        mock_settings.ches_sender_name = "Mock Notification System"
        yield mock_settings


# get_compliance_periods
@pytest.mark.anyio
async def test_get_compliance_periods_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_all_compliance_periods"
    ) as mock_get_all_compliance_periods:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])  # Set a valid role

        # Mock response data
        mock_get_all_compliance_periods.return_value = [
            {
                "compliance_period_id": 1,
                "description": "2024 Compliance Period",
                "effective_date": "2024-01-01T00:00:00",
                "expiration_date": "2024-12-31T23:59:59",
                "display_order": 1,
            },
            {
                "compliance_period_id": 2,
                "description": "2025 Compliance Period",
                "effective_date": "2025-01-01T00:00:00",
                "expiration_date": "2025-12-31T23:59:59",
                "display_order": 2,
            },
        ]

        url = fastapi_app.url_path_for("get_compliance_periods")

        response = await client.get(url)

        assert response.status_code == 200

        expected_response = [
            {
                "compliancePeriodId": 1,
                "description": "2024 Compliance Period",
                "effectiveDate": "2024-01-01T00:00:00",
                "expirationDate": "2024-12-31T23:59:59",
                "displayOrder": 1,
            },
            {
                "compliancePeriodId": 2,
                "description": "2025 Compliance Period",
                "effectiveDate": "2025-01-01T00:00:00",
                "expirationDate": "2025-12-31T23:59:59",
                "displayOrder": 2,
            },
        ]

        assert response.json() == expected_response
        mock_get_all_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_periods_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_all_compliance_periods"
    ) as mock_get_all_compliance_periods:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])  # Set a valid role

        # Simulate an empty list response indicating no compliance periods found
        mock_get_all_compliance_periods.return_value = []

        url = fastapi_app.url_path_for("get_compliance_periods")

        response = await client.get(url)

        assert response.status_code == 200
        assert response.json() == []  # Expected empty list


# get_compliance_reports
@pytest.mark.anyio
async def test_get_compliance_reports_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_list_schema,
    set_mock_user,
    pagination_request_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_reports_paginated"
    ) as mock_get_compliance_reports_paginated:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_get_compliance_reports_paginated.return_value = (
            compliance_report_list_schema
        )

        url = fastapi_app.url_path_for("get_compliance_reports")

        response = await client.post(
            url, json=pagination_request_schema.dict(by_alias=True)
        )

        assert response.status_code == 200
        # Convert Pydantic schema to dict
        expected_response = compliance_report_list_schema.dict(by_alias=True)
        assert (response.json())["pagination"] == expected_response["pagination"]
        assert len(response.json()["reports"]) == len(expected_response["reports"])


@pytest.mark.anyio
async def test_get_compliance_reports_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    pagination_request_schema,
):
    # Set a role that does not have access
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("get_compliance_reports")

    response = await client.post(
        url, json=pagination_request_schema.dict(by_alias=True)
    )

    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_get_compliance_reports_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for("get_compliance_reports")

    # Invalid payload with incorrect data type for `page` and missing `size`
    invalid_payload = {
        "page": "invalid_page",  # Should be an integer
        "filters": [
            {
                "field": "exampleField",
                "filter": "exampleValue",
                "filter_type": "text",
                "type": "equals",
            }
        ],
    }

    response = await client.post(url, json=invalid_payload)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_get_compliance_reports_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    pagination_request_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_reports_paginated"
    ) as mock_get_compliance_reports_paginated:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        # Simulate DataNotFoundException for no reports found
        mock_get_compliance_reports_paginated.side_effect = DataNotFoundException(
            "No compliance reports found"
        )

        url = fastapi_app.url_path_for("get_compliance_reports")

        response = await client.post(
            url, json=pagination_request_schema.dict(by_alias=True)
        )

        assert response.status_code == 404  # Not Found


# get_compliance_report_by_id
@pytest.mark.anyio
async def test_get_compliance_report_by_id_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_report = compliance_report_base_schema()
        mock_chained_schema = ChainedComplianceReportSchema(
            report=mock_report, chain=[], is_newest=True
        )

        mock_get_compliance_report_chain.return_value = mock_chained_schema
        mock_validate_organization_access.return_value = mock_report
        mock_validate_compliance_report_access.return_value = True

        url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id=1)

        response = await client.get(url)

        assert response.status_code == 200

        expected_response = json.loads(
            mock_chained_schema.model_dump_json(by_alias=True)
        )

        assert response.json() == expected_response
        mock_get_compliance_report_chain.assert_called_once_with(1, mock.ANY)
        mock_validate_organization_access.assert_called_once_with(1)
        mock_validate_compliance_report_access.assert_called_once_with(mock_report)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])  # User with the wrong role

    url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id=1)

    response = await client.get(url)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_compliance_report_by_id_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id="invalid")

    response = await client.get(url)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        # Simulate DataNotFoundException for a non-existent report
        mock_get_compliance_report_by_id.side_effect = DataNotFoundException(
            "Report not found"
        )

        url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id=9999)

        response = await client.get(url)

        assert response.status_code == 404  # Not Found


# get_compliance_report_summary
@pytest.mark.anyio
async def test_get_compliance_report_summary_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_summary_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.calculate_compliance_report_summary"
    ) as mock_calculate_compliance_report_summary, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        mock_compliance_report_summary = compliance_report_summary_schema()

        mock_calculate_compliance_report_summary.return_value = (
            mock_compliance_report_summary
        )
        mock_validate_organization_access.return_value = None

        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=1)

        response = await client.get(url)

        assert response.status_code == 200

        expected_response = json.loads(
            mock_compliance_report_summary.json(by_alias=True)
        )

        assert response.json() == expected_response
        mock_calculate_compliance_report_summary.assert_called_once_with(1)
        mock_validate_organization_access.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_compliance_report_summary_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    # Assuming 'abc' is an invalid report_id
    url = fastapi_app.url_path_for("get_compliance_report_summary", report_id="abc")

    response = await client.get(url)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_get_compliance_report_summary_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.calculate_compliance_report_summary"
    ) as mock_calculate_compliance_report_summary:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        # Simulate DataNotFoundException for a non-existent report
        mock_calculate_compliance_report_summary.side_effect = DataNotFoundException(
            "Summary not found"
        )

        url = fastapi_app.url_path_for(
            "get_compliance_report_summary", report_id=9999  # Non-existent report ID
        )

        response = await client.get(url)

        assert response.status_code == 404  # Not Found


# update_compliance_report_summary
@pytest.mark.anyio
async def test_update_compliance_report_summary_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_summary_schema,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.update_compliance_report_summary"
    ) as mock_update_compliance_report_summary, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        mock_compliance_report_summary = compliance_report_summary_schema()
        request_schema = ComplianceReportSummaryUpdateSchema(
            compliance_report_id=1,
            is_locked=False,
            renewable_fuel_target_summary=mock_compliance_report_summary.renewable_fuel_target_summary,
            low_carbon_fuel_target_summary=mock_compliance_report_summary.low_carbon_fuel_target_summary,
            non_compliance_penalty_summary=mock_compliance_report_summary.non_compliance_penalty_summary,
            summary_id=mock_compliance_report_summary.summary_id,
        )
        mock_validate_organization_access.return_value = compliance_report_base_schema()
        mock_update_compliance_report_summary.return_value = (
            mock_compliance_report_summary
        )

        url = fastapi_app.url_path_for("update_compliance_report_summary", report_id=1)

        payload = request_schema.model_dump(by_alias=True)

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(
            mock_compliance_report_summary.json(by_alias=True)
        )

        assert response.json() == expected_response
        mock_update_compliance_report_summary.assert_called_once_with(1, request_schema)
        mock_validate_organization_access.assert_called_once_with(1)


@pytest.mark.anyio
async def test_update_compliance_report_summary_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_summary_schema,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])  # User with the wrong role

    url = fastapi_app.url_path_for("update_compliance_report_summary", report_id=1)
    payload = compliance_report_summary_schema().dict(by_alias=True)

    response = await client.put(url, json=payload)

    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_update_compliance_report_summary_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    url = fastapi_app.url_path_for("update_compliance_report_summary", report_id=1)
    payload = {"invalidField": "invalidValue"}  # Invalid payload structure

    response = await client.put(url, json=payload)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_update_compliance_report_summary_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    compliance_report_summary_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.summary_service.ComplianceReportSummaryService.update_compliance_report_summary"
    ) as mock_update_compliance_report_summary:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        # Simulate DataNotFoundException for a non-existent summary
        mock_update_compliance_report_summary.side_effect = DataNotFoundException(
            "Summary not found"
        )

        url = fastapi_app.url_path_for("update_compliance_report_summary", report_id=1)
        payload = compliance_report_summary_schema().dict(by_alias=True)

        response = await client.put(url, json=payload)

        assert response.status_code == 404  # Not Found


# update_compliance_report
@pytest.mark.anyio
async def test_update_compliance_report_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {"status": "Draft", "supplementalNote": "new supplemental note"}

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )
        mock_validate_organization_access.assert_called_once_with(1)


@pytest.mark.anyio
async def test_update_compliance_report_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("update_compliance_report", report_id=1)

    payload = {"status": "Draft", "supplementalNote": "new supplemental note"}

    response = await client.put(url, json=payload)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_update_compliance_report_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        # Simulate that the report does not exist by raising an exception
        mock_update_compliance_report.side_effect = DataNotFoundException(
            "Compliance report not found"
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report", report_id=0
        )  # Non-existent ID

        payload = {"status": "Draft", "supplementalNote": "new supplemental note"}

        response = await client.put(url, json=payload)

        assert response.status_code == 404
        # assert response.json() == {"detail": "Compliance report not found"}


@pytest.mark.anyio
async def test_update_compliance_report_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for("update_compliance_report", report_id=1)
    payload = {"invalidField": "invalidValue"}  # Invalid payload structure

    response = await client.put(url, json=payload)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_update_compliance_report_draft_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {"status": "Draft", "supplementalNote": "Drafting a new report"}

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )


@pytest.mark.anyio
async def test_update_compliance_report_submitted_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {"status": "Submitted", "supplementalNote": "Submitting the report"}

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )


@pytest.mark.anyio
async def test_update_compliance_report_recommended_by_analyst_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {
            "status": "Recommended by analyst",
            "supplementalNote": "Analyst recommendation",
        }

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )


@pytest.mark.anyio
async def test_update_compliance_report_recommended_by_manager_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {
            "status": "Recommended by manager",
            "supplementalNote": "Manager recommendation",
        }

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )


@pytest.mark.anyio
async def test_update_compliance_report_assessed_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report, patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_compliance_report_chain:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_compliance_report = compliance_report_base_schema()
        mock_validate_organization_access.return_value = None
        mock_update_compliance_report.return_value = mock_compliance_report
        mock_get_compliance_report_chain.return_value = ChainedComplianceReportSchema(
            report=mock_compliance_report, chain=[], is_newest=True
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {"status": "Assessed", "supplementalNote": "Report has been assessed"}

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json()["report"] == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload), mock.ANY
        )


# Analyst Assignment API Tests
@pytest.mark.anyio
async def test_assign_analyst_to_report_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful analyst assignment API endpoint"""
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.assign_analyst_to_report"
    ) as mock_assign_analyst, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_chain, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access:
        
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock responses
        mock_report = MagicMock()
        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_assign_analyst.return_value = None
        
        # Create a proper mock for ChainedComplianceReportSchema
        from lcfs.web.api.compliance_report.schema import (
            ChainedComplianceReportSchema, 
            ComplianceReportBaseSchema,
            ComplianceReportOrganizationSchema,
            ComplianceReportStatusSchema,
            AssignedAnalystSchema
        )
        from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
        
        # Create mock report with assigned analyst
        mock_assigned_analyst = AssignedAnalystSchema(
            user_profile_id=123,
            first_name="Test",
            last_name="Analyst",
            initials="TA"
        )
        
        mock_base_report = ComplianceReportBaseSchema(
            compliance_report_id=1,
            compliance_report_group_uuid="test-uuid",
            version=0,
            compliance_period_id=1,
            compliance_period=CompliancePeriodBaseSchema(
                compliance_period_id=1,
                description="2024"
            ),
            organization_id=1,
            organization=ComplianceReportOrganizationSchema(
                organization_id=1,
                organization_code="TEST",
                name="Test Organization"
            ),
            current_status_id=1,
            current_status=ComplianceReportStatusSchema(
                compliance_report_status_id=1,
                status="Draft"
            ),
            has_supplemental=False,
            summary=None,
            assigned_analyst=mock_assigned_analyst
        )
        
        mock_chained_report = ChainedComplianceReportSchema(
            report=mock_base_report,
            chain=[mock_base_report],
            is_newest=True,
            had_been_assessed=False
        )
        
        mock_get_chain.return_value = mock_chained_report
        
        url = fastapi_app.url_path_for("assign_analyst_to_report", report_id=1)
        payload = {"assignedAnalystId": 123}
        
        response = await client.put(url, json=payload)
        
        assert response.status_code == 200
        mock_assign_analyst.assert_called_once_with(1, 123, mock.ANY)


@pytest.mark.anyio
async def test_assign_analyst_to_report_unassign(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unassigning analyst API endpoint"""
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.assign_analyst_to_report"
    ) as mock_assign_analyst, patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_chain"
    ) as mock_get_chain, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access:
        
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        
        # Mock responses
        mock_report = MagicMock()
        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_assign_analyst.return_value = None
        
        # Create a proper mock for ChainedComplianceReportSchema
        from lcfs.web.api.compliance_report.schema import (
            ChainedComplianceReportSchema, 
            ComplianceReportBaseSchema,
            ComplianceReportOrganizationSchema,
            ComplianceReportStatusSchema
        )
        from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
        
        # For unassign test, analyst should be None
        mock_base_report = ComplianceReportBaseSchema(
            compliance_report_id=1,
            compliance_report_group_uuid="test-uuid",
            version=0,
            compliance_period_id=1,
            compliance_period=CompliancePeriodBaseSchema(
                compliance_period_id=1,
                description="2024"
            ),
            organization_id=1,
            organization=ComplianceReportOrganizationSchema(
                organization_id=1,
                organization_code="TEST",
                name="Test Organization"
            ),
            current_status_id=1,
            current_status=ComplianceReportStatusSchema(
                compliance_report_status_id=1,
                status="Draft"
            ),
            has_supplemental=False,
            summary=None,
            assigned_analyst=None  # No assigned analyst for unassign test
        )
        
        mock_chained_report = ChainedComplianceReportSchema(
            report=mock_base_report,
            chain=[mock_base_report],
            is_newest=True,
            had_been_assessed=False
        )
        
        mock_get_chain.return_value = mock_chained_report
        
        url = fastapi_app.url_path_for("assign_analyst_to_report", report_id=1)
        payload = {"assignedAnalystId": None}
        
        response = await client.put(url, json=payload)
        
        assert response.status_code == 200
        mock_assign_analyst.assert_called_once_with(1, None, mock.ANY)


@pytest.mark.anyio
async def test_assign_analyst_to_report_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test assignment endpoint with unauthorized role"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    
    url = fastapi_app.url_path_for("assign_analyst_to_report", report_id=1)
    payload = {"assignedAnalystId": 123}
    
    response = await client.put(url, json=payload)
    
    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_available_analysts_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test get available analysts API endpoint"""
    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_available_analysts"
    ) as mock_get_analysts:
        
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock response
        mock_analysts = [
            {"userProfileId": 1, "firstName": "John", "lastName": "Doe", "initials": "JD"},
            {"userProfileId": 2, "firstName": "Jane", "lastName": "Smith", "initials": "JS"},
        ]
        mock_get_analysts.return_value = mock_analysts
        
        url = fastapi_app.url_path_for("get_available_analysts")
        
        response = await client.get(url)
        
        assert response.status_code == 200
        assert len(response.json()) == 2
        assert response.json()[0]["firstName"] == "John"
        mock_get_analysts.assert_called_once()


@pytest.mark.anyio
async def test_get_available_analysts_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test get available analysts endpoint with unauthorized role"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    
    url = fastapi_app.url_path_for("get_available_analysts")
    
    response = await client.get(url)
    
    assert response.status_code == 403