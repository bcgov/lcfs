import pytest
from lcfs.web.api.base import PaginationRequestSchema, SortOrder
from lcfs.tests.organizations.organizations_payloads import *
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress


@pytest.fixture
def organizations_repo(dbsession):
    return OrganizationsRepository(db=dbsession)


BASE_TOTAL_BALANCE = 51000


@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_no_transaction(
    organizations_repo,
):
    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field="organization_id", direction="asc")]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0, 10, [], pagination
    )

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert (
        org.total_balance == BASE_TOTAL_BALANCE
    ), f"Expected total balance to be {BASE_TOTAL_BALANCE}, got {org.total_balance}"
    assert (
        org.reserved_balance == 0
    ), f"Expected reserved balance to be 0, got {org.reserved_balance}"


@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_adjustment_transactions_only(
    organizations_repo, add_models
):
    # Add trnsactions
    await add_models([adjustment_transaction_orm_model])

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field="organization_id", direction="asc")]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0, 10, [], pagination
    )

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == (
        BASE_TOTAL_BALANCE + 100
    ), f"Expected total balance to be 100, got {org.total_balance}"
    assert (
        org.reserved_balance == 0
    ), f"Expected reserved balance to be 0, got {org.reserved_balance}"


@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_reserved_transactions(
    organizations_repo, add_models
):
    # Add trnsactions
    await add_models(
        [
            adjustment_transaction_orm_model,
            reserved_transaction_orm_model,
            reserved_transaction_orm_model_2,
        ]
    )

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field="organization_id", direction="asc")]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0, 10, [], pagination
    )

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == (
        BASE_TOTAL_BALANCE + 100
    ), f"Expected total balance to be 100, got {org.total_balance}"
    assert (
        org.reserved_balance == 0
    ), f"Expected reserved balance to be 0, got {org.reserved_balance}"


@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_released_transactions(
    organizations_repo, add_models, update_model
):
    # Add transactions, then update one to 'Released'
    await add_models(
        [
            adjustment_transaction_orm_model,
            reserved_transaction_orm_model,
            reserved_transaction_orm_model_2,
        ]
    )
    reserved_transaction_orm_model_2.transaction_action = TransactionActionEnum.Released
    await update_model(reserved_transaction_orm_model_2)

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field="organization_id", direction="asc")]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0, 10, [], pagination
    )

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert (
        org.total_balance == 51100
    ), f"Expected total balance to be 100, got {org.total_balance}"
    assert (
        org.reserved_balance == 0
    ), f"Expected reserved balance to be 0, got {org.reserved_balance}"


@pytest.mark.anyio
async def test_search_organizations_with_valid_query(organizations_repo, add_models):
    # Add a test organization with address
    test_org = Organization(
        organization_id=100,
        name="Test Company",
        operating_name="Test Co.",
        org_address=OrganizationAddress(
            street_address="123 Test St",
            city="Test City",
            province_state="Test Province",
            country="Test Country",
            postalCode_zipCode="T3ST 1Z3",
        ),
    )
    await add_models([test_org])

    # Perform the search
    results = await organizations_repo.search_organizations_by_name("Test")

    # Assert that the results are as expected
    assert len(results) == 1, f"Expected 1 result, got {len(results)}"
    assert (
        results[0].organization_id == 100
    ), f"Expected organization_id 100, got {results[0].organization_id}"
    assert (
        results[0].name == "Test Company"
    ), f"Expected name 'Test Company', got {results[0].name}"
    assert results[0].org_address is not None, "Expected org_address to be present"


@pytest.mark.anyio
async def test_search_organizations_with_empty_query(organizations_repo):
    # Perform the search with an empty query
    results = await organizations_repo.search_organizations_by_name("")

    # Assert that all results are returned
    assert len(results) == 3, f"Expected 3 results for empty query, got {len(results)}"


@pytest.mark.anyio
async def test_search_organizations_no_results(organizations_repo):
    # Perform the search with a query that should not match any organizations
    results = await organizations_repo.search_organizations_by_name(
        "NonexistentCompany"
    )

    # Assert that no results are returned
    assert len(results) == 0, f"Expected 0 results, got {len(results)}"


@pytest.mark.anyio
async def test_search_organizations_multiple_results(organizations_repo, add_models):
    # Add multiple test organizations
    test_orgs = [
        Organization(
            organization_id=101, name="Test Company A", operating_name="Test Co. A"
        ),
        Organization(
            organization_id=102, name="Test Company B", operating_name="Test Co. B"
        ),
        Organization(
            organization_id=103, name="Another Company", operating_name="Another Co."
        ),
    ]
    await add_models(test_orgs)

    # Perform the search
    results = await organizations_repo.search_organizations_by_name("Test")

    # Assert that the correct number of results are returned
    assert len(results) == 2, f"Expected 2 results, got {len(results)}"
    assert set(org.name for org in results) == {
        "Test Company A",
        "Test Company B",
    }, "Unexpected organization names in results"


@pytest.mark.anyio
async def test_search_organizations_case_insensitive(organizations_repo, add_models):
    # Add a test organization
    test_org = Organization(
        organization_id=104, name="CamelCase Company", operating_name="CamelCo"
    )
    await add_models([test_org])

    # Perform case-insensitive searches
    results_lower = await organizations_repo.search_organizations_by_name("camelcase")
    results_upper = await organizations_repo.search_organizations_by_name("CAMELCASE")

    # Assert that both searches return the same result
    assert (
        len(results_lower) == 1 and len(results_upper) == 1
    ), "Expected 1 result for both case variations"
    assert (
        results_lower[0].organization_id == results_upper[0].organization_id == 104
    ), "Expected matching organization_id for both case variations"


@pytest.mark.anyio
async def test_get_organization_names_no_conditions(organizations_repo):
    """Test get_organization_names with no conditions returns all organizations"""
    result = await organizations_repo.get_organization_names()

    assert isinstance(result, list)
    assert len(result) > 0
    # Check that each result has the expected structure
    for org in result:
        assert "organization_id" in org
        assert "name" in org
        assert "total_balance" in org
        assert "reserved_balance" in org


@pytest.mark.anyio
async def test_get_organization_names_with_status_conditions(organizations_repo):
    """Test get_organization_names with status filtering"""
    from lcfs.db.models.organization.OrganizationStatus import (
        OrganizationStatus,
        OrgStatusEnum,
    )

    # Test with registered organizations only
    registered_conditions = [OrganizationStatus.status == OrgStatusEnum.Registered]
    registered_result = await organizations_repo.get_organization_names(
        registered_conditions
    )

    # Test with multiple statuses
    multi_status_conditions = [
        OrganizationStatus.status.in_(
            [OrgStatusEnum.Registered, OrgStatusEnum.Unregistered]
        )
    ]
    multi_result = await organizations_repo.get_organization_names(
        multi_status_conditions
    )

    assert isinstance(registered_result, list)
    assert isinstance(multi_result, list)

    # Multi-status result should have at least as many organizations as registered-only
    assert len(multi_result) >= len(registered_result)

    # Check structure of results
    for org in registered_result:
        assert "organization_id" in org
        assert "name" in org
        assert "total_balance" in org
        assert "reserved_balance" in org


@pytest.mark.anyio
async def test_get_organization_names_ordering(organizations_repo):
    """Test get_organization_names respects ordering parameters"""
    # Test ascending order by name
    result_asc = await organizations_repo.get_organization_names(
        order_by=("name", "asc")
    )

    # Test descending order by name
    result_desc = await organizations_repo.get_organization_names(
        order_by=("name", "desc")
    )

    assert len(result_asc) == len(result_desc)

    if len(result_asc) > 1:
        # Check that first result in asc is last in desc (if unique names)
        first_asc = result_asc[0]["name"]
        last_desc = result_desc[-1]["name"]
        # They should be the same if all names are unique
        assert first_asc <= result_asc[-1]["name"]  # Ascending order
        assert result_desc[0]["name"] >= last_desc  # Descending order
