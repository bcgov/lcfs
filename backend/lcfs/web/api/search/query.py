"""Parsing and normalization for the global-search query language."""

from __future__ import annotations

import re
import shlex
from dataclasses import dataclass
from types import MappingProxyType
from typing import Iterable, Mapping, Optional, Tuple

_YEAR_RE = re.compile(r"^(19|20)\d{2}$")
MAX_RECORD_ID = 2_147_483_647
MIN_TERM_LENGTH = 2

_FILTER_VALUE_ALIASES = {
    "status": {
        "cancelled": "canceled",
    },
}

_ENTITY_ALIASES = {
    "organization": {"organizations", "org", "orgs", "supplier", "suppliers"},
    "report": {"reports", "compliance report", "compliance reports"},
    "transfer": {"transfers"},
    "fuel_code": {"fuel codes"},
    "ci_application": {"ci", "ci applications"},
    "initiative_agreement": {"initiative agreements"},
    "admin_adjustment": {"administrative adjustment", "administrative adjustments"},
    "user": {"users", "person", "people", "staff"},
}

_STATUS_WORDS = {
    "draft",
    "deleted",
    "sent",
    "submitted",
    "recommended",
    "recorded",
    "refused",
    "declined",
    "rescinded",
    "assessed",
    "exempted",
    "rejected",
    "approved",
    "registered",
    "unregistered",
    "suspended",
    "canceled",
    "cancelled",
    "active",
    "inactive",
}
_USER_AUDIENCE_WORDS = {"idir", "bceid"}


def _normalize_alias(value: str) -> str:
    return re.sub(r"[\s_-]+", "", value).casefold()


_ALIAS_TO_ENTITY = {
    _normalize_alias(alias): entity
    for entity, aliases in _ENTITY_ALIASES.items()
    for alias in aliases | {entity}
}


def _try_shell_split(raw: str) -> Optional[list[str]]:
    try:
        return shlex.split(raw, posix=True)
    except ValueError:
        return None


def _split(raw: str) -> list[str]:
    """Split like a shell so quoted phrases remain one search term."""
    parts = _try_shell_split(raw)
    if parts is not None:
        return parts

    if raw.count('"') % 2:
        parts = _try_shell_split(f'{raw}"')
        if parts is not None:
            return parts
    return raw.replace('"', "").replace("'", "").split()


def _append(values: dict[str, list[str]], key: str, value: str) -> None:
    stripped = value.strip()
    normalized = _FILTER_VALUE_ALIASES.get(key, {}).get(stripped.casefold(), stripped)
    if normalized and normalized.casefold() not in {
        existing.casefold() for existing in values.get(key, [])
    }:
        values.setdefault(key, []).append(normalized)


def _infer_filters(terms: Iterable[str]) -> Tuple[dict[str, list[str]], list[str]]:
    """Infer status/year/user_type filters from bare search terms."""
    filters: dict[str, list[str]] = {}
    remaining: list[str] = []
    for term in terms:
        normalized = term.casefold()
        if _YEAR_RE.fullmatch(normalized):
            _append(filters, "year", normalized)
        elif normalized in _STATUS_WORDS:
            _append(filters, "status", normalized)
        elif normalized in _USER_AUDIENCE_WORDS:
            _append(filters, "user_type", normalized)
        else:
            remaining.append(term)
    return filters, remaining


def _resolve_entities(terms: list[str]) -> Tuple[Tuple[str, ...], list[str]]:
    if not terms:
        return (), terms

    inferred = _ALIAS_TO_ENTITY.get(_normalize_alias(" ".join(terms)))
    return ((inferred,), []) if inferred is not None else ((), terms)


@dataclass(frozen=True)
class SearchQuery:
    """Normalized, immutable representation of one global-search request."""

    raw: str
    text: str
    terms: Tuple[str, ...]
    filters: Mapping[str, Tuple[str, ...]]
    entities: Tuple[str, ...]

    @property
    def is_empty(self) -> bool:
        return not self.terms and not self.filters and not self.entities

    @property
    def is_id_only(self) -> bool:
        return len(self.terms) == 1 and self.terms[0].isdigit()

    @property
    def numeric_id(self) -> Optional[int]:
        if not self.is_id_only:
            return None
        value = int(self.terms[0])
        return value if 0 < value <= MAX_RECORD_ID else None

    def values(self, key: str) -> Tuple[str, ...]:
        return self.filters.get(key, ())

    @property
    def context_terms(self) -> Tuple[str, ...]:
        values = list(self.terms)
        for key, filter_values in self.filters.items():
            if key != "user_type":
                values.extend(filter_values)
        return tuple(dict.fromkeys(value.casefold() for value in values if value))

    @property
    def applied_filters(self) -> dict[str, str]:
        """Serialize repeated values without changing the public API shape."""
        return {key: ", ".join(values) for key, values in self.filters.items()}


def parse_query(raw: str) -> SearchQuery:
    mutable_filters, remaining = _infer_filters(_split(raw))
    entities, remaining = _resolve_entities(remaining)
    meaningful_terms = tuple(
        term.strip() for term in remaining if len(term.strip()) >= MIN_TERM_LENGTH
    )
    filters = MappingProxyType(
        {key: tuple(values) for key, values in mutable_filters.items()}
    )
    return SearchQuery(
        raw=raw,
        text=" ".join(meaningful_terms),
        terms=meaningful_terms,
        filters=filters,
        entities=entities,
    )
