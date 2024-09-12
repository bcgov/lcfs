import pytest

from sqlalchemy.future import select

from lcfs.web.api.internal_comment.repo import InternalCommentRepository

from lcfs.tests.internal_comment.internal_comment_payloads import (
    user_orm_model,
    internal_comment_orm_model,
    transfer_orm_model,
    transaction_orm_model,
    transfer_internal_comment_orm_model,
    initiative_agreement_status_orm_model,
    initiative_agreement_orm_model,
    initiative_agreement_internal_comment_orm_model,
    internal_comment_orm_fields,
    transfer_internal_comment_orm_fields,
    initiative_agreement_internal_comment_orm_fields,
)

from lcfs.web.api.internal_comment.schema import AudienceScopeEnum, EntityTypeEnum

from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.comment.TransferInternalComment import TransferInternalComment
from lcfs.db.models.comment.InitiativeAgreementInternalComment import (
    InitiativeAgreementInternalComment,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement


@pytest.fixture
def internal_comment_repo(dbsession):
    return InternalCommentRepository(db=dbsession)


# Tests for create_internal_comment
@pytest.mark.anyio
async def test_create_transfer_internal_comment_success(
    dbsession, internal_comment_repo
):
    # Create and add a new internal comment
    new_internal_comment = InternalComment(**internal_comment_orm_fields)
    dbsession.add(new_internal_comment)
    await dbsession.commit()

    # Create and add a new TransferInternalComment linked to the internal comment
    transfer_internal_comment_orm_fields["internal_comment_id"] = (
        new_internal_comment.internal_comment_id
    )
    new_transfer_internal_comment = TransferInternalComment(
        **transfer_internal_comment_orm_fields
    )
    dbsession.add(new_transfer_internal_comment)
    await dbsession.commit()

    # Retrieve the added internal comment to verify it was added successfully
    added_internal_comment = await internal_comment_repo.get_internal_comment_by_id(
        new_internal_comment.internal_comment_id
    )

    # Assertions to ensure the internal comment and its relationship were correctly created
    assert added_internal_comment is not None
    assert (
        added_internal_comment.internal_comment_id
        == new_internal_comment.internal_comment_id
    )
    assert added_internal_comment.comment == internal_comment_orm_fields["comment"]

    result = await dbsession.execute(
        select(TransferInternalComment).where(
            TransferInternalComment.internal_comment_id
            == new_internal_comment.internal_comment_id
        )
    )
    linked_transfer_internal_comment = result.scalars().first()
    assert linked_transfer_internal_comment is not None
    assert (
        linked_transfer_internal_comment.transfer_id
        == transfer_internal_comment_orm_fields["transfer_id"]
    )


@pytest.mark.anyio
async def test_create_initiative_internal_comment_success(
    dbsession, internal_comment_repo
):
    # Create and add a new internal comment
    new_internal_comment = InternalComment(**internal_comment_orm_fields)
    dbsession.add(new_internal_comment)
    await dbsession.commit()

    # Create and add a new InitiativeAgreementInternalComment linked to the internal comment
    initiative_agreement_internal_comment_orm_fields["internal_comment_id"] = (
        new_internal_comment.internal_comment_id
    )
    new_initiative_agreement_internal_comment = InitiativeAgreementInternalComment(
        **initiative_agreement_internal_comment_orm_fields
    )
    dbsession.add(new_initiative_agreement_internal_comment)
    await dbsession.commit()

    # Retrieve the added internal comment to verify it was added successfully
    added_internal_comment = await internal_comment_repo.get_internal_comment_by_id(
        new_internal_comment.internal_comment_id
    )

    # Assertions to ensure the internal comment and its relationship were correctly created
    assert added_internal_comment is not None
    assert (
        added_internal_comment.internal_comment_id
        == new_internal_comment.internal_comment_id
    )
    assert added_internal_comment.comment == internal_comment_orm_fields["comment"]

    result = await dbsession.execute(
        select(InitiativeAgreementInternalComment).where(
            InitiativeAgreementInternalComment.internal_comment_id
            == new_internal_comment.internal_comment_id
        )
    )
    linked_initiative_agreement__internal_comment = result.scalars().first()
    assert linked_initiative_agreement__internal_comment is not None
    assert (
        linked_initiative_agreement__internal_comment.initiative_agreement_id
        == initiative_agreement_internal_comment_orm_fields["initiative_agreement_id"]
    )


# Tests for get_internal_comments
@pytest.mark.anyio
async def test_get_internal_comments_transfer_success(dbsession, internal_comment_repo):
    # Add and commit user, transfer, and internal comment to the session
    dbsession.add(user_orm_model)
    dbsession.add(transaction_orm_model)
    transfer_orm_model.transfer_id = transaction_orm_model.transaction_id
    dbsession.add(transfer_orm_model)
    dbsession.add(internal_comment_orm_model)
    await dbsession.commit()

    # Link internal comment to the transfer and commit
    transfer_internal_comment = TransferInternalComment(
        transfer_id=transfer_orm_model.transfer_id,
        internal_comment_id=internal_comment_orm_model.internal_comment_id,
    )
    dbsession.add(transfer_internal_comment)
    await dbsession.commit()

    # Attempt to retrieve internal comments for the transfer
    comments = await internal_comment_repo.get_internal_comments(
        EntityTypeEnum.TRANSFER, transfer_orm_model.transfer_id
    )

    # Verify that the correct comments are retrieved
    assert len(comments) == 1
    retrieved_comment = comments[0]
    assert retrieved_comment["comment"] == internal_comment_orm_model.comment
    assert (
        retrieved_comment["internal_comment_id"]
        == internal_comment_orm_model.internal_comment_id
    )

    # Ensure that full name is included in the response
    expected_full_name = f"{user_orm_model.first_name} {user_orm_model.last_name}"
    assert retrieved_comment["full_name"] == expected_full_name


@pytest.mark.anyio
async def test_get_internal_comments_initiative_success(
    dbsession, internal_comment_repo
):
    # Add and commit user, transaction, initiative agreement, and internal comment to the session
    dbsession.add(user_orm_model)
    dbsession.add(transaction_orm_model)
    initiative_agreement_orm_model.transaction_id = transaction_orm_model.transaction_id
    dbsession.add(initiative_agreement_status_orm_model)
    initiative_agreement_orm_model.current_status_id = (
        initiative_agreement_status_orm_model.initiative_agreement_status_id
    )
    dbsession.add(initiative_agreement_orm_model)
    dbsession.add(internal_comment_orm_model)
    await dbsession.commit()

    # Link internal comment to the initiative agreement and commit
    initiative_agreement_internal_comment = InitiativeAgreementInternalComment(
        initiative_agreement_id=initiative_agreement_orm_model.initiative_agreement_id,
        internal_comment_id=internal_comment_orm_model.internal_comment_id,
    )
    dbsession.add(initiative_agreement_internal_comment)
    await dbsession.commit()

    # Attempt to retrieve internal comments for the initiative agreement
    comments = await internal_comment_repo.get_internal_comments(
        EntityTypeEnum.INITIATIVE_AGREEMENT,
        initiative_agreement_orm_model.initiative_agreement_id,
    )

    # Verify that the correct comments are retrieved
    assert len(comments) == 1
    retrieved_comment = comments[0]
    assert retrieved_comment["comment"] == internal_comment_orm_model.comment
    assert (
        retrieved_comment["internal_comment_id"]
        == internal_comment_orm_model.internal_comment_id
    )
    assert retrieved_comment["create_user"] == user_orm_model.keycloak_username

    # Ensure that full name is included in the response
    expected_full_name = f"{user_orm_model.first_name} {user_orm_model.last_name}"
    assert retrieved_comment["full_name"] == expected_full_name


# Tests for get_internal_comment_by_id
@pytest.mark.anyio
async def test_get_internal_comment_by_id_success(dbsession, internal_comment_repo):
    # Add and commit user, transaction, initiative agreement, and internal comment to the session
    dbsession.add(user_orm_model)
    dbsession.add(transaction_orm_model)
    initiative_agreement_orm_model.transaction_id = transaction_orm_model.transaction_id
    dbsession.add(initiative_agreement_status_orm_model)
    initiative_agreement_orm_model.current_status_id = (
        initiative_agreement_status_orm_model.initiative_agreement_status_id
    )
    dbsession.add(initiative_agreement_orm_model)
    dbsession.add(internal_comment_orm_model)
    await dbsession.commit()

    # Link internal comment to the initiative agreement and commit
    initiative_agreement_internal_comment = InitiativeAgreementInternalComment(
        initiative_agreement_id=initiative_agreement_orm_model.initiative_agreement_id,
        internal_comment_id=internal_comment_orm_model.internal_comment_id,
    )
    dbsession.add(initiative_agreement_internal_comment)
    await dbsession.commit()

    # Attempt to retrieve internal comments for the initiative agreement
    comment = await internal_comment_repo.get_internal_comment_by_id(
        internal_comment_orm_model.internal_comment_id
    )

    # Verify that the correct comments are retrieved
    assert comment.comment == internal_comment_orm_model.comment
    assert comment.internal_comment_id == internal_comment_orm_model.internal_comment_id
    assert comment.create_user == user_orm_model.keycloak_username


# Tests for update_internal_comment
@pytest.mark.anyio
async def test_update_internal_comment_success(dbsession, internal_comment_repo):
    # Add and commit user, transaction, initiative agreement, and internal comment to the session
    dbsession.add(user_orm_model)
    dbsession.add(transaction_orm_model)
    initiative_agreement_orm_model.transaction_id = transaction_orm_model.transaction_id
    dbsession.add(initiative_agreement_status_orm_model)
    initiative_agreement_orm_model.current_status_id = (
        initiative_agreement_status_orm_model.initiative_agreement_status_id
    )
    dbsession.add(initiative_agreement_orm_model)
    dbsession.add(internal_comment_orm_model)
    await dbsession.commit()

    # Retrieve the added internal comment
    added_internal_comment = await internal_comment_repo.get_internal_comment_by_id(
        internal_comment_orm_model.internal_comment_id
    )

    # Check initial state
    assert added_internal_comment is not None
    assert added_internal_comment.comment == internal_comment_orm_model.comment

    # Update the transfer
    added_internal_comment.comment = "New comment"
    await dbsession.commit()

    # Refresh object from database (if your ORM supports this)
    await dbsession.refresh(added_internal_comment)

    # Assert the updated state
    assert added_internal_comment.comment == "New comment"
