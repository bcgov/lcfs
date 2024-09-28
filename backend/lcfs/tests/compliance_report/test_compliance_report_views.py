import warnings
import json
import pytest

from datetime import datetime
from unittest.mock import patch
from httpx import AsyncClient
from fastapi import FastAPI, status

from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)

from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.base import FilterModel
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportUpdateSchema,
)


# @pytest.mark.anyio
# async def test_get_compliance_periods_for_idir_users(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
# ) -> None:
#     set_mock_user_roles(fastapi_app, ["Government"])
#     url = fastapi_app.url_path_for("get_compliance_periods")
#     reposnse = await client.get(url)
#     assert reposnse.status_code == status.HTTP_200_OK
#     assert reposnse.content


# @pytest.mark.anyio
# async def test_get_compliance_periods_for_bceid_users(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
# ) -> None:
#     set_mock_user_roles(fastapi_app, ["Supplier"])
#     url = fastapi_app.url_path_for("get_compliance_periods")
#     reposnse = await client.get(url)
#     assert reposnse.status_code == status.HTTP_200_OK
#     assert reposnse.content


# # @pytest.mark.anyio
# # async def test_get_fse_options(
# #     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
# # ) -> None:
# #     set_mock_user_roles(fastapi_app, ["Supplier"])
# #     url = fastapi_app.url_path_for("get_fse_options")
# #     reposnse = await client.get(url)
# #     assert reposnse.status_code == status.HTTP_200_OK
# #     assert reposnse.content


# # @pytest.mark.anyio
# # async def test_create_compliance_report_draft(
# #     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
# # ) -> None:
# #     set_mock_user_roles(fastapi_app, ["Supplier"])
# #     payload = {"compliancePeriod": "2024", "organizationId": 1, "status": "Draft"}
# #     url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
# #     response = await client.post(url, json=payload)
# #     assert response.status_code == status.HTTP_201_CREATED
# #     assert response.content


# @pytest.mark.anyio
# async def test_get_compliance_report_by_id_for_bceid_user(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
# ) -> None:

#     set_mock_user_roles(fastapi_app, ["Supplier"])
#     payload = {"compliancePeriod": "2023", "organizationId": 1, "status": "Draft"}
#     url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
#     response = await client.post(url, json=payload)
#     assert response.status_code == status.HTTP_201_CREATED
#     assert response.content

#     compliance_report_id = json.loads(response.content.decode("utf-8"))[
#         "complianceReportId"
#     ]
#     # test to get the the report back after creating
#     url = fastapi_app.url_path_for(
#         "get_compliance_report_by_id", organization_id=1, report_id=compliance_report_id
#     )
#     response = await client.get(url)
#     assert response.status_code == status.HTTP_200_OK
#     assert response.content


# ## Tests for getting paginated compliance reports list
# @pytest.mark.anyio
# async def test_get_reports_paginated_for_org_successful(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     # Load a sample record to retrieve the reports list.
#     set_mock_user_roles(fastapi_app, ["Supplier"])
#     payload = {"compliancePeriod": "2022", "organizationId": 1, "status": "Draft"}
#     url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
#     response = await client.post(url, json=payload)
#     assert response.status_code == status.HTTP_201_CREATED
#     assert response.content
#     # retrieve the list of reports
#     url = fastapi_app.url_path_for("get_compliance_reports", organization_id=1)
#     request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
#     response = await client.post(url, json=request_data)

#     # Check the status code
#     assert response.status_code == status.HTTP_200_OK

#     # check if pagination is working as expected
#     content = json.loads(response.content.decode("utf-8"))
#     assert content["pagination"]["page"] == 1


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_1(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_report_id=1,
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     expected_use_type = ExpectedUseType(
#         expected_use_type_id=1,
#         name="Heating Oil",
#         description="Fuel used for heating purposes",
#     )

#     fuel_supply1 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=16,  # Fossil-derived diesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply2 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     fuel_supply3 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply4 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     fuel_supply5 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=18,  # Fossil-derived jet fuel
#         provision_of_the_act_id=1,
#     )

#     other_uses1 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses2 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses3 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=2,  # CNG
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses4 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=4,  # Ethanol
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses5 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=9,  # Other diesel fuel
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     await add_models(
#         [
#             compliance_report,
#             expected_use_type,
#             fuel_supply1,
#             fuel_supply2,
#             fuel_supply3,
#             fuel_supply4,
#             fuel_supply5,
#             other_uses1,
#             other_uses2,
#             other_uses3,
#             other_uses4,
#             other_uses5,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     content = json.loads(response.content.decode("utf-8"))
#     assert "renewableFuelTargetSummary" in content

#     renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
#     assert any(
#         row["line"] == "1" and row["gasoline"] == 400
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "1" and row["diesel"] == 200
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "1" and row["jetFuel"] == 200
#         for row in renewable_fuel_target_summary
#     )


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_2(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_report_id=1,
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     expected_use_type = ExpectedUseType(
#         expected_use_type_id=1,
#         name="Heating Oil",
#         description="Fuel used for heating purposes",
#     )

#     fuel_code = FuelCode(
#         fuel_code_id=1,
#         fuel_status_id=1,
#         prefix_id=1,
#         fuel_suffix="100.0",
#         company="Company 1",
#         contact_name="John Doe",
#         contact_email="john.doe@lcfs.com",
#         carbon_intensity=123,
#         edrms="edrms",
#         last_updated=datetime.strptime("2023-01-01", "%Y-%m-%d"),
#         application_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
#         fuel_type_id=1,
#         feedstock="feedstock",
#         feedstock_location="123 main street",
#         feedstock_misc="misc data",
#         fuel_production_facility_city="Vancouver",
#         fuel_production_facility_province_state="British Columbia",
#         fuel_production_facility_country="Canada",
#         former_company="ABC Company",
#         notes="notes",
#     )

#     allocation_transaction_type = AllocationTransactionType(
#         allocation_transaction_type_id=1, type="Allocation", description="Allocation"
#     )

#     fuel_supply1 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply2 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     fuel_supply3 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=2,  # CNG
#         provision_of_the_act_id=1,
#     )

#     fuel_supply4 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=2,  # CNG
#         provision_of_the_act_id=1,
#     )

#     fuel_supply5 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=18,  # Fossil-derived jet fuel
#         provision_of_the_act_id=1,
#     )

#     other_uses1 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses2 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=2,  # CNG
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses3 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=4,  # Ethanol
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses4 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=4,  # Ethanol
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     other_uses5 = OtherUses(
#         compliance_report_id=1,
#         quantity_supplied=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=14,  # Renewable gasoline
#         units="L",
#         expected_use_id=1,  # Heating oil
#     )

#     allocation_agreement1 = AllocationAgreement(
#         compliance_report_id=1,
#         transaction_partner="1",
#         postal_address="address",
#         fuel_type_id=14,  # Renewable gasoline
#         allocation_transaction_type_id=1,
#         fuel_category_id=3,  # Jet fuel
#         provision_of_the_act_id=1,
#         fuel_code_id=1,
#         quantity=100,
#     )

#     allocation_agreement2 = AllocationAgreement(
#         compliance_report_id=1,
#         transaction_partner="1",
#         postal_address="address",
#         fuel_type_id=14,  # Renewable gasoline
#         allocation_transaction_type_id=1,
#         fuel_category_id=3,  # Jet fuel
#         provision_of_the_act_id=1,
#         fuel_code_id=1,
#         quantity=100,
#     )

#     allocation_agreement3 = AllocationAgreement(
#         compliance_report_id=1,
#         transaction_partner="1",
#         postal_address="address",
#         fuel_type_id=13,  # Propane
#         allocation_transaction_type_id=1,
#         fuel_category_id=3,  # Jet fuel
#         provision_of_the_act_id=1,
#         fuel_code_id=1,
#         quantity=100,
#     )

#     allocation_agreement4 = AllocationAgreement(
#         compliance_report_id=1,
#         transaction_partner="1",
#         postal_address="address",
#         fuel_type_id=1,  # Biodiesel
#         allocation_transaction_type_id=1,
#         fuel_category_id=1,  # Gasoline
#         provision_of_the_act_id=1,
#         fuel_code_id=1,
#         quantity=100,
#     )

#     allocation_agreement5 = AllocationAgreement(
#         compliance_report_id=1,
#         transaction_partner="1",
#         postal_address="address",
#         fuel_type_id=1,  # Biodiesel
#         allocation_transaction_type_id=1,
#         fuel_category_id=3,  # Jet fuel
#         provision_of_the_act_id=1,
#         fuel_code_id=1,
#         quantity=100,
#     )

#     await add_models(
#         [
#             compliance_report,
#             expected_use_type,
#             fuel_code,
#             allocation_transaction_type,
#             fuel_supply1,
#             fuel_supply2,
#             fuel_supply3,
#             fuel_supply4,
#             fuel_supply5,
#             other_uses1,
#             other_uses2,
#             other_uses3,
#             other_uses4,
#             other_uses5,
#             allocation_agreement1,
#             allocation_agreement2,
#             allocation_agreement3,
#             allocation_agreement4,
#             allocation_agreement5,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     content = json.loads(response.content.decode("utf-8"))
#     assert "renewableFuelTargetSummary" in content

#     renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
#     assert any(
#         row["line"] == "2" and row["gasoline"] == 400
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "2" and row["diesel"] == 300
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "2" and row["jetFuel"] == 500
#         for row in renewable_fuel_target_summary
#     )


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_3(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_report_id=1,
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     fuel_supply1 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=1,  # Biodiesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply2 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=1,  # Gasoline
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     fuel_supply3 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=1,  # Biodiesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply4 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=2,  # Diesel
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     fuel_supply5 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=1,  # Biodiesel
#         provision_of_the_act_id=1,
#     )

#     fuel_supply6 = FuelSupply(
#         compliance_report_id=1,
#         quantity=100,
#         fuel_category_id=3,  # Jet fuel
#         fuel_type_id=17,  # Fossil-derived gasoline
#         provision_of_the_act_id=1,
#     )

#     await add_models(
#         [
#             compliance_report,
#             fuel_supply1,
#             fuel_supply2,
#             fuel_supply3,
#             fuel_supply4,
#             fuel_supply5,
#             fuel_supply6,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     content = json.loads(response.content.decode("utf-8"))
#     assert "renewableFuelTargetSummary" in content

#     renewable_fuel_target_summary = content["renewableFuelTargetSummary"]
#     assert any(
#         row["line"] == "3" and row["gasoline"] == 200
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "3" and row["diesel"] == 200
#         for row in renewable_fuel_target_summary
#     )
#     assert any(
#         row["line"] == "3" and row["jetFuel"] == 200
#         for row in renewable_fuel_target_summary
#     )


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_12(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     transfer_out1 = Transfer(
#         from_organization_id=1,  # LCFS Org 1
#         to_organization_id=2,  # LCFS Org 2
#         agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_out2 = Transfer(
#         from_organization_id=1,  # LCFS Org 1
#         to_organization_id=2,  # LCFS Org 2
#         agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_out3 = Transfer(
#         from_organization_id=2,  # LCFS Org 2
#         to_organization_id=1,  # LCFS Org 1
#         agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_out4 = Transfer(
#         from_organization_id=1,  # LCFS Org 1
#         to_organization_id=2,  # LCFS Org 2
#         agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_out5 = Transfer(
#         from_organization_id=1,  # LCFS Org 1
#         to_organization_id=2,  # LCFS Org 2
#         agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=5,  # Recommended
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )

#     await add_models(
#         [
#             compliance_report,
#             transfer_out1,
#             transfer_out2,
#             transfer_out3,
#             transfer_out4,
#             transfer_out5,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     assert response.status_code == status.HTTP_200_OK

#     content = json.loads(response.content.decode("utf-8"))
#     assert "lowCarbonFuelTargetSummary" in content
#     low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
#     assert any(
#         row["line"] == "12" and row["value"] == 200
#         for row in low_carbon_fuel_target_summary
#     )


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_13(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     transfer_in1 = Transfer(
#         from_organization_id=2,  # LCFS Org 2
#         to_organization_id=1,  # LCFS Org 1
#         agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_in2 = Transfer(
#         from_organization_id=2,  # LCFS Org 2
#         to_organization_id=1,  # LCFS Org 1
#         agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_in3 = Transfer(
#         from_organization_id=1,  # LCFS Org 1
#         to_organization_id=2,  # LCFS Org 2
#         agreement_date=datetime.strptime("2024-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2024-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_in4 = Transfer(
#         from_organization_id=2,  # LCFS Org 2
#         to_organization_id=1,  # LCFS Org 1
#         agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=6,  # Recorded
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )
#     transfer_in5 = Transfer(
#         from_organization_id=2,  # LCFS Org 2
#         to_organization_id=1,  # LCFS Org 1
#         agreement_date=datetime.strptime("2023-05-10", "%Y-%m-%d"),
#         transaction_effective_date=datetime.strptime("2023-06-01", "%Y-%m-%d"),
#         price_per_unit=1,
#         quantity=100,
#         transfer_category_id=1,  # A
#         current_status_id=5,  # Recommended
#         recommendation=TransferRecommendationEnum.Record,
#         effective_status=True,
#     )

#     await add_models(
#         [
#             compliance_report,
#             transfer_in1,
#             transfer_in2,
#             transfer_in3,
#             transfer_in4,
#             transfer_in5,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     assert response.status_code == status.HTTP_200_OK

#     content = json.loads(response.content.decode("utf-8"))
#     assert "lowCarbonFuelTargetSummary" in content
#     low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
#     assert any(
#         row["line"] == "13" and row["value"] == 200
#         for row in low_carbon_fuel_target_summary
#     )


# @pytest.mark.anyio
# async def test_get_compliance_report_summary_line_14(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
# ):
#     compliance_report = ComplianceReport(
#         compliance_period_id=15,  # 2024
#         organization_id=1,  # LCFS Org 1
#         current_status_id=6,  # Recorded
#     )

#     issued_units1 = InitiativeAgreement(
#         compliance_units=75,
#         transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
#         gov_comment="Issued units 1",
#         to_organization_id=1,  # LCFS Org 1
#         current_status_id=3,  # Approved
#     )
#     issued_units2 = InitiativeAgreement(
#         compliance_units=25,
#         transaction_effective_date=datetime.strptime("2024-02-01", "%Y-%m-%d"),
#         gov_comment="Issued units 2",
#         to_organization_id=1,  # LCFS Org 1
#         current_status_id=3,  # Approved
#     )
#     issued_units3 = InitiativeAgreement(
#         compliance_units=25,
#         transaction_effective_date=datetime.strptime("2024-02-01", "%Y-%m-%d"),
#         gov_comment="Issued units 2",
#         to_organization_id=2,  # LCFS Org 2
#         current_status_id=3,  # Approved
#     )
#     issued_units4 = InitiativeAgreement(
#         compliance_units=25,
#         transaction_effective_date=datetime.strptime("2023-02-01", "%Y-%m-%d"),
#         gov_comment="Issued units 2",
#         to_organization_id=2,  # LCFS Org 2
#         current_status_id=3,  # Approved
#     )
#     issued_units5 = InitiativeAgreement(
#         compliance_units=25,
#         transaction_effective_date=datetime.strptime("2023-02-01", "%Y-%m-%d"),
#         gov_comment="Issued units 2",
#         to_organization_id=2,  # LCFS Org 2
#         current_status_id=1,  # Draft
#     )

#     await add_models(
#         [
#             compliance_report,
#             issued_units1,
#             issued_units2,
#             issued_units3,
#             issued_units4,
#             issued_units5,
#         ]
#     )

#     set_mock_user_roles(fastapi_app, ["Supplier"])

#     with warnings.catch_warnings():
#         warnings.simplefilter("ignore", UserWarning)
#         url = fastapi_app.url_path_for(
#             "get_compliance_report_summary",
#             report_id=compliance_report.compliance_report_id,
#         )
#         response = await client.get(url)

#     content = json.loads(response.content.decode("utf-8"))
#     assert "lowCarbonFuelTargetSummary" in content
#     low_carbon_fuel_target_summary = content["lowCarbonFuelTargetSummary"]
#     assert any(
#         row["line"] == "14" and row["value"] == 100
#         for row in low_carbon_fuel_target_summary
#     )


# get_compliance_periods
@pytest.mark.anyio
async def test_get_compliance_periods_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_all_compliance_periods"
    ) as mock_get_all_compliance_periods:
        set_mock_user_roles(
            fastapi_app, [RoleEnum.GOVERNMENT.value]
        )  # Set a valid role

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
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_all_compliance_periods"
    ) as mock_get_all_compliance_periods:
        set_mock_user_roles(
            fastapi_app, [RoleEnum.GOVERNMENT.value]
        )  # Set a valid role

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
    set_mock_user_roles,
    pagination_request_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_compliance_reports_paginated"
    ) as mock_get_compliance_reports_paginated:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

        mock_get_compliance_reports_paginated.return_value = (
            compliance_report_list_schema
        )

        url = fastapi_app.url_path_for("get_compliance_reports")

        response = await client.post(
            url, json=pagination_request_schema.dict(by_alias=True)
        )

        assert response.status_code == 200

        expected_response = json.loads(
            compliance_report_list_schema.json(by_alias=True)
        )

        assert response.json() == expected_response

        pagination_request_schema.filters.append(
            FilterModel(
                field="status", filter="Draft", filter_type="text", type="notEqual"
            )
        )

        mock_get_compliance_reports_paginated.assert_called_once_with(
            pagination_request_schema
        )


@pytest.mark.anyio
async def test_get_compliance_reports_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    pagination_request_schema,
):
    # Set a role that does not have access
    set_mock_user_roles(fastapi_app, [RoleEnum.ANALYST.value])

    url = fastapi_app.url_path_for("get_compliance_reports")

    response = await client.post(
        url, json=pagination_request_schema.dict(by_alias=True)
    )

    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_get_compliance_reports_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

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
    set_mock_user_roles,
    pagination_request_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_compliance_reports_paginated"
    ) as mock_get_compliance_reports_paginated:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

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
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

        mock_compliance_report = compliance_report_base_schema()

        mock_get_compliance_report_by_id.return_value = mock_compliance_report

        url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id=1)

        response = await client.get(url)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json() == expected_response
        mock_get_compliance_report_by_id.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(
        fastapi_app, [RoleEnum.ANALYST.value]
    )  # User with the wrong role

    url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id=1)

    response = await client.get(url)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_compliance_report_by_id_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

    url = fastapi_app.url_path_for("get_compliance_report_by_id", report_id="invalid")

    response = await client.get(url)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

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
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.calculate_compliance_report_summary"
    ) as mock_calculate_compliance_report_summary:
        set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])
        mock_compliance_report_summary = compliance_report_summary_schema()

        mock_calculate_compliance_report_summary.return_value = (
            mock_compliance_report_summary
        )

        url = fastapi_app.url_path_for("get_compliance_report_summary", report_id=1)

        response = await client.get(url)

        assert response.status_code == 200

        expected_response = json.loads(
            mock_compliance_report_summary.json(by_alias=True)
        )

        assert response.json() == expected_response
        mock_calculate_compliance_report_summary.assert_called_once_with(
            1, is_edit=False
        )


@pytest.mark.anyio
async def test_get_compliance_report_summary_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    # Assuming 'abc' is an invalid report_id
    url = fastapi_app.url_path_for("get_compliance_report_summary", report_id="abc")

    response = await client.get(url)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_get_compliance_report_summary_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.calculate_compliance_report_summary"
    ) as mock_calculate_compliance_report_summary:
        set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

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
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportSummaryService.auto_save_compliance_report_summary"
    ) as mock_auto_save_compliance_report_summary:
        set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

        mock_compliance_report_summary = compliance_report_summary_schema()

        mock_auto_save_compliance_report_summary.return_value = (
            mock_compliance_report_summary
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report_summary", report_id=1, summary_id=1
        )

        payload = mock_compliance_report_summary.dict(by_alias=True)

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(
            mock_compliance_report_summary.json(by_alias=True)
        )

        assert response.json() == expected_response
        mock_auto_save_compliance_report_summary.assert_called_once_with(
            1, 1, mock_compliance_report_summary
        )


@pytest.mark.anyio
async def test_update_compliance_report_summary_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_summary_schema,
    set_mock_user_roles,
):
    set_mock_user_roles(
        fastapi_app, [RoleEnum.GOVERNMENT.value]
    )  # User with the wrong role

    url = fastapi_app.url_path_for(
        "update_compliance_report_summary", report_id=1, summary_id=1
    )
    payload = compliance_report_summary_schema().dict(by_alias=True)

    response = await client.put(url, json=payload)

    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_update_compliance_report_summary_invalid_payload(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

    url = fastapi_app.url_path_for(
        "update_compliance_report_summary", report_id=1, summary_id=1
    )
    payload = {"invalidField": "invalidValue"}  # Invalid payload structure

    response = await client.put(url, json=payload)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)


@pytest.mark.anyio
async def test_update_compliance_report_summary_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    compliance_report_summary_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.summary_service.ComplianceReportSummaryService.auto_save_compliance_report_summary"
    ) as mock_auto_save_compliance_report_summary:
        set_mock_user_roles(fastapi_app, [RoleEnum.SUPPLIER.value])

        # Simulate DataNotFoundException for a non-existent summary
        mock_auto_save_compliance_report_summary.side_effect = DataNotFoundException(
            "Summary not found"
        )

        url = fastapi_app.url_path_for(
            "update_compliance_report_summary", report_id=1, summary_id=9999
        )
        payload = compliance_report_summary_schema().dict(by_alias=True)

        response = await client.put(url, json=payload)

        assert response.status_code == 404  # Not Found


# update_compliance_report
@pytest.mark.anyio
async def test_update_compliance_report_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    compliance_report_base_schema,
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

        mock_compliance_report = compliance_report_base_schema()

        mock_update_compliance_report.return_value = mock_compliance_report

        url = fastapi_app.url_path_for(
            "update_compliance_report",
            report_id=1,
        )

        payload = {"status": "Draft", "supplementalNote": "new supplemental note"}

        response = await client.put(url, json=payload)

        assert response.status_code == 200

        expected_response = json.loads(mock_compliance_report.json(by_alias=True))

        assert response.json() == expected_response

        mock_update_compliance_report.assert_called_once_with(
            1, ComplianceReportUpdateSchema(**payload)
        )


@pytest.mark.anyio
async def test_update_compliance_report_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.ANALYST.value])

    url = fastapi_app.url_path_for("update_compliance_report", report_id=1)

    payload = {"status": "Draft", "supplementalNote": "new supplemental note"}

    response = await client.put(url, json=payload)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_update_compliance_report_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
):
    with patch(
        "lcfs.web.api.compliance_report.views.ComplianceReportUpdateService.update_compliance_report"
    ) as mock_update_compliance_report:
        set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

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
    set_mock_user_roles,
):
    set_mock_user_roles(fastapi_app, [RoleEnum.GOVERNMENT.value])

    url = fastapi_app.url_path_for("update_compliance_report", report_id=1)
    payload = {"invalidField": "invalidValue"}  # Invalid payload structure

    response = await client.put(url, json=payload)

    assert response.status_code == 422  # Unprocessable Entity (Validation Error)
