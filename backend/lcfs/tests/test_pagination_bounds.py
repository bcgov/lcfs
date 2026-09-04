import pytest
from pydantic import ValidationError

from lcfs.web.api.base import PaginationRequestSchema, calculate_total_pages


class TestCalculateTotalPages:
    """
    size=0 is the "return everything" sentinel used by the export paths, so
    dividing by it raised ZeroDivisionError - a 500 on any endpoint that took
    an externally supplied page size.
    """

    @pytest.mark.parametrize(
        "total, size, expected",
        [
            (100, 10, 10),
            (101, 10, 11),
            (9, 10, 1),
            (0, 10, 0),
            (0, 0, 0),
            (100, 0, 1),
            (100, -5, 1),
        ],
    )
    def test_total_pages(self, total, size, expected):
        assert calculate_total_pages(total, size) == expected


class TestPaginationRequestSchema:
    def test_defaults(self):
        pagination = PaginationRequestSchema()

        assert pagination.page == 1
        assert pagination.size == 10

    @pytest.mark.parametrize("page", [0, -1, -100])
    def test_page_below_one_is_clamped(self, page):
        """
        Repos compute offset as (page - 1) * size; a page below 1 gives a
        negative OFFSET, which Postgres rejects. The frontend sends page=0 on
        a live path, so clamp rather than reject.
        """
        assert PaginationRequestSchema(page=page, size=10).page == 1

    def test_size_zero_is_allowed(self):
        """The export paths rely on size=0 meaning 'no limit'."""
        assert PaginationRequestSchema(page=1, size=0).size == 0

    @pytest.mark.parametrize("size", [-1, -25])
    def test_negative_size_is_rejected(self, size):
        with pytest.raises(ValidationError):
            PaginationRequestSchema(page=1, size=size)
