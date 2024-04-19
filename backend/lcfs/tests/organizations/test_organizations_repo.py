import pytest
from lcfs.web.api.base import PaginationRequestSchema, SortOrder
from lcfs.tests.organizations.organizations_payloads import *
from lcfs.web.api.organizations.repo import OrganizationsRepository

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
