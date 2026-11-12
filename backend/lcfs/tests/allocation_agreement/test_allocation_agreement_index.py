"""Service and view tests for the IDIR allocation agreements index."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from pydantic import ValidationError

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementIndexItemSchema,
    AllocationAgreementIndexRequestSchema,
    AllocationAgreementIndexResponseSchema,
)
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.base import PaginationResponseSchema


def _row(**overrides):
    values = {
        "allocation_agreement_id": 7,
        "group_uuid": "group-1",
        "version": 0,
        "compliance_report_id": 42,
        "compliance_period": "2024",
        "status": ComplianceReportStatusEnum.Analyst_adjustment,
        "reporting_organization": "Org A",
        "allocation_transaction_type": "Allocated from",
        "transaction_partner": "Org B",
        "postal_address": "1 Main St",
        "transaction_partner_email": None,
        "transaction_partner_phone": None,
        "fuel_type": "Biodiesel",
        "fuel_type_other": None,
        "fuel_category": "Diesel",
        "provision_of_the_act": "Default carbon intensity",
        "fuel_code": None,
        "ci_of_fuel": 50.5,
        "quantity": 100,
        "q1_quantity": None,
        "q2_quantity": None,
        "q3_quantity": None,
        "q4_quantity": None,
        "total_quantity": None,
        "units": "L",
        "total_count": 61,
    }
    values.update(overrides)
    return SimpleNamespace(_mapping=values, **values)


@pytest.fixture
def index_service():
    repo = MagicMock()
    repo.get_allocation_agreements_index = AsyncMock(return_value=([_row()], 61))
    return (
        AllocationAgreementServices(
            repo=repo, fuel_repo=MagicMock(), compliance_report_repo=MagicMock()
        ),
        repo,
    )


@pytest.mark.anyio
async def test_service_maps_rows_and_pagination(index_service):
    service, repo = index_service
    request = AllocationAgreementIndexRequestSchema(
        page=2, size=25, filters=[], sort_orders=[], organization_id=5
    )

    result = await service.get_allocation_agreements_index(request)

    pagination, organization_id = repo.get_allocation_agreements_index.call_args.args
    assert (pagination.page, pagination.size) == (2, 25)
    assert organization_id == 5

    assert result.pagination.total == 61
    assert result.pagination.total_pages == 3
    item = result.allocation_agreements[0]
    # Status is rendered as the display value, not the enum member name
    assert item.status == "Analyst adjustment"
    assert item.compliance_period == "2024"
    assert item.reporting_organization == "Org A"
    assert item.transaction_partner == "Org B"
    assert "total_count" not in item.model_dump()


@pytest.mark.anyio
async def test_service_passes_no_organization_when_filter_cleared(index_service):
    service, repo = index_service

    await service.get_allocation_agreements_index(
        AllocationAgreementIndexRequestSchema(page=1, size=25)
    )

    assert repo.get_allocation_agreements_index.call_args.args[1] is None


def test_request_schema_accepts_grid_payload():
    request = AllocationAgreementIndexRequestSchema.model_validate(
        {
            "page": 1,
            "size": 25,
            "sortOrders": [{"field": "compliancePeriod", "direction": "desc"}],
            "filters": [
                {
                    "field": "reportingOrganization",
                    "filterType": "text",
                    "type": "contains",
                    "filter": "abc",
                }
            ],
            "organizationId": 9,
        }
    )

    assert request.organization_id == 9
    # camelCase grid field names are normalised to the repo's snake_case keys
    assert request.sort_orders[0].field == "compliance_period"
    assert request.filters[0].field == "reporting_organization"


@pytest.mark.parametrize(
    "payload", [{"page": 0}, {"size": 0}, {"size": 100000}, {"size": -5}]
)
def test_request_schema_rejects_out_of_range_paging(payload):
    with pytest.raises(ValidationError):
        AllocationAgreementIndexRequestSchema.model_validate(payload)


@pytest.mark.anyio
async def test_index_view_returns_camel_case_payload(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    service = MagicMock(spec=AllocationAgreementServices)
    service.get_allocation_agreements_index = AsyncMock(
        return_value=AllocationAgreementIndexResponseSchema(
            allocation_agreements=[
                AllocationAgreementIndexItemSchema.model_validate(
                    {**_row()._mapping, "status": "Assessed"}
                )
            ],
            pagination=PaginationResponseSchema(
                total=1, page=1, size=25, total_pages=1
            ),
        )
    )
    fastapi_app.dependency_overrides[AllocationAgreementServices] = lambda: service

    url = fastapi_app.url_path_for("get_allocation_agreements_index")
    response = await client.post(url, json={"page": 1, "size": 25, "organizationId": 3})

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] == 1
    row = body["allocationAgreements"][0]
    assert row["status"] == "Assessed"
    assert row["compliancePeriod"] == "2024"
    assert row["reportingOrganization"] == "Org A"
    assert row["complianceReportId"] == 42
    sent = service.get_allocation_agreements_index.call_args.args[0]
    assert sent.organization_id == 3
    assert sent.size == 25


@pytest.mark.anyio
async def test_index_view_is_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    service = MagicMock(spec=AllocationAgreementServices)
    service.get_allocation_agreements_index = AsyncMock()
    fastapi_app.dependency_overrides[AllocationAgreementServices] = lambda: service

    url = fastapi_app.url_path_for("get_allocation_agreements_index")
    response = await client.post(url, json={"page": 1, "size": 25})

    assert response.status_code == 403
    service.get_allocation_agreements_index.assert_not_called()
