"""Change orders on initiative agreement packages (#5555).

An underway package is amended through a change order:

1. IDIR staff start one, and the agreement moves to "Change order draft".
2. While it is open, an edit to the agreement's details, a note, a
   designated action or an evidence requirement is staged as a pending row
   in that record's version table. The live row keeps the accepted values,
   which are all an organization ever reads. A record added in the change
   order is a live row marked ``pending_change_order_id``. A record removed
   in it gets a pending DELETE version.
3. The Director accepts it with an Accepted date. The pending versions are
   applied to the live rows, the record as it stood before its first change
   is kept as version 0, and the agreement returns to Underway.
   Alternatively a manager or the Director discards it and the pending rows
   are dropped.

Only records the change order touches get versions. Everything attached to
a record (documents, comments, EOC submissions, credit transactions) hangs
off the live row, whose id never changes.

Workflow is not versioned: designated action status, assignment,
recommendations, issuance and the analyst's evidence review keep acting on
the live rows throughout.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.initiative_agreement.ChangeOrderVersion import (
    DesignatedActionVersion,
    EvidenceRequirementVersion,
    InitiativeAgreementNoteVersion,
    InitiativeAgreementVersion,
)
from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_CHANGE_ORDER,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementChangeOrder import (
    CHANGE_ORDER_ORIGIN_IDIR,
    CHANGE_ORDER_STATUS_ACCEPTED,
    CHANGE_ORDER_STATUS_DISCARDED,
    CHANGE_ORDER_STATUS_DRAFT,
    InitiativeAgreementChangeOrder,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleHistory import (
    InitiativeAgreementLifecycleHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleStatus import (
    InitiativeAgreementLifecycleStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementNote import (
    InitiativeAgreementNote,
)
from lcfs.utils.dates import PACIFIC_TZ
from lcfs.web.api.initiative_agreement.workflow import (
    CHANGE_ORDER_ACCEPT_ROLES,
    CHANGE_ORDER_DISCARD_ROLES,
    CHANGE_ORDER_START_ROLES,
    LIFECYCLE_STATUS_CHANGE_ORDER_DRAFT,
    LIFECYCLE_STATUS_UNDERWAY,
    LIFECYCLE_STATUSES_OPEN_TO_CHANGE_ORDERS,
    has_any_role,
    is_government,
)
from lcfs.web.exception.exceptions import DataNotFoundException

# How a record stands in the open change order, for IDIR readers.
STATE_ADDED = "added"
STATE_EDITED = "edited"
STATE_REMOVED = "removed"

RECORD_AGREEMENT = "agreement"
RECORD_NOTE = "note"
RECORD_DESIGNATED_ACTION = "designated-action"
RECORD_EVIDENCE_REQUIREMENT = "evidence-requirement"


@dataclass(frozen=True)
class RecordType:
    """One versioned record type: its live model and its version model.
    The live row's primary key and the version's foreign key share a name."""

    key: str
    live: type
    version: type

    @property
    def id_column(self) -> str:
        return self.version.RECORD_ID_COLUMN

    @property
    def fields(self) -> tuple:
        return self.version.VERSIONED_FIELDS

    def record_id(self, row) -> int:
        return getattr(row, self.id_column)

    def live_values(self, row) -> dict:
        return {name: getattr(row, name) for name in self.fields}


AGREEMENT = RecordType(
    RECORD_AGREEMENT, InitiativeAgreement, InitiativeAgreementVersion
)
NOTE = RecordType(RECORD_NOTE, InitiativeAgreementNote, InitiativeAgreementNoteVersion)
DESIGNATED_ACTION = RecordType(
    RECORD_DESIGNATED_ACTION, DesignatedAction, DesignatedActionVersion
)
EVIDENCE_REQUIREMENT = RecordType(
    RECORD_EVIDENCE_REQUIREMENT, EvidenceRequirement, EvidenceRequirementVersion
)
RECORD_TYPES = {
    record_type.key: record_type
    for record_type in (AGREEMENT, NOTE, DESIGNATED_ACTION, EVIDENCE_REQUIREMENT)
}
# Record types a change order can add or remove; the agreement itself it
# can only edit.
CHILD_RECORD_TYPES = (NOTE, DESIGNATED_ACTION, EVIDENCE_REQUIREMENT)


def is_removed(record_type: RecordType, row) -> bool:
    """Whether the live row is retired, by each table's own soft delete."""
    if record_type is DESIGNATED_ACTION:
        return row.action_type == ActionTypeEnum.DELETE
    if record_type in (NOTE, EVIDENCE_REQUIREMENT):
        return not row.is_active
    return False


def _retire(record_type: RecordType, row) -> None:
    if record_type is DESIGNATED_ACTION:
        row.action_type = ActionTypeEnum.DELETE
    else:
        row.is_active = False


def display_name(user) -> Optional[str]:
    name = " ".join(
        part
        for part in (getattr(user, "first_name", ""), getattr(user, "last_name", ""))
        if part
    ).strip()
    return name or None


def _jsonable(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value.normalize()) if value == value.to_integral() else str(value)
    return value


def _differences(before: dict, after: dict) -> dict:
    return {
        name: {"from": _jsonable(before.get(name)), "to": _jsonable(after.get(name))}
        for name in after
        if before.get(name) != after.get(name)
    }


@dataclass
class ChangeOrderView:
    """A reader's view of a package.

    Without a change order (and always for an organization), records read as
    accepted. For IDIR during a change order, each record reads as the
    change order would leave it, with its ``change_order_state``.
    """

    change_order: Optional[InitiativeAgreementChangeOrder] = None
    pending: Dict[str, Dict[int, object]] = field(default_factory=dict)

    @property
    def change_order_id(self) -> Optional[int]:
        return (
            self.change_order.initiative_agreement_change_order_id
            if self.change_order is not None
            else None
        )

    def pending_version(self, record_type: RecordType, row):
        return self.pending.get(record_type.key, {}).get(record_type.record_id(row))

    def state(self, record_type: RecordType, row) -> Optional[str]:
        if self.change_order is None:
            return None
        if (
            self.change_order_id is not None
            and getattr(row, "pending_change_order_id", None) == self.change_order_id
        ):
            return STATE_ADDED
        pending = self.pending_version(record_type, row)
        if pending is None:
            return None
        if pending.action_type == ActionTypeEnum.DELETE:
            return STATE_REMOVED
        return STATE_EDITED

    def values(self, record_type: RecordType, row) -> dict:
        """The versioned fields as this reader sees them."""
        pending = self.pending_version(record_type, row)
        if pending is not None and pending.action_type != ActionTypeEnum.DELETE:
            return pending.values()
        return record_type.live_values(row)

    def apply(self, record_type: RecordType, row, schema):
        """A copy of the record's schema with this view's values and state."""
        if self.change_order is None:
            return schema
        changes = dict(self.values(record_type, row))
        changes["change_order_state"] = self.state(record_type, row)
        return schema.model_copy(update=changes)


class ChangeOrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Queries -----------------------------------------------------------

    async def get_open_change_order(
        self, initiative_agreement_id: int, *, for_update: bool = False
    ) -> Optional[InitiativeAgreementChangeOrder]:
        query = select(InitiativeAgreementChangeOrder).where(
            InitiativeAgreementChangeOrder.initiative_agreement_id
            == initiative_agreement_id,
            InitiativeAgreementChangeOrder.status == CHANGE_ORDER_STATUS_DRAFT,
        )
        if for_update:
            query = query.with_for_update()
        return (await self.db.execute(query)).scalars().first()

    async def open_change_order_for(
        self, agreement
    ) -> Optional[InitiativeAgreementChangeOrder]:
        """The agreement's open change order, if it is in a change order
        draft. The agreement's lifecycle_status must already be loaded."""
        lifecycle = (
            agreement.lifecycle_status.status if agreement.lifecycle_status else None
        )
        if lifecycle != LIFECYCLE_STATUS_CHANGE_ORDER_DRAFT:
            return None
        return await self.get_open_change_order(agreement.initiative_agreement_id)

    async def list_change_orders(
        self, initiative_agreement_id: int
    ) -> List[InitiativeAgreementChangeOrder]:
        result = await self.db.execute(
            select(InitiativeAgreementChangeOrder)
            .where(
                InitiativeAgreementChangeOrder.initiative_agreement_id
                == initiative_agreement_id
            )
            .order_by(InitiativeAgreementChangeOrder.change_order_number.desc())
        )
        return list(result.scalars().all())

    async def _pending_versions(self, record_type: RecordType, change_order_id: int):
        result = await self.db.execute(
            select(record_type.version).where(
                record_type.version.change_order_id == change_order_id
            )
        )
        return list(result.scalars().all())

    async def _pending_version(
        self, record_type: RecordType, record_id: int, change_order_id: int
    ):
        version = record_type.version
        result = await self.db.execute(
            select(version).where(
                getattr(version, record_type.id_column) == record_id,
                version.change_order_id == change_order_id,
            )
        )
        return result.scalars().first()

    async def _version_numbers(self, record_type: RecordType, record_id: int):
        version = record_type.version
        result = await self.db.execute(
            select(version.version).where(
                getattr(version, record_type.id_column) == record_id
            )
        )
        return [number for (number,) in result.all()]

    async def record_versions(self, record_type: RecordType, record_id: int):
        """Every stored version of one record, oldest first, with the change
        order that produced each."""
        version = record_type.version
        result = await self.db.execute(
            select(version)
            .options(selectinload(version.change_order))
            .where(getattr(version, record_type.id_column) == record_id)
            .order_by(version.version)
        )
        return list(result.scalars().all())

    async def get_live_record(self, record_type: RecordType, record_id: int):
        return await self.db.get(record_type.live, record_id)

    async def view_for(self, agreement, user) -> ChangeOrderView:
        """The view this user gets of the agreement's package: IDIR staff
        see an open change order's edits, everyone else the accepted
        package."""
        if not is_government(user):
            return ChangeOrderView()
        change_order = await self.open_change_order_for(agreement)
        if change_order is None:
            return ChangeOrderView()
        pending = {}
        for record_type in RECORD_TYPES.values():
            rows = await self._pending_versions(
                record_type, change_order.initiative_agreement_change_order_id
            )
            pending[record_type.key] = {
                getattr(row, record_type.id_column): row for row in rows
            }
        return ChangeOrderView(change_order=change_order, pending=pending)

    # --- Lifecycle ---------------------------------------------------------

    async def _lock_agreement(self, initiative_agreement_id: int):
        agreement = (
            (
                await self.db.execute(
                    select(InitiativeAgreement)
                    .options(selectinload(InitiativeAgreement.lifecycle_status))
                    .where(
                        InitiativeAgreement.initiative_agreement_id
                        == initiative_agreement_id
                    )
                    .with_for_update(of=InitiativeAgreement)
                    .execution_options(populate_existing=True)
                )
            )
            .scalars()
            .first()
        )
        if agreement is None:
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        return agreement

    async def _move_lifecycle(self, agreement, status_name: str, user) -> None:
        lifecycle_status = (
            (
                await self.db.execute(
                    select(InitiativeAgreementLifecycleStatus).where(
                        InitiativeAgreementLifecycleStatus.status == status_name
                    )
                )
            )
            .scalars()
            .first()
        )
        if lifecycle_status is None:
            raise HTTPException(
                status_code=500,
                detail=f"Lifecycle status '{status_name}' is not configured.",
            )
        username = getattr(user, "keycloak_username", None)
        agreement.lifecycle_status_id = (
            lifecycle_status.initiative_agreement_lifecycle_status_id
        )
        agreement.lifecycle_status = lifecycle_status
        agreement.update_user = username
        self.db.add(
            InitiativeAgreementLifecycleHistory(
                initiative_agreement_id=agreement.initiative_agreement_id,
                lifecycle_status_id=(
                    lifecycle_status.initiative_agreement_lifecycle_status_id
                ),
                user_profile_id=getattr(user, "user_profile_id", None),
                display_name=display_name(user),
                create_user=username,
                update_user=username,
            )
        )

    async def _locked_open_change_order(self, initiative_agreement_id: int):
        agreement = await self._lock_agreement(initiative_agreement_id)
        lifecycle = (
            agreement.lifecycle_status.status if agreement.lifecycle_status else None
        )
        change_order = await self.get_open_change_order(
            initiative_agreement_id, for_update=True
        )
        if lifecycle != LIFECYCLE_STATUS_CHANGE_ORDER_DRAFT or change_order is None:
            raise HTTPException(
                status_code=400,
                detail="This agreement has no change order in progress.",
            )
        return agreement, change_order

    async def _lock_actions_or_409(self, change_order_id: int) -> None:
        """Take the rows of the designated actions this change order will
        change, without waiting.

        Acceptance and discard hold the agreement's row (FOR UPDATE) before
        they change actions, while a Director's approval holds an action's
        row before it adds the issued credits to the agreement's. Waiting on
        an action here could deadlock with that approval, so a busy action
        refuses the request instead, and it can be retried.
        """
        versioned = select(DesignatedActionVersion.designated_action_id).where(
            DesignatedActionVersion.change_order_id == change_order_id
        )
        try:
            await self.db.execute(
                select(DesignatedAction.designated_action_id)
                .where(
                    (DesignatedAction.designated_action_id.in_(versioned))
                    | (DesignatedAction.pending_change_order_id == change_order_id)
                )
                .order_by(DesignatedAction.designated_action_id)
                .with_for_update(nowait=True)
            )
        except DBAPIError as error:
            if _is_lock_not_available(error):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A designated action in this change order is being "
                        "updated right now. Try again in a moment."
                    ),
                ) from error
            raise

    async def start(
        self, initiative_agreement_id: int, user
    ) -> InitiativeAgreementChangeOrder:
        """Put an underway agreement into a change order draft."""
        if not has_any_role(user, CHANGE_ORDER_START_ROLES):
            raise HTTPException(
                status_code=403,
                detail="You are not permitted to start a change order.",
            )
        agreement = await self._lock_agreement(initiative_agreement_id)
        lifecycle = (
            agreement.lifecycle_status.status if agreement.lifecycle_status else None
        )
        if lifecycle not in LIFECYCLE_STATUSES_OPEN_TO_CHANGE_ORDERS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A change order can only be started on an underway "
                    f"agreement; this one is '{lifecycle or 'not set'}'."
                ),
            )
        if await self.get_open_change_order(initiative_agreement_id):
            raise HTTPException(
                status_code=409,
                detail="This agreement already has a change order in progress.",
            )
        highest = await self.db.scalar(
            select(func.max(InitiativeAgreementChangeOrder.change_order_number)).where(
                InitiativeAgreementChangeOrder.initiative_agreement_id
                == initiative_agreement_id
            )
        )
        username = getattr(user, "keycloak_username", None)
        change_order = InitiativeAgreementChangeOrder(
            initiative_agreement_id=initiative_agreement_id,
            change_order_number=(highest or 0) + 1,
            status=CHANGE_ORDER_STATUS_DRAFT,
            origin=CHANGE_ORDER_ORIGIN_IDIR,
            started_by_user_id=getattr(user, "user_profile_id", None),
            started_by_display_name=display_name(user),
            create_user=username,
            update_user=username,
        )
        self.db.add(change_order)
        await self._move_lifecycle(agreement, LIFECYCLE_STATUS_CHANGE_ORDER_DRAFT, user)
        await self.db.flush()
        return change_order

    # --- Staging edits -----------------------------------------------------

    async def working_values(self, change_order, record_type: RecordType, row) -> dict:
        """The record's versioned fields as the change order has them."""
        pending = await self._pending_version(
            record_type,
            record_type.record_id(row),
            change_order.initiative_agreement_change_order_id,
        )
        if pending is not None:
            if pending.action_type == ActionTypeEnum.DELETE:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This record is being removed in the change order and "
                        "can't be edited."
                    ),
                )
            return pending.values()
        return record_type.live_values(row)

    async def _new_pending(self, change_order, record_type, row, action_type, user):
        record_id = record_type.record_id(row)
        numbers = await self._version_numbers(record_type, record_id)
        # The live row is version 0 until something versions it.
        current = max(numbers) if numbers else getattr(row, "version", 0) or 0
        username = getattr(user, "keycloak_username", None)
        pending = record_type.version(
            **{record_type.id_column: record_id},
            version=current + 1,
            action_type=action_type,
            change_order_id=change_order.initiative_agreement_change_order_id,
            create_user=username,
            update_user=username,
            **record_type.live_values(row),
        )
        self.db.add(pending)
        return pending

    async def stage_update(
        self, change_order, record_type: RecordType, row, changes: dict, user
    ) -> None:
        """Record an edit to an accepted record as the change order's pending
        version of it. An edit that brings every field back to its accepted
        value leaves no pending version. A record the change order itself
        added is not accepted yet, so it is edited in place."""
        record_id = record_type.record_id(row)
        change_order_id = change_order.initiative_agreement_change_order_id
        if getattr(row, "pending_change_order_id", None) == change_order_id:
            for name, value in changes.items():
                setattr(row, name, value)
            row.update_user = getattr(user, "keycloak_username", None)
            await self.db.flush()
            return
        pending = await self._pending_version(record_type, record_id, change_order_id)
        if pending is not None and pending.action_type == ActionTypeEnum.DELETE:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This record is being removed in the change order and "
                    "can't be edited."
                ),
            )
        live = record_type.live_values(row)
        target = dict(pending.values() if pending is not None else live)
        target.update(changes)
        if target == live:
            if pending is not None:
                await self.db.delete(pending)
                await self.db.flush()
            return
        if pending is None:
            pending = await self._new_pending(
                change_order, record_type, row, ActionTypeEnum.UPDATE, user
            )
        for name, value in target.items():
            setattr(pending, name, value)
        pending.update_user = getattr(user, "keycloak_username", None)
        await self.db.flush()

    async def stage_removal(
        self, change_order, record_type: RecordType, row, user
    ) -> None:
        """Remove a record in the change order. One the change order itself
        added is retired at once (no organization ever saw it); an accepted
        one gets a pending DELETE version and stays until acceptance."""
        change_order_id = change_order.initiative_agreement_change_order_id
        if getattr(row, "pending_change_order_id", None) == change_order_id:
            if record_type is NOTE:
                await self.db.delete(row)
            else:
                _retire(record_type, row)
                row.update_user = getattr(user, "keycloak_username", None)
            await self.db.flush()
            return
        pending = await self._pending_version(
            record_type, record_type.record_id(row), change_order_id
        )
        if pending is None:
            pending = await self._new_pending(
                change_order, record_type, row, ActionTypeEnum.DELETE, user
            )
        pending.action_type = ActionTypeEnum.DELETE
        # A removal carries the accepted values: it removes the record as the
        # organization knows it, not a half-edited draft.
        for name, value in record_type.live_values(row).items():
            setattr(pending, name, value)
        pending.update_user = getattr(user, "keycloak_username", None)
        await self.db.flush()

    async def note_numbers_in_use(
        self,
        initiative_agreement_id: int,
        change_order,
        exclude_note_id: Optional[int] = None,
        include_live: bool = False,
    ) -> set:
        """Note numbers the change order's notes hold. With include_live,
        also the numbers the live rows still hold until acceptance; a note
        the change order adds is a live row, so it can't take one of those."""
        change_order_id = change_order.initiative_agreement_change_order_id
        notes = (
            (
                await self.db.execute(
                    select(InitiativeAgreementNote).where(
                        InitiativeAgreementNote.initiative_agreement_id
                        == initiative_agreement_id,
                        InitiativeAgreementNote.is_active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )
        pending = {
            row.initiative_agreement_note_id: row
            for row in await self._pending_versions(NOTE, change_order_id)
        }
        numbers = set()
        for note in notes:
            if note.initiative_agreement_note_id == exclude_note_id:
                continue
            if note.pending_change_order_id not in (None, change_order_id):
                continue
            staged = pending.get(note.initiative_agreement_note_id)
            if staged is not None and staged.action_type != ActionTypeEnum.DELETE:
                numbers.add(Decimal(staged.note_number))
            else:
                numbers.add(Decimal(note.note_number))
            if include_live:
                numbers.add(Decimal(note.note_number))
        return numbers

    # --- Acceptance and discard ------------------------------------------

    async def accept(
        self, initiative_agreement_id: int, accepted_date: date, user
    ) -> InitiativeAgreementChangeOrder:
        """The Director accepts the change order: its versions become the
        accepted package, effective ``accepted_date``."""
        if not has_any_role(user, CHANGE_ORDER_ACCEPT_ROLES):
            raise HTTPException(
                status_code=403,
                detail="Only the Director can accept a change order.",
            )
        if accepted_date is None:
            raise HTTPException(status_code=400, detail="An accepted date is required.")
        if accepted_date > datetime.now(PACIFIC_TZ).date():
            raise HTTPException(
                status_code=400,
                detail="The accepted date cannot be in the future.",
            )
        agreement, change_order = await self._locked_open_change_order(
            initiative_agreement_id
        )
        change_order_id = change_order.initiative_agreement_change_order_id
        await self._lock_actions_or_409(change_order_id)
        username = getattr(user, "keycloak_username", None)

        # Per designated action, what the change order did, for its history.
        action_events: Dict[int, dict] = {}

        def action_event(designated_action_id: int) -> dict:
            return action_events.setdefault(
                designated_action_id,
                {"action": None, "changed": {}, "requirements": []},
            )

        pending_by_type = {
            record_type.key: await self._pending_versions(record_type, change_order_id)
            for record_type in RECORD_TYPES.values()
        }

        await self._check_acceptable(agreement, pending_by_type)

        # Notes are applied removals first, then in two passes through
        # temporary numbers, so a renumbering that swaps two notes never
        # trips the unique index on the way.
        note_pending = sorted(
            pending_by_type[NOTE.key],
            key=lambda row: row.action_type != ActionTypeEnum.DELETE,
        )
        renumbered = []
        for pending in note_pending:
            note = await self.db.get(
                InitiativeAgreementNote, pending.initiative_agreement_note_id
            )
            await self._keep_original(NOTE, note, pending, username)
            if pending.action_type == ActionTypeEnum.DELETE:
                note.is_active = False
            elif Decimal(note.note_number) != Decimal(pending.note_number):
                note.note_number = Decimal(-note.initiative_agreement_note_id)
                renumbered.append((note, pending))
            else:
                note.note_text = pending.note_text
            note.update_user = username
        await self.db.flush()
        for note, pending in renumbered:
            note.note_number = pending.note_number
            note.note_text = pending.note_text
        await self.db.flush()

        for pending in pending_by_type[AGREEMENT.key]:
            await self._keep_original(AGREEMENT, agreement, pending, username)
            for name, value in pending.values().items():
                setattr(agreement, name, value)

        for pending in pending_by_type[DESIGNATED_ACTION.key]:
            action = await self.db.get(DesignatedAction, pending.designated_action_id)
            await self._keep_original(DESIGNATED_ACTION, action, pending, username)
            event = action_event(action.designated_action_id)
            if pending.action_type == ActionTypeEnum.DELETE:
                event["action"] = ActionTypeEnum.DELETE.value
                action.action_type = ActionTypeEnum.DELETE
            else:
                event["action"] = ActionTypeEnum.UPDATE.value
                event["changed"] = _differences(
                    DESIGNATED_ACTION.live_values(action), pending.values()
                )
                for name, value in pending.values().items():
                    setattr(action, name, value)
                action.action_type = ActionTypeEnum.UPDATE
            action.version = pending.version
            action.update_user = username

        for pending in pending_by_type[EVIDENCE_REQUIREMENT.key]:
            requirement = await self.db.get(
                EvidenceRequirement, pending.evidence_requirement_id
            )
            await self._keep_original(
                EVIDENCE_REQUIREMENT, requirement, pending, username
            )
            entry = {
                "evidence_requirement_id": requirement.evidence_requirement_id,
                "requirement_number": requirement.requirement_number,
                "title": requirement.title or requirement.description,
            }
            if pending.action_type == ActionTypeEnum.DELETE:
                entry["action"] = ActionTypeEnum.DELETE.value
                requirement.is_active = False
            else:
                entry["action"] = ActionTypeEnum.UPDATE.value
                entry["changed"] = _differences(
                    EVIDENCE_REQUIREMENT.live_values(requirement), pending.values()
                )
                for name, value in pending.values().items():
                    setattr(requirement, name, value)
            requirement.update_user = username
            action_event(requirement.designated_action_id)["requirements"].append(entry)

        # Records the change order added join the accepted package, each
        # with a CREATE version recording it. One it added and then removed
        # again never existed for the organization and stays hidden.
        for record_type in CHILD_RECORD_TYPES:
            added = (
                (
                    await self.db.execute(
                        select(record_type.live).where(
                            record_type.live.pending_change_order_id == change_order_id
                        )
                    )
                )
                .scalars()
                .all()
            )
            for row in added:
                if is_removed(record_type, row):
                    continue
                self.db.add(
                    record_type.version(
                        **{record_type.id_column: record_type.record_id(row)},
                        version=0,
                        action_type=ActionTypeEnum.CREATE,
                        change_order_id=change_order_id,
                        create_user=username,
                        update_user=username,
                        **record_type.live_values(row),
                    )
                )
                row.pending_change_order_id = None
                row.update_user = username
                if record_type is DESIGNATED_ACTION:
                    action_event(row.designated_action_id)[
                        "action"
                    ] = ActionTypeEnum.CREATE.value
                elif record_type is EVIDENCE_REQUIREMENT:
                    action_event(row.designated_action_id)["requirements"].append(
                        {
                            "evidence_requirement_id": row.evidence_requirement_id,
                            "requirement_number": row.requirement_number,
                            "title": row.title or row.description,
                            "action": ActionTypeEnum.CREATE.value,
                        }
                    )

        await self._record_action_events(
            change_order, accepted_date, action_events, user
        )

        change_order.status = CHANGE_ORDER_STATUS_ACCEPTED
        change_order.accepted_date = accepted_date
        change_order.accepted_at = datetime.now(timezone.utc)
        change_order.accepted_by_user_id = getattr(user, "user_profile_id", None)
        change_order.accepted_by_display_name = display_name(user)
        change_order.update_user = username
        await self._move_lifecycle(agreement, LIFECYCLE_STATUS_UNDERWAY, user)
        await self.db.flush()
        return change_order

    async def _check_acceptable(self, agreement, pending_by_type) -> None:
        """Refuse an acceptance that would leave the package inconsistent."""
        for pending in pending_by_type[AGREEMENT.key]:
            ia_code = (pending.ia_code or "").strip()
            if ia_code and ia_code.lower() != (agreement.ia_code or "").lower():
                clash = await self.db.scalar(
                    select(InitiativeAgreement.initiative_agreement_id).where(
                        func.lower(InitiativeAgreement.ia_code) == ia_code.lower(),
                        InitiativeAgreement.initiative_agreement_id
                        != agreement.initiative_agreement_id,
                    )
                )
                if clash is not None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Agreement code '{ia_code}' is already in use.",
                    )
        for pending in pending_by_type[DESIGNATED_ACTION.key]:
            action = await self.db.get(DesignatedAction, pending.designated_action_id)
            check_issued_credits(
                action,
                removing=pending.action_type == ActionTypeEnum.DELETE,
                credit_allocation=pending.credit_allocation,
            )

    async def _keep_original(self, record_type, row, pending, username) -> None:
        """Before a record's first change is applied, keep the record as it
        stood as version 0."""
        numbers = await self._version_numbers(record_type, record_type.record_id(row))
        if any(number < pending.version for number in numbers):
            return
        self.db.add(
            record_type.version(
                **{record_type.id_column: record_type.record_id(row)},
                version=min(getattr(row, "version", 0) or 0, pending.version - 1),
                action_type=ActionTypeEnum.CREATE,
                change_order_id=None,
                create_user=username,
                update_user=username,
                **record_type.live_values(row),
            )
        )
        await self.db.flush()

    async def _record_action_events(
        self, change_order, accepted_date, action_events, user
    ) -> None:
        for designated_action_id, event in action_events.items():
            action = await self.db.get(DesignatedAction, designated_action_id)
            snapshot = {
                "change_order_number": change_order.change_order_number,
                "accepted_date": accepted_date.isoformat(),
                "action": event["action"],
            }
            if event["changed"]:
                snapshot["changed"] = event["changed"]
            if event["requirements"]:
                snapshot["requirements"] = event["requirements"]
            self.db.add(
                DesignatedActionHistory(
                    designated_action_id=designated_action_id,
                    designated_action_group_uuid=action.group_uuid,
                    event=EVENT_CHANGE_ORDER,
                    status_id=action.current_status_id,
                    user_profile_id=getattr(user, "user_profile_id", None),
                    display_name=display_name(user),
                    snapshot=snapshot,
                )
            )

    async def discard(
        self, initiative_agreement_id: int, user
    ) -> InitiativeAgreementChangeOrder:
        """Drop the change order's pending versions, retire what it added,
        and return the agreement to Underway."""
        if not has_any_role(user, CHANGE_ORDER_DISCARD_ROLES):
            raise HTTPException(
                status_code=403,
                detail="You are not permitted to discard a change order.",
            )
        agreement, change_order = await self._locked_open_change_order(
            initiative_agreement_id
        )
        change_order_id = change_order.initiative_agreement_change_order_id
        await self._lock_actions_or_409(change_order_id)
        username = getattr(user, "keycloak_username", None)

        for record_type in RECORD_TYPES.values():
            await self.db.execute(
                delete(record_type.version).where(
                    record_type.version.change_order_id == change_order_id
                )
            )
        # Notes have nothing attached and go. Actions and requirements may
        # carry comments, documents or history, so they are retired and keep
        # the discarded change order's mark, which hides them for good.
        await self.db.execute(
            delete(InitiativeAgreementNote).where(
                InitiativeAgreementNote.pending_change_order_id == change_order_id
            )
        )
        await self.db.execute(
            update(DesignatedAction)
            .where(DesignatedAction.pending_change_order_id == change_order_id)
            .values(action_type=ActionTypeEnum.DELETE, update_user=username)
        )
        await self.db.execute(
            update(EvidenceRequirement)
            .where(EvidenceRequirement.pending_change_order_id == change_order_id)
            .values(is_active=False, update_user=username)
        )

        change_order.status = CHANGE_ORDER_STATUS_DISCARDED
        change_order.discarded_at = datetime.now(timezone.utc)
        change_order.discarded_by_user_id = getattr(user, "user_profile_id", None)
        change_order.discarded_by_display_name = display_name(user)
        change_order.update_user = username
        await self._move_lifecycle(agreement, LIFECYCLE_STATUS_UNDERWAY, user)
        await self.db.flush()
        return change_order


def check_issued_credits(
    action, *, removing: bool = False, credit_allocation: Optional[int] = None
) -> None:
    """A change order cannot take away credits already issued for an action:
    not by removing it, nor by allocating less than was issued."""
    if action is None or action.transaction_id is None:
        return
    if removing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Designated action {action.action_number} has had credits "
                "issued and cannot be removed."
            ),
        )
    issued = action.recommended_credits or 0
    if credit_allocation is not None and credit_allocation < issued:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Designated action {action.action_number} has had {issued} "
                "credits issued; its compliance units to be issued cannot be "
                "set below that."
            ),
        )


def _is_lock_not_available(error: DBAPIError) -> bool:
    """Whether PostgreSQL refused a NOWAIT lock (SQLSTATE 55P03)."""
    original = getattr(error, "orig", None)
    for candidate in (original, getattr(original, "__cause__", None)):
        if candidate is None:
            continue
        if getattr(candidate, "sqlstate", None) == "55P03":
            return True
        if getattr(candidate, "pgcode", None) == "55P03":
            return True
        if type(candidate).__name__ == "LockNotAvailableError":
            return True
    return False
