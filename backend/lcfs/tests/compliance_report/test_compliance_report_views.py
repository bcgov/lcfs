import warnings
import json
from datetime import datetime
import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport


@pytest.mark.anyio
async def test_get_compliance_periods_for_idir_users(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_compliance_periods")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content


@pytest.mark.anyio
async def test_get_compliance_periods_for_bceid_users(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_compliance_periods")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content


@pytest.mark.anyio
async def test_get_fse_options(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fse_options")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content


@pytest.mark.anyio
async def test_create_compliance_report_draft(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    payload = {"compliancePeriod": "2024", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content


@pytest.mark.anyio
async def test_get_compliance_report_by_id_for_bceid_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    
    set_mock_user_roles(fastapi_app, ["Supplier"])
    payload = {"compliancePeriod": "2023", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content

    compliance_report_id = json.loads(response.content.decode("utf-8"))[
        "complianceReportId"
    ]
    # test to get the the report back after creating
    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id", organization_id=1, report_id=compliance_report_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert response.content

## Tests for getting paginated compliance reports list
@pytest.mark.anyio
async def test_get_reports_paginated_for_org_successful(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    # Load a sample record to retrieve the reports list.
    set_mock_user_roles(fastapi_app, ["Supplier"])
    payload = {"compliancePeriod": "2022", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content
    # retrieve the list of reports
    url = fastapi_app.url_path_for("get_compliance_reports", organization_id=1)
    request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK

    # check if pagination is working as expected
    content = json.loads(response.content.decode("utf-8"))
    assert content["pagination"]["page"] == 1

@pytest.mark.anyio
async def test_get_compliance_report_summary_line_12(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    transfer_out1 = Transfer(
        from_organization_id=1, # LCFS Org 1
        to_organization_id=2, # LCFS Org 2
        agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_out2 = Transfer(
        from_organization_id=1, # LCFS Org 1
        to_organization_id=2, # LCFS Org 2
        agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_out3 = Transfer(
        from_organization_id=2, # LCFS Org 2
        to_organization_id=1, # LCFS Org 1
        agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_out4 = Transfer(
        from_organization_id=1, # LCFS Org 1
        to_organization_id=2, # LCFS Org 2
        agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_out5 = Transfer(
        from_organization_id=1, # LCFS Org 1
        to_organization_id=2, # LCFS Org 2
        agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=5, # Recommended
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )

    await add_models([
        compliance_report, transfer_out1, transfer_out2, transfer_out3, transfer_out4, transfer_out5
    ])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK

    content = json.loads(response.content.decode("utf-8"))
    assert "lowCarbonFuelTargetSummary" in content
    low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
    assert any(row['line'] == '12' and row['value'] == 200 for row in low_carbon_fuel_target_summary)


@pytest.mark.anyio
async def test_get_compliance_report_summary_line_13(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    transfer_in1 = Transfer(
        from_organization_id=2, # LCFS Org 2
        to_organization_id=1, # LCFS Org 1
        agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_in2 = Transfer(
        from_organization_id=2, # LCFS Org 2
        to_organization_id=1, # LCFS Org 1
        agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_in3 = Transfer(
        from_organization_id=1, # LCFS Org 1
        to_organization_id=2, # LCFS Org 2
        agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_in4 = Transfer(
        from_organization_id=2, # LCFS Org 2
        to_organization_id=1, # LCFS Org 1
        agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=6, # Recorded
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )
    transfer_in5 = Transfer(
        from_organization_id=2, # LCFS Org 2
        to_organization_id=1, # LCFS Org 1
        agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1, # A
        current_status_id=5, # Recommended
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )

    await add_models([
        compliance_report, transfer_in1, transfer_in2, transfer_in3, transfer_in4, transfer_in5
    ])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK

    content = json.loads(response.content.decode("utf-8"))
    assert "lowCarbonFuelTargetSummary" in content
    low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
    assert any(row['line'] == '13' and row['value'] == 200 for row in low_carbon_fuel_target_summary)


@pytest.mark.anyio
async def test_get_compliance_report_summary_line_14(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    issued_units1 = InitiativeAgreement(
        compliance_units=75,
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
        gov_comment="Issued units 1",
        to_organization_id=1, # LCFS Org 1
        current_status_id=3 # Approved
    )
    issued_units2 = InitiativeAgreement(
        compliance_units=25,
        transaction_effective_date=datetime.strptime("2024-02-01", "%Y-%m-%d").date(),
        gov_comment="Issued units 2",
        to_organization_id=1, # LCFS Org 1
        current_status_id=3 # Approved
    )
    issued_units3 = InitiativeAgreement(
        compliance_units=25,
        transaction_effective_date=datetime.strptime("2024-02-01", "%Y-%m-%d").date(),
        gov_comment="Issued units 2",
        to_organization_id=2, # LCFS Org 2
        current_status_id=3 # Approved
    )
    issued_units4 = InitiativeAgreement(
        compliance_units=25,
        transaction_effective_date=datetime.strptime("2023-02-01", "%Y-%m-%d").date(),
        gov_comment="Issued units 2",
        to_organization_id=2, # LCFS Org 2
        current_status_id=3 # Approved
    )
    issued_units5 = InitiativeAgreement(
        compliance_units=25,
        transaction_effective_date=datetime.strptime("2023-02-01", "%Y-%m-%d").date(),
        gov_comment="Issued units 2",
        to_organization_id=2, # LCFS Org 2
        current_status_id=1 # Draft
    )

    await add_models([compliance_report, issued_units1, issued_units2, issued_units3, issued_units4, issued_units5])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    content = json.loads(response.content.decode("utf-8"))
    assert "lowCarbonFuelTargetSummary" in content
    low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
    assert any(row['line'] == '14' and row['value'] == 100 for row in low_carbon_fuel_target_summary)
