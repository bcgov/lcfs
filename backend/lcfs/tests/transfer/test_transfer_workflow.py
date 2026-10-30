"""Transfer workflow: the transition table the API enforces.

Every move is checked against the stored transfer: the caller's side comes
from its counterparties, and the move from its current status.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum as S
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.transfer.workflow import (
    PARTY_FROM,
    PARTY_GOVERNMENT,
    PARTY_TO,
    TRANSITIONS,
    ensure_transfer_transition,
    transfer_party,
)

FROM_ORG, TO_ORG, OTHER_ORG = 1, 2, 3


def _user(roles, organization_id=None):
    user = MagicMock()
    user.role_names = roles
    user.organization_id = organization_id
    return user


def _transfer(current):
    transfer = MagicMock()
    transfer.from_organization_id = FROM_ORG
    transfer.to_organization_id = TO_ORG
    transfer.current_status.status = current
    return transfer


def _signer(org):
    return _user([RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY], org)


def _drafter(org):
    return _user([RoleEnum.SUPPLIER, RoleEnum.TRANSFER], org)


def _read_only(org):
    return _user([RoleEnum.SUPPLIER, RoleEnum.READ_ONLY], org)


ANALYST = _user([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
MANAGER = _user([RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER])
DIRECTOR = _user([RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR])


def _status_code(user, transfer, target):
    try:
        ensure_transfer_transition(user, transfer, target)
    except HTTPException as exc:
        return exc.status_code
    return 200


def test_party_comes_from_the_stored_transfer():
    transfer = _transfer(S.Sent)
    assert transfer_party(_signer(FROM_ORG), transfer) == PARTY_FROM
    assert transfer_party(_signer(TO_ORG), transfer) == PARTY_TO
    assert transfer_party(ANALYST, transfer) == PARTY_GOVERNMENT
    assert transfer_party(_signer(OTHER_ORG), transfer) is None


def test_terminal_statuses_have_no_way_out():
    terminal = {S.Recorded, S.Refused, S.Declined, S.Rescinded, S.Deleted}
    assert not [key for key in TRANSITIONS if key[0] in terminal]


@pytest.mark.parametrize(
    "user, current, target",
    [
        (_drafter(FROM_ORG), None, S.Draft),
        (_signer(FROM_ORG), None, S.Sent),
        (_drafter(FROM_ORG), S.Draft, S.Draft),
        (_drafter(FROM_ORG), S.Draft, S.Deleted),
        (_signer(FROM_ORG), S.Draft, S.Sent),
        (_signer(TO_ORG), S.Sent, S.Submitted),
        (_drafter(TO_ORG), S.Sent, S.Declined),
        (_signer(FROM_ORG), S.Sent, S.Rescinded),
        (_signer(TO_ORG), S.Submitted, S.Rescinded),
        (_signer(FROM_ORG), S.Recommended, S.Rescinded),
        (MANAGER, S.Submitted, S.Submitted),
        (ANALYST, S.Submitted, S.Recommended),
        (DIRECTOR, S.Submitted, S.Recommended),
        (DIRECTOR, S.Recommended, S.Recorded),
        (DIRECTOR, S.Recommended, S.Refused),
        (DIRECTOR, S.Recommended, S.Submitted),
    ],
)
def test_moves_the_transfer_page_offers_are_allowed(user, current, target):
    transfer = None if current is None else _transfer(current)
    assert _status_code(user, transfer, target) == 200


@pytest.mark.parametrize(
    "user, current, target, expected",
    [
        # Someone who is not a party sees no transfer at all.
        (_signer(OTHER_ORG), S.Sent, S.Submitted, 404),
        (_signer(OTHER_ORG), S.Draft, S.Draft, 404),
        # Read Only cannot accept, decline or rescind.
        (_read_only(TO_ORG), S.Sent, S.Submitted, 403),
        (_read_only(TO_ORG), S.Sent, S.Declined, 403),
        (_read_only(FROM_ORG), S.Sent, S.Rescinded, 403),
        # Drafting without signing authority cannot send.
        (_drafter(FROM_ORG), None, S.Sent, 403),
        (_drafter(FROM_ORG), S.Draft, S.Sent, 403),
        # The sender cannot accept its own transfer.
        (_signer(FROM_ORG), S.Sent, S.Submitted, 403),
        # A finished transfer cannot be reopened, re-sent or re-decided.
        (_signer(FROM_ORG), S.Recorded, S.Sent, 403),
        (_signer(FROM_ORG), S.Recorded, S.Draft, 403),
        (_signer(FROM_ORG), S.Recorded, S.Rescinded, 403),
        (DIRECTOR, S.Recorded, S.Refused, 403),
        (DIRECTOR, S.Recorded, S.Recorded, 403),
        (_signer(TO_ORG), S.Declined, S.Submitted, 403),
        # Government steps keep their order and their roles.
        (ANALYST, S.Submitted, S.Recorded, 403),
        (DIRECTOR, S.Submitted, S.Recorded, 403),
        (MANAGER, S.Submitted, S.Recommended, 403),
        (ANALYST, S.Recommended, S.Refused, 403),
        (ANALYST, S.Recommended, S.Recommended, 403),
        (DIRECTOR, S.Sent, S.Refused, 403),
    ],
)
def test_moves_outside_the_table_are_refused(user, current, target, expected):
    transfer = None if current is None else _transfer(current)
    assert _status_code(user, transfer, target) == expected


def test_a_status_is_required():
    assert _status_code(_drafter(FROM_ORG), _transfer(S.Draft), None) == 400
