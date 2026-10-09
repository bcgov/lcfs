"""Designated action grid, analyst assignment and change log (#4896)."""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import date, datetime, timezone

from sqlalchemy import select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.comment.DesignatedActionInternalComment import (
    DesignatedActionInternalComment,
)
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.initiative_agreement import DesignatedAction
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_ANALYST_ASSIGNED,
    EVENT_ANALYST_REASSIGNED,
    EVENT_ANALYST_UNASSIGNED,
    DesignatedActionHistory,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _lifecycle_status_id,
    PAGINATION_BODY,
    _action_status_id,
    _seed_agreement,
    _two_org_ids,
)

IDIR_IA_MANAGER = [RoleEnum.IA_MANAGER, RoleEnum.GOVERNMENT]
IDIR_DIRECTOR = [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT]


async def _seed_action(dbsession, agreement, number, name, credits=1000, **overrides):
    # Overrides win over the defaults, so a test can seed any status.
    fields = {
        "initiative_agreement_id": agreement.initiative_agreement_id,
        "action_number": number,
        "name": name,
        "credit_allocation": credits,
        "current_status_id": await _action_status_id(dbsession, "Not started"),
    }
    fields.update(overrides)
    action = DesignatedAction(**fields)
    dbsession.add(action)
    await dbsession.flush()
    return action


async def _seed_ia_analyst(dbsession, username, first, last):
    """An active IDIR user holding the IA Analyst role."""
    user = UserProfile(
        keycloak_email=f"{username}@gov.bc.ca",
        keycloak_username=username,
        email=f"{username}@gov.bc.ca",
        first_name=first,
        last_name=last,
        organization_id=None,
        is_active=True,
    )
    dbsession.add(user)
    await dbsession.flush()
    role_id = (
        await dbsession.execute(
            select(Role.role_id).where(Role.name == RoleEnum.IA_ANALYST)
        )
    ).scalar_one()
    dbsession.add(UserRole(user_profile_id=user.user_profile_id, role_id=role_id))
    await dbsession.flush()
    return user


def _list_url(fastapi_app, agreement):
    return fastapi_app.url_path_for(
        "get_designated_actions",
        initiative_agreement_id=agreement.initiative_agreement_id,
    )


@pytest.mark.anyio
async def test_grid_lists_current_actions_with_analyst_and_dates(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26GRID1")
    analyst = await _seed_ia_analyst(dbsession, "kchan", "Kenneth", "Chan")
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Commission station",
        1850,
        assigned_analyst_id=analyst.user_profile_id,
    )
    await _seed_action(dbsession, agreement, 2, "Production facility", 27309)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _list_url(fastapi_app, agreement), json=PAGINATION_BODY
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["total"] == 2
    rows = data["designatedActions"]
    assert [r["actionNumber"] for r in rows] == [1, 2]
    assert rows[0]["assignedAnalyst"]["firstName"] == "Kenneth"
    assert rows[1]["assignedAnalyst"] is None
    assert rows[0]["creditAllocation"] == 1850
    assert rows[0]["updateDate"] is not None
    assert rows[0]["lastComment"] is None


@pytest.mark.anyio
async def test_grid_shows_one_row_per_amended_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26GRID2")
    original = await _seed_action(dbsession, agreement, 1, "Original scope", 1000)
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Amended scope",
        1500,
        group_uuid=original.group_uuid,
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _list_url(fastapi_app, agreement), json=PAGINATION_BODY
    )

    rows = response.json()["designatedActions"]
    assert len(rows) == 1
    assert rows[0]["name"] == "Amended scope"


@pytest.mark.anyio
async def test_grid_filters_by_name_and_assigned_analyst(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26GRID3")
    analyst = await _seed_ia_analyst(dbsession, "efong", "Erin", "Fong")
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Charging corridor",
        500,
        assigned_analyst_id=analyst.user_profile_id,
    )
    await _seed_action(dbsession, agreement, 2, "Hydrogen station", 700)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    by_name = await client.post(
        _list_url(fastapi_app, agreement),
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "name",
                    "filterType": "text",
                    "type": "contains",
                    "filter": "hydrogen",
                }
            ],
        },
    )
    assert [r["name"] for r in by_name.json()["designatedActions"]] == [
        "Hydrogen station"
    ]

    by_analyst = await client.post(
        _list_url(fastapi_app, agreement),
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "assignedAnalyst",
                    "filterType": "number",
                    "type": "equals",
                    # The floating filter sends the id as a string.
                    "filter": str(analyst.user_profile_id),
                }
            ],
        },
    )
    assert [r["name"] for r in by_analyst.json()["designatedActions"]] == [
        "Charging corridor"
    ]


@pytest.mark.anyio
async def test_grid_surfaces_the_latest_action_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """DA comments post with #4900; the association already feeds the grid."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26GRID4")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    author = await _seed_ia_analyst(dbsession, "kchan2", "Kenneth", "Chan")

    for text_, when in (
        ("older note", datetime(2026, 1, 1)),
        ("<p>newest note</p>", datetime(2026, 2, 1)),
    ):
        comment = InternalComment(comment=text_, visibility="Internal")
        comment.create_user = author.keycloak_username
        comment.create_date = when
        dbsession.add(comment)
        await dbsession.flush()
        dbsession.add(
            DesignatedActionInternalComment(
                designated_action_id=action.designated_action_id,
                internal_comment_id=comment.internal_comment_id,
                designated_action_group_uuid=action.group_uuid,
            )
        )
        await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _list_url(fastapi_app, agreement), json=PAGINATION_BODY
    )

    row = response.json()["designatedActions"][0]
    assert row["lastComment"]["fullName"] == "Kenneth Chan"
    assert row["lastComment"]["comment"] == "newest note"


@pytest.mark.anyio
async def test_grid_is_refused_for_proponents(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26GRID5")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    forbidden = await client.post(
        _list_url(fastapi_app, agreement), json=PAGINATION_BODY
    )

    assert forbidden.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_grid_404s_on_a_missing_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    missing = await client.post(
        fastapi_app.url_path_for(
            "get_designated_actions", initiative_agreement_id=999999
        ),
        json=PAGINATION_BODY,
    )

    assert missing.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_manager_assignment_writes_the_change_log(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ASGN1")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    first = await _seed_ia_analyst(dbsession, "efong2", "Erin", "Fong")
    second = await _seed_ia_analyst(dbsession, "bwill", "Blake", "Willems")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    url = fastapi_app.url_path_for(
        "assign_designated_action_analyst",
        designated_action_id=action.designated_action_id,
    )

    assigned = await client.put(url, json={"assignedAnalystId": first.user_profile_id})
    assert assigned.status_code == status.HTTP_200_OK
    assert assigned.json()["assignedAnalyst"]["firstName"] == "Erin"

    reassigned = await client.put(
        url, json={"assignedAnalystId": second.user_profile_id}
    )
    assert reassigned.json()["assignedAnalyst"]["firstName"] == "Blake"

    unassigned = await client.put(url, json={"assignedAnalystId": None})
    assert unassigned.json()["assignedAnalyst"] is None

    events = (
        (
            await dbsession.execute(
                select(DesignatedActionHistory)
                .where(
                    DesignatedActionHistory.designated_action_id
                    == action.designated_action_id
                )
                .order_by(DesignatedActionHistory.designated_action_history_id)
            )
        )
        .scalars()
        .all()
    )
    assert [event.event for event in events] == [
        EVENT_ANALYST_ASSIGNED,
        EVENT_ANALYST_REASSIGNED,
        EVENT_ANALYST_UNASSIGNED,
    ]
    assert events[1].snapshot == {
        "from_analyst_id": first.user_profile_id,
        "to_analyst_id": second.user_profile_id,
    }
    assert events[0].designated_action_group_uuid == action.group_uuid

    # The version must not move: assignment is operational state, not a
    # change order.
    await dbsession.refresh(action)
    assert action.version == 0


@pytest.mark.parametrize(
    "role_set",
    [[RoleEnum.IA_ANALYST, RoleEnum.GOVERNMENT], [RoleEnum.IA_PROPONENT]],
    ids=["ia-analyst", "proponent"],
)
@pytest.mark.anyio
async def test_assignment_is_refused_below_manager(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, role_set
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ASGN2")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, role_set)

    url = fastapi_app.url_path_for(
        "assign_designated_action_analyst",
        designated_action_id=action.designated_action_id,
    )
    response = await client.put(url, json={"assignedAnalystId": None})

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_assignment_rejects_a_non_analyst_target(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Only active IA analysts are assignable."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ASGN3")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    url = fastapi_app.url_path_for(
        "assign_designated_action_analyst",
        designated_action_id=action.designated_action_id,
    )
    response = await client.put(url, json={"assignedAnalystId": 999999})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_analyst_options_list_only_ia_analysts(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    analyst = await _seed_ia_analyst(dbsession, "efong3", "Erin", "Fong")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    url = fastapi_app.url_path_for("get_initiative_agreement_analysts")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    rows = response.json()
    ids = {row["userProfileId"] for row in rows}
    assert analyst.user_profile_id in ids
    erin = next(r for r in rows if r["userProfileId"] == analyst.user_profile_id)
    assert erin["initials"] == "EF"
    assert erin["fullName"] == "Erin Fong"


@pytest.mark.anyio
async def test_analyst_options_are_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    url = fastapi_app.url_path_for("get_initiative_agreement_analysts")
    forbidden = await client.get(url)

    assert forbidden.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_action_profile_carries_the_agreement_and_siblings(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The detail page needs the agreement code for its title, the status
    display order for the stepper, and sibling ids for prev/next."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26PROF1")
    first = await _seed_action(dbsession, agreement, 1, "Permitting", 1850)
    second = await _seed_action(dbsession, agreement, 2, "Construction", 27309)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    url = fastapi_app.url_path_for(
        "get_designated_action_profile",
        designated_action_id=second.designated_action_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["iaCode"] == "IA-26PROF1"
    assert data["initiativeAgreementId"] == agreement.initiative_agreement_id
    assert data["actionNumber"] == 2
    assert data["creditAllocation"] == 27309
    assert data["currentStatus"]["status"] == "Not started"
    assert data["currentStatus"]["displayOrder"] == 10
    assert data["siblingActionIds"] == [
        first.designated_action_id,
        second.designated_action_id,
    ]


@pytest.mark.anyio
async def test_action_profile_404s_and_refuses_proponents(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    url = fastapi_app.url_path_for(
        "get_designated_action_profile", designated_action_id=999999
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_action_profile_is_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26PROF2")
    action = await _seed_action(dbsession, agreement, 1, "Permitting")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    url = fastapi_app.url_path_for(
        "get_designated_action_profile",
        designated_action_id=action.designated_action_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_action_documents_list_and_are_org_gated(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Per-action documents flow through the shared machinery; access
    resolves through the action's agreement (#4840)."""
    from lcfs.db.models.document import Document
    from lcfs.db.models.initiative_agreement.DesignatedAction import (
        designated_action_document_association,
    )

    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DOC1")
    action = await _seed_action(dbsession, agreement, 1, "Permitting")
    document = Document(
        file_key="da/award-letter.pdf",
        file_name="award-letter.pdf",
        file_size=4096,
        mime_type="application/pdf",
    )
    dbsession.add(document)
    await dbsession.flush()
    await dbsession.execute(
        designated_action_document_association.insert().values(
            designated_action_id=action.designated_action_id,
            document_id=document.document_id,
        )
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    url = fastapi_app.url_path_for(
        "get_all_documents",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    files = response.json()
    assert [f["fileName"] for f in files] == ["award-letter.pdf"]


# ---------------------------------------------------------------------------
# Creating designated actions, which is possible while the agreement is a
# draft or underway. Agreements government enters start Underway (#5186).
# ---------------------------------------------------------------------------


def _create_action_url(fastapi_app, agreement):
    return fastapi_app.url_path_for(
        "create_designated_action",
        initiative_agreement_id=agreement.initiative_agreement_id,
    )


async def _open_agreement(dbsession, code):
    """An agreement as an analyst creates it: Underway."""
    org_id, _ = await _two_org_ids(dbsession)
    return await _seed_agreement(dbsession, org_id, code)


@pytest.mark.anyio
async def test_an_analyst_adds_an_action_to_an_underway_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement),
        json={
            "name": "Commission the first fueling station",
            "creditAllocation": 1850,
            "specifiedDate": "2026-09-30",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Commission the first fueling station"
    assert data["actionNumber"] == 1
    assert data["creditAllocation"] == 1850
    # A new action has not been started and belongs to nobody yet.
    assert data["currentStatus"]["status"] == "Not started"
    assert data["assignedAnalyst"] is None
    assert data["recommendedCredits"] is None


@pytest.mark.anyio
async def test_action_numbers_continue_from_what_is_there(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW2")
    await _seed_action(dbsession, agreement, 1, "Existing")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "Second"}
    )

    assert response.json()["actionNumber"] == 2


@pytest.mark.anyio
@pytest.mark.parametrize("lifecycle", ["Completed", "Terminated"])
async def test_actions_cannot_be_added_once_the_agreement_is_closed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, lifecycle
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id,
        "IA-26NEW3",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, lifecycle),
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "Too late"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "draft or underway" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_an_analyst_cannot_reach_a_draft_to_add_an_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A draft is a proponent's unsubmitted application, which IDIR users
    do not see (#5186), so to them it does not exist."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id,
        "IA-26NEW9",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, "Draft"),
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "Hidden"}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_a_nameless_action_is_refused(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW4")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "   "}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_negative_credits_are_refused(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW5")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement),
        json={"name": "Negative", "creditAllocation": -1},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_an_action_without_an_amount_starts_at_nought(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW6")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "To be decided"}
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["creditAllocation"] == 0


@pytest.mark.anyio
async def test_a_director_cannot_add_an_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Drafting the schedule is the analyst's job, not the approver's."""
    agreement = await _open_agreement(dbsession, "IA-26NEW7")
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "Director's own"}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_a_proponent_cannot_add_an_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _open_agreement(dbsession, "IA-26NEW8")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.post(
        _create_action_url(fastapi_app, agreement), json={"name": "Not mine"}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Editing a designated action. Analysts and managers may correct one at any
# point; every change is recorded.
# ---------------------------------------------------------------------------


def _edit_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "update_designated_action",
        designated_action_id=action.designated_action_id,
    )


async def _action_history(dbsession, action):
    from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
        DesignatedActionHistory,
    )

    result = await dbsession.execute(
        select(DesignatedActionHistory)
        .where(
            DesignatedActionHistory.designated_action_id == action.designated_action_id
        )
        .order_by(DesignatedActionHistory.designated_action_history_id)
    )
    return list(result.scalars().all())


@pytest.mark.anyio
async def test_an_analyst_corrects_an_action_and_it_is_recorded(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT1")
    action = await _seed_action(dbsession, agreement, 1, "Comission statoin", 1000)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _edit_url(fastapi_app, action),
        json={"name": "Commission station", "creditAllocation": 1850},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Commission station"
    assert data["creditAllocation"] == 1850

    entries = await _action_history(dbsession, action)
    assert [e.event for e in entries] == ["DETAILS_EDITED"]
    changed = entries[0].snapshot["changed"]
    assert changed["name"] == {"from": "Comission statoin", "to": "Commission station"}
    assert changed["credit_allocation"] == {"from": 1000, "to": 1850}


@pytest.mark.anyio
async def test_an_action_can_be_corrected_after_the_agreement_is_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A wrong figure should be fixable rather than worked around."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT2")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    action.current_status_id = await _action_status_id(dbsession, "Underway")
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _edit_url(fastapi_app, action), json={"name": "Corrected while underway"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "Corrected while underway"


@pytest.mark.anyio
async def test_editing_nothing_records_nothing(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT3")
    action = await _seed_action(dbsession, agreement, 1, "Commission station", 1000)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        _edit_url(fastapi_app, action),
        json={"name": "Commission station", "creditAllocation": 1000},
    )

    assert response.status_code == status.HTTP_200_OK
    assert await _action_history(dbsession, action) == []


@pytest.mark.anyio
async def test_the_completion_date_can_be_set_and_cleared(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT4")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    dated = await client.put(
        _edit_url(fastapi_app, action), json={"specifiedDate": "2026-09-30"}
    )
    assert dated.json()["specifiedDate"] == "2026-09-30"

    cleared = await client.put(
        _edit_url(fastapi_app, action), json={"clearSpecifiedDate": True}
    )
    assert cleared.json()["specifiedDate"] is None


@pytest.mark.anyio
async def test_an_edit_cannot_blank_the_name_or_go_negative(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT5")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    blank = await client.put(_edit_url(fastapi_app, action), json={"name": "  "})
    assert blank.status_code == status.HTTP_400_BAD_REQUEST

    negative = await client.put(
        _edit_url(fastapi_app, action), json={"creditAllocation": -5}
    )
    assert negative.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_a_manager_may_also_correct_an_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT6")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    response = await client.put(
        _edit_url(fastapi_app, action), json={"name": "Manager's correction"}
    )

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_a_proponent_cannot_correct_an_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26EDT7")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.put(
        _edit_url(fastapi_app, action), json={"name": "Not mine to change"}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_grid_carries_and_sorts_the_current_status(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The status column sorts by workflow progression, not alphabet (#4926).

    'Approved' sorts after 'Not started' even though the alphabet says
    otherwise — an analyst sorting by status is scanning workload order.
    """
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26STAT1")
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Already approved",
        current_status_id=await _action_status_id(dbsession, "Approved"),
    )
    await _seed_action(dbsession, agreement, 2, "Still not started")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _list_url(fastapi_app, agreement),
        json={
            **PAGINATION_BODY,
            "sortOrders": [{"field": "currentStatus", "direction": "asc"}],
        },
    )

    assert response.status_code == status.HTTP_200_OK
    rows = response.json()["designatedActions"]
    assert [r["currentStatus"]["status"] for r in rows] == [
        "Not started",
        "Approved",
    ]


# ---------------------------------------------------------------------------
# The module-wide Designated actions tab (#5078).
# ---------------------------------------------------------------------------


def _all_url(fastapi_app):
    return fastapi_app.url_path_for("get_all_designated_actions")


@pytest.mark.anyio
async def test_the_tab_lists_actions_across_every_agreement_newest_first(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Every agreement's current actions in one list, and — with no sort
    asked for — the most recently touched first, because the tab is a
    work queue rather than a register."""
    org_id, other_org = await _two_org_ids(dbsession)
    first = await _seed_agreement(dbsession, org_id, "IA-26ALL1")
    second = await _seed_agreement(dbsession, other_org, "IA-26ALL2")
    older = await _seed_action(dbsession, first, 1, "Older work")
    newer = await _seed_action(dbsession, second, 1, "Newer work")
    older.update_date = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newer.update_date = datetime(2026, 6, 1, tzinfo=timezone.utc)
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(_all_url(fastapi_app), json=PAGINATION_BODY)

    assert response.status_code == status.HTTP_200_OK
    rows = response.json()["designatedActions"]
    assert [r["name"] for r in rows][:2] == ["Newer work", "Older work"]
    # Each row says which agreement it belongs to, for the ID column and
    # for navigating to the action.
    by_name = {r["name"]: r for r in rows}
    assert by_name["Newer work"]["initiativeAgreementId"] == (
        second.initiative_agreement_id
    )
    assert by_name["Newer work"]["iaCode"] == "IA-26ALL2"
    assert by_name["Older work"]["initiativeAgreementId"] == (
        first.initiative_agreement_id
    )


@pytest.mark.anyio
async def test_the_tab_shows_one_row_per_amended_action(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A change order appends a version row; the tab shows the current one."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ALL3")
    original = await _seed_action(dbsession, agreement, 1, "Original scope")
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Amended scope",
        group_uuid=original.group_uuid,
        version=original.version + 1,
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(_all_url(fastapi_app), json=PAGINATION_BODY)

    names = [r["name"] for r in response.json()["designatedActions"]]
    assert "Amended scope" in names
    assert "Original scope" not in names


@pytest.mark.anyio
async def test_the_tab_honours_a_caller_sort(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ALL4")
    await _seed_action(dbsession, agreement, 1, "Zebra crossing")
    await _seed_action(dbsession, agreement, 2, "Apple orchard")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _all_url(fastapi_app),
        json={**PAGINATION_BODY, "sortOrders": [{"field": "name", "direction": "asc"}]},
    )

    names = [r["name"] for r in response.json()["designatedActions"]]
    assert names.index("Apple orchard") < names.index("Zebra crossing")


@pytest.mark.anyio
async def test_the_tab_is_closed_to_proponents(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.post(_all_url(fastapi_app), json=PAGINATION_BODY)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# The index columns added by #5203: the tab's organization, IA name and
# assigned analyst, and both grids' date for completion.
# ---------------------------------------------------------------------------


async def _org_name(dbsession, org_id):
    return (
        await dbsession.execute(
            select(Organization.name).where(Organization.organization_id == org_id)
        )
    ).scalar_one()


def _text_filter(field, value, filter_type="equals"):
    return {"field": field, "filterType": "text", "type": filter_type, "filter": value}


def _names(response, only):
    """The row names, in order, of the rows this test seeded."""
    return [
        r["name"] for r in response.json()["designatedActions"] if r["name"] in only
    ]


@pytest.mark.anyio
async def test_the_tab_carries_each_rows_organization_and_agreement_code(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    with_org = await _seed_agreement(dbsession, org_id, "IA-26COL1")
    without_org = await _seed_agreement(dbsession, None, "IA-26COL2")
    await _seed_action(
        dbsession, with_org, 1, "Owned work", specified_date=date(2026, 11, 30)
    )
    await _seed_action(dbsession, without_org, 1, "Unowned work")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _all_url(fastapi_app), json={**PAGINATION_BODY, "size": 200}
    )

    assert response.status_code == status.HTTP_200_OK
    rows = {r["name"]: r for r in response.json()["designatedActions"]}
    assert rows["Owned work"]["organization"] == {
        "organizationId": org_id,
        "name": await _org_name(dbsession, org_id),
    }
    assert rows["Owned work"]["iaCode"] == "IA-26COL1"
    assert rows["Owned work"]["specifiedDate"] == "2026-11-30"
    # An agreement saved before its organization was known (#5186).
    assert rows["Unowned work"]["organization"] is None
    assert rows["Unowned work"]["iaCode"] == "IA-26COL2"
    assert rows["Unowned work"]["specifiedDate"] is None


@pytest.mark.anyio
async def test_the_tab_filters_and_sorts_by_organization_and_ia_name(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, other_org = await _two_org_ids(dbsession)
    first = await _seed_agreement(dbsession, org_id, "IA-26COL3")
    second = await _seed_agreement(dbsession, other_org, "IA-26COL4")
    await _seed_action(dbsession, first, 1, "First org work")
    await _seed_action(dbsession, second, 1, "Second org work")
    mine = {"First org work", "Second org work"}
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    first_name = await _org_name(dbsession, org_id)
    second_name = await _org_name(dbsession, other_org)

    by_org = await client.post(
        _all_url(fastapi_app),
        json={
            **PAGINATION_BODY,
            "filters": [_text_filter("organization.name", first_name)],
        },
    )
    assert _names(by_org, mine) == ["First org work"]

    by_code = await client.post(
        _all_url(fastapi_app),
        json={
            **PAGINATION_BODY,
            "filters": [_text_filter("iaCode", "COL4", "contains")],
        },
    )
    assert _names(by_code, mine) == ["Second org work"]

    by_org_name = [
        name
        for _, name in sorted(
            [(first_name, "First org work"), (second_name, "Second org work")]
        )
    ]
    for field, ascending in (
        ("organization.name", by_org_name),
        ("iaCode", ["First org work", "Second org work"]),
    ):
        for direction, expected in (("asc", ascending), ("desc", ascending[::-1])):
            response = await client.post(
                _all_url(fastapi_app),
                json={
                    **PAGINATION_BODY,
                    "size": 200,
                    "sortOrders": [{"field": field, "direction": direction}],
                },
            )
            assert _names(response, mine) == expected, (field, direction)


@pytest.mark.anyio
async def test_the_tab_shows_and_filters_by_the_assigned_analyst(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26ANL1")
    analyst = await _seed_ia_analyst(dbsession, "tabanalyst", "Tab", "Analyst")
    await _seed_action(
        dbsession,
        agreement,
        1,
        "Assigned work",
        assigned_analyst_id=analyst.user_profile_id,
    )
    await _seed_action(dbsession, agreement, 2, "Unassigned work")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _all_url(fastapi_app),
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "assignedAnalyst",
                    "filterType": "number",
                    "type": "equals",
                    "filter": str(analyst.user_profile_id),
                }
            ],
        },
    )

    rows = response.json()["designatedActions"]
    assert [r["name"] for r in rows] == ["Assigned work"]
    assert rows[0]["assignedAnalyst"]["firstName"] == "Tab"


@pytest.mark.anyio
async def test_both_grids_filter_and_sort_by_the_date_for_completion(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DATE1")
    await _seed_action(
        dbsession, agreement, 1, "Due later", specified_date=date(2027, 3, 31)
    )
    await _seed_action(
        dbsession, agreement, 2, "Due sooner", specified_date=date(2026, 12, 31)
    )
    await _seed_action(dbsession, agreement, 3, "No date yet")
    mine = {"Due later", "Due sooner"}
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    for url in (_list_url(fastapi_app, agreement), _all_url(fastapi_app)):
        ordered = await client.post(
            url,
            json={
                **PAGINATION_BODY,
                "size": 200,
                "sortOrders": [{"field": "specifiedDate", "direction": "asc"}],
            },
        )
        assert _names(ordered, mine) == ["Due sooner", "Due later"], url

        before = await client.post(
            url,
            json={
                **PAGINATION_BODY,
                "size": 200,
                "filters": [
                    {
                        "field": "specifiedDate",
                        "filterType": "date",
                        "type": "lessThan",
                        "dateFrom": "2027-01-01",
                    }
                ],
            },
        )
        assert _names(before, mine | {"No date yet"}) == ["Due sooner"], url


@pytest.mark.anyio
async def test_actions_of_a_draft_are_hidden_from_government(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A draft is a proponent's unsubmitted application (#5186): its actions
    stay out of the tab, and its grid and action pages read as missing."""
    org_id, _ = await _two_org_ids(dbsession)
    draft = await _seed_agreement(
        dbsession,
        org_id,
        "IA-26HID1",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, "Draft"),
    )
    action = await _seed_action(dbsession, draft, 1, "Proposed work")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    tab = await client.post(
        _all_url(fastapi_app), json={**PAGINATION_BODY, "size": 200}
    )
    assert _names(tab, {"Proposed work"}) == []

    grid = await client.post(_list_url(fastapi_app, draft), json=PAGINATION_BODY)
    assert grid.status_code == status.HTTP_404_NOT_FOUND

    profile = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_profile",
            designated_action_id=action.designated_action_id,
        )
    )
    assert profile.status_code == status.HTTP_404_NOT_FOUND
