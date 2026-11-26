"""The IA package edit lock (#5554).

Once an agreement is Underway its package — the agreement's information,
notes, designated actions, evidence of completion list and the files on the
agreement and its actions — is read-only. The lock lives in one place
(workflow.LIFECYCLE_STATUSES_EDITABLE) and every write route that changes
the package checks it, so an API call can no more get round it than the
page can.

Each write route is exercised twice: on a Draft it goes through, on an
Underway agreement it is refused with 409 and nothing about the package
changes. A Draft is government's own preparation (#5553), so IDIR sees and
edits it while the organization does not see it at all.
"""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException, status
from httpx import AsyncClient
from sqlalchemy import delete, select

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.document import Document, DocumentFolder, DocumentFolderItem
from lcfs.db.models.initiative_agreement import DesignatedAction
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    EvidenceRequirement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    InitiativeAgreement,
    initiative_agreement_document_association,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementNote import (
    InitiativeAgreementNote,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_IA_MANAGER,
    _seed_action,
    _seed_ia_analyst,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _lifecycle_status_id,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.web.api.initiative_agreement import workflow

DRAFT = workflow.LIFECYCLE_STATUS_DRAFT
UNDERWAY = workflow.LIFECYCLE_STATUS_UNDERWAY

# The mock user's username, which the bin uses to decide who may restore or
# destroy a file.
ME = "mockuser"

BCEID_PROPONENT = [RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
BCEID_SIGNER = [RoleEnum.IA_SIGNER, RoleEnum.SUPPLIER]


@pytest.fixture(autouse=True)
def no_storage(monkeypatch):
    """Uploads and permanent deletes stop short of S3 and the virus scan;
    what is checked here is whether the route lets them through at all."""
    calls = []

    async def upload_file(self, file, parent_id, parent_type, user=None, **_):
        calls.append(("upload", parent_type, parent_id))
        document = Document(
            file_key=f"lock/{file.filename}",
            file_name=file.filename,
            file_size=4,
            mime_type="application/pdf",
            create_user=getattr(user, "keycloak_username", None),
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)
        table = (
            initiative_agreement_document_association
            if parent_type == "initiativeAgreement"
            else designated_action_document_association
        )
        column = (
            "initiative_agreement_id"
            if parent_type == "initiativeAgreement"
            else "designated_action_id"
        )
        await self.db.execute(
            table.insert().values(
                **{column: parent_id, "document_id": document.document_id}
            )
        )
        return document

    async def delete_file(self, document_id, parent_id, parent_type, **_):
        calls.append(("delete", parent_type, parent_id))
        await self.db.delete(await self.db.get(Document, document_id))
        await self.db.flush()
        return True

    monkeypatch.setattr(DocumentService, "upload_file", upload_file)
    monkeypatch.setattr(DocumentService, "delete_file", delete_file)
    return calls


async def _document(dbsession, table, column, parent_id, name, **fields):
    document = Document(
        file_key=f"lock/{name}",
        file_name=name,
        file_size=2048,
        mime_type="application/pdf",
        **fields,
    )
    dbsession.add(document)
    await dbsession.flush()
    await dbsession.execute(
        table.insert().values(
            **{column: parent_id, "document_id": document.document_id}
        )
    )
    return document


async def _files(dbsession, parent_type, parent_id, prefix, create_user=ME):
    """One parent's files and folders, in every state the folder routes act
    on: a live file in a folder, a file in the bin, an empty folder and a
    folder in the bin."""
    table, column = {
        "initiativeAgreement": (
            initiative_agreement_document_association,
            "initiative_agreement_id",
        ),
        "designatedAction": (
            designated_action_document_association,
            "designated_action_id",
        ),
    }[parent_type]
    now = datetime.now(timezone.utc)
    live = await _document(
        dbsession,
        table,
        column,
        parent_id,
        f"{prefix}-live.pdf",
        create_user=create_user,
    )
    binned = await _document(
        dbsession,
        table,
        column,
        parent_id,
        f"{prefix}-binned.pdf",
        create_user=create_user,
        deleted_date=now,
        deleted_by=create_user,
    )
    folder = DocumentFolder(
        parent_type=parent_type, parent_id=parent_id, name="Permits"
    )
    empty = DocumentFolder(parent_type=parent_type, parent_id=parent_id, name="Empty")
    binned_folder = DocumentFolder(
        parent_type=parent_type,
        parent_id=parent_id,
        name="Old",
        deleted_date=now,
        deleted_by=create_user,
        deleted_group_uuid="lock-test-group",
    )
    dbsession.add_all([folder, empty, binned_folder])
    await dbsession.flush()
    dbsession.add(
        DocumentFolderItem(folder_id=folder.folder_id, document_id=live.document_id)
    )
    await dbsession.flush()
    return SimpleNamespace(
        live=live,
        binned=binned,
        folder=folder,
        empty=empty,
        binned_folder=binned_folder,
    )


async def _package(dbsession, lifecycle, code, file_owner=ME):
    """An agreement in this lifecycle status with something of every part
    of its package: a note, a designated action with one evidence
    requirement, and files and folders on both the agreement and the
    action."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id,
        code,
        lifecycle_status_id=await _lifecycle_status_id(dbsession, lifecycle),
    )
    note = InitiativeAgreementNote(
        initiative_agreement_id=agreement.initiative_agreement_id,
        note_number=1,
        note_text="<p>Original note</p>",
    )
    dbsession.add(note)
    action = await _seed_action(dbsession, agreement, 1, "Commission station")
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        title="Permits",
        description="List of major permits",
    )
    dbsession.add(requirement)
    await dbsession.flush()
    return SimpleNamespace(
        agreement=agreement,
        note=note,
        action=action,
        requirement=requirement,
        initiativeAgreement=await _files(
            dbsession,
            "initiativeAgreement",
            agreement.initiative_agreement_id,
            f"{code}-ia",
            file_owner,
        ),
        designatedAction=await _files(
            dbsession,
            "designatedAction",
            action.designated_action_id,
            f"{code}-da",
            file_owner,
        ),
    )


async def _state(dbsession, pkg):
    """Everything about the package a write could change, read fresh from
    the database: column queries, which never answer from the session's
    identity map."""
    agreement_id = pkg.agreement.initiative_agreement_id
    action_id = pkg.action.designated_action_id

    async def rows(query):
        return sorted(tuple(row) for row in (await dbsession.execute(query)).all())

    document_ids = (
        select(initiative_agreement_document_association.c.document_id)
        .where(
            initiative_agreement_document_association.c.initiative_agreement_id
            == agreement_id
        )
        .union(
            select(designated_action_document_association.c.document_id).where(
                designated_action_document_association.c.designated_action_id
                == action_id
            )
        )
    )
    return {
        "agreement": await rows(
            select(
                InitiativeAgreement.title,
                InitiativeAgreement.ia_code,
                InitiativeAgreement.project_description,
            ).where(InitiativeAgreement.initiative_agreement_id == agreement_id)
        ),
        "notes": await rows(
            select(
                InitiativeAgreementNote.note_number, InitiativeAgreementNote.note_text
            ).where(InitiativeAgreementNote.initiative_agreement_id == agreement_id)
        ),
        "actions": await rows(
            select(
                DesignatedAction.action_number,
                DesignatedAction.name,
                DesignatedAction.credit_allocation,
            ).where(DesignatedAction.initiative_agreement_id == agreement_id)
        ),
        "requirements": await rows(
            select(
                EvidenceRequirement.requirement_number,
                EvidenceRequirement.title,
                EvidenceRequirement.description,
                EvidenceRequirement.is_active,
            ).where(EvidenceRequirement.designated_action_id == action_id)
        ),
        "documents": await rows(
            select(
                Document.document_id,
                Document.file_name,
                Document.display_name,
                Document.deleted_date.is_(None),
            ).where(Document.document_id.in_(document_ids))
        ),
        "folders": await rows(
            select(
                DocumentFolder.folder_id,
                DocumentFolder.parent_type,
                DocumentFolder.name,
                DocumentFolder.parent_folder_id,
                DocumentFolder.deleted_date.is_(None),
            ).where(
                (
                    (DocumentFolder.parent_type == "initiativeAgreement")
                    & (DocumentFolder.parent_id == agreement_id)
                )
                | (
                    (DocumentFolder.parent_type == "designatedAction")
                    & (DocumentFolder.parent_id == action_id)
                )
            )
        ),
        "placements": await rows(
            select(DocumentFolderItem.document_id, DocumentFolderItem.folder_id).where(
                DocumentFolderItem.document_id.in_(document_ids)
            )
        ),
    }


# ---------------------------------------------------------------------------
# Every write route that edits the package. Each entry names the route, how
# to call it against a package, and the status it answers with when the
# package is open to edits.
# ---------------------------------------------------------------------------


def _agreement(pkg):
    return {"initiative_agreement_id": pkg.agreement.initiative_agreement_id}


def _note(pkg):
    return {**_agreement(pkg), "note_id": pkg.note.initiative_agreement_note_id}


def _action(pkg):
    return {"designated_action_id": pkg.action.designated_action_id}


def _requirement(pkg):
    return {"evidence_requirement_id": pkg.requirement.evidence_requirement_id}


PACKAGE_ROUTES = [
    # IA information
    ("update_agreement", "PUT", _agreement, {"title": "Changed"}, 200),
    # Notes
    ("create_note", "POST", _agreement, {"noteText": "<p>Added</p>"}, 201),
    ("update_note", "PUT", _note, {"noteNumber": 1, "noteText": "<p>Edited</p>"}, 200),
    ("delete_note", "DELETE", _note, None, 204),
    # Designated actions
    ("create_designated_action", "POST", _agreement, {"name": "Added action"}, 201),
    ("update_designated_action", "PUT", _action, {"name": "Renamed"}, 200),
    # Evidence of completion: adding, rewording and removing requirements
    (
        "create_evidence_requirement",
        "POST",
        _action,
        {"title": "Inspection", "description": "Inspection report"},
        201,
    ),
    ("update_evidence_requirement", "PUT", _requirement, {"title": "Retitled"}, 200),
    (
        "update_evidence_requirement",
        "PUT",
        _requirement,
        {"description": "Reworded"},
        200,
    ),
    (
        "update_evidence_requirement",
        "PUT",
        _requirement,
        {"requirementNumber": 7},
        200,
    ),
    ("deactivate_evidence_requirement", "DELETE", _requirement, None, 204),
]


def _parent(pkg, parent_type):
    parent_id = (
        pkg.agreement.initiative_agreement_id
        if parent_type == "initiativeAgreement"
        else pkg.action.designated_action_id
    )
    return {"parent_type": parent_type, "parent_id": parent_id}


def _file_routes(parent_type):
    """The file and folder routes for one parent type. Uploading also covers
    replacing, which is an upload naming the file it replaces."""

    def files(pkg):
        return getattr(pkg, parent_type)

    return [
        ("upload_file", "POST", lambda pkg: _parent(pkg, parent_type), "upload", 201),
        (
            "soft_delete_document",
            "DELETE",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "document_id": files(pkg).live.document_id,
            },
            None,
            204,
        ),
        (
            "restore_document",
            "PUT",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "document_id": files(pkg).binned.document_id,
            },
            None,
            204,
        ),
        (
            "hard_delete_document",
            "DELETE",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "document_id": files(pkg).binned.document_id,
            },
            None,
            204,
        ),
        (
            "create_document_folder",
            "POST",
            lambda pkg: _parent(pkg, parent_type),
            {"name": "Inspections"},
            201,
        ),
        (
            "move_document_folder_items",
            "PUT",
            lambda pkg: _parent(pkg, parent_type),
            lambda pkg: {
                "documentIds": [files(pkg).live.document_id],
                "folderId": files(pkg).empty.folder_id,
            },
            204,
        ),
        (
            "update_document_folder",
            "PUT",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "folder_id": files(pkg).folder.folder_id,
            },
            {"name": "Renamed folder"},
            200,
        ),
        (
            "update_document_folder",
            "PUT",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "folder_id": files(pkg).empty.folder_id,
            },
            lambda pkg: {"parentFolderId": files(pkg).folder.folder_id},
            200,
        ),
        (
            "delete_document_folder",
            "DELETE",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "folder_id": files(pkg).empty.folder_id,
            },
            None,
            204,
        ),
        (
            "restore_document_folder",
            "PUT",
            lambda pkg: {
                **_parent(pkg, parent_type),
                "folder_id": files(pkg).binned_folder.folder_id,
            },
            None,
            204,
        ),
    ]


FILE_ROUTES = _file_routes("initiativeAgreement") + _file_routes("designatedAction")


def _case_id(case):
    route, method, params, body, _ = case
    detail = ""
    if isinstance(body, dict) and route == "update_evidence_requirement":
        detail = "-" + next(iter(body))
    if route.endswith("folder") and callable(body):
        detail = "-move"
    parent = ""
    if case in FILE_ROUTES:
        parent = "-ia" if FILE_ROUTES.index(case) < len(FILE_ROUTES) // 2 else "-da"
    return f"{route}{detail}{parent}"


ALL_ROUTES = PACKAGE_ROUTES + FILE_ROUTES


async def _call(client, fastapi_app, pkg, case):
    route, method, params, body, _ = case
    url = fastapi_app.url_path_for(route, **params(pkg))
    if body == "upload":
        return await client.post(
            url, files={"file": ("added.pdf", b"%PDF", "application/pdf")}
        )
    if callable(body):
        body = body(pkg)
    return await client.request(method, url, json=body)


@pytest.mark.anyio
@pytest.mark.parametrize("case", ALL_ROUTES, ids=[_case_id(c) for c in ALL_ROUTES])
async def test_idir_edits_a_draft_package(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, case
):
    pkg = await _package(dbsession, DRAFT, "IA-26LCKD")
    before = await _state(dbsession, pkg)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await _call(client, fastapi_app, pkg, case)

    assert response.status_code == case[-1], response.text
    assert await _state(dbsession, pkg) != before


@pytest.mark.anyio
@pytest.mark.parametrize("case", ALL_ROUTES, ids=[_case_id(c) for c in ALL_ROUTES])
async def test_idir_cannot_edit_an_underway_package(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    no_storage,
    case,
):
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKU")
    before = await _state(dbsession, pkg)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await _call(client, fastapi_app, pkg, case)

    assert response.status_code == status.HTTP_409_CONFLICT, response.text
    assert "Underway" in response.json()["detail"]
    assert await _state(dbsession, pkg) == before
    assert no_storage == []


@pytest.mark.anyio
@pytest.mark.parametrize("lifecycle", ["Completed", "Terminated"])
@pytest.mark.parametrize(
    "case", PACKAGE_ROUTES, ids=[_case_id(c) for c in PACKAGE_ROUTES]
)
async def test_a_closed_package_stays_read_only(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    lifecycle,
    case,
):
    """The editable statuses are an allow-list, so the statuses after
    Underway are read-only too."""
    pkg = await _package(dbsession, lifecycle, "IA-26LCKC")
    before = await _state(dbsession, pkg)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await _call(client, fastapi_app, pkg, case)

    assert response.status_code == status.HTTP_409_CONFLICT, response.text
    assert await _state(dbsession, pkg) == before


# ---------------------------------------------------------------------------
# An edit racing Set to Underway. Each request has its own transaction here,
# as in production, so PostgreSQL's row locks are what is under test.
# ---------------------------------------------------------------------------

RACING_EDITS = [
    ("update_agreement", "PUT", _agreement, {"title": "Changed"}),
    ("create_note", "POST", _agreement, {"noteText": "<p>Added</p>"}),
    ("update_designated_action", "PUT", _action, {"name": "Renamed"}),
    (
        "create_evidence_requirement",
        "POST",
        _action,
        {"title": "Inspection", "description": "Inspection report"},
    ),
    (
        "create_document_folder",
        "POST",
        lambda pkg: _parent(pkg, "initiativeAgreement"),
        {"name": "Inspections"},
    ),
]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "route, method, params, body", RACING_EDITS, ids=[r[0] for r in RACING_EDITS]
)
async def test_an_edit_racing_set_to_underway_is_refused(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession_factory,
    route,
    method,
    params,
    body,
):
    """An edit that starts while a Draft is being set Underway must not
    land after it. The edit reads the status under the agreement's row lock,
    so it waits for the transition and is then refused."""
    async with dbsession_factory() as setup:
        async with setup.begin():
            org_id, _ = await _two_org_ids(setup)
            draft = await _lifecycle_status_id(setup, DRAFT)
            underway = await _lifecycle_status_id(setup, UNDERWAY)
            agreement = await _seed_agreement(
                setup,
                org_id,
                f"IA-26RACE-{RACING_EDITS.index((route, method, params, body))}",
                lifecycle_status_id=draft,
            )
            action = await _seed_action(setup, agreement, 1, "Commission station")
            pkg = SimpleNamespace(agreement=agreement, action=action)
            agreement_id = agreement.initiative_agreement_id
            action_id = action.designated_action_id

    async def request_session():
        async with dbsession_factory() as session:
            async with session.begin():
                yield session

    previous = fastapi_app.dependency_overrides[get_async_db_session]
    fastapi_app.dependency_overrides[get_async_db_session] = request_session
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    try:
        async with dbsession_factory() as transition:
            async with transition.begin():
                # Set to Underway's own lock and update, not yet committed.
                await transition.execute(
                    select(InitiativeAgreement.initiative_agreement_id)
                    .where(InitiativeAgreement.initiative_agreement_id == agreement_id)
                    .with_for_update()
                )
                row = await transition.get(InitiativeAgreement, agreement_id)
                row.lifecycle_status_id = underway
                await transition.flush()

                edit = asyncio.create_task(
                    client.request(
                        method,
                        fastapi_app.url_path_for(route, **params(pkg)),
                        json=body,
                    )
                )
                await asyncio.sleep(1)
                # Without the lock the edit reads Draft and is already saved.
                assert not edit.done(), (await edit).text

        response = await asyncio.wait_for(edit, timeout=10)

        assert response.status_code == status.HTTP_409_CONFLICT, response.text
        async with dbsession_factory() as check:
            saved = await check.get(InitiativeAgreement, agreement_id)
            assert saved.title == "Test agreement"
            assert (
                await check.scalars(
                    select(InitiativeAgreementNote.initiative_agreement_note_id).where(
                        InitiativeAgreementNote.initiative_agreement_id == agreement_id
                    )
                )
            ).all() == []
            assert (
                await check.get(DesignatedAction, action_id)
            ).name == "Commission station"
            assert (
                await check.scalars(
                    select(EvidenceRequirement.evidence_requirement_id).where(
                        EvidenceRequirement.designated_action_id == action_id
                    )
                )
            ).all() == []
            assert (
                await check.scalars(
                    select(DocumentFolder.folder_id).where(
                        DocumentFolder.parent_type == "initiativeAgreement",
                        DocumentFolder.parent_id == agreement_id,
                    )
                )
            ).all() == []
    finally:
        fastapi_app.dependency_overrides[get_async_db_session] = previous
        async with dbsession_factory() as cleanup:
            async with cleanup.begin():
                await cleanup.execute(
                    delete(EvidenceRequirement).where(
                        EvidenceRequirement.designated_action_id == action_id
                    )
                )
                await cleanup.execute(
                    delete(DesignatedActionHistory).where(
                        DesignatedActionHistory.designated_action_id == action_id
                    )
                )
                await cleanup.execute(
                    delete(DesignatedAction).where(
                        DesignatedAction.initiative_agreement_id == agreement_id
                    )
                )
                await cleanup.execute(
                    delete(InitiativeAgreementNote).where(
                        InitiativeAgreementNote.initiative_agreement_id == agreement_id
                    )
                )
                await cleanup.execute(
                    delete(DocumentFolder).where(
                        DocumentFolder.parent_type == "initiativeAgreement",
                        DocumentFolder.parent_id == agreement_id,
                    )
                )
                await cleanup.execute(
                    delete(InitiativeAgreement).where(
                        InitiativeAgreement.initiative_agreement_id == agreement_id
                    )
                )


# ---------------------------------------------------------------------------
# BCeID
# ---------------------------------------------------------------------------


# A BCeID upload to a designated action is evidence, not package editing; it
# has its own test below.
BCEID_ROUTES = [c for c in ALL_ROUTES if _case_id(c) != "upload_file-da"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles", [BCEID_PROPONENT, BCEID_SIGNER], ids=["proponent", "signer"]
)
@pytest.mark.parametrize("case", BCEID_ROUTES, ids=[_case_id(c) for c in BCEID_ROUTES])
async def test_bceid_cannot_edit_an_underway_package(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    no_storage,
    roles,
    case,
):
    """A proponent or signer of the agreement's own organization changes
    nothing in an Underway package, including the files government put on
    its designated actions. Their own evidence on an action is the
    exception, covered below."""
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKB", file_owner="someone-else")
    before = await _state(dbsession, pkg)
    set_mock_user(fastapi_app, roles)

    response = await _call(client, fastapi_app, pkg, case)

    assert response.status_code >= 400, response.text
    assert await _state(dbsession, pkg) == before
    assert no_storage == []


@pytest.mark.anyio
@pytest.mark.parametrize("lifecycle", [DRAFT, UNDERWAY])
async def test_bceid_agreement_file_bin_answers_to_the_lock(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, lifecycle
):
    """Proponents may bin files on an agreement, which is a package edit,
    so it is refused once Underway. A Draft is hidden from the organization
    altogether (#5553), so to them it reads as missing."""
    pkg = await _package(dbsession, lifecycle, "IA-26LCKP")
    before = await _state(dbsession, pkg)
    set_mock_user(fastapi_app, BCEID_PROPONENT)

    response = await client.delete(
        fastapi_app.url_path_for(
            "soft_delete_document",
            **_parent(pkg, "initiativeAgreement"),
            document_id=pkg.initiativeAgreement.live.document_id,
        )
    )

    assert response.status_code == (
        status.HTTP_404_NOT_FOUND if lifecycle == DRAFT else status.HTTP_409_CONFLICT
    )
    assert await _state(dbsession, pkg) == before


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles", [BCEID_PROPONENT, BCEID_SIGNER], ids=["proponent", "signer"]
)
async def test_bceid_evidence_on_a_designated_action_is_not_package_editing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    no_storage,
    roles,
):
    """Underway is what opens the BCeID evidence of completion submission.
    A proponent's upload to their designated action, and their own files
    there, are its evidence: the package lock lets them through to the
    submission's own rules."""
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKE")
    set_mock_user(fastapi_app, roles)

    await client.post(
        fastapi_app.url_path_for("upload_file", **_parent(pkg, "designatedAction")),
        files={"file": ("evidence.pdf", b"%PDF", "application/pdf")},
    )
    binned = await client.delete(
        fastapi_app.url_path_for(
            "soft_delete_document",
            **_parent(pkg, "designatedAction"),
            document_id=pkg.designatedAction.live.document_id,
        )
    )

    # The upload reached storage rather than being refused by the lock.
    assert no_storage == [
        ("upload", "designatedAction", pkg.action.designated_action_id)
    ]
    # Not refused by the lock. Develop's bin routes admit proponents but not
    # signers yet; the evidence submission (#5516) decides that.
    assert binned.status_code != status.HTTP_409_CONFLICT
    if RoleEnum.IA_PROPONENT in roles:
        assert binned.status_code == status.HTTP_204_NO_CONTENT


# ---------------------------------------------------------------------------
# The review workflow is not package editing and stays open while Underway.
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "route, params, body",
    [
        (
            "update_evidence_requirement",
            _requirement,
            {"reviewOutcome": "Satisfactory"},
        ),
        ("update_evidence_requirement", _requirement, {"reviewNotes": "<p>Seen</p>"}),
        ("update_evidence_requirement", _requirement, {"analystReview": "<p>Good</p>"}),
        (
            "update_evidence_requirement",
            _requirement,
            {"missingInformation": "<p>Signed copy</p>"},
        ),
        # A client saving the whole card sends the wording unchanged.
        (
            "update_evidence_requirement",
            _requirement,
            {
                "title": "Permits",
                "description": "List of major permits",
                "reviewOutcome": "Satisfactory",
            },
        ),
        (
            "set_designated_action_recommended_credits",
            _action,
            {"recommendedCredits": 500},
        ),
    ],
    ids=[
        "eoc-outcome",
        "eoc-notes",
        "eoc-evaluation",
        "eoc-missing-information",
        "eoc-unchanged-wording",
        "recommended-credits",
    ],
)
async def test_the_review_stays_open_while_underway(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    route,
    params,
    body,
):
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKR")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        fastapi_app.url_path_for(route, **params(pkg)), json=body
    )

    assert response.status_code == status.HTTP_200_OK, response.text


@pytest.mark.anyio
async def test_an_analyst_is_assigned_while_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKA")
    analyst = await _seed_ia_analyst(dbsession, "lockanalyst", "Lee", "Lock")
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    response = await client.put(
        fastapi_app.url_path_for("assign_designated_action_analyst", **_action(pkg)),
        json={"assignedAnalystId": analyst.user_profile_id},
    )

    assert response.status_code == status.HTTP_200_OK, response.text


@pytest.mark.anyio
async def test_a_review_transition_goes_through_while_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKW")
    pkg.requirement.review_outcome = "Satisfactory"
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.put(
        fastapi_app.url_path_for("perform_designated_action_workflow", **_action(pkg)),
        json={"action": workflow.ACTION_ACCEPT_EVIDENCE},
    )

    assert response.status_code == status.HTTP_200_OK, response.text


@pytest.mark.anyio
@pytest.mark.parametrize(
    "entity_type, entity",
    [("initiativeAgreement", "agreement"), ("designatedAction", "action")],
)
async def test_comments_stay_open_while_underway(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    entity_type,
    entity,
):
    """Internal comments discuss the package; they are not part of it."""
    pkg = await _package(dbsession, UNDERWAY, "IA-26LCKM")
    entity_id = (
        pkg.agreement.initiative_agreement_id
        if entity == "agreement"
        else pkg.action.designated_action_id
    )
    # The new comment carries its author's name, so the mock user needs a
    # profile.
    await _seed_ia_analyst(dbsession, ME, "Dana", "Reed")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        fastapi_app.url_path_for("create_comment"),
        json={
            "entityType": entity_type,
            "entityId": entity_id,
            "comment": "Checked the permit list",
            "visibility": "Public",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED, response.text


# ---------------------------------------------------------------------------
# The profiles tell the page whether to offer edits.
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "lifecycle, editable",
    [(DRAFT, True), (UNDERWAY, False), ("Completed", False), ("Terminated", False)],
)
async def test_the_profiles_say_whether_the_package_is_editable(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    lifecycle,
    editable,
):
    pkg = await _package(dbsession, lifecycle, "IA-26LCKF")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    agreement = await client.get(
        fastapi_app.url_path_for("get_initiative_agreement_profile", **_agreement(pkg))
    )
    action = await client.get(
        fastapi_app.url_path_for("get_designated_action_profile", **_action(pkg))
    )

    assert agreement.json()["packageEditable"] is editable
    assert action.json()["packageEditable"] is editable


# ---------------------------------------------------------------------------
# The rule itself.
# ---------------------------------------------------------------------------


def _agreement_in(lifecycle):
    return SimpleNamespace(
        lifecycle_status=SimpleNamespace(status=lifecycle) if lifecycle else None
    )


@pytest.mark.parametrize(
    "lifecycle, editable",
    [
        (DRAFT, True),
        (UNDERWAY, False),
        ("Completed", False),
        ("Terminated", False),
        (None, False),
        ("A status nobody listed", False),
    ],
)
def test_only_listed_statuses_are_editable(lifecycle, editable):
    assert workflow.is_package_editable(_agreement_in(lifecycle)) is editable


PROPONENT = (RoleEnum.IA_PROPONENT,)
ANALYST = (RoleEnum.IA_ANALYST, RoleEnum.GOVERNMENT)


@pytest.mark.parametrize(
    "parent_type, roles, write, allowed",
    [
        # A proponent's or signer's evidence on their designated action
        ("designatedAction", PROPONENT, {"new_file": True}, True),
        ("designatedAction", (RoleEnum.IA_SIGNER,), {"new_file": True}, True),
        ("designatedAction", PROPONENT, {"file_owner": ME}, True),
        # ...but not government's files there, or its folders
        ("designatedAction", PROPONENT, {"file_owner": "an-analyst"}, False),
        ("designatedAction", PROPONENT, {}, False),
        # ...and nothing on the agreement itself
        ("initiativeAgreement", PROPONENT, {"new_file": True}, False),
        # Government edits the package, whatever it touches
        ("designatedAction", ANALYST, {"new_file": True}, False),
        ("designatedAction", ANALYST, {"file_owner": ME}, False),
        # A supplier user without an IA role is no evidence submitter
        ("designatedAction", (RoleEnum.SUPPLIER,), {"new_file": True}, False),
    ],
)
def test_only_bceid_evidence_on_an_action_passes_an_underway_lock(
    parent_type, roles, write, allowed
):
    user = SimpleNamespace(role_names=list(roles), keycloak_username=ME)

    def write_file():
        workflow.ensure_package_document_writable(
            _agreement_in(UNDERWAY), parent_type, user, **write
        )

    if allowed:
        write_file()
    else:
        with pytest.raises(HTTPException) as refused:
            write_file()
        assert refused.value.status_code == status.HTTP_409_CONFLICT
