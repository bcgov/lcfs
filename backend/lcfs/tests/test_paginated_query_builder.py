from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.orm import declarative_base

from lcfs.web.api.base import (
    FilterModel,
    PaginatedQueryBuilder,
    PaginationRequestSchema,
    SortOrder,
)

Base = declarative_base()


class Widget(Base):
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    status = Column(String)
    updated_at = Column(String)


def make_filter(field, filter=None, type="equals", filter_type="text", **kwargs):
    return FilterModel(
        field=field, filter=filter, type=type, filter_type=filter_type, **kwargs
    )


class TestBuildConditions:
    def test_default_field_resolution(self):
        builder = PaginatedQueryBuilder(Widget)
        conditions = builder.build_conditions([make_filter("name", "foo")])
        assert len(conditions) == 1

    def test_field_map_renames_field(self):
        builder = PaginatedQueryBuilder(Widget, field_map={"legacy_name": "name"})
        conditions = builder.build_conditions([make_filter("legacy_name", "foo")])
        assert len(conditions) == 1
        assert "widgets.name" in str(conditions[0])

    def test_custom_filter_receives_filter_model(self):
        seen = {}

        def handler(filter_model):
            seen["value"] = filter_model.filter
            return Widget.status == "custom"

        builder = PaginatedQueryBuilder(Widget, custom_filters={"status": handler})
        conditions = builder.build_conditions([make_filter("status", "anything")])
        assert seen["value"] == "anything"
        assert len(conditions) == 1

    def test_custom_filter_returning_none_is_skipped(self):
        builder = PaginatedQueryBuilder(
            Widget, custom_filters={"status": lambda f: None}
        )
        conditions = builder.build_conditions([make_filter("status", "x")])
        assert conditions == []

    def test_custom_filter_resolved_via_field_map(self):
        """A custom filter keyed by the mapped name still fires when the
        incoming filter uses the unmapped alias."""
        builder = PaginatedQueryBuilder(
            Widget,
            field_map={"legacy_name": "name"},
            custom_filters={"name": lambda f: Widget.name == f.filter},
        )
        conditions = builder.build_conditions([make_filter("legacy_name", "foo")])
        assert len(conditions) == 1

    def test_date_filter_in_range_uses_date_from_and_to(self):
        builder = PaginatedQueryBuilder(Widget)
        filter_model = make_filter(
            "updated_at",
            filter=None,
            type="inRange",
            filter_type="date",
            date_from="2024-01-01",
            date_to="2024-02-01",
        )
        conditions = builder.build_conditions([filter_model])
        assert len(conditions) == 1

    def test_date_filter_single_value_uses_date_from(self):
        builder = PaginatedQueryBuilder(Widget)
        filter_model = make_filter(
            "updated_at",
            filter=None,
            type="equals",
            filter_type="date",
            date_from="2024-01-01",
        )
        conditions = builder.build_conditions([filter_model])
        assert len(conditions) == 1

    def test_date_filter_in_range_skipped_when_both_bounds_empty(self):
        builder = PaginatedQueryBuilder(Widget)
        filter_model = make_filter(
            "updated_at", filter=None, type="inRange", filter_type="date"
        )
        assert builder.build_conditions([filter_model]) == []

    def test_date_filter_single_skipped_when_date_from_empty(self):
        builder = PaginatedQueryBuilder(Widget)
        filter_model = make_filter(
            "updated_at", filter=None, type="equals", filter_type="date"
        )
        assert builder.build_conditions([filter_model]) == []

    def test_default_filter_used_for_fields_without_custom_filter(self):
        seen = {}

        def default_filter(filter_model):
            seen["field"] = filter_model.field
            return Widget.name == "from_default"

        builder = PaginatedQueryBuilder(Widget, default_filter=default_filter)
        conditions = builder.build_conditions([make_filter("status", "x")])
        assert seen["field"] == "status"
        assert len(conditions) == 1

    def test_default_filter_skipped_in_favor_of_custom_filter(self):
        builder = PaginatedQueryBuilder(
            Widget,
            custom_filters={"status": lambda f: Widget.status == f.filter},
            default_filter=lambda f: (_ for _ in ()).throw(
                AssertionError("should not be called")
            ),
        )
        conditions = builder.build_conditions([make_filter("status", "x")])
        assert len(conditions) == 1

    def test_default_filter_returning_none_is_skipped(self):
        builder = PaginatedQueryBuilder(Widget, default_filter=lambda f: None)
        assert builder.build_conditions([make_filter("status", "x")]) == []


class TestApplyFilters:
    def test_no_filters_returns_query_unchanged(self):
        builder = PaginatedQueryBuilder(Widget)
        query = select(Widget)
        assert builder.apply_filters(query, []) is query

    def test_filters_add_where_clause(self):
        builder = PaginatedQueryBuilder(Widget)
        query = builder.apply_filters(select(Widget), [make_filter("name", "foo")])
        assert "WHERE" in str(query)


class TestApplySorting:
    def test_default_field_used_when_no_sort_orders(self):
        builder = PaginatedQueryBuilder(Widget)
        query = builder.apply_sorting(select(Widget), [], default_field="name")
        assert "ORDER BY widgets.name DESC" in str(query)

    def test_no_sort_orders_and_no_default_leaves_query_unchanged(self):
        builder = PaginatedQueryBuilder(Widget)
        query = select(Widget)
        assert builder.apply_sorting(query, []) is query

    def test_sort_orders_use_field_map(self):
        builder = PaginatedQueryBuilder(Widget, field_map={"legacy_name": "name"})
        query = builder.apply_sorting(
            select(Widget), [SortOrder(field="legacy_name", direction="asc")]
        )
        assert "ORDER BY widgets.name ASC" in str(query)

    def test_custom_sort_column_override(self):
        builder = PaginatedQueryBuilder(Widget, custom_sorts={"status": Widget.name})
        query = builder.apply_sorting(
            select(Widget), [SortOrder(field="status", direction="asc")]
        )
        assert "ORDER BY widgets.name ASC" in str(query)

    def test_custom_sort_callable_can_skip_field(self):
        builder = PaginatedQueryBuilder(
            Widget, custom_sorts={"status": lambda order: None}
        )
        query = builder.apply_sorting(
            select(Widget), [SortOrder(field="status", direction="asc")]
        )
        assert "ORDER BY" not in str(query)

    def test_unknown_sort_field_is_skipped_not_raised(self):
        builder = PaginatedQueryBuilder(Widget)
        query = builder.apply_sorting(
            select(Widget), [SortOrder(field="does_not_exist", direction="asc")]
        )
        assert "ORDER BY" not in str(query)

    def test_secondary_field_appended_as_tiebreaker(self):
        builder = PaginatedQueryBuilder(Widget)
        query = builder.apply_sorting(
            select(Widget),
            [SortOrder(field="name", direction="asc")],
            secondary_field="id",
        )
        rendered = str(query)
        assert "widgets.name ASC" in rendered
        assert "widgets.id DESC" in rendered


class TestOffsetLimit:
    @pytest.mark.parametrize(
        "page, size, expected_offset",
        [(1, 10, 0), (2, 10, 10), (3, 5, 10)],
    )
    def test_offset_limit(self, page, size, expected_offset):
        pagination = PaginationRequestSchema(page=page, size=size)
        offset, limit = PaginatedQueryBuilder.offset_limit(pagination)
        assert (offset, limit) == (expected_offset, size)

    def test_page_below_one_is_clamped_to_zero_offset(self):
        # PaginationRequestSchema already clamps page>=1, so exercise the
        # builder's own guard directly with a duck-typed object.
        class FakePagination:
            page = 0
            size = 10

        offset, limit = PaginatedQueryBuilder.offset_limit(FakePagination())
        assert (offset, limit) == (0, 10)


class TestPaginate:
    @pytest.mark.anyio
    async def test_paginate_delegates_with_computed_offset_and_limit(self):
        builder = PaginatedQueryBuilder(Widget)
        query = select(Widget)
        pagination = PaginationRequestSchema(page=2, size=5)
        db = AsyncMock()

        with patch(
            "lcfs.web.api.base.paginate_with_window_count",
            new=AsyncMock(return_value=(["row"], 1)),
        ) as mock_paginate:
            rows, total = await builder.paginate(db, query, pagination)

        mock_paginate.assert_awaited_once_with(db, query, 5, 5)
        assert (rows, total) == (["row"], 1)
