"""What each side of a transfer may write, checked against the database.

A new transfer takes only the fields its sender chooses. On every move each
side writes only its own comment, the analyst's recommendation is set only
while recommending, and drafting or signing needs both organizations
registered for transfers.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferComment import (
    TransferComment,
    TransferCommentSourceEnum as Source,
)
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.transfer.validation import TransferValidation

FROM_ORG, TO_ORG = 1, 2
UNREGISTERED_ORG = 9311


def _service(dbsession):
    org_repo = OrganizationsRepository(dbsession)
    transaction_repo = TransactionRepository(dbsession)
    service = TransferServices(
        validate=MagicMock(),
        repo=TransferRepository(dbsession),
        org_repo=org_repo,
        org_service=OrganizationsService(
            repo=org_repo,
            transaction_repo=transaction_repo,
            notification_service=MagicMock(),
        ),
        transaction_repo=transaction_repo,
        notfn_service=AsyncMock(),
    )
    service._perform_notification_call = AsyncMock()
    return service


async def _user(dbsession, username, roles, organization_id=None):
    # History rows reference a real profile; which one does not matter here.
    profile_id = await dbsession.scalar(select(UserProfile.user_profile_id).limit(1))
    return SimpleNamespace(
        user_profile_id=profile_id,
        keycloak_username=username,
        first_name="Test",
        last_name=username,
        organization_id=organization_id,
        role_names=roles,
    )


def _drafter(dbsession, username="sender_drafter"):
    return _user(dbsession, username, [RoleEnum.SUPPLIER, RoleEnum.TRANSFER], FROM_ORG)


def _signer(dbsession, organization_id, username):
    return _user(
        dbsession,
        username,
        [RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY],
        organization_id,
    )


def _analyst(dbsession):
    return _user(dbsession, "gov_analyst", [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])


async def _seed_transfer(
    dbsession, status, *, recommendation=None, comments=(), from_transaction=None
):
    current = await dbsession.scalar(
        select(TransferStatus).where(TransferStatus.status == status)
    )
    transfer = Transfer(
        from_organization_id=FROM_ORG,
        to_organization_id=TO_ORG,
        agreement_date=date.today(),
        quantity=10,
        price_per_unit=5.0,
        current_status=current,
        recommendation=recommendation,
        from_transaction=from_transaction,
    )
    dbsession.add(transfer)
    await dbsession.flush()
    for source, text, author in comments:
        dbsession.add(
            TransferComment(
                transfer_id=transfer.transfer_id,
                comment=text,
                comment_source=source,
                create_user=author,
            )
        )
    await dbsession.flush()
    return transfer.transfer_id


def _body(transfer_id, status, **fields):
    values = dict(
        transfer_id=transfer_id,
        from_organization_id=FROM_ORG,
        to_organization_id=TO_ORG,
        agreement_date=date.today(),
        quantity=10,
        price_per_unit=5.0,
        current_status=status,
    )
    values.update(fields)
    return TransferCreateSchema(**values)


async def _comments(dbsession, transfer_id):
    rows = await dbsession.scalars(
        select(TransferComment).where(TransferComment.transfer_id == transfer_id)
    )
    return {row.comment_source: (row.comment, row.create_user) for row in rows}


async def _unregistered_org(dbsession):
    dbsession.add(
        Organization(
            organization_id=UNREGISTERED_ORG,
            name="Test Unregistered Counterparty",
            operating_name="Test Unregistered Counterparty",
            organization_type_id=1,
            organization_status_id=1,  # Unregistered
        )
    )
    await dbsession.flush()


# --- create -----------------------------------------------------------------


@pytest.mark.anyio
async def test_create_ignores_fields_the_server_owns(dbsession):
    drafter = await _drafter(dbsession)
    seeded_transaction = await dbsession.scalar(
        select(Transaction.transaction_id).where(
            Transaction.organization_id == FROM_ORG
        )
    )

    created = await _service(dbsession).create_transfer(
        _body(
            987654,
            TransferStatusEnum.Draft,
            transfer_category_id=4,
            recommendation="Record",
            from_transaction_id=seeded_transaction,
            to_transaction_id=seeded_transaction,
            current_status_id=6,
        ),
        drafter,
    )

    assert created.transfer_id != 987654
    stored = await dbsession.get(Transfer, created.transfer_id)
    assert stored.transfer_category_id is None
    assert stored.recommendation is None
    assert stored.from_transaction_id is None
    assert stored.to_transaction_id is None
    assert stored.current_status_id == await dbsession.scalar(
        select(TransferStatus.transfer_status_id).where(
            TransferStatus.status == TransferStatusEnum.Draft
        )
    )
    assert (stored.quantity, stored.price_per_unit) == (10, 5.0)


@pytest.mark.anyio
async def test_create_saves_only_the_senders_comment(dbsession):
    drafter = await _drafter(dbsession)

    created = await _service(dbsession).create_transfer(
        _body(
            None,
            TransferStatusEnum.Draft,
            from_org_comment="Ours",
            to_org_comment="Written for the receiver",
            gov_comment="Written for government",
        ),
        drafter,
    )

    assert await _comments(dbsession, created.transfer_id) == {
        Source.FROM_ORG: ("Ours", "sender_drafter")
    }


# --- comments on update -----------------------------------------------------


@pytest.mark.anyio
async def test_receiver_cannot_overwrite_the_senders_comment(dbsession):
    transfer_id = await _seed_transfer(
        dbsession,
        TransferStatusEnum.Sent,
        comments=[(Source.FROM_ORG, "Original terms", "sender_signer")],
    )
    receiver = await _signer(dbsession, TO_ORG, "receiver_signer")

    await _service(dbsession).update_transfer(
        _body(
            transfer_id,
            TransferStatusEnum.Submitted,
            from_org_comment="Rewritten by the receiver",
            to_org_comment="Accepted",
            gov_comment="Posing as government",
        ),
        receiver,
    )

    assert await _comments(dbsession, transfer_id) == {
        Source.FROM_ORG: ("Original terms", "sender_signer"),
        Source.TO_ORG: ("Accepted", "receiver_signer"),
    }


@pytest.mark.anyio
async def test_government_comment_save_leaves_organization_comments(dbsession):
    transfer_id = await _seed_transfer(
        dbsession,
        TransferStatusEnum.Submitted,
        comments=[
            (Source.FROM_ORG, "Sender note", "sender_signer"),
            (Source.TO_ORG, "Receiver note", "receiver_signer"),
        ],
    )

    await _service(dbsession).update_transfer(
        _body(
            transfer_id,
            TransferStatusEnum.Submitted,
            from_org_comment="Changed sender note",
            to_org_comment="Changed receiver note",
            gov_comment="Reviewed",
        ),
        await _analyst(dbsession),
    )

    assert await _comments(dbsession, transfer_id) == {
        Source.FROM_ORG: ("Sender note", "sender_signer"),
        Source.TO_ORG: ("Receiver note", "receiver_signer"),
        Source.GOVERNMENT: ("Reviewed", "gov_analyst"),
    }


@pytest.mark.anyio
async def test_edited_comment_shows_its_new_author(dbsession):
    transfer_id = await _seed_transfer(
        dbsession,
        TransferStatusEnum.Draft,
        comments=[(Source.FROM_ORG, "First wording", "colleague_a")],
    )

    await _service(dbsession).update_transfer(
        _body(transfer_id, TransferStatusEnum.Draft, from_org_comment="Second wording"),
        await _drafter(dbsession, "colleague_b"),
    )

    assert await _comments(dbsession, transfer_id) == {
        Source.FROM_ORG: ("Second wording", "colleague_b")
    }


@pytest.mark.anyio
async def test_unchanged_comment_keeps_its_author(dbsession):
    transfer_id = await _seed_transfer(
        dbsession,
        TransferStatusEnum.Draft,
        comments=[(Source.FROM_ORG, "First wording", "colleague_a")],
    )

    await _service(dbsession).update_transfer(
        _body(transfer_id, TransferStatusEnum.Draft, from_org_comment="First wording"),
        await _drafter(dbsession, "colleague_b"),
    )

    assert await _comments(dbsession, transfer_id) == {
        Source.FROM_ORG: ("First wording", "colleague_a")
    }


# --- recommendation ---------------------------------------------------------


@pytest.mark.anyio
async def test_organization_cannot_set_the_recommendation(dbsession):
    transfer_id = await _seed_transfer(dbsession, TransferStatusEnum.Sent)
    receiver = await _signer(dbsession, TO_ORG, "receiver_signer")

    with pytest.raises(HTTPException) as exc:
        await _service(dbsession).update_transfer(
            _body(transfer_id, TransferStatusEnum.Submitted, recommendation="Refuse"),
            receiver,
        )

    assert exc.value.status_code == 403
    assert (await dbsession.get(Transfer, transfer_id)).recommendation is None


@pytest.mark.anyio
async def test_organization_may_send_back_the_stored_recommendation(dbsession):
    reservation = Transaction(
        organization_id=FROM_ORG,
        compliance_units=-10,
        transaction_action=TransactionActionEnum.Reserved,
    )
    transfer_id = await _seed_transfer(
        dbsession,
        TransferStatusEnum.Recommended,
        recommendation=TransferRecommendationEnum.Record,
        from_transaction=reservation,
    )
    sender = await _signer(dbsession, FROM_ORG, "sender_signer")

    await _service(dbsession).update_transfer(
        _body(transfer_id, TransferStatusEnum.Rescinded, recommendation="Record"),
        sender,
    )

    transfer = await dbsession.get(Transfer, transfer_id)
    assert transfer.recommendation == TransferRecommendationEnum.Record
    assert transfer.current_status.status == TransferStatusEnum.Rescinded
    assert reservation.transaction_action == TransactionActionEnum.Released


@pytest.mark.anyio
async def test_government_comment_save_does_not_set_the_recommendation(dbsession):
    transfer_id = await _seed_transfer(dbsession, TransferStatusEnum.Submitted)

    await _service(dbsession).update_transfer(
        _body(transfer_id, TransferStatusEnum.Submitted, recommendation="Record"),
        await _analyst(dbsession),
    )

    assert (await dbsession.get(Transfer, transfer_id)).recommendation is None


@pytest.mark.anyio
async def test_analyst_sets_the_recommendation_when_recommending(dbsession):
    transfer_id = await _seed_transfer(dbsession, TransferStatusEnum.Submitted)

    await _service(dbsession).update_transfer(
        _body(transfer_id, TransferStatusEnum.Recommended, recommendation="Refuse"),
        await _analyst(dbsession),
    )

    transfer = await dbsession.get(Transfer, transfer_id)
    assert transfer.recommendation == TransferRecommendationEnum.Refuse


# --- registration -----------------------------------------------------------


@pytest.mark.anyio
async def test_registration_reads_the_organizations_own_status(dbsession):
    await _unregistered_org(dbsession)
    repo = OrganizationsRepository(dbsession)

    assert await repo.is_registered_for_transfer(FROM_ORG)
    assert not await repo.is_registered_for_transfer(UNREGISTERED_ORG)


@pytest.mark.anyio
async def test_draft_cannot_be_readdressed_to_an_unregistered_organization(
    dbsession,
):
    await _unregistered_org(dbsession)
    transfer_id = await _seed_transfer(dbsession, TransferStatusEnum.Draft)

    with pytest.raises(HTTPException) as exc:
        await _service(dbsession).update_transfer(
            _body(
                transfer_id,
                TransferStatusEnum.Draft,
                to_organization_id=UNREGISTERED_ORG,
            ),
            await _drafter(dbsession),
        )

    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_recording_checks_both_organizations_are_registered(dbsession):
    await _unregistered_org(dbsession)
    director = await _user(
        dbsession, "gov_director", [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
    )
    validation = TransferValidation(
        request=SimpleNamespace(user=director),
        org_repo=OrganizationsRepository(dbsession),
    )

    with pytest.raises(HTTPException) as exc:
        await validation.government_update_transfer(
            SimpleNamespace(user=director),
            _body(
                1,
                TransferStatusEnum.Recorded,
                to_organization_id=UNREGISTERED_ORG,
            ),
        )

    assert exc.value.status_code == 403
