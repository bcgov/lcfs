from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.models.ci_application import (
    CIApplication,
    CIApplicationStatus,
)
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    SortOrder,
)
from lcfs.web.api.ci_application.repo import (
    CIApplicationRepository,
    _DIRECT_FILTER_COLUMNS,
    _NESTED_FILTER_BUILDERS,
    _resolve_value,
)
from lcfs.web.api.ci_application.schema import (
    AssignedAnalystSchema,
    CIApplicationBaseSchema,
    LatestCommentSchema,
)
from lcfs.web.api.ci_application.services import (
    CIApplicationServices,
    _initials,
    _to_assigned_analyst,
    _to_list_item,
)


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def repo(mock_db):
    r = CIApplicationRepository()
    r.db = mock_db
    return r


def _status(name="Submitted", ident=2):
    return CIApplicationStatus(
        ci_application_status_id=ident,
        status=name,
        description=name,
        display_order=ident,
    )


def _organization(name="Acme Fuels", organization_id=1):
    return SimpleNamespace(
        organization_id=organization_id,
        name=name,
        operating_name=name,
        email="ops@example.org",
        phone="555-0100",
    )


def _user(user_profile_id=42, first="Alex", last="Zorkin"):
    return SimpleNamespace(
        user_profile_id=user_profile_id,
        first_name=first,
        last_name=last,
        keycloak_username="ALZORKIN",
    )


def _internal_comment(comment_id=99, text="LGTM", create_date=None):
    return SimpleNamespace(
        internal_comment_id=comment_id,
        comment=text,
        create_user="ALZORKIN",
        create_date=create_date or datetime(2026, 5, 14, 16, 0, tzinfo=timezone.utc),
    )


def _application(
    ci_application_id=100,
    organization_id=1,
    status_id=2,
    assigned_analyst=None,
    organization=None,
    priority_score=None,
    verification_level=None,
):
    ci = CIApplication(
        ci_application_id=ci_application_id,
        organization_id=organization_id,
        status_id=status_id,
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=1,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
        priority_score=priority_score,
        verification_level=verification_level,
        group_uuid="abc",
        version=0,
    )
    ci.update_date = datetime(2026, 5, 1, tzinfo=timezone.utc)
    ci.create_date = datetime(2026, 4, 1, tzinfo=timezone.utc)
    # Attach eager-loaded relationships via __dict__ to bypass SQLAlchemy's
    # descriptors (SimpleNamespace stand-ins lack _sa_instance_state).
    ci.__dict__["ci_application_status"] = _status(ident=status_id)
    ci.__dict__["organization"] = organization or _organization(
        organization_id=organization_id
    )
    ci.__dict__["assigned_analyst"] = assigned_analyst
    return ci


class TestFilterResolver:
    def test_direct_filter_columns_cover_grid_fields(self):
        expected = {
            "ci_application_id",
            "facility_city",
            "facility_country",
            "facility_province_state",
            "facility_nameplate_capacity",
            "proposed_fuel_code_effective_date",
            "priority_score",
            "verification_level",
            "update_date",
            "create_date",
        }
        assert expected.issubset(_DIRECT_FILTER_COLUMNS.keys())

    def test_nested_filter_builders_cover_grid_fields(self):
        assert set(_NESTED_FILTER_BUILDERS.keys()) == {
            "status.status",
            "organization.name",
            "production_facility_location",
        }

    def test_resolve_value_picks_filter_for_non_set_filters(self):
        f = FilterModel(
            filter_type="text", type="contains", filter="Acme", field="anything"
        )
        assert _resolve_value(f) == "Acme"

    def test_resolve_value_picks_values_list_for_set_filters(self):
        f = FilterModel(
            filter_type="set", type="set", values=["A", "B"], field="anything"
        )
        assert _resolve_value(f) == ["A", "B"]

    def test_resolve_value_for_empty_set_filter(self):
        f = FilterModel(filter_type="set", type="set", values=None, field="anything")
        assert _resolve_value(f) == []

    def test_camel_to_snake_conversion_normalises_grid_field_names(self):
        # Pin the validator-side conversion the resolver lookup relies on.
        f = FilterModel(
            filter_type="text",
            type="contains",
            filter="x",
            field="priorityScore",
        )
        assert f.field == "priority_score"
        f2 = FilterModel(
            filter_type="text",
            type="contains",
            filter="x",
            field="productionFacilityLocation",
        )
        assert f2.field == "production_facility_location"

    def test_apply_filters_skips_unknown_field_silently(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    filter_type="text",
                    type="contains",
                    filter="AZ",
                    field="assignedAnalyst",
                )
            ],
        )
        assert repo._apply_filters(pagination) == []

    def test_apply_filters_returns_clause_for_known_direct_field(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    filter_type="number",
                    type="equals",
                    filter=511,
                    field="priorityScore",
                )
            ],
        )
        conds = repo._apply_filters(pagination)
        assert len(conds) == 1
        assert "priority_score" in str(conds[0]).lower()

    def test_apply_filters_returns_clause_for_nested_status_field(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    filter_type="text",
                    type="equals",
                    filter="Submitted",
                    field="status.status",
                )
            ],
        )
        conds = repo._apply_filters(pagination)
        assert len(conds) == 1
        rendered = str(conds[0]).lower()
        assert "exists" in rendered
        assert "ci_application_status" in rendered

    def test_apply_filters_returns_clause_for_organization_name_field(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    filter_type="text",
                    type="contains",
                    filter="Acme",
                    field="organization.name",
                )
            ],
        )
        conds = repo._apply_filters(pagination)
        assert len(conds) == 1
        rendered = str(conds[0]).lower()
        assert "exists" in rendered
        assert "organization" in rendered

    def test_apply_filters_returns_clause_for_production_facility_location(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    filter_type="text",
                    type="contains",
                    filter="Argentina",
                    field="productionFacilityLocation",
                )
            ],
        )
        conds = repo._apply_filters(pagination)
        assert len(conds) == 1
        rendered = str(conds[0]).lower()
        assert "concat_ws" in rendered
        assert "facility_city" in rendered
        assert "facility_country" in rendered

    def test_apply_sorting_uses_default_when_no_orders(self, repo):
        pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
        clauses = repo._apply_sorting(pagination)
        assert len(clauses) == 1
        rendered = str(clauses[0]).lower()
        assert "update_date" in rendered
        assert "desc" in rendered

    def test_apply_sorting_skips_unknown_field(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[SortOrder(field="lastComment", direction="asc")],
            filters=[],
        )
        clauses = repo._apply_sorting(pagination)
        assert len(clauses) == 1
        assert "update_date" in str(clauses[0]).lower()

    def test_apply_sorting_uses_direct_column(self, repo):
        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[SortOrder(field="priorityScore", direction="desc")],
            filters=[],
        )
        clauses = repo._apply_sorting(pagination)
        assert len(clauses) == 1
        rendered = str(clauses[0]).lower()
        assert "priority_score" in rendered
        assert "desc" in rendered


class TestGetLatestComments:
    @pytest.mark.anyio
    async def test_empty_input_short_circuits_without_db_call(self, repo, mock_db):
        out = await repo.get_latest_comments_by_ci_application_ids([])
        assert out == {}
        mock_db.execute.assert_not_awaited()

    @pytest.mark.anyio
    async def test_returns_comment_keyed_by_application_id(self, repo, mock_db):
        comment_a = _internal_comment(comment_id=1, text="ping")
        comment_b = _internal_comment(comment_id=2, text="follow-up")

        result = MagicMock()
        result.all.return_value = [
            (10, comment_a, "Alex", "Zorkin"),
            (11, comment_b, "Lindsy", "Grunert"),
        ]
        mock_db.execute.return_value = result

        out = await repo.get_latest_comments_by_ci_application_ids([10, 11])

        assert set(out.keys()) == {10, 11}
        first_comment, first_full_name = out[10]
        assert first_comment is comment_a
        assert first_full_name == "Alex Zorkin"
        _, second_full_name = out[11]
        assert second_full_name == "Lindsy Grunert"

    @pytest.mark.anyio
    async def test_missing_user_profile_falls_back_to_empty_name(self, repo, mock_db):
        comment = _internal_comment(comment_id=1)
        result = MagicMock()
        result.all.return_value = [(10, comment, None, None)]
        mock_db.execute.return_value = result

        out = await repo.get_latest_comments_by_ci_application_ids([10])
        assert list(out.keys()) == [10]
        _, full_name = out[10]
        assert full_name == ""


class TestInitials:
    @pytest.mark.parametrize(
        "first,last,expected",
        [
            ("Alex", "Zorkin", "AZ"),
            ("alex", "zorkin", "AZ"),
            ("Alex", None, "A"),
            (None, "Zorkin", "Z"),
            (" Alex ", " Zorkin ", "AZ"),
            ("", "", None),
            (None, None, None),
            ("   ", "   ", None),
        ],
    )
    def test_initials(self, first, last, expected):
        assert _initials(first, last) == expected


class TestToAssignedAnalyst:
    def test_returns_none_for_unassigned(self):
        assert _to_assigned_analyst(None) is None

    def test_serializes_user_into_analyst_pill_payload(self):
        analyst = _to_assigned_analyst(_user(user_profile_id=7, first="Hamed", last="Bayeki"))
        assert isinstance(analyst, AssignedAnalystSchema)
        assert analyst.user_profile_id == 7
        assert analyst.first_name == "Hamed"
        assert analyst.last_name == "Bayeki"
        assert analyst.initials == "HB"
        assert analyst.full_name == "Hamed Bayeki"

    def test_handles_partial_name(self):
        analyst = _to_assigned_analyst(_user(first="Alex", last=None))
        assert analyst.initials == "A"
        assert analyst.full_name == "Alex"


class TestToListItem:
    def test_minimum_row_serialises_without_optional_fields(self):
        ci = _application(assigned_analyst=None, priority_score=None, verification_level=None)
        out = _to_list_item(ci, last_comment_entry=None)
        assert isinstance(out, CIApplicationBaseSchema)
        assert out.ci_application_id == 100
        assert out.assigned_analyst is None
        assert out.last_comment is None
        assert out.priority_score is None
        assert out.verification_level is None
        assert out.organization is not None
        assert out.organization.name == "Acme Fuels"

    def test_populates_analyst_and_triage_fields(self):
        ci = _application(
            assigned_analyst=_user(user_profile_id=2, first="Hamed", last="Bayeki"),
            priority_score=511,
            verification_level="VX2 - High",
        )
        out = _to_list_item(ci, last_comment_entry=None)
        assert out.assigned_analyst.initials == "HB"
        assert out.priority_score == 511
        assert out.verification_level == "VX2 - High"

    def test_populates_last_comment_when_provided(self):
        ci = _application()
        comment = _internal_comment(text="Needs follow-up")
        out = _to_list_item(ci, last_comment_entry=(comment, "Alex Zorkin"))
        assert isinstance(out.last_comment, LatestCommentSchema)
        assert out.last_comment.comment == "Needs follow-up"
        assert out.last_comment.full_name == "Alex Zorkin"
        assert out.last_comment.create_date == comment.create_date

    def test_empty_full_name_becomes_none_on_last_comment(self):
        ci = _application()
        comment = _internal_comment()
        out = _to_list_item(ci, last_comment_entry=(comment, ""))
        assert out.last_comment is not None
        assert out.last_comment.full_name is None


class TestListCiApplications:
    @pytest.fixture
    def service_with_mocks(self):
        repo = AsyncMock()
        # total_pages is sync; AsyncMock would return a coroutine and trip Pydantic.
        repo.total_pages = MagicMock(return_value=0)
        user_repo = AsyncMock()
        return CIApplicationServices(repo=repo, user_repo=user_repo), repo

    @pytest.mark.anyio
    async def test_skips_latest_comments_lookup_when_page_is_empty(
        self, service_with_mocks
    ):
        service, repo = service_with_mocks
        repo.list_paginated.return_value = ([], 0)

        pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
        out = await service.list_ci_applications(pagination, organization_id=None)

        assert out.ci_applications == []
        repo.get_latest_comments_by_ci_application_ids.assert_not_awaited()

    @pytest.mark.anyio
    async def test_attaches_latest_comment_to_matching_row(self, service_with_mocks):
        service, repo = service_with_mocks
        ci_with_comment = _application(ci_application_id=100)
        ci_without_comment = _application(ci_application_id=101)
        repo.list_paginated.return_value = (
            [ci_with_comment, ci_without_comment],
            2,
        )
        repo.total_pages.return_value = 1

        comment = _internal_comment(text="Triage notes")
        repo.get_latest_comments_by_ci_application_ids.return_value = {
            100: (comment, "Alex Zorkin"),
        }

        pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
        out = await service.list_ci_applications(pagination, organization_id=None)

        repo.get_latest_comments_by_ci_application_ids.assert_awaited_once_with(
            [100, 101]
        )
        assert out.ci_applications[0].last_comment.comment == "Triage notes"
        assert out.ci_applications[1].last_comment is None

    @pytest.mark.anyio
    async def test_propagates_organization_scope_to_repo(self, service_with_mocks):
        service, repo = service_with_mocks
        repo.list_paginated.return_value = ([], 0)

        pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
        await service.list_ci_applications(pagination, organization_id=42)
        repo.list_paginated.assert_awaited_once_with(pagination, 42)
