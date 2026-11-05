"""Director approval issues credits atomically through the existing IA flow."""

import asyncio
from datetime import date
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from sqlalchemy import delete, func, select

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.initiative_agreement import DesignatedAction, InitiativeAgreement
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CREDITS_ISSUED,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_LEGACY_AWARD,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_action_workflow import (
    IDIR_DIRECTOR,
    _history,
    _seed_da,
    _seed_requirement,
    _status_of,
    _workflow_url,
)
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_IA_MANAGER,
    _action_status_id,
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.transaction.repo import TransactionRepository


@pytest.fixture
def transactional_requests(fastapi_app, dbsession):
    """Roll back failed requests without removing fixture data."""

    async def session():
        async with dbsession.begin_nested():
            yield dbsession

    previous = fastapi_app.dependency_overrides[get_async_db_session]
    fastapi_app.dependency_overrides[get_async_db_session] = session
    yield
    fastapi_app.dependency_overrides[get_async_db_session] = previous


async def _award(dbsession, transaction_id):
    return (
        await dbsession.execute(
            select(InitiativeAgreement).where(
                InitiativeAgreement.transaction_id == transaction_id
            )
        )
    ).scalar_one()


async def _count(dbsession, model):
    return await dbsession.scalar(select(func.count()).select_from(model))


def _set_actor(fastapi_app, set_mock_user, roles):
    # Starlette freezes middleware after the first request.
    fastapi_app.middleware_stack = None
    set_mock_user(fastapi_app, roles)


@pytest.mark.anyio
@pytest.mark.parametrize("credits", [0, 1200])
async def test_review_through_approval_issues_the_saved_amount(
    client, fastapi_app, set_mock_user, dbsession, credits
):
    action = await _seed_da(dbsession, "IA-ISSUE1")
    if credits:
        action.determination_date = date(2026, 1, 15)
    await _seed_requirement(dbsession, action)
    parent = await dbsession.get(InitiativeAgreement, action.initiative_agreement_id)
    org_id = parent.to_organization_id
    _, other_org_id = await _two_org_ids(dbsession)
    ledger = TransactionRepository(dbsession)
    before = await ledger.calculate_available_balance(org_id)
    other_before = await ledger.calculate_available_balance(other_org_id)

    for roles, payload in (
        (
            IDIR_IA_ANALYST,
            {"action": "recommend_to_manager", "recommendedCredits": credits},
        ),
        (IDIR_IA_MANAGER, {"action": "recommend_to_director"}),
    ):
        _set_actor(fastapi_app, set_mock_user, roles)
        response = await client.put(_workflow_url(fastapi_app, action), json=payload)
        assert response.status_code == status.HTTP_200_OK, response.text
        assert response.json()["transactionId"] is None

    _set_actor(fastapi_app, set_mock_user, IDIR_DIRECTOR)
    response = await client.put(
        _workflow_url(fastapi_app, action),
        # Approval must use the saved amount.
        json={"action": "approve", "recommendedCredits": 1700},
    )
    assert response.status_code == status.HTTP_200_OK, response.text
    transaction_id = response.json()["transactionId"]
    assert transaction_id is not None
    assert await _status_of(dbsession, action) == "Approved"

    transaction = await dbsession.get(Transaction, transaction_id)
    assert transaction.compliance_units == credits
    assert transaction.organization_id == org_id
    assert transaction.transaction_action == TransactionActionEnum.Adjustment
    assert action.recommended_credits == credits
    assert action.determination_date == (
        date(2026, 1, 15) if credits else transaction.effective_date
    )
    award = await _award(dbsession, transaction_id)
    assert award.record_kind == RECORD_KIND_LEGACY_AWARD
    assert award.compliance_units == credits
    assert award.to_organization_id == org_id
    assert parent.transaction_id is None
    await dbsession.refresh(parent)
    assert parent.total_credits_issued == credits
    assert await ledger.calculate_available_balance(org_id) == before + credits
    assert await ledger.calculate_available_balance(other_org_id) == other_before

    issuance = (await _history(dbsession, action))[-1]
    assert issuance.event == EVENT_CREDITS_ISSUED
    assert issuance.display_name == "System"
    assert issuance.user_profile_id is None
    assert issuance.snapshot == {
        "system_generated": True,
        "designated_action_id": action.designated_action_id,
        "initiative_agreement_id": parent.initiative_agreement_id,
        "credit_transaction_id": award.initiative_agreement_id,
        "transaction_id": transaction_id,
        "recommended_credits": credits,
        "approved_by_user_profile_id": 1,
    }
    assert str(action.designated_action_id) in award.gov_comment
    assert parent.ia_code in award.gov_comment

    # These reads verify the database refresh triggers.
    view = (
        await dbsession.execute(
            select(TransactionView).where(
                TransactionView.transaction_type == "InitiativeAgreement",
                TransactionView.transaction_id == award.initiative_agreement_id,
            )
        )
    ).scalar_one()
    assert view.quantity == credits
    assert view.status == "Approved"
    assert view.approved_date is not None
    assert view.transaction_effective_date == transaction.effective_date
    credit = (
        await dbsession.execute(
            select(CreditLedgerView).where(
                CreditLedgerView.transaction_type == "InitiativeAgreement",
                CreditLedgerView.transaction_id == award.initiative_agreement_id,
            )
        )
    ).scalar_one()
    assert credit.compliance_units == credits
    assert credit.organization_id == org_id
    assert not await dbsession.scalar(
        select(func.count())
        .select_from(TransactionView)
        .where(
            TransactionView.transaction_type == "StandaloneTransaction",
            TransactionView.transaction_id == transaction_id,
        )
    )

    transactions = await client.post(
        fastapi_app.url_path_for("get_transactions_paginated"),
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "transactionId",
                    "filterType": "text",
                    "type": "equals",
                    "filter": f"IA{award.initiative_agreement_id}",
                }
            ],
        },
    )
    assert transactions.status_code == status.HTTP_200_OK, transactions.text
    assert transactions.json()["pagination"]["total"] == 1
    assert transactions.json()["transactions"][0]["quantity"] == credits
    detail = await client.get(
        fastapi_app.url_path_for(
            "get_initiative_agreement",
            initiative_agreement_id=award.initiative_agreement_id,
        )
    )
    assert detail.status_code == status.HTTP_200_OK, detail.text
    assert detail.json()["complianceUnits"] == credits

    fastapi_app.middleware_stack = None
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], {"organization_id": org_id})
    supplier_transactions = await client.post(
        fastapi_app.url_path_for("get_transactions_paginated_for_org"),
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "transactionId",
                    "filterType": "text",
                    "type": "equals",
                    "filter": f"IA{award.initiative_agreement_id}",
                }
            ],
        },
    )
    assert (
        supplier_transactions.status_code == status.HTTP_200_OK
    ), supplier_transactions.text
    assert supplier_transactions.json()["pagination"]["total"] == 1
    assert supplier_transactions.json()["transactions"][0]["quantity"] == credits


@pytest.mark.anyio
async def test_repeated_approval_and_status_reexecution_do_not_issue_again(
    client, fastapi_app, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-ISSUE2", "Recommended to director")
    action.recommended_credits = 100
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    approved = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    transaction_id = approved.json()["transactionId"]
    transaction_count = await _count(dbsession, Transaction)
    award_count = await _count(dbsession, InitiativeAgreement)

    repeated = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    assert repeated.status_code == status.HTTP_400_BAD_REQUEST
    action.current_status_id = await _action_status_id(
        dbsession, "Recommended to director"
    )
    await dbsession.flush()
    repeated = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    assert repeated.status_code == status.HTTP_200_OK, repeated.text
    assert repeated.json()["transactionId"] == transaction_id
    assert await _count(dbsession, Transaction) == transaction_count
    assert await _count(dbsession, InitiativeAgreement) == award_count
    assert [h.event for h in await _history(dbsession, action)].count(
        EVENT_CREDITS_ISSUED
    ) == 1
    parent = await dbsession.get(InitiativeAgreement, action.initiative_agreement_id)
    assert parent.total_credits_issued == 100


@pytest.mark.anyio
@pytest.mark.parametrize("credits", [None, -1, 1851])
async def test_invalid_saved_amount_does_not_finalize_approval(
    client, fastapi_app, set_mock_user, dbsession, transactional_requests, credits
):
    action = await _seed_da(dbsession, "IA-ISSUE3", "Recommended to director")
    action.recommended_credits = credits
    await dbsession.flush()
    action_id = action.designated_action_id
    before = await _count(dbsession, Transaction)
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    action = await dbsession.get(DesignatedAction, action_id)
    assert await _status_of(dbsession, action) == "Recommended to director"
    assert action.transaction_id is None
    assert await _count(dbsession, Transaction) == before
    assert not await _history(dbsession, action)


@pytest.mark.anyio
async def test_missing_receiving_organization_does_not_finalize_approval(
    client, fastapi_app, set_mock_user, dbsession, transactional_requests
):
    action = await _seed_da(dbsession, "IA-ISSUE-NO-ORG", "Recommended to director")
    action.recommended_credits = 100
    parent = await dbsession.get(InitiativeAgreement, action.initiative_agreement_id)
    parent.to_organization_id = None
    await dbsession.flush()
    action_id = action.designated_action_id
    before = await _count(dbsession, Transaction)
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    action = await dbsession.get(DesignatedAction, action_id)
    assert await _status_of(dbsession, action) == "Recommended to director"
    assert action.transaction_id is None
    assert await _count(dbsession, Transaction) == before
    assert not await _history(dbsession, action)


@pytest.mark.anyio
@pytest.mark.parametrize("decision", ["return", "reject", "cancelled"])
async def test_unfinalized_or_cancelled_approval_does_not_issue(
    client, fastapi_app, set_mock_user, dbsession, decision
):
    action = await _seed_da(dbsession, "IA-ISSUE4", "Recommended to director")
    action.recommended_credits = 100
    before = await _count(dbsession, Transaction)
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    if decision == "cancelled":
        action.current_status_id = await _action_status_id(dbsession, "Cancelled")
        await dbsession.flush()
        payload = {"action": "approve"}
        expected = status.HTTP_400_BAD_REQUEST
    else:
        payload = {"action": decision, "comment": "Do not issue credits."}
        expected = status.HTTP_200_OK
    response = await client.put(_workflow_url(fastapi_app, action), json=payload)
    assert response.status_code == expected, response.text
    await dbsession.refresh(action)
    assert action.transaction_id is None
    assert await _count(dbsession, Transaction) == before


@pytest.mark.anyio
async def test_failure_after_ledger_creation_rolls_back_the_entire_approval(
    client, fastapi_app, set_mock_user, dbsession, transactional_requests, monkeypatch
):
    action = await _seed_da(dbsession, "IA-ISSUE5", "Recommended to director")
    action.recommended_credits = 100
    await dbsession.flush()
    action_id = action.designated_action_id
    parent_id = action.initiative_agreement_id
    before = await _count(dbsession, Transaction)
    awards_before = await _count(dbsession, InitiativeAgreement)
    monkeypatch.setattr(
        InitiativeAgreementRepository,
        "add_initiative_agreement_history",
        AsyncMock(side_effect=RuntimeError("Issuance failed")),
    )
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    action = await dbsession.get(DesignatedAction, action_id)
    assert await _status_of(dbsession, action) == "Recommended to director"
    assert action.transaction_id is None
    assert await _count(dbsession, Transaction) == before
    assert await _count(dbsession, InitiativeAgreement) == awards_before
    assert not await _history(dbsession, action)
    parent = await dbsession.get(InitiativeAgreement, parent_id)
    assert parent.total_credits_issued == 0


@pytest.mark.anyio
async def test_issuances_for_multiple_actions_add_to_the_correct_agreement(
    client, fastapi_app, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    parent = await _seed_agreement(dbsession, org_id, "IA-ISSUE6")
    other = await _seed_agreement(dbsession, org_id, "IA-ISSUE7")
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    for number, credits in enumerate([100, 250], start=1):
        action = await _seed_action(dbsession, parent, number, "Station", 500)
        action.current_status_id = await _action_status_id(
            dbsession, "Recommended to director"
        )
        action.recommended_credits = credits
        await dbsession.flush()
        response = await client.put(
            _workflow_url(fastapi_app, action), json={"action": "approve"}
        )
        assert response.status_code == status.HTTP_200_OK, response.text
    await dbsession.refresh(parent)
    await dbsession.refresh(other)
    assert parent.total_credits_issued == 350
    assert other.total_credits_issued == 0
    issued = await dbsession.scalar(
        select(func.sum(Transaction.compliance_units))
        .join(
            DesignatedAction,
            DesignatedAction.transaction_id == Transaction.transaction_id,
        )
        .where(
            DesignatedAction.initiative_agreement_id == parent.initiative_agreement_id
        )
    )
    assert parent.total_credits_issued == issued


@pytest.mark.anyio
async def test_issued_recommendation_cannot_be_changed(
    client, fastapi_app, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-ISSUE8", "Recommended to director")
    action.recommended_credits = 100
    set_mock_user(fastapi_app, IDIR_DIRECTOR)
    approved = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )
    assert approved.status_code == status.HTTP_200_OK, approved.text
    _set_actor(fastapi_app, set_mock_user, IDIR_IA_ANALYST)
    changed = await client.put(
        fastapi_app.url_path_for(
            "set_designated_action_recommended_credits",
            designated_action_id=action.designated_action_id,
        ),
        json={"recommendedCredits": 200},
    )
    assert changed.status_code == status.HTTP_400_BAD_REQUEST
    await dbsession.refresh(action)
    assert action.recommended_credits == 100


@pytest.mark.anyio
@pytest.mark.parametrize(
    "different_actions, edit_agreement",
    [(False, False), (True, False), (False, True)],
    ids=["same-action", "same-agreement", "agreement-edit"],
)
async def test_concurrent_requests_issue_once_per_action(
    client,
    fastapi_app,
    set_mock_user,
    dbsession_factory,
    monkeypatch,
    different_actions,
    edit_agreement,
):
    # Use separate transactions to exercise PostgreSQL row locks.
    async with dbsession_factory() as setup:
        async with setup.begin():
            action = await _seed_da(setup, "IA-ISSUE-RACE", "Recommended to director")
            action.recommended_credits = 100
            action_id = action.designated_action_id
            parent_id = action.initiative_agreement_id
            action_ids = [action_id]
            amounts = [100]
            if different_actions:
                parent = await setup.get(InitiativeAgreement, parent_id)
                second = await _seed_action(
                    setup,
                    parent,
                    2,
                    "Second station",
                    500,
                    current_status_id=action.current_status_id,
                    recommended_credits=250,
                )
                action_ids.append(second.designated_action_id)
                amounts.append(250)

    async def request_session():
        async with dbsession_factory() as session:
            async with session.begin():
                yield session

    previous = fastapi_app.dependency_overrides[get_async_db_session]
    fastapi_app.dependency_overrides[get_async_db_session] = request_session
    both_started = asyncio.Event()
    attempts = 0
    get_action = InitiativeAgreementRepository.get_designated_action_by_id

    async def wait_for_competing_approval(
        repo, designated_action_id, *, for_update=False
    ):
        nonlocal attempts
        if for_update and not edit_agreement:
            attempts += 1
            if attempts == 2:
                both_started.set()
        result = await get_action(repo, designated_action_id, for_update=for_update)
        if for_update and not edit_agreement:
            await asyncio.wait_for(both_started.wait(), timeout=10)
        return result

    monkeypatch.setattr(
        InitiativeAgreementRepository,
        "get_designated_action_by_id",
        wait_for_competing_approval,
    )
    if edit_agreement:
        approval_ready = asyncio.Event()
        edit_locked = asyncio.Event()
        add_issued_credits = InitiativeAgreementRepository.add_issued_credits
        update_agreement = InitiativeAgreementServices.update_agreement

        async def wait_for_edit_lock(repo, initiative_agreement_id, credits):
            approval_ready.set()
            await asyncio.wait_for(edit_locked.wait(), timeout=10)
            await add_issued_credits(repo, initiative_agreement_id, credits)

        async def edit_with_parent_locked(service, initiative_agreement_id, data, user):
            await asyncio.wait_for(approval_ready.wait(), timeout=10)
            # Hold the edit's parent-row lock before its flush refreshes views.
            await service.repo.db.execute(
                select(InitiativeAgreement.initiative_agreement_id)
                .where(
                    InitiativeAgreement.initiative_agreement_id
                    == initiative_agreement_id
                )
                .with_for_update(key_share=True)
            )
            edit_locked.set()
            return await update_agreement(service, initiative_agreement_id, data, user)

        monkeypatch.setattr(
            InitiativeAgreementRepository, "add_issued_credits", wait_for_edit_lock
        )
        monkeypatch.setattr(
            InitiativeAgreementServices, "update_agreement", edit_with_parent_locked
        )

    set_mock_user(
        fastapi_app,
        IDIR_DIRECTOR + ([RoleEnum.IA_ANALYST] if edit_agreement else []),
    )
    urls = [
        fastapi_app.url_path_for(
            "perform_designated_action_workflow", designated_action_id=value
        )
        for value in (action_ids if different_actions else [action_id, action_id])
    ]
    payloads = [{"action": "approve"} for _ in urls]
    if edit_agreement:
        urls[1] = fastapi_app.url_path_for(
            "update_agreement", initiative_agreement_id=parent_id
        )
        payloads[1] = {"title": "Edited during approval"}
    try:
        responses = await asyncio.wait_for(
            asyncio.gather(
                *(client.put(url, json=payload) for url, payload in zip(urls, payloads))
            ),
            timeout=30,
        )
        assert sorted(r.status_code for r in responses) == (
            [200, 200] if different_actions or edit_agreement else [200, 400]
        ), [r.text for r in responses]
        async with dbsession_factory() as session:
            for saved_id, amount in zip(action_ids, amounts):
                saved = await session.get(DesignatedAction, saved_id)
                award = await _award(session, saved.transaction_id)
                assert award.compliance_units == amount
                assert [h.event for h in await _history(session, saved)].count(
                    EVENT_CREDITS_ISSUED
                ) == 1
            parent = await session.get(InitiativeAgreement, parent_id)
            assert parent.total_credits_issued == sum(amounts)
            if edit_agreement:
                assert parent.title == "Edited during approval"
    finally:
        fastapi_app.dependency_overrides[get_async_db_session] = previous
        async with dbsession_factory() as session:
            async with session.begin():
                transaction_ids = list(
                    (
                        await session.scalars(
                            select(DesignatedAction.transaction_id).where(
                                DesignatedAction.designated_action_id.in_(action_ids),
                                DesignatedAction.transaction_id.is_not(None),
                            )
                        )
                    ).all()
                )
                if transaction_ids:
                    award_ids = select(
                        InitiativeAgreement.initiative_agreement_id
                    ).where(InitiativeAgreement.transaction_id.in_(transaction_ids))
                    await session.execute(
                        delete(InitiativeAgreementHistory).where(
                            InitiativeAgreementHistory.initiative_agreement_id.in_(
                                award_ids
                            )
                        )
                    )
                await session.execute(
                    delete(DesignatedActionHistory).where(
                        DesignatedActionHistory.designated_action_id.in_(action_ids)
                    )
                )
                await session.execute(
                    delete(DesignatedAction).where(
                        DesignatedAction.designated_action_id.in_(action_ids)
                    )
                )
                if transaction_ids:
                    await session.execute(
                        delete(InitiativeAgreement).where(
                            InitiativeAgreement.transaction_id.in_(transaction_ids)
                        )
                    )
                await session.execute(
                    delete(InitiativeAgreement).where(
                        InitiativeAgreement.initiative_agreement_id == parent_id
                    )
                )
                if transaction_ids:
                    await session.execute(
                        delete(Transaction).where(
                            Transaction.transaction_id.in_(transaction_ids)
                        )
                    )
