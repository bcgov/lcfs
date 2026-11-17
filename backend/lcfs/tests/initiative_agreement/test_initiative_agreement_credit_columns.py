"""The agreements grid's calculated credit columns (#5339)."""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import _seed_action
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _action_status_id,
    _seed_agreement,
    _two_org_ids,
)


async def _seed_transaction(dbsession, org_id, units):
    transaction = Transaction(
        transaction_action=TransactionActionEnum.Adjustment,
        compliance_units=units,
        organization_id=org_id,
    )
    dbsession.add(transaction)
    await dbsession.flush()
    return transaction.transaction_id


async def _list(client, fastapi_app, code_prefix, **body):
    response = await client.post(
        fastapi_app.url_path_for("get_initiative_agreements"),
        json={
            **PAGINATION_BODY,
            **body,
            "filters": [
                {
                    "field": "iaCode",
                    "filterType": "text",
                    "type": "startsWith",
                    "filter": code_prefix,
                },
                *body.get("filters", []),
            ],
        },
    )
    assert response.status_code == status.HTTP_200_OK, response.text
    return response.json()["initiativeAgreements"]


async def _seed_credit_scenario(dbsession, org_id, prefix):
    """Three agreements: mixed actions, no actions, and nothing awarded."""
    approved = await _action_status_id(dbsession, "Approved")
    underway = await _action_status_id(dbsession, "Underway")

    mixed = await _seed_agreement(dbsession, org_id, f"{prefix}-MIX")
    # Approved with a resulting transaction: counts toward both columns.
    await _seed_action(
        dbsession,
        mixed,
        1,
        "Awarded",
        credits=1000,
        current_status_id=approved,
        recommended_credits=800,
        transaction_id=await _seed_transaction(dbsession, org_id, 800),
    )
    # Not approved: counts toward total only.
    changed = await _seed_action(
        dbsession, mixed, 2, "Changed", credits=500, current_status_id=underway
    )
    # A change order supersedes the action's earlier version.
    await _seed_action(
        dbsession,
        mixed,
        2,
        "Changed",
        credits=700,
        current_status_id=underway,
        group_uuid=changed.group_uuid,
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )
    # Approved but never issued: no resulting transaction, so not awarded.
    await _seed_action(
        dbsession,
        mixed,
        3,
        "Approved, not issued",
        credits=200,
        current_status_id=approved,
        recommended_credits=150,
    )
    # Deleted: counts toward neither.
    await _seed_action(
        dbsession,
        mixed,
        4,
        "Deleted",
        credits=300,
        current_status_id=underway,
        action_type=ActionTypeEnum.DELETE,
    )

    await _seed_agreement(dbsession, org_id, f"{prefix}-NONE")

    pending = await _seed_agreement(dbsession, org_id, f"{prefix}-PEND")
    await _seed_action(dbsession, pending, 1, "Pending", credits=50)
    return mixed, pending


@pytest.mark.anyio
async def test_list_calculates_total_and_awarded_credits_from_designated_actions(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    await _seed_credit_scenario(dbsession, org_id, "IA-26CRD")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    rows = {row["iaCode"]: row for row in await _list(client, fastapi_app, "IA-26CRD")}

    # 1000 + 700 (current version) + 200; the delete and the superseded
    # version do not count. Only the issued approval is awarded.
    assert rows["IA-26CRD-MIX"]["totalCredits"] == 1900
    assert rows["IA-26CRD-MIX"]["awardedCredits"] == 800
    assert rows["IA-26CRD-NONE"]["totalCredits"] == 0
    assert rows["IA-26CRD-NONE"]["awardedCredits"] == 0
    assert rows["IA-26CRD-PEND"]["totalCredits"] == 50
    assert rows["IA-26CRD-PEND"]["awardedCredits"] == 0


@pytest.mark.anyio
async def test_list_sorts_by_the_credit_columns(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    await _seed_credit_scenario(dbsession, org_id, "IA-26CRS")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    by_total = await _list(
        client,
        fastapi_app,
        "IA-26CRS",
        sortOrders=[{"field": "totalCredits", "direction": "desc"}],
    )
    assert [r["iaCode"] for r in by_total] == [
        "IA-26CRS-MIX",
        "IA-26CRS-PEND",
        "IA-26CRS-NONE",
    ]

    by_awarded = await _list(
        client,
        fastapi_app,
        "IA-26CRS",
        sortOrders=[{"field": "awardedCredits", "direction": "desc"}],
    )
    assert by_awarded[0]["iaCode"] == "IA-26CRS-MIX"


@pytest.mark.anyio
async def test_list_filters_by_the_credit_columns(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    await _seed_credit_scenario(dbsession, org_id, "IA-26CRF")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    async def codes(field, type_, value):
        rows = await _list(
            client,
            fastapi_app,
            "IA-26CRF",
            filters=[
                {
                    "field": field,
                    "filterType": "number",
                    "type": type_,
                    "filter": value,
                }
            ],
        )
        return {r["iaCode"] for r in rows}

    assert await codes("totalCredits", "greaterThan", 100) == {"IA-26CRF-MIX"}
    assert await codes("totalCredits", "equals", 0) == {"IA-26CRF-NONE"}
    assert await codes("awardedCredits", "greaterThanOrEqual", 800) == {"IA-26CRF-MIX"}
    assert await codes("awardedCredits", "equals", 0) == {
        "IA-26CRF-NONE",
        "IA-26CRF-PEND",
    }
    # Fractional and unusable values must not break the request.
    assert await codes("totalCredits", "greaterThan", 99.5) == {"IA-26CRF-MIX"}
    assert await codes("totalCredits", "lessThan", 49.5) == {"IA-26CRF-NONE"}
    assert await codes("totalCredits", "lessThan", 50.5) == {
        "IA-26CRF-NONE",
        "IA-26CRF-PEND",
    }
    assert len(await codes("totalCredits", "equals", "abc")) == 3
    assert len(await codes("totalCredits", "equals", "NaN")) == 3
