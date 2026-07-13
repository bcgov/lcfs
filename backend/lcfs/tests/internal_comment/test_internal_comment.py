import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import datetime, timedelta
import asyncio

from lcfs.db.models import UserProfile
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.TransferInternalComment import TransferInternalComment
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import EntityTypeEnum, AudienceScopeEnum


@pytest.mark.anyio
async def test_create_internal_comment_with_transfer(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test creating an internal comment associated with a Transfer entity.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    payload = {
        "entity_type": EntityTypeEnum.TRANSFER.value,
        "entity_id": transfer.transfer_id,
        "comment": "Transfer comment",
        "audience_scope": AudienceScopeEnum.ANALYST.value,
    }

    with patch(
        "lcfs.web.api.internal_comment.repo.UserRepository.get_full_name",
        new_callable=AsyncMock,
    ) as mock_get_full_name:
        mock_get_full_name.return_value = "Mocked Full Name"

        url = fastapi_app.url_path_for("create_comment")
        response = await client.post(url, json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["comment"] == "Transfer comment"
        assert data["audienceScope"] == AudienceScopeEnum.ANALYST.value
        assert data["createUser"] == "mockuser"
        assert data["fullName"] == "Mocked Full Name"


@pytest.mark.anyio
async def test_create_internal_comment_with_initiative_agreement(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test creating an internal comment associated with an Initiative Agreement entity.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    initiative_agreement = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=1000,
        transaction_effective_date=datetime.now(),
        gov_comment="Test Initiative Agreement",
        to_organization_id=1,
        current_status_id=1,
    )
    await add_models([initiative_agreement])

    payload = {
        "entity_type": EntityTypeEnum.INITIATIVE_AGREEMENT.value,
        "entity_id": initiative_agreement.initiative_agreement_id,
        "comment": "Initiative Agreement comment",
        "audience_scope": AudienceScopeEnum.DIRECTOR.value,
    }

    with patch(
        "lcfs.web.api.internal_comment.repo.UserRepository.get_full_name",
        new_callable=AsyncMock,
    ) as mock_get_full_name:
        mock_get_full_name.return_value = "Mocked Full Name"

        url = fastapi_app.url_path_for("create_comment")
        response = await client.post(url, json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["comment"] == "Initiative Agreement comment"
        assert data["audienceScope"] == AudienceScopeEnum.DIRECTOR.value
        assert data["createUser"] == "mockuser"
        assert data["fullName"] == "Mocked Full Name"


@pytest.mark.anyio
async def test_create_internal_comment_with_admin_adjustment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test creating an internal comment associated with an Admin Adjustment entity.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    admin_adjustment = AdminAdjustment(
        admin_adjustment_id=100,
        compliance_units=500,
        transaction_effective_date=datetime.now(),
        gov_comment="Test Admin Adjustment",
        to_organization_id=1,
        current_status_id=1,
    )
    await add_models([admin_adjustment])

    payload = {
        "entity_type": EntityTypeEnum.ADMIN_ADJUSTMENT.value,
        "entity_id": admin_adjustment.admin_adjustment_id,
        "comment": "Admin Adjustment comment",
        "audience_scope": AudienceScopeEnum.COMPLIANCE_MANAGER.value,
    }

    with patch(
        "lcfs.web.api.internal_comment.repo.UserRepository.get_full_name",
        new_callable=AsyncMock,
    ) as mock_get_full_name:
        mock_get_full_name.return_value = "Mocked Full Name"

        url = fastapi_app.url_path_for("create_comment")
        response = await client.post(url, json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["comment"] == "Admin Adjustment comment"
        assert data["audienceScope"] == AudienceScopeEnum.COMPLIANCE_MANAGER.value
        assert data["createUser"] == "mockuser"
        assert data["fullName"] == "Mocked Full Name"


@pytest.mark.anyio
async def test_create_internal_comment_invalid_entity_type(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """
    Test creating an internal comment with an invalid entity type.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    payload = {
        "entity_type": "InvalidType",
        "entity_id": 1,
        "comment": "Invalid entity type comment",
        "audience_scope": AudienceScopeEnum.ANALYST.value,
    }

    url = fastapi_app.url_path_for("create_comment")
    response = await client.post(url, json=payload)
    assert (
        response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    )  # Pydantic validation error
    data = response.json()
    assert "details" in data


@pytest.mark.anyio
async def test_create_internal_comment_missing_fields(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """
    Test creating an internal comment with missing required fields.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    payload = {
        # Missing 'entity_type', 'entity_id', 'comment', 'audience_scope'
    }

    url = fastapi_app.url_path_for("create_comment")
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "details" in data


@pytest.mark.anyio
async def test_create_internal_comment_invalid_audience_scope(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test creating an internal comment with an invalid audience scope.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    transfer = Transfer(
        transfer_id=2,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    payload = {
        "entity_type": EntityTypeEnum.TRANSFER.value,
        "entity_id": transfer.transfer_id,
        "comment": "Invalid audience scope comment",
        "audience_scope": "InvalidScope",
    }

    url = fastapi_app.url_path_for("create_comment")
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "details" in data


@pytest.mark.anyio
async def test_get_internal_comments_no_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test retrieving internal comments when none exist for the entity.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    transfer = Transfer(
        transfer_id=3,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    entity_type = EntityTypeEnum.TRANSFER.value
    entity_id = transfer.transfer_id
    url = fastapi_app.url_path_for(
        "get_comments", entity_type=entity_type, entity_id=entity_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0  # No comments


@pytest.mark.anyio
async def test_create_internal_comment_without_government_role(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """
    Test that a user without the GOVERNMENT role cannot create an internal comment.
    """
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    payload = {
        "entity_type": EntityTypeEnum.TRANSFER.value,
        "entity_id": 1,
        "comment": "Attempted comment by supplier",
        "audience_scope": AudienceScopeEnum.ANALYST.value,
    }

    url = fastapi_app.url_path_for("create_comment")
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_internal_comments_multiple_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test retrieving multiple internal comments for an entity.
    """
    set_mock_user(
        fastapi_app, [RoleEnum.GOVERNMENT], user_details={"username": "IDIRUSER"}
    )

    transfer = Transfer(
        transfer_id=5,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    user = UserProfile(
        keycloak_username="IDIRUSER",
        first_name="Test",
        last_name="User",
    )
    await add_models([user])

    comments = []
    base_time = datetime.now()

    for i in range(3):
        # Create comments with different update times to ensure ordering
        internal_comment = InternalComment(
            internal_comment_id=i,
            comment=f"Comment {i}",
            audience_scope=AudienceScopeEnum.ANALYST.value,
            create_user="IDIRUSER",
            create_date=base_time
            - timedelta(seconds=i),  # Each comment has a later update_date
        )
        await add_models([internal_comment])
        association = TransferInternalComment(
            transfer_id=transfer.transfer_id,
            internal_comment_id=internal_comment.internal_comment_id,
        )
        await add_models([association])
        comments.append(internal_comment)

        # Small delay to ensure different timestamps
        await asyncio.sleep(0.001)

    entity_type = EntityTypeEnum.TRANSFER.value
    entity_id = transfer.transfer_id
    url = fastapi_app.url_path_for(
        "get_comments", entity_type=entity_type, entity_id=entity_id
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 3

    # Now they should be ordered by create_date ASC (most recent first)
    for i in range(3):
        assert data[i]["comment"] == f"Comment {2 - i}"


@pytest.mark.anyio
async def test_update_internal_comment_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    Test updating an internal comment successfully.
    """
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )

    # Create a transfer and an internal comment
    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    internal_comment = InternalComment(
        internal_comment_id=1,
        comment="Original Comment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
    )
    await add_models([internal_comment])

    # Associate the internal comment with the transfer
    association = TransferInternalComment(
        transfer_id=transfer.transfer_id,
        internal_comment_id=internal_comment.internal_comment_id,
    )
    await add_models([association])

    # Prepare payload for the update
    update_payload = {"comment": "Updated Comment"}

    url = fastapi_app.url_path_for(
        "update_comment", internal_comment_id=internal_comment.internal_comment_id
    )
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["comment"] == "Updated Comment"
    assert data["createUser"] == "IDIRUSER"


@pytest.mark.anyio
async def test_update_internal_comment_unauthorized(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    A user who is not the creator of the comment cannot update it, even if
    their role is allowed at the route level (e.g. SUPPLIER on a CI
    application comment). The endpoint's ownership check returns 403.
    """
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    internal_comment = InternalComment(
        internal_comment_id=1,
        comment="Original Comment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",  # different from the mock user (mockuser)
    )
    await add_models([internal_comment])

    update_payload = {"comment": "Updated Comment"}

    url = fastapi_app.url_path_for("update_comment", internal_comment_id=1)
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_update_internal_comment_nonexistent(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """
    Test trying to update an internal comment that does not exist.
    """
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    # Prepare payload for the update attempt
    update_payload = {"comment": "Updated Comment"}

    # Try to update a comment that does not exist (e.g., internal_comment_id=999)
    url = fastapi_app.url_path_for("update_comment", internal_comment_id=999)
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_update_internal_comment_admin_can_edit_other_users_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Admin can edit any comment; create_user is preserved and editor metadata is returned."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR],
        user_details={"keycloak_username": "ADMINUSER"},
    )

    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    await add_models([transfer])

    internal_comment = InternalComment(
        internal_comment_id=1,
        comment="Original Comment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="ANOTHERUSER",
    )
    await add_models([internal_comment])
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer.transfer_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        ]
    )

    update_payload = {"comment": "Admin-edited comment"}

    url = fastapi_app.url_path_for(
        "update_comment", internal_comment_id=internal_comment.internal_comment_id
    )
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["comment"] == "Admin-edited comment"
    assert data["createUser"] == "ANOTHERUSER"  # original author preserved
    assert "updateUser" in data
    assert "updateFullName" in data


@pytest.mark.anyio
async def test_update_internal_comment_non_admin_gov_cannot_edit_other_users_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Non-admin government users can only edit their own comments (403 otherwise)."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT, RoleEnum.ANALYST],
        user_details={"keycloak_username": "ANALYSTUSER"},
    )

    internal_comment = InternalComment(
        internal_comment_id=2,
        comment="Original Comment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="ANOTHERUSER",
    )
    await add_models([internal_comment])

    update_payload = {"comment": "Should not succeed"}

    url = fastapi_app.url_path_for(
        "update_comment", internal_comment_id=internal_comment.internal_comment_id
    )
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_update_internal_comment_system_admin_cannot_edit_other_users_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """System Admin alone does NOT grant the admin edit override."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT, RoleEnum.SYSTEM_ADMIN],
        user_details={"keycloak_username": "SYSADMIN"},
    )

    internal_comment = InternalComment(
        internal_comment_id=3,
        comment="Original Comment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="OTHER",
    )
    await add_models([internal_comment])

    update_payload = {"comment": "Should not succeed"}

    url = fastapi_app.url_path_for(
        "update_comment", internal_comment_id=internal_comment.internal_comment_id
    )
    response = await client.put(url, json=update_payload)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ======================================================================
# Organization Comment Log endpoint
# GET /organizations/{organization_id}/comments
# ======================================================================
def _make_transfer(transfer_id: int, to_org_id: int) -> Transfer:
    """Minimal Transfer fixture so the live org derivation can find it."""
    return Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=to_org_id,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )


async def _seed_org_comment(
    add_models,
    *,
    transfer_id: int,
    to_org_id: int,
    visibility: str,
    create_user: str,
    audience_scope: str | None = None,
    comment: str = "<p>x</p>",
) -> InternalComment:
    """Seed Transfer + InternalComment + association so the live-derive
    read path can find the comment by ``to_org_id``."""
    transfer = _make_transfer(transfer_id, to_org_id)
    await add_models([transfer])
    ic = InternalComment(
        comment=comment,
        comment_search_text=comment,
        visibility=visibility,
        audience_scope=audience_scope,
        create_user=create_user,
    )
    await add_models([ic])
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer.transfer_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )
    return ic


@pytest.mark.anyio
async def test_org_comments_idir_sees_internal_and_public(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """AC: IDIR sees Internal + Public comments for the organization."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="Test", last_name="User")]
    )

    await _seed_org_comment(
        add_models,
        transfer_id=1001,
        to_org_id=1,
        visibility="Internal",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
        comment="internal",
    )
    await _seed_org_comment(
        add_models,
        transfer_id=1002,
        to_org_id=1,
        visibility="Public",
        create_user="IDIRUSER",
        comment="public",
    )
    await _seed_org_comment(
        add_models,
        transfer_id=1003,
        to_org_id=2,
        visibility="Internal",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
        comment="other",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["total"] == 2
    visibilities = sorted(c["visibility"] for c in data["comments"])
    assert visibilities == ["Internal", "Public"]


@pytest.mark.anyio
async def test_org_comments_bcid_own_org_public_only(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """AC: BCeID for own org sees only Public comments."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.SUPPLIER],
        user_details={"keycloak_username": "BCEIDUSER", "organization_id": 1},
    )
    await add_models(
        [
            UserProfile(
                keycloak_username="BCEIDUSER",
                first_name="BC",
                last_name="User",
                organization_id=1,
            )
        ]
    )

    await _seed_org_comment(
        add_models,
        transfer_id=2001,
        to_org_id=1,
        visibility="Internal",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
    )
    await _seed_org_comment(
        add_models,
        transfer_id=2002,
        to_org_id=1,
        visibility="Public",
        create_user="BCEIDUSER",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["total"] == 1
    assert data["comments"][0]["visibility"] == "Public"
    # canEdit true for own comment
    assert data["comments"][0]["canEdit"] is True


@pytest.mark.anyio
async def test_org_comments_bcid_other_org_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """AC: BCeID requesting another org's log gets 403."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.SUPPLIER],
        user_details={"keycloak_username": "BCEIDUSER", "organization_id": 1},
    )
    url = fastapi_app.url_path_for("get_organization_comments", organization_id=99)
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_org_comments_pagination_metadata(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """AC: page=2&size=25 returns correct pagination block."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="T", last_name="U")]
    )

    for i in range(30):
        await _seed_org_comment(
            add_models,
            transfer_id=3000 + i,
            to_org_id=1,
            visibility="Internal",
            audience_scope=AudienceScopeEnum.ANALYST.value,
            create_user="IDIRUSER",
            comment=f"c{i}",
        )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    response = await client.get(url, params={"page": 2, "size": 25})
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["page"] == 2
    assert data["pagination"]["size"] == 25
    assert data["pagination"]["total"] == 30
    assert data["pagination"]["totalPages"] == 2
    assert len(data["comments"]) == 5


@pytest.mark.anyio
async def test_org_comments_reflect_parent_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
    dbsession,
):
    """Live derivation: changing the parent's to_organization_id moves
    the comment to the new org's Comment Log without any sync code."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [
            UserProfile(keycloak_username="IDIRUSER", first_name="T", last_name="U"),
            Organization(organization_id=7, name="Org Seven"),
        ]
    )

    ic = await _seed_org_comment(
        add_models,
        transfer_id=4001,
        to_org_id=1,
        visibility="Internal",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
        comment="moved",
    )

    url1 = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    assert (await client.get(url1)).json()["pagination"]["total"] == 1

    # Reassign the parent transfer to org 7 — no sync code involved.
    from sqlalchemy import update as sa_update

    await dbsession.execute(
        sa_update(Transfer)
        .where(Transfer.transfer_id == 4001)
        .values(to_organization_id=7)
    )
    await dbsession.flush()

    assert (await client.get(url1)).json()["pagination"]["total"] == 0
    url7 = fastapi_app.url_path_for("get_organization_comments", organization_id=7)
    body = (await client.get(url7)).json()
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["internalCommentId"] == ic.internal_comment_id


# ======================================================================
# Comment Log filters & search (tickets #4452 / #4453)
# ======================================================================
from sqlalchemy import func, select as sa_select
from lcfs.db.models.comment.CommentCategory import CommentCategory


async def _seed_org_comment_full(
    add_models,
    dbsession,
    *,
    transfer_id: int,
    to_org_id: int,
    visibility: str = "Internal",
    create_user: str = "IDIRUSER",
    audience_scope: str | None = AudienceScopeEnum.ANALYST.value,
    comment: str = "<p>hello world</p>",
    plain_text: str = "hello world",
    category_name: str | None = None,
    compliance_year: int | None = None,
) -> InternalComment:
    """Seed an InternalComment with denormalized metadata + tsvector so
    the Comment Log filter / search path can query it as production does.
    """
    transfer = _make_transfer(transfer_id, to_org_id)
    await add_models([transfer])

    category_id = None
    if category_name is not None:
        row = (
            await dbsession.execute(
                sa_select(CommentCategory.comment_category_id).where(
                    CommentCategory.display_name == category_name
                )
            )
        ).scalar_one_or_none()
        if row is None:
            cat = CommentCategory(display_name=category_name, display_order=0)
            await add_models([cat])
            row = cat.comment_category_id
        category_id = row

    ic = InternalComment(
        comment=comment,
        comment_search_text=plain_text,
        comment_search_vector=func.to_tsvector("english", plain_text),
        visibility=visibility,
        audience_scope=audience_scope,
        create_user=create_user,
        comment_category_id=category_id,
        compliance_year=compliance_year,
    )
    await add_models([ic])
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer.transfer_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )
    await dbsession.refresh(ic)
    return ic


async def _gov_setup(fastapi_app, set_mock_user, add_models):
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="T", last_name="U")]
    )


@pytest.mark.anyio
async def test_org_comments_filter_by_category(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: category=Transfer notes returns only Transfer notes comments."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5001,
        to_org_id=1,
        comment="<p>t</p>",
        plain_text="t",
        category_name="Transfer notes",
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5002,
        to_org_id=1,
        comment="<p>c</p>",
        plain_text="c",
        category_name="Compliance notes",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"category": "Transfer notes"})
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["category"] == "Transfer notes"


@pytest.mark.anyio
async def test_org_comments_filter_by_compliance_year(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: compliance_year=2024 returns only 2024 comments."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5101,
        to_org_id=1,
        comment="<p>a</p>",
        plain_text="a",
        compliance_year=2024,
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5102,
        to_org_id=1,
        comment="<p>b</p>",
        plain_text="b",
        compliance_year=2025,
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"compliance_year": 2024})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["complianceYear"] == 2024


@pytest.mark.anyio
async def test_org_comments_filter_by_date_range_inclusive(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: date_from / date_to are inclusive on create_date."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    ic_old = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5201,
        to_org_id=1,
        comment="<p>old</p>",
        plain_text="old",
    )
    ic_in = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5202,
        to_org_id=1,
        comment="<p>in</p>",
        plain_text="in",
    )
    ic_new = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5203,
        to_org_id=1,
        comment="<p>new</p>",
        plain_text="new",
    )

    # Force known create_dates via SQL update.
    from sqlalchemy import update as sa_update

    await dbsession.execute(
        sa_update(InternalComment)
        .where(InternalComment.internal_comment_id == ic_old.internal_comment_id)
        .values(create_date=datetime(2024, 1, 1, 0, 0, 0))
    )
    await dbsession.execute(
        sa_update(InternalComment)
        .where(InternalComment.internal_comment_id == ic_in.internal_comment_id)
        .values(create_date=datetime(2024, 6, 15, 12, 0, 0))
    )
    await dbsession.execute(
        sa_update(InternalComment)
        .where(InternalComment.internal_comment_id == ic_new.internal_comment_id)
        .values(create_date=datetime(2025, 1, 1, 0, 0, 0))
    )
    await dbsession.flush()

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(
        url, params={"date_from": "2024-01-01", "date_to": "2024-12-31"}
    )
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    # Inclusive: old (Jan 1) and in (Jun 15) — but NOT new (Jan 1, 2025)
    assert body["pagination"]["total"] == 2


@pytest.mark.anyio
async def test_org_comments_filter_combined_intersection(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: multiple filters compose as an AND intersection."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5301,
        to_org_id=1,
        comment="<p>match</p>",
        plain_text="match",
        category_name="Transfer notes",
        compliance_year=2024,
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5302,
        to_org_id=1,
        comment="<p>wrong year</p>",
        plain_text="wrong year",
        category_name="Transfer notes",
        compliance_year=2023,
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5303,
        to_org_id=1,
        comment="<p>wrong cat</p>",
        plain_text="wrong cat",
        category_name="Compliance notes",
        compliance_year=2024,
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(
        url, params={"category": "Transfer notes", "compliance_year": 2024}
    )
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1


@pytest.mark.anyio
async def test_org_comments_visibility_filter_idir(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: IDIR can narrow by visibility=Internal."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5401,
        to_org_id=1,
        visibility="Internal",
        comment="<p>i</p>",
        plain_text="i",
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5402,
        to_org_id=1,
        visibility="Public",
        audience_scope=None,
        comment="<p>p</p>",
        plain_text="p",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"visibility": "Internal"})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["visibility"] == "Internal"


@pytest.mark.anyio
async def test_org_comments_bceid_visibility_param_ignored(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: BCeID passing visibility=Internal still gets Public only."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.SUPPLIER],
        user_details={"keycloak_username": "BCEIDUSER", "organization_id": 1},
    )
    await add_models(
        [
            UserProfile(
                keycloak_username="BCEIDUSER",
                first_name="BC",
                last_name="User",
                organization_id=1,
            )
        ]
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5501,
        to_org_id=1,
        visibility="Internal",
        comment="<p>i</p>",
        plain_text="i",
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5502,
        to_org_id=1,
        visibility="Public",
        audience_scope=None,
        create_user="BCEIDUSER",
        comment="<p>p</p>",
        plain_text="p",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"visibility": "Internal"})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["visibility"] == "Public"


@pytest.mark.anyio
async def test_org_comments_sort_create_date_asc(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    ic_a = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5601,
        to_org_id=1,
        comment="<p>a</p>",
        plain_text="a",
    )
    ic_b = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=5602,
        to_org_id=1,
        comment="<p>b</p>",
        plain_text="b",
    )

    from sqlalchemy import update as sa_update

    await dbsession.execute(
        sa_update(InternalComment)
        .where(InternalComment.internal_comment_id == ic_a.internal_comment_id)
        .values(create_date=datetime(2024, 1, 1, 0, 0, 0))
    )
    await dbsession.execute(
        sa_update(InternalComment)
        .where(InternalComment.internal_comment_id == ic_b.internal_comment_id)
        .values(create_date=datetime(2025, 1, 1, 0, 0, 0))
    )
    await dbsession.flush()

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"sort_by": "create_date", "sort_order": "asc"})
    body = resp.json()
    ids = [c["internalCommentId"] for c in body["comments"]]
    assert ids == [ic_a.internal_comment_id, ic_b.internal_comment_id]

    resp_desc = await client.get(
        url, params={"sort_by": "create_date", "sort_order": "desc"}
    )
    ids_desc = [c["internalCommentId"] for c in resp_desc.json()["comments"]]
    assert ids_desc == [ic_b.internal_comment_id, ic_a.internal_comment_id]


# ----------------------------------------------------------------------
# Search (ticket #4453)
# ----------------------------------------------------------------------
@pytest.mark.anyio
async def test_org_comments_search_basic_match(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: search=transfer matches all visible comment text variants."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    transfer = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6001,
        to_org_id=1,
        comment="<p>transfer agreement signed</p>",
        plain_text="transfer agreement signed",
    )
    transferred = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6002,
        to_org_id=1,
        comment="<p>Units were transferred yesterday</p>",
        plain_text="Units were transferred yesterday",
    )
    credit_transfer = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6003,
        to_org_id=1,
        comment="<p>CREDIT TRANSFER approved</p>",
        plain_text="CREDIT TRANSFER approved",
    )
    punctuated_credit_transfer = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6004,
        to_org_id=1,
        comment="<p>credit-transfer reissued</p>",
        plain_text="credit-transfer reissued",
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6005,
        to_org_id=1,
        comment="<p>nothing here</p>",
        plain_text="nothing here",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"search": "transfer"})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 4
    assert {c["internalCommentId"] for c in body["comments"]} == {
        transfer.internal_comment_id,
        transferred.internal_comment_id,
        credit_transfer.internal_comment_id,
        punctuated_credit_transfer.internal_comment_id,
    }

    resp = await client.get(url, params={"search": "credit transfer"})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 2
    assert {c["internalCommentId"] for c in body["comments"]} == {
        credit_transfer.internal_comment_id,
        punctuated_credit_transfer.internal_comment_id,
    }


@pytest.mark.anyio
async def test_org_comments_search_matches_when_search_text_is_stale(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """Regression: search must match the authoritative ``comment`` column even
    when the denormalized ``comment_search_text`` is stale or corrupt.

    Reproduces the original defect where a backfill wrote a corrupt
    ``comment_search_text`` (e.g. "tran fer" instead of "transfer"), which
    silently dropped matches. Here the caller supplies a deliberately wrong
    ``comment_search_text``; the term must still be found because search runs
    against the raw ``comment`` body."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    # Denormalized text is corrupt, but the raw comment contains the term.
    stale = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6201,
        to_org_id=1,
        comment="<p>I recommend recording this transfer.</p>",
        plain_text="tran fer",  # corrupt denormalized value
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6202,
        to_org_id=1,
        comment="<p>nothing relevant here</p>",
        plain_text="",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"search": "transfer"})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["internalCommentId"] == stale.internal_comment_id


@pytest.mark.anyio
async def test_org_comments_search_empty_returns_all(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: empty search → no FTS predicate is applied."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6101,
        to_org_id=1,
        comment="<p>x</p>",
        plain_text="x",
    )
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6102,
        to_org_id=1,
        comment="<p>y</p>",
        plain_text="y",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"search": "   "})
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 2


@pytest.mark.anyio
@pytest.mark.parametrize(
    "term",
    ["!@#$%^&*()", "über café", "naïve résumé", "中文 测试", '"unbalanced'],
)
async def test_org_comments_search_special_chars_no_500(
    client, fastapi_app, set_mock_user, add_models, dbsession, term
):
    """AC: special characters / Unicode never cause a 500."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6200 + abs(hash(term)) % 50,
        to_org_id=1,
        comment="<p>safe</p>",
        plain_text="safe",
    )
    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    resp = await client.get(url, params={"search": term})
    assert resp.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_org_comments_search_org_details_expands_to_org_name(
    client, fastapi_app, set_mock_user, add_models, dbsession
):
    """AC: category=Organization details + search also matches Organization.name."""
    await _gov_setup(fastapi_app, set_mock_user, add_models)
    # Create an org with a recognisable name; the entity_meta join uses
    # transfer.to_organization_id, so the seeded transfer's target org will
    # be matched against Organization.name.
    await add_models([Organization(organization_id=42, name="Acme Fuels Limited")])
    ic = await _seed_org_comment_full(
        add_models,
        dbsession,
        transfer_id=6301,
        to_org_id=42,
        comment="<p>random body</p>",
        plain_text="random body",
        category_name="Organization details",
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=42)
    resp = await client.get(
        url, params={"category": "Organization details", "search": "Acme"}
    )
    body = resp.json()
    assert resp.status_code == status.HTTP_200_OK
    assert body["pagination"]["total"] == 1
    assert body["comments"][0]["internalCommentId"] == ic.internal_comment_id


@pytest.mark.anyio
async def test_get_internal_comments_embeds_attachments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """
    A comment's attached documents are embedded in the comment list response
    (issue #4514), so the UI can render and re-load attachments in one request.
    """
    from lcfs.db.models.document.Document import Document

    set_mock_user(
        fastapi_app, [RoleEnum.GOVERNMENT], user_details={"username": "IDIRUSER"}
    )

    transfer = Transfer(
        transfer_id=4514,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.now(),
        transaction_effective_date=datetime.now(),
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    user = UserProfile(
        keycloak_username="IDIRUSER", first_name="Test", last_name="User"
    )
    await add_models([transfer, user])

    document = Document(
        file_key="lcfs-docs/internal_comment/45140/abc",
        file_name="attachment.pdf",
        file_size=2048,
        mime_type="application/pdf",
    )
    internal_comment = InternalComment(
        internal_comment_id=45140,
        comment="Comment with attachment",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
    )
    # Linking via the relationship inserts the association row on flush.
    internal_comment.documents = [document]
    await add_models([document, internal_comment])
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer.transfer_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        ]
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.TRANSFER.value,
        entity_id=transfer.transfer_id,
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 1
    documents = data[0]["documents"]
    assert len(documents) == 1
    assert documents[0]["fileName"] == "attachment.pdf"
    assert documents[0]["fileSize"] == 2048
    assert "documentId" in documents[0]


@pytest.mark.anyio
async def test_org_comments_pagination_counts_comments_not_conversations(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Pagination counts comments, not entity conversations.

    An entity with multiple comments must contribute each comment to the
    total and the rendered rows, so the displayed count matches the list
    (regression: previously the total counted distinct conversations, so a
    2-comment + 1-comment pair of transfers reported total=2 for 3 rows).
    """
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": "IDIRUSER"},
    )
    await add_models(
        [UserProfile(keycloak_username="IDIRUSER", first_name="T", last_name="U")]
    )

    # Transfer A: two comments. Transfer B: one comment. => 2 conversations,
    # 3 comments.
    transfer_a = _make_transfer(9101, 1)
    transfer_b = _make_transfer(9102, 1)
    await add_models([transfer_a, transfer_b])

    for text in ("first on A", "second on A"):
        ic = InternalComment(
            comment=text,
            comment_search_text=text,
            visibility="Internal",
            audience_scope=AudienceScopeEnum.ANALYST.value,
            create_user="IDIRUSER",
        )
        await add_models([ic])
        await add_models(
            [
                TransferInternalComment(
                    transfer_id=transfer_a.transfer_id,
                    internal_comment_id=ic.internal_comment_id,
                )
            ]
        )

    ic_b = InternalComment(
        comment="only on B",
        comment_search_text="only on B",
        visibility="Internal",
        audience_scope=AudienceScopeEnum.ANALYST.value,
        create_user="IDIRUSER",
    )
    await add_models([ic_b])
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer_b.transfer_id,
                internal_comment_id=ic_b.internal_comment_id,
            )
        ]
    )

    url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    data = (await client.get(url)).json()

    assert data["pagination"]["total"] == 3
    assert data["pagination"]["totalPages"] == 1
    assert len(data["comments"]) == 3
