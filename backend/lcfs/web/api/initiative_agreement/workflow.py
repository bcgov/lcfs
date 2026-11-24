"""Designated action workflow transitions (#4898).

The whole workflow is one declarative table: who may take each action,
which statuses it may be taken from, where it lands, and what it records.
Keeping it here rather than scattered through the service means the rules
can be read — and reviewed — in one place, and the tests assert against
the same table the API enforces.

Final director approval also issues the recommended credits through the
existing initiative agreement credit transaction flow.
"""

from fastapi import HTTPException

from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CREDITS_RECOMMENDED,
    EVENT_EVIDENCE_REVIEWED,
    EVENT_INFORMATION_REQUESTED,
    EVENT_STATUS_CHANGE,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.role.schema import user_has_roles

# Agreement lifecycle, distinct from the designated action statuses below.
LIFECYCLE_STATUS_DRAFT = "Draft"
LIFECYCLE_STATUS_UNDERWAY = "Underway"

# Where a new agreement starts, by who starts it (#5186); the first rule the
# creator matches wins. An agreement government enters is live from the
# start. Draft is kept for the applications BCeID proponents will start.
INITIAL_LIFECYCLE_STATUS_RULES = (
    (RoleEnum.GOVERNMENT, LIFECYCLE_STATUS_UNDERWAY),
    (RoleEnum.SUPPLIER, LIFECYCLE_STATUS_DRAFT),
)

# A draft is a proponent's application that has not been submitted, so IDIR
# users do not see it: not in the grids, the counts or the status filter.
LIFECYCLE_STATUSES_HIDDEN_FROM_GOVERNMENT = (LIFECYCLE_STATUS_DRAFT,)

# The IA package (#5554) is the agreement's information, its notes, its
# designated actions, their evidence of completion list, and the files on the
# agreement and its actions. It can be edited directly only in these lifecycle
# statuses. Underway is the package the organization has been given, so from
# then on it is read-only and changes only through a change order (#5555 adds
# its draft status here). The tuple lists what is open, so Underway,
# Completed, Terminated and any status added later stay read-only unless
# someone opens them here.
LIFECYCLE_STATUSES_EDITABLE = (LIFECYCLE_STATUS_DRAFT,)

# Not every write to an agreement edits its package. These stay open while it
# is Underway, because Underway is when they happen:
# - the analyst review: the TRANSITIONS below, the EOC assessment, the
#   recommended amount and analyst assignment;
# - internal comments on the agreement and its actions;
# - the BCeID evidence of completion submission, which Underway opens. The
#   files a proponent or signer puts on their designated action are that
#   submission's evidence, not package attachments, so the submission's own
#   rules govern them (is_eoc_evidence_write).
EOC_SUBMISSION_ROLES = (RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER)

# Where the files on an agreement's package live, by document parent type.
PACKAGE_DOCUMENT_PARENT_TYPES = ("initiativeAgreement", "designatedAction")


def initial_lifecycle_status(user):
    """The lifecycle status an agreement this user creates starts in, or
    None when no rule covers them."""
    for role, lifecycle_status in INITIAL_LIFECYCLE_STATUS_RULES:
        if user_has_roles(user, [role]):
            return lifecycle_status
    return None


def hidden_lifecycle_statuses(user):
    """Lifecycle statuses kept out of this user's sight."""
    if user is not None and user_has_roles(user, [RoleEnum.GOVERNMENT]):
        return LIFECYCLE_STATUSES_HIDDEN_FROM_GOVERNMENT
    return ()


def _lifecycle(agreement):
    return agreement.lifecycle_status.status if agreement.lifecycle_status else None


def is_hidden_from(agreement, user) -> bool:
    """Whether this agreement's lifecycle status keeps it from this user.
    The agreement's lifecycle_status must already be loaded."""
    return _lifecycle(agreement) in hidden_lifecycle_statuses(user)


def is_package_editable(agreement) -> bool:
    """Whether this agreement's package can be edited directly (#5554). The
    agreement's lifecycle_status must already be loaded."""
    return _lifecycle(agreement) in LIFECYCLE_STATUSES_EDITABLE


def ensure_package_editable(agreement) -> None:
    """Refuse a direct edit to a package that is not open to one.

    Every write path that changes the package calls this, so the lock holds
    for an API call as well as the page. 409, not 403: the request is
    understood and allowed for this caller, but the agreement's state
    refuses it, and view_handler would replace a 403's message.
    """
    if not is_package_editable(agreement):
        raise HTTPException(
            status_code=409,
            detail=(
                f"This initiative agreement is {_lifecycle(agreement) or 'not set'}, "
                "so its package can't be edited directly."
            ),
        )


def is_eoc_evidence_write(
    parent_type: str, user, *, new_file: bool = False, file_owner=None
) -> bool:
    """Whether a file write belongs to the BCeID evidence of completion
    submission rather than the package (see EOC_SUBMISSION_ROLES): a
    proponent or signer uploading to a designated action, or changing a
    file they uploaded there. Folders, and the files government put on the
    action, stay part of the package."""
    if parent_type != "designatedAction":
        return False
    if user_has_roles(user, [RoleEnum.GOVERNMENT]) or not any(
        user_has_roles(user, [role]) for role in EOC_SUBMISSION_ROLES
    ):
        return False
    username = getattr(user, "keycloak_username", None)
    return new_file or (file_owner is not None and file_owner == username)


def ensure_package_document_writable(
    agreement, parent_type: str, user, *, new_file: bool = False, file_owner=None
) -> None:
    """Refuse a file or folder write on a package that is not open to edits,
    unless it is BCeID evidence (see is_eoc_evidence_write)."""
    if is_eoc_evidence_write(
        parent_type, user, new_file=new_file, file_owner=file_owner
    ):
        return
    ensure_package_editable(agreement)


# Status names as seeded in designated_action_status. "Approved" is the
# terminal reviewed state — the ticket calls it "Completed"; there is one
# status and these are two names for it.
STATUS_NOT_STARTED = "Not started"
STATUS_SUBMISSION_RECEIVED = "Submission received"
STATUS_UNDERWAY = "Underway"
STATUS_INFORMATION_REQUESTED = "Information requested"
STATUS_RECOMMENDED_TO_MANAGER = "Recommended to manager"
STATUS_NOT_RECOMMENDED = "Not recommended"
STATUS_RECOMMENDED_TO_DIRECTOR = "Recommended to director"
STATUS_APPROVED = "Approved"
STATUS_RETURNED = "Returned"
STATUS_REJECTED = "Rejected"
STATUS_CANCELLED = "Cancelled"

# Where an action can sit while an analyst is still working it.
IN_REVIEW_STATUSES = (
    STATUS_NOT_STARTED,
    STATUS_SUBMISSION_RECEIVED,
    STATUS_UNDERWAY,
    STATUS_INFORMATION_REQUESTED,
    STATUS_RETURNED,
)

ACTION_ACCEPT_EVIDENCE = "accept_evidence"
ACTION_REQUEST_INFORMATION = "request_information"
ACTION_RECOMMEND_TO_MANAGER = "recommend_to_manager"
ACTION_NOT_RECOMMEND = "not_recommend"
ACTION_RETURN = "return"
ACTION_RECOMMEND_TO_DIRECTOR = "recommend_to_director"
ACTION_APPROVE = "approve"
ACTION_REJECT = "reject"


class Transition:
    """One workflow action.

    ``to_status`` of None means the action records a decision without
    moving the designated action — accepting the evidence is a review
    milestone, not a change of hands.
    """

    def __init__(
        self,
        *,
        roles,
        from_statuses,
        to_status,
        event,
        requires_comment=False,
        requires_credits=False,
        requires_all_evidence_satisfactory=False,
        captures_evidence=False,
        uses_missing_information=False,
    ):
        self.roles = roles
        self.from_statuses = from_statuses
        self.to_status = to_status
        self.event = event
        self.requires_comment = requires_comment
        self.requires_credits = requires_credits
        self.requires_all_evidence_satisfactory = requires_all_evidence_satisfactory
        self.captures_evidence = captures_evidence
        self.uses_missing_information = uses_missing_information


TRANSITIONS = {
    # The analyst concludes the evidence review. Every active requirement
    # must be satisfactory, which is what the wireframe's greyed-out
    # Accept button means.
    ACTION_ACCEPT_EVIDENCE: Transition(
        roles=(RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER),
        from_statuses=IN_REVIEW_STATUSES,
        to_status=STATUS_UNDERWAY,
        event=EVENT_EVIDENCE_REVIEWED,
        requires_all_evidence_satisfactory=True,
        captures_evidence=True,
    ),
    # Sends the action back to the proponent for more evidence. The
    # snapshot carries the full review, so this round's findings survive
    # the next one.
    ACTION_REQUEST_INFORMATION: Transition(
        roles=(RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER),
        from_statuses=IN_REVIEW_STATUSES,
        to_status=STATUS_INFORMATION_REQUESTED,
        event=EVENT_INFORMATION_REQUESTED,
        requires_comment=True,
        captures_evidence=True,
        uses_missing_information=True,
    ),
    ACTION_RECOMMEND_TO_MANAGER: Transition(
        roles=(RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER),
        from_statuses=IN_REVIEW_STATUSES,
        to_status=STATUS_RECOMMENDED_TO_MANAGER,
        event=EVENT_CREDITS_RECOMMENDED,
        requires_credits=True,
        requires_all_evidence_satisfactory=True,
        captures_evidence=True,
    ),
    # The analyst's negative recommendation (#5118). It goes to the
    # manager like a positive one, but carries no amount and does not
    # need the evidence to be satisfactory: evidence falling short is the
    # usual reason for it. The reason is required, and the review is kept.
    ACTION_NOT_RECOMMEND: Transition(
        roles=(RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER),
        from_statuses=IN_REVIEW_STATUSES,
        to_status=STATUS_NOT_RECOMMENDED,
        event=EVENT_STATUS_CHANGE,
        requires_comment=True,
        captures_evidence=True,
    ),
    ACTION_RETURN: Transition(
        roles=(RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR),
        from_statuses=(
            STATUS_RECOMMENDED_TO_MANAGER,
            STATUS_NOT_RECOMMENDED,
            STATUS_RECOMMENDED_TO_DIRECTOR,
        ),
        to_status=STATUS_RETURNED,
        event=EVENT_STATUS_CHANGE,
        requires_comment=True,
    ),
    ACTION_RECOMMEND_TO_DIRECTOR: Transition(
        roles=(RoleEnum.IA_MANAGER,),
        from_statuses=(STATUS_RECOMMENDED_TO_MANAGER,),
        to_status=STATUS_RECOMMENDED_TO_DIRECTOR,
        event=EVENT_STATUS_CHANGE,
    ),
    ACTION_APPROVE: Transition(
        roles=(RoleEnum.DIRECTOR,),
        from_statuses=(STATUS_RECOMMENDED_TO_DIRECTOR,),
        to_status=STATUS_APPROVED,
        event=EVENT_STATUS_CHANGE,
        captures_evidence=True,
    ),
    ACTION_REJECT: Transition(
        roles=(RoleEnum.DIRECTOR,),
        from_statuses=(STATUS_RECOMMENDED_TO_DIRECTOR,),
        to_status=STATUS_REJECTED,
        event=EVENT_STATUS_CHANGE,
        requires_comment=True,
    ),
}

WORKFLOW_ACTIONS = tuple(TRANSITIONS)
