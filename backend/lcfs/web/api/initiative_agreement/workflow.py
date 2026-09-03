"""Designated action workflow transitions (#4898).

The whole workflow is one declarative table: who may take each action,
which statuses it may be taken from, where it lands, and what it records.
Keeping it here rather than scattered through the service means the rules
can be read — and reviewed — in one place, and the tests assert against
the same table the API enforces.

Credit issuance is deliberately absent. Approving a designated action
concludes its review; moving credits is a separate step, per #4898.
"""

from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CREDITS_RECOMMENDED,
    EVENT_EVIDENCE_REVIEWED,
    EVENT_INFORMATION_REQUESTED,
    EVENT_STATUS_CHANGE,
)
from lcfs.db.models.user.Role import RoleEnum

# Status names as seeded in designated_action_status. "Approved" is the
# terminal reviewed state — the ticket calls it "Completed"; there is one
# status and these are two names for it.
# Agreement lifecycle, distinct from the designated action statuses below.
# Designated actions may only be added while the agreement is a draft.
LIFECYCLE_STATUS_DRAFT = "Draft"

STATUS_NOT_STARTED = "Not started"
STATUS_SUBMISSION_RECEIVED = "Submission received"
STATUS_UNDERWAY = "Underway"
STATUS_INFORMATION_REQUESTED = "Information requested"
STATUS_RECOMMENDED_TO_MANAGER = "Recommended to manager"
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
    ):
        self.roles = roles
        self.from_statuses = from_statuses
        self.to_status = to_status
        self.event = event
        self.requires_comment = requires_comment
        self.requires_credits = requires_credits
        self.requires_all_evidence_satisfactory = requires_all_evidence_satisfactory
        self.captures_evidence = captures_evidence


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
    ),
    ACTION_RECOMMEND_TO_MANAGER: Transition(
        roles=(RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER),
        from_statuses=IN_REVIEW_STATUSES,
        to_status=STATUS_RECOMMENDED_TO_MANAGER,
        event=EVENT_CREDITS_RECOMMENDED,
        requires_credits=True,
        requires_all_evidence_satisfactory=True,
    ),
    ACTION_RETURN: Transition(
        roles=(RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR),
        from_statuses=(
            STATUS_RECOMMENDED_TO_MANAGER,
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
