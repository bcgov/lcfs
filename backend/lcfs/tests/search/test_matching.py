from sqlalchemy import column
from sqlalchemy.dialects import postgresql

from lcfs.web.api.search.matching import (
    SearchField,
    _base_match,
    _escape_like,
    _match_excerpt,
    applies,
    contains_any,
    contains_any_field,
    date_years,
    equals_any,
    ids_filter,
    search_clause,
)
from lcfs.web.api.search.query import parse_query


def _sql(expression) -> str:
    return str(
        expression.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_date_year_filter_uses_index_friendly_ranges():
    sql = _sql(date_years(column("created_at"), ("2023", "2024")))

    assert "to_char" not in sql
    assert "created_at >= '2023-01-01'" in sql
    assert "created_at < '2024-01-01'" in sql
    assert "created_at >= '2024-01-01'" in sql
    assert "created_at < '2025-01-01'" in sql


def test_malformed_explicit_id_matches_nothing():
    assert _sql(ids_filter(column("record_id"), ("not-a-number",))) == "false"


def test_out_of_range_explicit_id_matches_nothing():
    assert _sql(ids_filter(column("record_id"), ("99999999999999999999",))) == "false"


def test_status_filter_is_exact_not_a_substring():
    sql = _sql(equals_any(column("status"), ("active", "draft")))

    assert "lower(CAST(status AS VARCHAR)) IN ('active', 'draft')" == sql


def test_malformed_year_matches_nothing():
    assert _sql(date_years(column("created_at"), ("9999",))) == "false"


def test_like_wildcards_from_user_input_are_escaped():
    sql = _sql(contains_any(column("name"), ("100%", "A_B")))

    assert _escape_like("100%_complete") == r"100\%\_complete"
    assert "ESCAPE" in sql


def test_search_clause_combines_terms_and_requires_primary_context():
    query = parse_query("parkland vancouver")
    clause, score = search_clause(
        [
            SearchField("Name", column("name"), primary=True, fuzzy=True),
            SearchField("City", column("city")),
        ],
        query,
    )
    sql = _sql(clause)

    assert score is not None
    assert "parkland" in sql
    assert "vancouver" in sql
    assert "name" in sql
    assert "city" in sql


def test_short_partial_word_matches_from_the_start_of_a_word():
    sql = _sql(_base_match(column("city"), "prin"))

    assert r"\mprin" in sql
    assert r"\M" not in sql


def test_short_partial_word_escapes_regex_metacharacters():
    expression = _base_match(column("code"), "b.c")

    assert expression.right.value == r"\mb\.c"


def test_longer_partial_word_uses_case_insensitive_substring_matching():
    sql = _sql(_base_match(column("city"), "georg"))

    assert "ILIKE '%%georg%%'" in sql


def test_match_excerpt_fallback_contains_only_the_stored_value():
    sql = _sql(_match_excerpt(column("name"), "bc"))

    assert "bc —" not in sql
    assert "substr(CAST(name AS VARCHAR), 1, 100)" in sql


def test_contains_any_field_returns_none_when_no_values_are_supplied():
    assert contains_any_field((column("name"), column("city")), ()) is None


def test_entity_must_support_every_combined_filter():
    query = parse_query("approved 2023")

    assert applies(query, {"status", "year"}, "fuel_code")
    assert not applies(query, {"status", "org"}, "transfer")


def test_entity_type_restricts_results_without_becoming_a_data_filter():
    query = parse_query("active users")

    assert applies(query, {"status", "org", "user_type", "id"}, "user")
    assert not applies(query, {"status", "city", "org", "id"}, "organization")
