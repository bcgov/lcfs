"""Comments on designated actions (#4900).

The shared internal-comment machinery gains the designatedAction entity
type; these tests pin the thread behaviour the DA detail page and the DA
grid's last-comment column depend on.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.comment.DesignatedActionInternalComment import (
    DesignatedActionInternalComment,
)
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_comments import (
    _ensure_author_profile,
)


def _authenticate(application, set_mock_user, roles, details=None):
    """Rebuild authentication for every in-test role/organization switch."""
    application.middleware_stack = None
    set_mock_user(application, roles, details)


async def _post_da_comment(client, fastapi_app, designated_action_id, text, **extra):
    url = fastapi_app.url_path_for("create_comment")
    payload = {
        "entityType": "designatedAction",
        "entityId": designated_action_id,
        "comment": text,
        **extra,
    }
    return await client.post(url, json=payload)


@pytest.mark.anyio
async def test_action_comments_are_internal_by_default_and_stamp_the_group(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DAC1")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    _authenticate(fastapi_app, set_mock_user, IDIR_IA_ANALYST)

    response = await _post_da_comment(
        client, fastapi_app, action.designated_action_id, "internal action note"
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["visibility"] == "Internal"

    association = (
        await dbsession.execute(
            select(DesignatedActionInternalComment).where(
                DesignatedActionInternalComment.internal_comment_id
                == data["internalCommentId"]
            )
        )
    ).scalar_one()
    assert association.designated_action_id == action.designated_action_id
    assert association.designated_action_group_uuid == action.group_uuid

    comment = (
        await dbsession.execute(
            select(InternalComment).where(
                InternalComment.internal_comment_id == data["internalCommentId"]
            )
        )
    ).scalar_one()
    # Denormalized Comment Log metadata resolves through the agreement.
    assert comment.organization_id == org_id


@pytest.mark.anyio
async def test_the_thread_spans_change_order_versions(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A comment made on the original version stays on the thread after a
    change order appends a new version row."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DAC2")
    original = await _seed_action(dbsession, agreement, 1, "Original scope")
    amended = await _seed_action(
        dbsession,
        agreement,
        1,
        "Amended scope",
        group_uuid=original.group_uuid,
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )
    await _ensure_author_profile(dbsession)
    _authenticate(fastapi_app, set_mock_user, IDIR_IA_ANALYST)

    posted = await _post_da_comment(
        client, fastapi_app, original.designated_action_id, "before the change order"
    )
    assert posted.status_code == status.HTTP_201_CREATED

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type="designatedAction",
        entity_id=amended.designated_action_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    comments = [c["comment"] for c in response.json()]
    assert comments == ["before the change order"]


@pytest.mark.anyio
async def test_a_new_comment_lights_up_the_grids_last_comment_column(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """End to end with #4896: posting through the API surfaces in the
    designated actions grid."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DAC3")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    await _ensure_author_profile(dbsession)
    _authenticate(fastapi_app, set_mock_user, IDIR_IA_ANALYST)

    posted = await _post_da_comment(
        client,
        fastapi_app,
        action.designated_action_id,
        "<p>rich <em>note</em></p>",
    )
    assert posted.status_code == status.HTTP_201_CREATED

    grid_url = fastapi_app.url_path_for(
        "get_designated_actions",
        initiative_agreement_id=agreement.initiative_agreement_id,
    )
    response = await client.post(grid_url, json=PAGINATION_BODY)

    row = response.json()["designatedActions"][0]
    assert row["lastComment"]["comment"] == "rich note"
    assert row["lastComment"]["fullName"] == "Mock User"


@pytest.mark.anyio
async def test_proponents_only_read_public_action_comments(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Public DA messages are shared; internal notes and other orgs are refused."""
    org_id, other_org = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DAC4")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    await _ensure_author_profile(dbsession)
    _authenticate(fastapi_app, set_mock_user, IDIR_IA_ANALYST)
    internal = await _post_da_comment(
        client, fastapi_app, action.designated_action_id, "Government note"
    )
    public = await _post_da_comment(
        client,
        fastapi_app,
        action.designated_action_id,
        "Shared message",
        visibility="Public",
    )
    assert internal.status_code == 201
    assert public.status_code == 201
    _authenticate(
        fastapi_app, set_mock_user, [RoleEnum.IA_PROPONENT], {"organization_id": org_id}
    )
    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type="designatedAction",
        entity_id=action.designated_action_id,
    )
    response = await client.get(url)
    assert response.status_code == 200
    assert [c["comment"] for c in response.json()] == ["Shared message"]
    denied = await _post_da_comment(
        client,
        fastapi_app,
        action.designated_action_id,
        "Internal injection",
        visibility="Internal",
    )
    assert denied.status_code == 403
    _authenticate(
        fastapi_app, set_mock_user, [RoleEnum.IA_SIGNER], {"organization_id": other_org}
    )
    assert (await client.get(url)).status_code == 403


@pytest.mark.anyio
async def test_proponents_can_post_public_action_comments(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26DAC5")
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    _authenticate(
        fastapi_app, set_mock_user, [RoleEnum.IA_PROPONENT], {"organization_id": org_id}
    )

    response = await _post_da_comment(
        client,
        fastapi_app,
        action.designated_action_id,
        "Proponent evidence question",
        visibility="Public",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["visibility"] == "Public"
    comment_id = response.json()["internalCommentId"]
    edit_url = fastapi_app.url_path_for(
        "update_comment", internal_comment_id=comment_id
    )
    edited = await client.put(edit_url, json={"comment": "Updated question"})
    assert edited.status_code == 200
    assert edited.json()["comment"] == "Updated question"
    _authenticate(
        fastapi_app,
        set_mock_user,
        [RoleEnum.IA_PROPONENT, RoleEnum.MANAGE_USERS],
        {"organization_id": org_id, "keycloak_username": "anotheruser"},
    )
    assert (
        await client.put(edit_url, json={"comment": "Not my comment"})
    ).status_code == 403
