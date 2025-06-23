import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import datetime, timedelta
import asyncio

from lcfs.db.models import UserProfile
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
            create_date=base_time - timedelta(seconds=i)  # Each comment has a later update_date
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """
    Test trying to update an internal comment the user is not authorized to update.
    """
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Prepare payload for the update attempt
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
