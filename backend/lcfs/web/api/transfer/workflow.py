"""Transfer workflow transitions.

The whole workflow is one declarative table: which status a transfer may
move to from where it stands now, which side of the transfer may move it,
and which roles that side needs. It mirrors the buttons the transfer page
offers, so the API refuses what the page would never send.

The party comes from the stored transfer, never from organization IDs in
the request body. Recorded, Refused, Declined, Rescinded and Deleted are
terminal: nothing in the table leaves them.
"""

from fastapi import HTTPException
from starlette import status

from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.core.ownership import is_government_user

PARTY_FROM = "from"
PARTY_TO = "to"
PARTY_GOVERNMENT = "government"

# The table's key for a transfer that does not exist yet.
NEW = None


class TransferTransition:
    """Who may move a transfer along one edge of the workflow.

    The caller must be one of *parties* and hold any one of *roles*.
    """

    def __init__(self, *, parties, roles):
        self.parties = parties
        self.roles = roles


_DRAFTERS = (RoleEnum.TRANSFER, RoleEnum.SIGNING_AUTHORITY)
_SIGNERS = (RoleEnum.SIGNING_AUTHORITY,)
_EITHER_ORG = (PARTY_FROM, PARTY_TO)

TRANSITIONS = {
    # The sending organization drafts, edits, deletes and signs.
    (NEW, TransferStatusEnum.Draft): TransferTransition(
        parties=(PARTY_FROM,), roles=_DRAFTERS
    ),
    (NEW, TransferStatusEnum.Sent): TransferTransition(
        parties=(PARTY_FROM,), roles=_SIGNERS
    ),
    (TransferStatusEnum.Draft, TransferStatusEnum.Draft): TransferTransition(
        parties=(PARTY_FROM,), roles=_DRAFTERS
    ),
    (TransferStatusEnum.Draft, TransferStatusEnum.Deleted): TransferTransition(
        parties=(PARTY_FROM,), roles=_DRAFTERS
    ),
    (TransferStatusEnum.Draft, TransferStatusEnum.Sent): TransferTransition(
        parties=(PARTY_FROM,), roles=_SIGNERS
    ),
    # The receiving organization accepts (signs and submits) or declines.
    (TransferStatusEnum.Sent, TransferStatusEnum.Submitted): TransferTransition(
        parties=(PARTY_TO,), roles=_SIGNERS
    ),
    (TransferStatusEnum.Sent, TransferStatusEnum.Declined): TransferTransition(
        parties=(PARTY_TO,), roles=_DRAFTERS
    ),
    # Until it is recorded, a signing authority on either side can rescind.
    # While it is only Sent, that is the sender's call alone.
    (TransferStatusEnum.Sent, TransferStatusEnum.Rescinded): TransferTransition(
        parties=(PARTY_FROM,), roles=_SIGNERS
    ),
    (TransferStatusEnum.Submitted, TransferStatusEnum.Rescinded): TransferTransition(
        parties=_EITHER_ORG, roles=_SIGNERS
    ),
    (TransferStatusEnum.Recommended, TransferStatusEnum.Rescinded): TransferTransition(
        parties=_EITHER_ORG, roles=_SIGNERS
    ),
    # Government: any IDIR user saves a comment on a submitted transfer; the
    # analyst (or a director acting as one) recommends; the director alone
    # records, refuses, returns it to the analyst, or comments once it is
    # recommended.
    (TransferStatusEnum.Submitted, TransferStatusEnum.Submitted): TransferTransition(
        parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.GOVERNMENT,)
    ),
    (TransferStatusEnum.Submitted, TransferStatusEnum.Recommended): TransferTransition(
        parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.ANALYST, RoleEnum.DIRECTOR)
    ),
    (
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recommended,
    ): TransferTransition(parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.DIRECTOR,)),
    (TransferStatusEnum.Recommended, TransferStatusEnum.Submitted): TransferTransition(
        parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.DIRECTOR,)
    ),
    (TransferStatusEnum.Recommended, TransferStatusEnum.Recorded): TransferTransition(
        parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.DIRECTOR,)
    ),
    (TransferStatusEnum.Recommended, TransferStatusEnum.Refused): TransferTransition(
        parties=(PARTY_GOVERNMENT,), roles=(RoleEnum.DIRECTOR,)
    ),
}


def transfer_party(user, transfer):
    """Which side of this stored transfer the user is on, or None."""
    if is_government_user(user):
        return PARTY_GOVERNMENT
    user_organization_id = getattr(user, "organization_id", None)
    if user_organization_id is None:
        return None
    if user_organization_id == transfer.from_organization_id:
        return PARTY_FROM
    if user_organization_id == transfer.to_organization_id:
        return PARTY_TO
    return None


def _status_of(transfer):
    current = getattr(transfer, "current_status", None)
    return getattr(current, "status", None)


def ensure_transfer_transition(user, transfer, target_status) -> str:
    """Refuse a move the workflow does not allow; return the caller's party.

    *transfer* is the stored row, or None when creating. A user who is not
    a party to the transfer gets 404, as if it did not exist.
    """
    if target_status is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A transfer status is required.",
        )

    if transfer is None:
        party = PARTY_FROM
        current = NEW
    else:
        party = transfer_party(user, transfer)
        if party is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found."
            )
        current = _status_of(transfer)

    transition = TRANSITIONS.get((current, target_status))
    if (
        transition is None
        or party not in transition.parties
        or not any(role in user.role_names for role in transition.roles)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This transfer cannot move to that status.",
        )
    return party
