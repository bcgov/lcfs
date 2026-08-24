"""Comments on initiative agreements (#4897).

The module reuses the shared internal-comment machinery; these tests pin
the behaviour the IA detail page depends on: IDIR IA roles can post
internal (the default) and public comments against an agreement, the
thread reads back, a new comment surfaces as the grid's last comment,
and BCeID proponents get no access to the thread at all for now.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _seed_agreement,
    _two_org_ids,
)


async def _ensure_author_profile(dbsession):
    """The comment read path joins user_profile on the author's username;
    real users always have a profile, so give the mock user one too."""
    from sqlalchemy import select

    from lcfs.db.models.user.UserProfile import UserProfile

    existing = (
        (
            await dbsession.execute(
                select(UserProfile).where(UserProfile.keycloak_username == "mockuser")
            )
        )
        .scalars()
        .first()
    )
    if existing is None:
        dbsession.add(
            UserProfile(
                keycloak_email="mockuser@gov.bc.ca",
                keycloak_username="mockuser",
                email="mockuser@gov.bc.ca",
                first_name="Mock",
                last_name="User",
                organization_id=None,
                is_active=True,
            )
        )
        await dbsession.flush()


async def _post_comment(client, fastapi_app, agreement_id, text, **extra):
    url = fastapi_app.url_path_for("create_comment")
    payload = {
        "entityType": "initiativeAgreement",
        "entityId": agreement_id,
        "comment": text,
        **extra,
    }
    return await client.post(url, json=payload)


@pytest.mark.anyio
async def test_analyst_comments_are_internal_by_default(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26CMT1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await _post_comment(
        client, fastapi_app, agreement.initiative_agreement_id, "internal note"
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["visibility"] == "Internal"
    assert data["comment"] == "internal note"


@pytest.mark.anyio
async def test_analyst_can_post_a_public_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26CMT2")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await _post_comment(
        client,
        fastapi_app,
        agreement.initiative_agreement_id,
        "public update",
        visibility="Public",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["visibility"] == "Public"


@pytest.mark.anyio
async def test_the_thread_reads_back_for_idir(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26CMT3")
    await _ensure_author_profile(dbsession)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    await _post_comment(client, fastapi_app, agreement.initiative_agreement_id, "first")
    await _post_comment(
        client,
        fastapi_app,
        agreement.initiative_agreement_id,
        "second",
        visibility="Public",
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type="initiativeAgreement",
        entity_id=agreement.initiative_agreement_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    visibilities = {c["comment"]: c["visibility"] for c in response.json()}
    assert visibilities == {"first": "Internal", "second": "Public"}


@pytest.mark.anyio
async def test_a_new_comment_becomes_the_grids_last_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, "IA-26CMT4")
    await _ensure_author_profile(dbsession)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    await _post_comment(
        client,
        fastapi_app,
        agreement.initiative_agreement_id,
        "<p>rich <strong>text</strong></p>",
    )

    url = fastapi_app.url_path_for("get_initiative_agreements")
    response = await client.post(url, json=PAGINATION_BODY)

    row = next(
        r for r in response.json()["initiativeAgreements"] if r["iaCode"] == "IA-26CMT4"
    )
    assert row["lastComment"]["comment"] == "rich text"


@pytest.mark.anyio
async def test_proponents_cannot_read_the_thread(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The BCeID view of comments arrives with its own story; until then
    the thread is IDIR-only."""
    agreement = await _seed_agreement(dbsession, 1, "IA-26CMT5")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type="initiativeAgreement",
        entity_id=agreement.initiative_agreement_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_proponents_cannot_post_to_the_thread(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    agreement = await _seed_agreement(dbsession, 1, "IA-26CMT6")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await _post_comment(
        client,
        fastapi_app,
        agreement.initiative_agreement_id,
        "should not land",
        visibility="Public",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
