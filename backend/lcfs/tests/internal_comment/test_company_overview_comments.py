"""Integration tests for org-scoped Company Overview comments (#4608).

Company Overview lives on the IDIR Organization dashboard as a dedicated
comment thread. It reuses the internal-comment framework via the new
``ORGANIZATION`` entity type (association table ``organization_internal_comment``)
and the seeded ``Company Overview`` category, and it flows into the org
Comment Log where it is filterable/searchable by category.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.models import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import EntityTypeEnum, AudienceScopeEnum


async def _create_company_overview_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    *,
    organization_id: int = 1,
    comment: str = "<p>Company overview note</p>",
):
    """POST a Company Overview comment (ORGANIZATION entity) and return the JSON."""
    payload = {
        "entity_type": EntityTypeEnum.ORGANIZATION.value,
        "entity_id": organization_id,
        "comment": comment,
        "audience_scope": AudienceScopeEnum.ANALYST.value,
    }
    with patch(
        "lcfs.web.api.internal_comment.repo.UserRepository.get_full_name",
        new_callable=AsyncMock,
    ) as mock_get_full_name:
        mock_get_full_name.return_value = "Mocked Full Name"
        url = fastapi_app.url_path_for("create_comment")
        response = await client.post(url, json=payload)
    return response


@pytest.mark.anyio
async def test_gov_can_create_company_overview_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """IDIR can create an ORGANIZATION-scoped Company Overview comment."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="Test", last_name="User")]
    )

    response = await _create_company_overview_comment(client, fastapi_app)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["comment"] == "<p>Company overview note</p>"
    assert data["createUser"] == "IDIRUSER"


@pytest.mark.anyio
async def test_bceid_cannot_create_company_overview_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """BCeID users must not be able to create org-scoped internal comments."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    response = await _create_company_overview_comment(client, fastapi_app)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_company_overview_comment_appears_in_org_comment_log(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """A created Company Overview comment surfaces in the org Comment Log feed,
    tagged with the ORGANIZATION entity type and the 'Company Overview'
    category, and is filterable by that category."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="Test", last_name="User")]
    )

    create = await _create_company_overview_comment(
        client, fastapi_app, organization_id=1, comment="<p>Overview alpha</p>"
    )
    assert create.status_code == status.HTTP_201_CREATED

    # Appears in the org feed with the right entity type + category + org.
    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    match = [
        c for c in data["comments"] if c["comment"] == "<p>Overview alpha</p>"
    ]
    assert len(match) == 1
    record = match[0]
    assert record["entityType"] == EntityTypeEnum.ORGANIZATION.value
    assert record["entityId"] == 1
    assert record["organizationId"] == 1
    assert record["category"] == "Company Overview"

    # Filterable by the Company Overview category.
    filtered = await client.get(url, params={"category": "Company Overview"})
    assert filtered.status_code == status.HTTP_200_OK
    assert filtered.json()["pagination"]["total"] >= 1
    assert all(
        c["category"] == "Company Overview" for c in filtered.json()["comments"]
    )

    # Excluded when filtering by an unrelated category.
    other = await client.get(url, params={"category": "Transfer notes"})
    assert other.status_code == status.HTTP_200_OK
    assert all(
        c["comment"] != "<p>Overview alpha</p>" for c in other.json()["comments"]
    )


@pytest.mark.anyio
async def test_company_overview_comment_searchable_in_org_comment_log(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Company Overview comment bodies are keyword-searchable in the Comment Log."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="Test", last_name="User")]
    )

    create = await _create_company_overview_comment(
        client,
        fastapi_app,
        organization_id=1,
        comment="<p>Distinctive aggregator arrangement noted</p>",
    )
    assert create.status_code == status.HTTP_201_CREATED

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    hit = await client.get(url, params={"search": "aggregator"})
    assert hit.status_code == status.HTTP_200_OK
    assert any(
        "aggregator" in (c["comment"] or "") for c in hit.json()["comments"]
    )
