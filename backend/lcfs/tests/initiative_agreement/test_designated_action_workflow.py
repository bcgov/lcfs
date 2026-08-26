"""Designated action workflow: statuses, recommendations, audit (#4898).

The transition table is the feature, so most of these assert against it
directly: who may act, from where, what lands, and what the audit trail
keeps. Credit issuance is out of scope for this story and no test here
expects any transaction to move.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CREDITS_RECOMMENDED,
    EVENT_EVIDENCE_REVIEWED,
    EVENT_INFORMATION_REQUESTED,
    EVENT_STATUS_CHANGE,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
    REVIEW_OUTCOME_SATISFACTORY,
    EvidenceRequirement,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_IA_MANAGER,
    _action_status_id,
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _seed_agreement,
    _two_org_ids,
)

IDIR_DIRECTOR = [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT]


async def _seed_da(dbsession, code, status_name="Underway", credits=1850):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, code)
    action = await _seed_action(dbsession, agreement, 1, "Commission station", credits)
    action.current_status_id = await _action_status_id(dbsession, status_name)
    await dbsession.flush()
    return action


async def _seed_requirement(dbsession, action, outcome=REVIEW_OUTCOME_SATISFACTORY):
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        description="List of major permits",
        analyst_review="Permits verified.",
        review_outcome=outcome,
    )
    dbsession.add(requirement)
    await dbsession.flush()
    return requirement


def _workflow_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "perform_designated_action_workflow",
        designated_action_id=action.designated_action_id,
    )


async def _status_of(dbsession, action):
    from lcfs.db.models.initiative_agreement.DesignatedActionStatus import (
        DesignatedActionStatus,
    )

    await dbsession.refresh(action)
    return (
        await dbsession.execute(
            select(DesignatedActionStatus.status).where(
                DesignatedActionStatus.designated_action_status_id
                == action.current_status_id
            )
        )
    ).scalar_one()


async def _history(dbsession, action):
    result = await dbsession.execute(
        select(DesignatedActionHistory)
        .where(
            DesignatedActionHistory.designated_action_id == action.designated_action_id
        )
        .order_by(DesignatedActionHistory.designated_action_history_id)
    )
    return list(result.scalars().all())


@pytest.mark.anyio
async def test_requesting_information_keeps_the_round_in_the_audit_trail(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The snapshot carries the review itself, not just the fact that a
    round happened — otherwise the next round overwrites this one's
    findings and they are gone."""
    action = await _seed_da(dbsession, "IA-26WF1")
    await _seed_requirement(dbsession, action, REVIEW_OUTCOME_INFORMATION_REQUESTED)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action),
        json={
            "action": "request_information",
            "comment": "Please send the signed permit for stage two.",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert await _status_of(dbsession, action) == "Information requested"

    entries = await _history(dbsession, action)
    assert [e.event for e in entries] == [EVENT_INFORMATION_REQUESTED]
    snapshot = entries[0].snapshot
    assert snapshot["comment"] == "Please send the signed permit for stage two."
    captured = snapshot["evidence_requirements"]
    assert captured[0]["analyst_review"] == "Permits verified."
    assert captured[0]["review_outcome"] == REVIEW_OUTCOME_INFORMATION_REQUESTED


@pytest.mark.anyio
async def test_requesting_information_requires_saying_what_is_needed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF2")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "request_information"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_accepting_evidence_requires_every_requirement_satisfactory(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF3")
    requirement = await _seed_requirement(
        dbsession, action, REVIEW_OUTCOME_INFORMATION_REQUESTED
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    blocked = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "accept_evidence"}
    )
    assert blocked.status_code == status.HTTP_400_BAD_REQUEST
    assert not await _history(dbsession, action)

    requirement.review_outcome = REVIEW_OUTCOME_SATISFACTORY
    await dbsession.flush()

    accepted = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "accept_evidence"}
    )
    assert accepted.status_code == status.HTTP_200_OK
    entries = await _history(dbsession, action)
    assert [e.event for e in entries] == [EVENT_EVIDENCE_REVIEWED]
    # Accepting records what was accepted; it is not a status hand-off.
    assert entries[0].snapshot["evidence_requirements"][0]["review_outcome"] == (
        REVIEW_OUTCOME_SATISFACTORY
    )


@pytest.mark.anyio
async def test_the_analyst_recommends_with_an_amount(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF4", credits=1850)
    await _seed_requirement(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "recommend_to_manager", "recommendedCredits": 1200},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["recommendedCredits"] == 1200
    assert await _status_of(dbsession, action) == "Recommended to manager"

    entries = await _history(dbsession, action)
    assert entries[-1].event == EVENT_CREDITS_RECOMMENDED
    assert entries[-1].snapshot["recommended_credits"] == 1200


@pytest.mark.anyio
async def test_recommending_needs_an_amount_and_satisfactory_evidence(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF5")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    # No requirements reviewed yet.
    no_evidence = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "recommend_to_manager", "recommendedCredits": 10},
    )
    assert no_evidence.status_code == status.HTTP_400_BAD_REQUEST

    await _seed_requirement(dbsession, action)
    no_amount = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "recommend_to_manager"}
    )
    assert no_amount.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_a_recommendation_cannot_exceed_the_allocation(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF6", credits=1000)
    await _seed_requirement(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "recommend_to_manager", "recommendedCredits": 1001},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_zero_is_a_real_recommendation(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Nought credits is a decision, not a missing value."""
    action = await _seed_da(dbsession, "IA-26WF7", credits=1000)
    await _seed_requirement(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "recommend_to_manager", "recommendedCredits": 0},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["recommendedCredits"] == 0


@pytest.mark.anyio
async def test_the_manager_returns_or_advances_to_the_director(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WF8", status_name="Recommended to manager")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    returned = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "return", "comment": "Please revisit requirement two."},
    )
    assert returned.status_code == status.HTTP_200_OK
    assert await _status_of(dbsession, action) == "Returned"

    action.current_status_id = await _action_status_id(
        dbsession, "Recommended to manager"
    )
    await dbsession.flush()

    advanced = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "recommend_to_director"}
    )
    assert advanced.status_code == status.HTTP_200_OK
    assert await _status_of(dbsession, action) == "Recommended to director"


@pytest.mark.anyio
async def test_the_director_approves(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Approved is the terminal reviewed state the ticket calls Completed.
    No credits move — issuance is a separate step."""
    action = await _seed_da(
        dbsession, "IA-26WF9", status_name="Recommended to director"
    )
    await _seed_requirement(dbsession, action)
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert await _status_of(dbsession, action) == "Approved"
    assert response.json()["transactionId"] is None

    entries = await _history(dbsession, action)
    assert entries[-1].event == EVENT_STATUS_CHANGE
    # The approval preserves what was approved.
    assert "evidence_requirements" in entries[-1].snapshot


@pytest.mark.anyio
async def test_the_director_rejects_with_a_reason(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(
        dbsession, "IA-26WFA", status_name="Recommended to director"
    )
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    no_reason = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "reject"}
    )
    assert no_reason.status_code == status.HTTP_400_BAD_REQUEST

    rejected = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "reject", "comment": "Evidence does not support the claim."},
    )
    assert rejected.status_code == status.HTTP_200_OK
    assert await _status_of(dbsession, action) == "Rejected"


@pytest.mark.anyio
async def test_an_analyst_cannot_approve(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(
        dbsession, "IA-26WFB", status_name="Recommended to director"
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_a_manager_cannot_approve_their_own_recommendation(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Approval is the director's alone; a manager may only advance it."""
    action = await _seed_da(
        dbsession, "IA-26WFC", status_name="Recommended to director"
    )
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_an_action_cannot_skip_the_chain(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WFD", status_name="Underway")
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "approve"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_an_unknown_action_is_refused(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WFE")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _workflow_url(fastapi_app, action), json={"action": "issue_the_credits"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_proponents_are_refused_the_workflow(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WFF")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "request_information", "comment": "hello"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_the_profile_offers_only_the_actions_this_caller_can_take(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(
        dbsession, "IA-26WFG", status_name="Recommended to director"
    )
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    profile = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_profile",
            designated_action_id=action.designated_action_id,
        )
    )

    available = profile.json()["availableActions"]
    assert set(available) == {"approve", "reject", "return"}


@pytest.mark.anyio
async def test_the_history_endpoint_returns_the_trail_newest_first(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26WFH")
    await _seed_requirement(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    await client.put(
        _workflow_url(fastapi_app, action), json={"action": "accept_evidence"}
    )
    await client.put(
        _workflow_url(fastapi_app, action),
        json={"action": "recommend_to_manager", "recommendedCredits": 5},
    )

    response = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_history",
            designated_action_id=action.designated_action_id,
        )
    )

    assert response.status_code == status.HTTP_200_OK
    events = [entry["event"] for entry in response.json()]
    assert events == [EVENT_CREDITS_RECOMMENDED, EVENT_EVIDENCE_REVIEWED]


@pytest.mark.anyio
async def test_the_history_names_the_analyst_rather_than_an_id(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Assignment events store ids; a reader needs names."""
    from lcfs.tests.initiative_agreement.test_designated_actions_api import (
        _seed_ia_analyst,
    )

    action = await _seed_da(dbsession, "IA-26WFI")
    first = await _seed_ia_analyst(dbsession, "hfong", "Harriet", "Fong")
    second = await _seed_ia_analyst(dbsession, "jwills", "Jo", "Willems")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    assign_url = fastapi_app.url_path_for(
        "assign_designated_action_analyst",
        designated_action_id=action.designated_action_id,
    )
    await client.put(assign_url, json={"assignedAnalystId": first.user_profile_id})
    await client.put(assign_url, json={"assignedAnalystId": second.user_profile_id})

    response = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_history",
            designated_action_id=action.designated_action_id,
        )
    )

    assert response.status_code == status.HTTP_200_OK
    reassignment = response.json()[0]
    assert reassignment["snapshot"]["from_analyst"] == "Harriet Fong"
    assert reassignment["snapshot"]["to_analyst"] == "Jo Willems"
    # The stable ids are still there underneath.
    assert reassignment["snapshot"]["from_analyst_id"] == first.user_profile_id


@pytest.mark.anyio
async def test_an_unassignment_names_only_who_was_removed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    from lcfs.tests.initiative_agreement.test_designated_actions_api import (
        _seed_ia_analyst,
    )

    action = await _seed_da(dbsession, "IA-26WFJ")
    analyst = await _seed_ia_analyst(dbsession, "kpatel", "Kiran", "Patel")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    assign_url = fastapi_app.url_path_for(
        "assign_designated_action_analyst",
        designated_action_id=action.designated_action_id,
    )
    await client.put(assign_url, json={"assignedAnalystId": analyst.user_profile_id})
    await client.put(assign_url, json={"assignedAnalystId": None})

    response = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_history",
            designated_action_id=action.designated_action_id,
        )
    )

    unassignment = response.json()[0]
    assert unassignment["snapshot"]["from_analyst"] == "Kiran Patel"
    assert unassignment["snapshot"]["to_analyst"] is None
