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

@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_no_transaction(organizations_repo):
    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field='organization_id', direction='asc')]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(0, 10, [], pagination)

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == 0, f"Expected total balance to be 0, got {org.total_balance}"
    assert org.reserved_balance == 0, f"Expected reserved balance to be 0, got {org.reserved_balance}"

@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_adjustment_transactions_only(organizations_repo, add_models):
    # Add trnsactions
    await add_models([adjustment_transaction_orm_model])

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field='organization_id', direction='asc')]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(0, 10, [], pagination)

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == 100, f"Expected total balance to be 100, got {org.total_balance}"
    assert org.reserved_balance == 0, f"Expected reserved balance to be 0, got {org.reserved_balance}"

@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_reserved_transactions(organizations_repo, add_models):
    # Add trnsactions
    await add_models([
        adjustment_transaction_orm_model,
        reserved_transaction_orm_model,
        reserved_transaction_orm_model_2
    ])

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field='organization_id', direction='asc')]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(0, 10, [], pagination)

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == 100, f"Expected total balance to be 100, got {org.total_balance}"
    assert org.reserved_balance == 30, f"Expected reserved balance to be 30, got {org.reserved_balance}"

@pytest.mark.anyio
async def test_get_organizations_paginated_balances_with_released_transactions(organizations_repo, add_models, update_model):
    # Add transactions, then update one to 'Released'
    await add_models([
        adjustment_transaction_orm_model,
        reserved_transaction_orm_model,
        reserved_transaction_orm_model_2
    ])
    reserved_transaction_orm_model_2.transaction_action = TransactionActionEnum.Released
    await update_model(reserved_transaction_orm_model_2)

    # Fetch the paginated list of all organizations
    pagination = PaginationRequestSchema(
        sort_orders=[SortOrder(field='organization_id', direction='asc')]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(0, 10, [], pagination)

    # Search for the organization with ID = 1
    org = next((org for org in organizations if org.organization_id == 1), None)

    # Assert that the organization was found
    assert org is not None, "Organization with ID = 1 not found"

    # Assert the balances are as expected
    assert org.total_balance == 100, f"Expected total balance to be 100, got {org.total_balance}"
    assert org.reserved_balance == 10, f"Expected reserved balance to be 10, got {org.reserved_balance}"

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
            postalCode_zipCode="T3ST 1Z3"
        )
    )
    await add_models([test_org])

    # Perform the search
    results = await organizations_repo.search_organizations("Test")

    # Assert that the results are as expected
    assert len(results) == 1, f"Expected 1 result, got {len(results)}"
    assert results[0].organization_id == 100, f"Expected organization_id 100, got {results[0].organization_id}"
    assert results[0].name == "Test Company", f"Expected name 'Test Company', got {results[0].name}"
    assert results[0].org_address is not None, "Expected org_address to be present"

@pytest.mark.anyio
async def test_search_organizations_with_empty_query(organizations_repo):
    # Perform the search with an empty query
    results = await organizations_repo.search_organizations("")

    # Assert that no results are returned for an empty query
    assert len(results) == 0, f"Expected 0 results for empty query, got {len(results)}"

@pytest.mark.anyio
async def test_search_organizations_no_results(organizations_repo):
    # Perform the search with a query that should not match any organizations
    results = await organizations_repo.search_organizations("NonexistentCompany")

    # Assert that no results are returned
    assert len(results) == 0, f"Expected 0 results, got {len(results)}"

@pytest.mark.anyio
async def test_search_organizations_multiple_results(organizations_repo, add_models):
    # Add multiple test organizations
    test_orgs = [
        Organization(organization_id=101, name="Test Company A", operating_name="Test Co. A"),
        Organization(organization_id=102, name="Test Company B", operating_name="Test Co. B"),
        Organization(organization_id=103, name="Another Company", operating_name="Another Co.")
    ]
    await add_models(test_orgs)

    # Perform the search
    results = await organizations_repo.search_organizations("Test")

    # Assert that the correct number of results are returned
    assert len(results) == 2, f"Expected 2 results, got {len(results)}"
    assert set(org.name for org in results) == {"Test Company A", "Test Company B"}, "Unexpected organization names in results"

@pytest.mark.anyio
async def test_search_organizations_case_insensitive(organizations_repo, add_models):
    # Add a test organization
    test_org = Organization(organization_id=104, name="CamelCase Company", operating_name="CamelCo")
    await add_models([test_org])

    # Perform case-insensitive searches
    results_lower = await organizations_repo.search_organizations("camelcase")
    results_upper = await organizations_repo.search_organizations("CAMELCASE")

    # Assert that both searches return the same result
    assert len(results_lower) == 1 and len(results_upper) == 1, "Expected 1 result for both case variations"
    assert results_lower[0].organization_id == results_upper[0].organization_id == 104, "Expected matching organization_id for both case variations"