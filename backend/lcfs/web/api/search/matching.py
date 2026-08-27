"""Composable SQLAlchemy primitives for global search."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Optional, Sequence, Tuple

from sqlalchemy import String, and_, case, cast, false, func, literal, or_
from sqlalchemy.sql.elements import ColumnElement

from lcfs.web.api.search.query import MAX_RECORD_ID, SearchQuery

_REGEX_META = re.compile(r"([.^$*+?()\[\]{}|\\])")


@dataclass(frozen=True)
class SearchField:
    """One searchable expression and the behaviour attached to it."""

    label: str
    expression: Any
    primary: bool = False
    fuzzy: bool = False
    searchable: bool = True


def text_expression(expression: Any) -> ColumnElement[str]:
    """Coerce enums, numbers, and other scalar expressions to text."""
    return cast(expression, String)


def date_text_expression(expression: Any) -> ColumnElement[str]:
    """Represent a date for match explanations, not for year filtering."""
    return func.to_char(expression, "YYYY-MM-DD")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _base_match(expression: Any, term: str) -> ColumnElement[bool]:
    if len(term) <= 4 and " " not in term:
        pattern = r"\m" + _REGEX_META.sub(r"\\\1", term)
        return expression.op("~*")(pattern)
    return expression.ilike(f"%{_escape_like(term)}%", escape="\\")


def _field_match(field: SearchField, term: str) -> ColumnElement[bool]:
    value = text_expression(field.expression)
    raw = _base_match(value, term)
    if not field.fuzzy:
        return raw
    normalized = func.regexp_replace(value, r"[^\w\s]", "", "g")
    return or_(raw, _base_match(normalized, term))


def search_clause(
    fields: Sequence[SearchField], query: SearchQuery
) -> Tuple[Optional[ColumnElement[bool]], Optional[ColumnElement[Any]]]:
    """Return a relevance predicate and score for the free-text terms."""
    searchable = [field for field in fields if field.searchable]
    if not query.terms or query.is_id_only or not searchable:
        return None, None

    per_term = [
        or_(*[_field_match(field, term) for field in searchable])
        for term in query.terms
    ]
    score = sum((case((condition, 1), else_=0) for condition in per_term), literal(0))
    required = (
        len(query.terms) if len(query.terms) <= 2 else math.ceil(len(query.terms) * 0.6)
    )
    primary = [field for field in searchable if field.primary]
    primary_hit = (
        or_(*[_field_match(field, term) for field in primary for term in query.terms])
        if primary
        else or_(*per_term)
    )
    return and_(score >= required, primary_hit), score


def _match_excerpt(expression: Any, term: str) -> ColumnElement[str]:
    """Return only persisted text, including for punctuation-normalized matches."""
    value = text_expression(expression)
    position = func.strpos(func.lower(value), term.casefold())
    start = func.greatest(position - 40, 1)
    excerpt = func.substr(value, start, 100)
    return case(
        (
            position > 0,
            func.concat(
                case((start > 1, "…"), else_=""),
                excerpt,
                case((func.length(value) > start + 99, "…"), else_=""),
            ),
        ),
        else_=func.substr(value, 1, 100),
    )


def match_context_expression(
    fields: Sequence[SearchField], query: SearchQuery
) -> ColumnElement[str]:
    """Return labelled values explaining where each query term matched."""
    if not query.context_terms:
        return cast(literal(None), String).label("match_context")

    matches = []
    for term in query.context_terms:
        matched_value = case(
            *[
                (
                    _field_match(field, term),
                    func.concat(
                        field.label,
                        ": ",
                        _match_excerpt(field.expression, term),
                    ),
                )
                for field in fields
            ],
            else_=None,
        )
        matches.append(matched_value)
    return func.concat_ws(" · ", *matches).label("match_context")


def relevance_rank(expression: Any, query: SearchQuery) -> ColumnElement[int]:
    """Prefer exact primary values, then prefixes, then substrings."""
    if not query.text:
        return literal(0)
    value = func.lower(text_expression(expression))
    normalized = _escape_like(query.text.strip().casefold())
    return case(
        (value == query.text.strip().casefold(), 100),
        (value.like(f"{normalized}%", escape="\\"), 60),
        (value.like(f"%{normalized}%", escape="\\"), 30),
        else_=0,
    )


def contains_any(
    expression: Any, values: Iterable[str]
) -> Optional[ColumnElement[bool]]:
    """Case-insensitive substring match for any supplied filter value."""
    values = tuple(value for value in values if value)
    if not values:
        return None
    text = text_expression(expression)
    return or_(
        *[text.ilike(f"%{_escape_like(value)}%", escape="\\") for value in values]
    )


def equals_any(expression: Any, values: Iterable[str]) -> Optional[ColumnElement[bool]]:
    """Case-insensitive exact match for enumerated filter values."""
    normalized = tuple(value.strip().casefold() for value in values if value.strip())
    if not normalized:
        return None
    return func.lower(text_expression(expression)).in_(normalized)


def contains_any_field(
    expressions: Iterable[Any], values: Iterable[str]
) -> Optional[ColumnElement[bool]]:
    """Match any value against any of the supplied expressions."""
    values = tuple(values)
    clauses = tuple(
        clause
        for expression in expressions
        if (clause := contains_any(expression, values)) is not None
    )
    return or_(*clauses) if clauses else None


def starts_with_any(
    expression: Any, values: Iterable[str]
) -> Optional[ColumnElement[bool]]:
    values = tuple(value for value in values if value)
    if not values:
        return None
    text = text_expression(expression)
    return or_(
        *[text.ilike(f"{_escape_like(value)}%", escape="\\") for value in values]
    )


def date_years(expression: Any, values: Iterable[str]) -> Optional[ColumnElement[bool]]:
    """Build index-friendly date ranges instead of formatting the column."""
    raw_values = tuple(value.strip() for value in values if value.strip())
    clauses = []
    for value in raw_values:
        if len(value) != 4 or not value.isdigit() or not value.startswith(("19", "20")):
            continue
        year = int(value)
        clauses.append(
            and_(expression >= date(year, 1, 1), expression < date(year + 1, 1, 1))
        )
    if clauses:
        return or_(*clauses)
    return false() if raw_values else None


def ids_filter(expression: Any, values: Iterable[str]) -> Optional[ColumnElement[bool]]:
    """Match explicit numeric IDs; malformed IDs intentionally match nothing."""
    raw_values = tuple(value.strip() for value in values if value.strip())
    if not raw_values:
        return None
    identifiers = [
        identifier
        for value in raw_values
        if value.isdigit() and 0 < (identifier := int(value)) <= MAX_RECORD_ID
    ]
    return expression.in_(identifiers) if identifiers else false()


def applies(query: SearchQuery, supported: Iterable[str], entity: str) -> bool:
    """Return whether this entity can contribute meaningful results."""
    supported_filters = set(supported)
    requested_filters = set(query.filters)

    if not requested_filters.issubset(supported_filters):
        return False
    if query.entities and entity not in query.entities:
        return False
    if query.terms:
        return True
    return bool(query.entities or requested_filters)
