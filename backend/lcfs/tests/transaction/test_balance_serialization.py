"""Balance-changing requests for one organization take turns.

Each test runs the same request twice in overlapping database transactions:
the first holds its transaction open while the second starts. The second
must act on what the first committed, so the ledger ends with one write.
"""

import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select

from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import (
    AdminAdjustmentHistory,
)
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatus,
    AdminAdjustmentStatusEnum,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    InitiativeAgreement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferComment import TransferComment
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.admin_adjustment.repo import AdminAdjustmentRepository
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentUpdateSchema
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementUpdateSchema
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.transfer.services import TransferServices

# Rows for this organization are committed, so they are removed afterwards.
LEDGER_ORG = 9321
RECEIVING_ORG = 2  # seeded and registered


def _org_service(session):
    return OrganizationsService(
        repo=OrganizationsRepository(session),
        transaction_repo=TransactionRepository(session),
        notification_service=MagicMock(),
    )


async def _user(session, roles, organization_id=None):
    profile_id = await session.scalar(select(UserProfile.user_profile_id).limit(1))
    return SimpleNamespace(
        user_profile_id=profile_id,
        keycloak_username="ledger_test_user",
        first_name="Ledger",
        last_name="Tester",
        organization_id=organization_id,
        role_names=roles,
    )


async def _director(session):
    return await _user(session, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR])


async def _run_overlapping(dbsession_factory, act):
    """Run *act* in two overlapping transactions; return the second's outcome.

    The first transaction stays open until the second has had time to reach
    the database. The outcome is the second call's result or its exception.
    """
    first_done = asyncio.Event()
    allow_commit = asyncio.Event()

    async def first():
        async with dbsession_factory() as session, session.begin():
            try:
                await act(session)
            finally:
                first_done.set()
            await allow_commit.wait()

    async def second():
        async with dbsession_factory() as session, session.begin():
            return await act(session)

    first_task = asyncio.create_task(first())
    second_task = None
    try:
        await asyncio.wait_for(first_done.wait(), timeout=10)
        if first_task.done():
            first_task.result()  # surface a failure in the first request
        second_task = asyncio.create_task(second())
        await asyncio.sleep(0.3)
        allow_commit.set()
        await asyncio.wait_for(first_task, timeout=10)
        (outcome,) = await asyncio.wait_for(
            asyncio.gather(second_task, return_exceptions=True), timeout=10
        )
        return outcome
    finally:
        allow_commit.set()
        for task in (first_task, second_task):
            if task is not None and not task.done():
                task.cancel()


async def _seed_ledger_org(dbsession_factory, units=0):
    async with dbsession_factory() as session, session.begin():
        session.add(
            Organization(
                organization_id=LEDGER_ORG,
                name="Test Ledger Organization",
                operating_name="Test Ledger Organization",
                organization_type_id=1,
                organization_status_id=2,  # Registered
            )
        )
        await session.flush()
        if units:
            session.add(
                Transaction(
                    organization_id=LEDGER_ORG,
                    compliance_units=units,
                    transaction_action=TransactionActionEnum.Adjustment,
                )
            )


async def _remove_ledger_org(dbsession_factory):
    async with dbsession_factory() as session, session.begin():
        transfer_ids = select(Transfer.transfer_id).where(
            Transfer.from_organization_id == LEDGER_ORG
        )
        await session.execute(
            delete(TransferHistory).where(TransferHistory.transfer_id.in_(transfer_ids))
        )
        await session.execute(
            delete(TransferComment).where(TransferComment.transfer_id.in_(transfer_ids))
        )
        await session.execute(
            delete(Transfer).where(Transfer.from_organization_id == LEDGER_ORG)
        )
        adjustment_ids = select(AdminAdjustment.admin_adjustment_id).where(
            AdminAdjustment.to_organization_id == LEDGER_ORG
        )
        await session.execute(
            delete(AdminAdjustmentHistory).where(
                AdminAdjustmentHistory.admin_adjustment_id.in_(adjustment_ids)
            )
        )
        await session.execute(
            delete(AdminAdjustment).where(
                AdminAdjustment.to_organization_id == LEDGER_ORG
            )
        )
        agreement_ids = select(InitiativeAgreement.initiative_agreement_id).where(
            InitiativeAgreement.to_organization_id == LEDGER_ORG
        )
        await session.execute(
            delete(InitiativeAgreementHistory).where(
                InitiativeAgreementHistory.initiative_agreement_id.in_(agreement_ids)
            )
        )
        await session.execute(
            delete(InitiativeAgreement).where(
                InitiativeAgreement.to_organization_id == LEDGER_ORG
            )
        )
        await session.execute(
            delete(Transaction).where(Transaction.organization_id == LEDGER_ORG)
        )
        await session.execute(
            delete(Organization).where(Organization.organization_id == LEDGER_ORG)
        )


async def _ledger(dbsession_factory, action):
    async with dbsession_factory() as session:
        rows = await session.scalars(
            select(Transaction)
            .where(
                Transaction.organization_id == LEDGER_ORG,
                Transaction.transaction_action == action,
            )
            .order_by(Transaction.transaction_id)
        )
        return [(row.transaction_id, row.compliance_units) for row in rows]


@pytest.fixture
async def ledger_org(dbsession_factory):
    await _remove_ledger_org(dbsession_factory)  # in case a run was interrupted
    yield
    await _remove_ledger_org(dbsession_factory)


@pytest.mark.anyio
async def test_reservations_cannot_spend_the_same_balance_twice(
    dbsession_factory, ledger_org
):
    await _seed_ledger_org(dbsession_factory, units=100)

    async def reserve(session):
        return await _org_service(session).adjust_balance(
            transaction_action=TransactionActionEnum.Reserved,
            compliance_units=-80,
            organization_id=LEDGER_ORG,
        )

    outcome = await _run_overlapping(dbsession_factory, reserve)

    assert isinstance(outcome, ValueError), outcome
    assert "exceed available balance" in str(outcome)
    reserved = await _ledger(dbsession_factory, TransactionActionEnum.Reserved)
    assert [units for _, units in reserved] == [-80]


@pytest.mark.anyio
async def test_signing_a_draft_twice_reserves_once(dbsession_factory, ledger_org):
    await _seed_ledger_org(dbsession_factory, units=100)
    async with dbsession_factory() as session, session.begin():
        draft = await session.scalar(
            select(TransferStatus).where(
                TransferStatus.status == TransferStatusEnum.Draft
            )
        )
        transfer = Transfer(
            from_organization_id=LEDGER_ORG,
            to_organization_id=RECEIVING_ORG,
            agreement_date=date.today(),
            quantity=30,
            price_per_unit=10.0,
            current_status=draft,
        )
        session.add(transfer)
        await session.flush()
        transfer_id = transfer.transfer_id

    async def sign_and_send(session):
        org_repo = OrganizationsRepository(session)
        transaction_repo = TransactionRepository(session)
        service = TransferServices(
            validate=MagicMock(),
            repo=TransferRepository(session),
            org_repo=org_repo,
            org_service=_org_service(session),
            transaction_repo=transaction_repo,
            notfn_service=AsyncMock(),
        )
        service._perform_notification_call = AsyncMock()
        signer = await _user(
            session, [RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY], LEDGER_ORG
        )
        return await service.update_transfer(
            TransferCreateSchema(
                transfer_id=transfer_id,
                from_organization_id=LEDGER_ORG,
                to_organization_id=RECEIVING_ORG,
                agreement_date=date.today(),
                quantity=30,
                price_per_unit=10.0,
                current_status=TransferStatusEnum.Sent,
            ),
            signer,
        )

    outcome = await _run_overlapping(dbsession_factory, sign_and_send)

    # The second request finds the transfer already Sent.
    assert isinstance(outcome, HTTPException), outcome
    assert outcome.status_code == 403
    reserved = await _ledger(dbsession_factory, TransactionActionEnum.Reserved)
    assert [units for _, units in reserved] == [-30]
    async with dbsession_factory() as session:
        stored = await session.get(Transfer, transfer_id)
        assert stored.from_transaction_id == reserved[0][0]


@pytest.mark.anyio
async def test_approving_an_admin_adjustment_twice_issues_once(
    dbsession_factory, ledger_org
):
    await _seed_ledger_org(dbsession_factory)
    async with dbsession_factory() as session, session.begin():
        recommended = await session.scalar(
            select(AdminAdjustmentStatus).where(
                AdminAdjustmentStatus.status == AdminAdjustmentStatusEnum.Recommended
            )
        )
        adjustment = AdminAdjustment(
            to_organization_id=LEDGER_ORG,
            compliance_units=50,
            current_status=recommended,
        )
        session.add(adjustment)
        await session.flush()
        adjustment_id = adjustment.admin_adjustment_id

    async def approve(session):
        service = AdminAdjustmentServices(
            repo=AdminAdjustmentRepository(session),
            org_service=_org_service(session),
            internal_comment_service=MagicMock(),
            request=SimpleNamespace(user=await _director(session)),
        )
        return await service.update_admin_adjustment(
            AdminAdjustmentUpdateSchema(
                admin_adjustment_id=adjustment_id,
                compliance_units=50,
                to_organization_id=LEDGER_ORG,
                current_status=AdminAdjustmentStatusEnum.Approved.value,
            )
        )

    outcome = await _run_overlapping(dbsession_factory, approve)

    assert not isinstance(outcome, Exception), outcome
    issued = await _ledger(dbsession_factory, TransactionActionEnum.Adjustment)
    assert [units for _, units in issued] == [50]
    async with dbsession_factory() as session:
        stored = await session.get(AdminAdjustment, adjustment_id)
        assert stored.transaction_id == issued[0][0]


@pytest.mark.anyio
async def test_approving_a_legacy_initiative_agreement_twice_issues_once(
    dbsession_factory, ledger_org
):
    await _seed_ledger_org(dbsession_factory)
    async with dbsession_factory() as session, session.begin():
        recommended = await session.scalar(
            select(InitiativeAgreementStatus).where(
                InitiativeAgreementStatus.status
                == InitiativeAgreementStatusEnum.Recommended
            )
        )
        agreement = InitiativeAgreement(
            to_organization_id=LEDGER_ORG,
            compliance_units=50,
            current_status=recommended,
        )
        session.add(agreement)
        await session.flush()
        agreement_id = agreement.initiative_agreement_id

    async def approve(session):
        service = InitiativeAgreementServices(
            repo=InitiativeAgreementRepository(session),
            org_service=_org_service(session),
            internal_comment_service=MagicMock(),
            notfn_service=AsyncMock(),
            request=SimpleNamespace(user=await _director(session)),
            transaction_repo=TransactionRepository(session),
        )
        service._perform_notification_call = AsyncMock()
        return await service.update_initiative_agreement(
            InitiativeAgreementUpdateSchema(
                initiative_agreement_id=agreement_id,
                compliance_units=50,
                to_organization_id=LEDGER_ORG,
                current_status=InitiativeAgreementStatusEnum.Approved.value,
            )
        )

    outcome = await _run_overlapping(dbsession_factory, approve)

    assert not isinstance(outcome, Exception), outcome
    issued = await _ledger(dbsession_factory, TransactionActionEnum.Adjustment)
    assert [units for _, units in issued] == [50]
    async with dbsession_factory() as session:
        stored = await session.get(InitiativeAgreement, agreement_id)
        assert stored.transaction_id == issued[0][0]


@pytest.mark.anyio
async def test_an_admin_adjustment_cannot_share_a_ledger_transaction(dbsession):
    issued = Transaction(
        organization_id=1,
        compliance_units=5,
        transaction_action=TransactionActionEnum.Adjustment,
    )
    dbsession.add(issued)
    await dbsession.flush()
    draft = await dbsession.scalar(
        select(AdminAdjustmentStatus).where(
            AdminAdjustmentStatus.status == AdminAdjustmentStatusEnum.Draft
        )
    )
    for _ in range(2):
        dbsession.add(
            AdminAdjustment(
                to_organization_id=1,
                compliance_units=5,
                current_status=draft,
                transaction_id=issued.transaction_id,
            )
        )

    with pytest.raises(Exception, match="uq_admin_adjustment_transaction_id"):
        await dbsession.flush()
