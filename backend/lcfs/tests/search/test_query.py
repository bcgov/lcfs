import pytest

from lcfs.web.api.search.query import parse_query


def test_combines_free_text_with_multiple_inferred_filters():
    query = parse_query("parkland 2023 assessed")

    assert query.text == "parkland"
    assert query.terms == ("parkland",)
    assert query.values("year") == ("2023",)
    assert query.values("status") == ("assessed",)
    assert query.entities == ()


def test_repeated_filter_values_are_retained_and_deduplicated():
    query = parse_query("draft submitted DRAFT 2023 2024")

    assert query.values("status") == ("draft", "submitted")
    assert query.values("year") == ("2023", "2024")
    assert query.applied_filters == {
        "status": "draft, submitted",
        "year": "2023, 2024",
    }


@pytest.mark.parametrize(
    ("raw", "entity", "filters"),
    [
        ("draft transfers", "transfer", {"status": ("draft",)}),
        ("fuel codes", "fuel_code", {}),
        ("ci applications", "ci_application", {}),
        ("idir users", "user", {"user_type": ("idir",)}),
    ],
)
def test_infers_entity_and_common_natural_language_filters(raw, entity, filters):
    query = parse_query(raw)

    assert query.entities == (entity,)
    assert query.text == ""
    for name, values in filters.items():
        assert query.values(name) == values


def test_every_canonical_entity_key_is_recognized_as_bare_text():
    canonical_types = (
        "organization",
        "report",
        "transfer",
        "fuel_code",
        "ci_application",
        "initiative_agreement",
        "admin_adjustment",
        "user",
    )

    for entity_type in canonical_types:
        assert parse_query(entity_type).entities == (entity_type,)


def test_common_filter_value_spelling_is_normalized():
    assert parse_query("cancelled transfers").values("status") == ("canceled",)


def test_multiple_inferred_values_keep_repeated_filter_semantics():
    query = parse_query("draft submitted 2023 2024 transfers")

    assert query.entities == ("transfer",)
    assert query.values("status") == ("draft", "submitted")
    assert query.values("year") == ("2023", "2024")
    assert query.terms == ()


def test_unknown_filter_is_regular_search_text():
    query = parse_query("parkland made_up:value")

    assert query.terms == ("parkland", "made_up:value")
    assert query.filters == {}


def test_unfinished_quote_never_breaks_search_while_user_is_typing():
    query = parse_query('"Parkland Fuels')

    assert query.terms == ("Parkland Fuels",)


def test_context_terms_are_case_insensitively_deduplicated():
    query = parse_query("Parkland parkland 2023")

    assert query.context_terms == ("parkland", "2023")


@pytest.mark.parametrize("raw", ["", " ", "a"])
def test_empty_or_too_short_search_is_empty(raw):
    assert parse_query(raw).is_empty


def test_bare_numeric_query_is_an_exact_id_candidate():
    query = parse_query("42")

    assert query.is_id_only
    assert query.numeric_id == 42


def test_out_of_range_numeric_query_cannot_reach_integer_database_columns():
    query = parse_query("99999999999999999999")

    assert query.is_id_only
    assert query.numeric_id is None
