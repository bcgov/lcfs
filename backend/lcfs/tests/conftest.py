import pytest
from lcfs.web.api.base import PaginationRequestSchema, FilterModel, SortOrder


@pytest.fixture
def pagination_request_schema():
    return PaginationRequestSchema(
        page=1,
        size=10,
        sort_orders=[
            SortOrder(field="createdDate", direction="asc"),
            SortOrder(field="status", direction="desc"),
        ],
        filters=[
            FilterModel(
                filter_type="text",
                type="contains",
                filter="exampleValue",
                field="exampleField",
                date_from="2024-01-01",
                date_to="2024-12-31",
            ),
            FilterModel(
                filter_type="date",
                type="range",
                field="createdDate",
                date_from="2024-01-01",
                date_to="2024-12-31",
            ),
        ],
    )


@pytest.fixture
def mock_user_profile():
    def _create_mock_user_profile(
        role="GOVERNMENT",
        organization_id=1,
        email="john.doe@example.com",
        user_profile_id=1,
    ):
        class MockUserProfile:
            def __init__(self):
                self.user_profile_id = user_profile_id
                self.first_name = "John"
                self.last_name = "Doe"
                self.keycloak_username = "johndoe"
                self.organization_id = organization_id
                self.email = email
                self.role_names = [role]

            def get_role_names(self):
                return self.role_names

        return MockUserProfile()

    return _create_mock_user_profile
