import pytest
import uuid
from lcfs.web.api.base import PaginationRequestSchema, SortOrder, FilterModel
from lcfs.tests.organizations.organizations_payloads import *
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress
from lcfs.db.models.organization.OrganizationEarlyIssuanceByYear import (
    OrganizationEarlyIssuanceByYear,
)
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.utils.constants import LCFS_Constants
from unittest.mock import patch


@pytest.fixture
def unique_id() -> int:
    """
    Generate a unique ID for tests.
    """
    return uuid.uuid4().int & (1 << 31) - 1


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
        sort_orders=[SortOrder(field="organization_id", direction="asc")], filters=[]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0,
        10,
        [],
        pagination,
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
        sort_orders=[SortOrder(field="organization_id", direction="asc")], filters=[]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0,
        10,
        [],
        pagination,
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
        sort_orders=[SortOrder(field="organization_id", direction="asc")], filters=[]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0,
        10,
        [],
        pagination,
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
        sort_orders=[SortOrder(field="organization_id", direction="asc")], filters=[]
    )
    organizations, total_count = await organizations_repo.get_organizations_paginated(
        0,
        10,
        [],
        pagination,
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
    assert (
        len(results) > 1
    ), f"Expected more than 1 result for empty query, got {len(results)}"


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
    # Test with no conditions
    result = await organizations_repo.get_organization_names()
    assert len(result) > 1


@pytest.mark.anyio
async def test_get_organization_names_with_status_conditions(organizations_repo):
    """Test get_organization_names with a list of statuses"""
    # Test with a list of statuses
    result = await organizations_repo.get_organization_names(
        conditions=[Organization.org_status.has(status="Registered")]
    )
    assert len(result) > 0


@pytest.mark.anyio
async def test_get_early_issuance_by_year(organizations_repo, add_models, unique_id):
    """Test fetching early issuance record by year."""
    org_id = 1
    year = f"2023-{unique_id}"
    compliance_period_id = unique_id
    await add_models(
        [
            CompliancePeriod(
                compliance_period_id=compliance_period_id, description=year
            ),
            OrganizationEarlyIssuanceByYear(
                organization_id=org_id,
                compliance_period_id=compliance_period_id,
                has_early_issuance=True,
            ),
        ]
    )
    result = await organizations_repo.get_early_issuance_by_year(org_id, year)
    assert result is not None
    assert result.has_early_issuance is True


@pytest.mark.anyio
async def test_check_existing_reports_for_year(
    organizations_repo, add_models, unique_id
):
    """Test checking for existing compliance reports for a given year."""
    org_id = 1
    year = f"2023-{unique_id}"
    compliance_period_id = unique_id
    await add_models(
        [
            CompliancePeriod(
                compliance_period_id=compliance_period_id, description=year
            ),
            ComplianceReport(
                compliance_report_id=unique_id,
                organization_id=org_id,
                compliance_period_id=compliance_period_id,
                current_status_id=1,
            ),
        ]
    )
    result = await organizations_repo.check_existing_reports_for_year(org_id, year)
    assert result is True


@pytest.mark.anyio
async def test_update_early_issuance_by_year_create_new(
    organizations_repo, add_models, unique_id
):
    """Test updating early issuance when no record exists."""
    org_id = 1
    year = f"{LCFS_Constants.get_current_compliance_year()}-{unique_id}"
    user = UserProfile(user_profile_id=1)
    compliance_period_id = unique_id
    await add_models(
        [CompliancePeriod(compliance_period_id=compliance_period_id, description=year)]
    )

    issuance = await organizations_repo.update_early_issuance_by_year(
        org_id, year, True, user
    )
    assert issuance.has_early_issuance is True
    assert issuance.organization_id == org_id


@pytest.mark.anyio
async def test_update_early_issuance_by_year_update_existing(
    organizations_repo, add_models, unique_id
):
    """Test updating an existing early issuance record."""
    org_id = 1
    year = f"{LCFS_Constants.get_current_compliance_year()}-{unique_id}"
    user = UserProfile(user_profile_id=1)
    compliance_period_id = unique_id
    await add_models(
        [
            CompliancePeriod(
                compliance_period_id=compliance_period_id, description=year
            ),
            OrganizationEarlyIssuanceByYear(
                organization_id=org_id,
                compliance_period_id=compliance_period_id,
                has_early_issuance=True,
            ),
        ]
    )

    issuance = await organizations_repo.update_early_issuance_by_year(
        org_id, year, False, user
    )
    assert issuance.has_early_issuance is False


@pytest.mark.anyio
async def test_get_current_year_early_issuance(
    organizations_repo, add_models, unique_id
):
    """Test fetching the current year's early issuance status."""
    org_id = 1
    year = "2023"
    compliance_period_id = unique_id
    await add_models(
        [
            CompliancePeriod(
                compliance_period_id=compliance_period_id, description=year
            ),
            OrganizationEarlyIssuanceByYear(
                organization_id=org_id,
                compliance_period_id=compliance_period_id,
                has_early_issuance=True,
            ),
        ]
    )
    with patch(
        "lcfs.utils.constants.LCFS_Constants.get_current_compliance_year",
        return_value="2023",
    ):
        has_issuance = await organizations_repo.get_current_year_early_issuance(org_id)
    assert has_issuance is True


@pytest.mark.anyio
async def test_get_organizations_paginated_with_early_issuance_filter(
    organizations_repo, add_models, unique_id
):
    # Create test data
    compliance_period = CompliancePeriod(
        compliance_period_id=unique_id, description="2025"
    )
    org_with_early_issuance = Organization(
        organization_id=unique_id,
        name="Early Bird Inc.",
    )
    early_issuance_record = OrganizationEarlyIssuanceByYear(
        organization_id=org_with_early_issuance.organization_id,
        compliance_period_id=compliance_period.compliance_period_id,
        has_early_issuance=True,
    )
    await add_models(
        [compliance_period, org_with_early_issuance, early_issuance_record]
    )

    # Create pagination request with filter
    pagination = PaginationRequestSchema(
        filters=[
            FilterModel(
                field="has_early_issuance",
                value=True,
                type="boolean",
                filter_type="eq",
            )
        ],
        sort_orders=[SortOrder(field="organization_id", direction="asc")],
    )

    with patch.object(
        LCFS_Constants, "get_current_compliance_year", return_value="2025"
    ):
        # Test that the repository can handle the early issuance filter
        # without throwing an error (the actual filtering is done by the service layer)
        organizations, total_count = (
            await organizations_repo.get_organizations_paginated(
                0,
                10,
                [],
                pagination,
            )
        )

    # Just verify that the query executed without error
    # The actual filtering logic is tested in the service layer
    assert isinstance(organizations, list)
    assert isinstance(total_count, int)
    assert total_count >= 0


# Link Key Tests
@pytest.mark.anyio
async def test_get_organization_link_keys_success(
    organizations_repo, add_models, unique_id
):
    """Test successful retrieval of organization link keys"""
    from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
    from lcfs.db.models.form.Form import Form

    org_id = unique_id
    form_id = unique_id + 1

    # Create test data
    test_org = Organization(organization_id=org_id, name="Test Org")
    test_form = Form(
        form_id=form_id, name="Test Form", slug="test-form", allows_anonymous=True
    )
    test_link_key = OrganizationLinkKey(
        organization_id=org_id, form_id=form_id, link_key="test-key-123"
    )

    await add_models([test_org, test_form, test_link_key])

    # Test the method
    result = await organizations_repo.get_organization_link_keys(org_id)

    assert len(result) == 1
    assert result[0].organization_id == org_id
    assert result[0].form_id == form_id
    assert result[0].link_key == "test-key-123"


@pytest.mark.anyio
async def test_get_organization_link_keys_empty(organizations_repo, unique_id):
    """Test retrieval when no link keys exist for organization"""
    org_id = unique_id

    result = await organizations_repo.get_organization_link_keys(org_id)

    assert len(result) == 0


@pytest.mark.anyio
async def test_get_link_key_by_form_id_success(
    organizations_repo, add_models, unique_id
):
    """Test successful retrieval of link key by form ID"""
    from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
    from lcfs.db.models.form.Form import Form

    org_id = unique_id
    form_id = unique_id + 1

    # Create test data
    test_org = Organization(organization_id=org_id, name="Test Org")
    test_form = Form(
        form_id=form_id, name="Test Form", slug="test-form", allows_anonymous=True
    )
    test_link_key = OrganizationLinkKey(
        organization_id=org_id, form_id=form_id, link_key="test-key-456"
    )

    await add_models([test_org, test_form, test_link_key])

    # Test the method
    result = await organizations_repo.get_link_key_by_form_id(org_id, form_id)

    assert result is not None
    assert result.organization_id == org_id
    assert result.form_id == form_id
    assert result.link_key == "test-key-456"


@pytest.mark.anyio
async def test_get_link_key_by_form_id_not_found(organizations_repo, unique_id):
    """Test retrieval when link key doesn't exist for form ID"""
    org_id = unique_id
    form_id = unique_id + 1

    result = await organizations_repo.get_link_key_by_form_id(org_id, form_id)

    assert result is None


@pytest.mark.anyio
async def test_get_link_key_by_key_success(organizations_repo, add_models, unique_id):
    """Test successful retrieval of link key by key value"""
    from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
    from lcfs.db.models.form.Form import Form

    org_id = unique_id
    form_id = unique_id + 1
    link_key_value = f"test-key-{unique_id}"

    # Create test data
    test_org = Organization(organization_id=org_id, name="Test Org")
    test_form = Form(
        form_id=form_id, name="Test Form", slug="test-form", allows_anonymous=True
    )
    test_link_key = OrganizationLinkKey(
        organization_id=org_id, form_id=form_id, link_key=link_key_value
    )

    await add_models([test_org, test_form, test_link_key])

    # Test the method
    result = await organizations_repo.get_link_key_by_key(link_key_value)

    assert result is not None
    assert result.organization_id == org_id
    assert result.form_id == form_id
    assert result.link_key == link_key_value


@pytest.mark.anyio
async def test_get_link_key_by_key_not_found(organizations_repo):
    """Test retrieval when link key doesn't exist"""
    result = await organizations_repo.get_link_key_by_key("nonexistent-key")

    assert result is None


@pytest.mark.anyio
async def test_create_link_key_success(organizations_repo, add_models, unique_id):
    """Test successful creation of link key"""
    from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
    from lcfs.db.models.form.Form import Form

    org_id = unique_id
    form_id = unique_id + 1

    # Create prerequisite data
    test_org = Organization(organization_id=org_id, name="Test Org")
    test_form = Form(
        form_id=form_id, name="Test Form", slug="test-form", allows_anonymous=True
    )
    await add_models([test_org, test_form])

    # Create new link key
    new_link_key = OrganizationLinkKey(
        organization_id=org_id, form_id=form_id, link_key="new-test-key-789"
    )

    # Test the method
    result = await organizations_repo.create_link_key(new_link_key)

    assert result is not None
    assert result.organization_id == org_id
    assert result.form_id == form_id
    assert result.link_key == "new-test-key-789"
    assert result.link_key_id is not None  # Should be assigned after creation


@pytest.mark.anyio
async def test_update_link_key_success(organizations_repo, add_models, unique_id):
    """Test successful update of link key"""
    from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
    from lcfs.db.models.form.Form import Form

    org_id = unique_id
    form_id = unique_id + 1

    # Create test data
    test_org = Organization(organization_id=org_id, name="Test Org")
    test_form = Form(
        form_id=form_id, name="Test Form", slug="test-form", allows_anonymous=True
    )
    test_link_key = OrganizationLinkKey(
        organization_id=org_id, form_id=form_id, link_key="original-key"
    )

    await add_models([test_org, test_form, test_link_key])

    # Update the link key
    test_link_key.link_key = "updated-key"

    # Test the method
    result = await organizations_repo.update_link_key(test_link_key)

    assert result is not None
    assert result.link_key == "updated-key"
    assert result.organization_id == org_id
    assert result.form_id == form_id


@pytest.mark.anyio
async def test_get_form_by_id_success(organizations_repo, add_models, unique_id):
    """Test successful retrieval of form by ID"""
    from lcfs.db.models.form.Form import Form

    form_id = unique_id

    # Create test form
    test_form = Form(
        form_id=form_id,
        name="Test Form",
        slug="test-form",
        description="A test form",
        allows_anonymous=True,
    )

    await add_models([test_form])

    # Test the method
    result = await organizations_repo.get_form_by_id(form_id)

    assert result is not None
    assert result.form_id == form_id
    assert result.name == "Test Form"
    assert result.slug == "test-form"
    assert result.allows_anonymous is True


@pytest.mark.anyio
async def test_get_form_by_id_not_found(organizations_repo, unique_id):
    """Test retrieval when form doesn't exist"""
    form_id = unique_id

    result = await organizations_repo.get_form_by_id(form_id)

    assert result is None


@pytest.mark.anyio
async def test_get_available_forms_for_link_keys_success(
    organizations_repo, add_models, unique_id
):
    """Test successful retrieval of forms that allow anonymous access"""
    from lcfs.db.models.form.Form import Form

    form_id_1 = unique_id
    form_id_2 = unique_id + 1
    form_id_3 = unique_id + 2

    # Create test forms - some allow anonymous, some don't
    test_forms = [
        Form(
            form_id=form_id_1,
            name="Anonymous Form 1",
            slug="anon-form-1",
            allows_anonymous=True,
        ),
        Form(
            form_id=form_id_2,
            name="Private Form",
            slug="private-form",
            allows_anonymous=False,
        ),
        Form(
            form_id=form_id_3,
            name="Anonymous Form 2",
            slug="anon-form-2",
            allows_anonymous=True,
        ),
    ]

    await add_models(test_forms)

    # Test the method
    result = await organizations_repo.get_available_forms_for_link_keys()

    # Should only return forms that allow anonymous access
    anonymous_forms = [form for form in result if form.allows_anonymous]
    assert len(anonymous_forms) >= 2  # At least our test forms

    # Check our specific test forms are included
    form_names = [form.name for form in result]
    assert "Anonymous Form 1" in form_names
    assert "Anonymous Form 2" in form_names
    assert "Private Form" not in form_names
