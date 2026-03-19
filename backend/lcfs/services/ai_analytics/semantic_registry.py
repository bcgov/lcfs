from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set


ENTITY_DESCRIPTIONS: Dict[str, str] = {
    "vw_compliance_report_flow_metrics": "Compliance report workflow timing metrics such as lead time, cycle time, status, and completion year.",
    "vw_compliance_report_status_timeline": "Ordered compliance report lifecycle history with per-stage durations.",
    "vw_compliance_report_throughput": "Completed compliance reports by period and completion timeframe.",
    "vw_compliance_report_service_levels": "Service level attainment and completed-within-threshold metrics by year and period.",
    "vw_compliance_report_queue_flow": "Monthly submissions versus completions across compliance report workflow.",
    "mv_credit_ledger": "Credit ledger balances and compliance units by organization, transaction, and compliance period.",
    "vw_fuel_supply_analytics_base": "Analytics-ready fuel supply facts with organization, fuel category, and compliance metadata.",
    "vw_fuel_export_analytics_base": "Analytics-ready fuel export facts with organization and fuel metadata.",
    "vw_transfer_base": "Transfer and credit movement facts with counterparties and values.",
    "v_compliance_report": "Business-ready compliance report listing with versioning and reporting context.",
}

SYNONYMS: Dict[str, List[str]] = {
    "credits": ["credits", "credit", "compliance units", "compliance unit", "units"],
    "organization": ["organization", "org", "supplier", "fuel supplier", "company"],
    "compliance_period": ["compliance period", "period", "year", "reporting year"],
    "workflow": ["workflow", "status", "stage", "queue", "review"],
    "processing_time": [
        "processing time",
        "lead time",
        "cycle time",
        "days to complete",
        "turnaround time",
    ],
    "fuel_category": ["fuel category", "fuel type", "fuel", "category"],
    "report_status": ["report status", "workflow stage", "status"],
    "date": ["date", "month", "quarter", "year", "completion year", "create date"],
}


def tokenize_text(*parts: str) -> Set[str]:
    tokens: Set[str] = set()
    for part in parts:
        normalized = (
            part.lower()
            .replace("-", " ")
            .replace("_", " ")
            .replace("/", " ")
            .replace(",", " ")
        )
        for token in normalized.split():
            if token:
                tokens.add(token)
    return tokens


def semantic_tags_for_text(*parts: str) -> List[str]:
    haystack = " ".join(part for part in parts if part).lower()
    tags: List[str] = []
    for tag, synonyms in SYNONYMS.items():
        if any(term in haystack for term in synonyms):
            tags.append(tag)
    return tags


def get_entity_description(
    entity_name: str, fallback: Optional[str] = None
) -> Optional[str]:
    return ENTITY_DESCRIPTIONS.get(entity_name, fallback)


def semantic_registry_payload() -> Dict[str, List[str]]:
    return SYNONYMS


def score_terms_match(question: str, candidates: Iterable[str]) -> int:
    lowered = question.lower()
    score = 0
    for candidate in candidates:
        if candidate and candidate.lower() in lowered:
            score += 1
    return score
