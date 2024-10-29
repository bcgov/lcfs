import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status
from lcfs.tests.test_organization import create_organization, update_organization


@pytest.mark.anyio
async def test_insert_audit_log(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    payload = {
        "name": "Test Organizationa",
        "operatingName": "Test Operating name",
        "email": "test@gov.bc.ca",
        "phone": "0000000000",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }


    response = await create_organization(client, fastapi_app, set_mock_user, payload)
    assert response.status_code == status.HTTP_201_CREATED

    response_data = response.json()
    organization_id = response_data["organizationId"]

    # Fetch audit logs for the created organization
    audit_url = fastapi_app.url_path_for("get_audit_log")
    audit_response = await client.get(audit_url, params={"table_name": "organization", "operation": "INSERT"})
    audit_log = audit_response.json()

    # Assert that the audit log entry was created and contains correct data
    assert audit_response.status_code == status.HTTP_200_OK
    assert (
        audit_log["row_id"] == organization_id and
        audit_log["table_name"] == "organization" and
        audit_log["operation"] == "INSERT"
    ), "Expected INSERT operation in audit logs for the new organization creation."

    if audit_log["row_id"] == organization_id and audit_log["operation"] == "INSERT":
        assert audit_log["new_values"].get("name") == "Test Organizationa", "Audit log should contain the correct new 'name' value."
        assert audit_log["new_values"].get("operating_name") == "Test Operating name", "Audit log should contain the correct 'operating' value."
        assert audit_log["new_values"].get("email") == "test@gov.bc.ca", "Audit log should contain the correct 'email' value."
        assert audit_log["new_values"].get("edrms_record") == "EDRMS123", "Audit log should contain the correct 'edrms_record' value."
        assert audit_log["new_values"].get("organization_status_id") == 2, "Audit log should contain the correct 'organization_status_id' value."
        assert audit_log["new_values"].get("organization_type_id") == 1, "Audit log should contain the correct 'organization_type_id' value."
    else:
        raise AssertionError("Expected INSERT operation in audit logs for the new organization creation.")

@pytest.mark.anyio
async def test_update_organization_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    payload = {
        "name": "Test Organization",
        "operatingName": "Test Operating name",
        "email": "organization@gov.bc.ca",
        "phone": "1111111111",
        "edrmsRecord": "EDRMS123",
        "organizationStatusId": 2,
        "organizationTypeId": 1,
        "address": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
        "attorneyAddress": {
            "name": "Test Operating name",
            "streetAddress": "123 Test Street",
            "addressOther": "",
            "city": "Victoria",
            "provinceState": "BC",
            "country": "Canada",
            "postalcodeZipcode": "V8W 2C3",
        },
    }

    response = await update_organization(client, fastapi_app, set_mock_user, 1, payload)
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()

    # Fetch audit logs for the updated organization
    audit_url = fastapi_app.url_path_for("get_audit_log")
    audit_response = await client.get(audit_url, params={"table_name": "organization", "operation": "UPDATE"})
    audit_log = audit_response.json()

    # Assert that the audit log entry was created and contains correct data
    assert audit_response.status_code == status.HTTP_200_OK
    assert (
        audit_log["row_id"] == response_data["organizationId"] and
        audit_log["table_name"] == "organization" and
        audit_log["operation"] == "UPDATE"
    ), "Expected UPDATE operation in audit logs for the updated organization."

    # Assert audit log old and new values, and delta
    if audit_log["row_id"] == response_data["organizationId"] and audit_log["operation"] == "UPDATE":
        assert audit_log["old_values"].get("name") == "GreenLeaf Dynamics", "Audit log should contain the correct old 'name' value."
        assert audit_log["new_values"].get("name") == "Test Organization", "Audit log should contain the correct new 'name' value."
        assert audit_log["old_values"].get("operating_name") == "GreenLeaf Dynamics", "Audit log should contain the correct old 'operating' value."
        assert audit_log["new_values"].get("operating_name") == "Test Operating name", "Audit log should contain the correct new 'operating' value."
        assert audit_log["old_values"].get("phone") == None, "Audit log should contain the correct old 'phone' value."
        assert audit_log["new_values"].get("phone") == "1111111111", "Audit log should contain the correct new 'phone' value."
        assert audit_log["old_values"].get("email") == None, "Audit log should contain the correct old 'email' value."
        assert audit_log["new_values"].get("email") == "organization@gov.bc.ca", "Audit log should contain the correct new 'email' value."
        assert audit_log["old_values"].get("edrms_record") == None, "Audit log should contain the correct old 'edrms_record' value."
        assert audit_log["new_values"].get("edrms_record") == "EDRMS123", "Audit log should contain the correct new 'edrms_record' value."
        assert audit_log["old_values"].get("organization_status_id") == 2, "Audit log should contain the correct old 'organization_status_id' value."
        assert audit_log["new_values"].get("organization_status_id") == 2, "Audit log should contain the correct new 'organization_status_id' value."
        assert audit_log["old_values"].get("organization_type_id") == 1, "Audit log should contain the correct old 'organization_type_id' value."
        assert audit_log["new_values"].get("organization_type_id") == 1, "Audit log should contain the correct new 'organization_type_id' value."
        assert audit_log["delta"].get("name") == "Test Organization", "Audit log delta should contain the difference"
        assert audit_log["delta"].get("email") == "organization@gov.bc.ca", "Audit log delta should contain the difference"
        assert audit_log["delta"].get("phone") == "1111111111", "Audit log delta should contain the difference"
        assert audit_log["delta"].get("edrms_record") == "EDRMS123", "Audit log delta should contain the difference"
        assert audit_log["delta"].get("operating_name") == "Test Operating name", "Audit log delta should contain the difference"
    else:
        raise AssertionError("Expected UPDATE operation in audit logs for the updated organization.")
