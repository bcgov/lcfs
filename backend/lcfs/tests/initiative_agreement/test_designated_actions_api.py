"""Designated action grid, analyst assignment and change log (#4896)."""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import datetime

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
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _action_status_id,
    _seed_agreement,
    _two_org_ids,
)

IDIR_IA_MANAGER = [RoleEnum.IA_MANAGER, RoleEnum.GOVERNMENT]


async def _seed_action(dbsession, agreement, number, name, credits=1000, **overrides):
    action = DesignatedAction(
        initiative_agreement_id=agreement.initiative_agreement_id,
        action_number=number,
        name=name,
        credit_allocation=credits,
        current_status_id=await _action_status_id(dbsession, "Not started"),
        **overrides,
    )
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
