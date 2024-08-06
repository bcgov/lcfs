import warnings
import json
from datetime import datetime
import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.compliance.AllocationTransactionType import AllocationTransactionType


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
async def test_get_compliance_report_summary_line_1(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_report_id=1,
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    expected_use_type = ExpectedUseType(
        expected_use_type_id=1,
        name="Heating Oil",
        description="Fuel used for heating purposes"
    )

    fuel_supply1 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=16, # Fossil-derived diesel
        provision_of_the_act_id = 1
    )

    fuel_supply2 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    fuel_supply3 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        provision_of_the_act_id = 1
    )

    fuel_supply4 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    fuel_supply5 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=18, # Fossil-derived jet fuel
        provision_of_the_act_id = 1
    )

    other_uses1 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses2 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses3 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=2, # CNG
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses4 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=4, # Ethanol
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses5 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=9, # Other diesel fuel
        units="L",
        expected_use_id=1, # Heating oil
    )

    await add_models([
        compliance_report, expected_use_type,
        fuel_supply1, fuel_supply2, fuel_supply3, fuel_supply4, fuel_supply5,
        other_uses1, other_uses2, other_uses3, other_uses4, other_uses5
    ])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    content = json.loads(response.content.decode("utf-8"))
    assert "renewableFuelTargetSummary" in content

    renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
    assert any(row['line'] == '1' and row['gasoline'] == 400 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '1' and row['diesel'] == 200 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '1' and row['jetFuel'] == 200 for row in renewable_fuel_target_summary)


@pytest.mark.anyio
async def test_get_compliance_report_summary_line_2(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_report_id=1,
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    expected_use_type = ExpectedUseType(
        expected_use_type_id=1,
        name="Heating Oil",
        description="Fuel used for heating purposes"
    )

    fuel_code = FuelCode(
        fuel_code_id=1,
        fuel_status_id=1,
        prefix_id=1,
        fuel_code="100.0",
        company="Company 1",
        contact_name="John Doe",
        contact_email="john.doe@lcfs.com",
        carbon_intensity=123,
        edrms="edrms",
        last_updated=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        application_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        fuel_type_id=1,
        feedstock='feedstock',
        feedstock_location="123 main street",
        feedstock_misc="misc data",
        fuel_production_facility_city="Vancouver",
        fuel_production_facility_province_state="British Columbia",
        fuel_production_facility_country="Canada",
        former_company="ABC Company",
        notes="notes",
    )

    allocation_transaction_type = AllocationTransactionType(
        allocation_transaction_type_id=1,
        type="Allocation",
        description="Allocation"
    )

    fuel_supply1 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        provision_of_the_act_id = 1
    )

    fuel_supply2 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    fuel_supply3 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=2, # CNG
        provision_of_the_act_id = 1
    )

    fuel_supply4 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=2, # CNG
        provision_of_the_act_id = 1
    )

    fuel_supply5 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=18, # Fossil-derived jet fuel
        provision_of_the_act_id = 1
    )

    other_uses1 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses2 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=2, # CNG
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses3 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=4, # Ethanol
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses4 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=4, # Ethanol
        units="L",
        expected_use_id=1, # Heating oil
    )

    other_uses5 = OtherUses(
        compliance_report_id=1,
        quantity_supplied=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=14, # Renewable gasoline
        units="L",
        expected_use_id=1, # Heating oil
    )

    allocation_agreement1 = AllocationAgreement(
        compliance_report_id=1,
        transaction_partner="1",
        postal_address="address",
        quantity_not_sold=1,
        fuel_type_id=14, # Renewable gasoline
        transaction_type_id=1,
        fuel_category_id=3, # Jet fuel
        provision_of_the_act_id=1,
        fuel_code_id=1,
        quantity=100
    )

    allocation_agreement2 = AllocationAgreement(
        compliance_report_id=1,
        transaction_partner="1",
        postal_address="address",
        quantity_not_sold=1,
        fuel_type_id=14, # Renewable gasoline
        transaction_type_id=1,
        fuel_category_id=3, # Jet fuel
        provision_of_the_act_id=1,
        fuel_code_id=1,
        quantity=100
    )

    allocation_agreement3 = AllocationAgreement(
        compliance_report_id=1,
        transaction_partner="1",
        postal_address="address",
        quantity_not_sold=1,
        fuel_type_id=13, # Propane
        transaction_type_id=1,
        fuel_category_id=3, # Jet fuel
        provision_of_the_act_id=1,
        fuel_code_id=1,
        quantity=100
    )

    allocation_agreement4 = AllocationAgreement(
        compliance_report_id=1,
        transaction_partner="1",
        postal_address="address",
        quantity_not_sold=1,
        fuel_type_id=1, # Biodiesel
        transaction_type_id=1,
        fuel_category_id=1, # Gasoline
        provision_of_the_act_id=1,
        fuel_code_id=1,
        quantity=100
    )

    allocation_agreement5 = AllocationAgreement(
        compliance_report_id=1,
        transaction_partner="1",
        postal_address="address",
        quantity_not_sold=1,
        fuel_type_id=1, # Biodiesel
        transaction_type_id=1,
        fuel_category_id=3, # Jet fuel
        provision_of_the_act_id=1,
        fuel_code_id=1,
        quantity=100
    )

    await add_models([
        compliance_report, expected_use_type, fuel_code, allocation_transaction_type,
        fuel_supply1, fuel_supply2, fuel_supply3, fuel_supply4, fuel_supply5,
        other_uses1, other_uses2, other_uses3, other_uses4, other_uses5,
        allocation_agreement1, allocation_agreement2, allocation_agreement3, allocation_agreement4, allocation_agreement5
    ])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    content = json.loads(response.content.decode("utf-8"))
    assert "renewableFuelTargetSummary" in content

    renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
    assert any(row['line'] == '2' and row['gasoline'] == 400 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '2' and row['diesel'] == 300 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '2' and row['jetFuel'] == 500 for row in renewable_fuel_target_summary)


@pytest.mark.anyio
async def test_get_compliance_report_summary_line_3(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    compliance_report = ComplianceReport(
        compliance_report_id=1,
        compliance_period_id=15, # 2024
        organization_id=1, # LCFS Org 1
        status_id=6 # Recorded
    )

    fuel_supply1 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=1, # Biodiesel
        provision_of_the_act_id = 1
    )

    fuel_supply2 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=1, # Gasoline
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    fuel_supply3 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=1, # Biodiesel
        provision_of_the_act_id = 1
    )

    fuel_supply4 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=2, # Diesel
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    fuel_supply5 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=1, # Biodiesel
        provision_of_the_act_id = 1
    )

    fuel_supply6 = FuelSupply(
        compliance_report_id=1,
        quantity=100,
        fuel_category_id=3, # Jet fuel
        fuel_type_id=17, # Fossil-derived gasoline
        provision_of_the_act_id = 1
    )

    await add_models([
        compliance_report,
        fuel_supply1, fuel_supply2, fuel_supply3, fuel_supply4, fuel_supply5, fuel_supply6
    ])

    set_mock_user_roles(fastapi_app, ["Supplier"])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=compliance_report.compliance_report_id)
        response = await client.get(url)

    content = json.loads(response.content.decode("utf-8"))
    assert "renewableFuelTargetSummary" in content

    renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
    assert any(row['line'] == '3' and row['gasoline'] == 200 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '3' and row['diesel'] == 200 for row in renewable_fuel_target_summary)
    assert any(row['line'] == '3' and row['jetFuel'] == 200 for row in renewable_fuel_target_summary)


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
