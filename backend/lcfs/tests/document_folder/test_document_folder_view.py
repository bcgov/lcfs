"""Folder layer for designated action documents (#4925, phase 1).

The isolation guarantee comes first: folders exist only for the surfaces
in FOLDER_ENABLED_PARENT_TYPES, and every other parent type is refused
before any work happens. The rest covers CRUD, the tree shape, and the
six server-side invariants.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.document import Document, DocumentFolder, DocumentFolderItem
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _seed_agreement,
    _two_org_ids,
)


async def _seed_da(dbsession, code="IA-26FLD1"):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, code)
    return await _seed_action(dbsession, agreement, 1, "Commission station")


async def _seed_document(dbsession, action, name="evidence.pdf", create_user=None):
    document = Document(
        file_key=f"da/{name}",
        file_name=name,
        file_size=2048,
        mime_type="application/pdf",
        create_user=create_user,
    )
    dbsession.add(document)
    await dbsession.flush()
    await dbsession.execute(
        designated_action_document_association.insert().values(
            designated_action_id=action.designated_action_id,
            document_id=document.document_id,
        )
    )
    return document


async def _legacy_bin(dbsession, folders=(), documents=(), by="mockuser"):
    """Set up bins created by the former cascade flow for restore coverage."""
    group_uuid = str(uuid.uuid4())
    deleted_date = datetime.now(timezone.utc)
    for folder_id in folders:
        folder = await dbsession.get(DocumentFolder, folder_id)
        folder.deleted_date = deleted_date
        folder.deleted_by = by
        folder.deleted_group_uuid = group_uuid
    for document in documents:
        document.deleted_date = deleted_date
        document.deleted_by = by
        document.deleted_group_uuid = group_uuid
    await dbsession.flush()
    return group_uuid


def _tree_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "get_document_folder_tree",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )


async def _create_folder(client, fastapi_app, action, name, parent_folder_id=None):
    url = fastapi_app.url_path_for(
        "create_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    payload = {"name": name}
    if parent_folder_id is not None:
        payload["parentFolderId"] = parent_folder_id
    return await client.post(url, json=payload)


@pytest.mark.parametrize(
    "parent_type",
    [
        "compliance_report",
        "ci_application",
        "charging_site",
        "administrativeAdjustment",
        "internal_comment",
        "initiativeAgreement",
    ],
)
@pytest.mark.anyio
async def test_folders_are_refused_for_every_other_parent_type(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, parent_type
):
    """The isolation guarantee, as one parametrised assertion."""
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    url = fastapi_app.url_path_for(
        "get_document_folder_tree", parent_type=parent_type, parent_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_folder_crud_and_tree_shape(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    action = await _seed_da(dbsession)
    placed = await _seed_document(dbsession, action, "permit.pdf")
    await _seed_document(dbsession, action, "root-letter.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    created = await _create_folder(client, fastapi_app, action, "Permits & Approvals")
    assert created.status_code == status.HTTP_201_CREATED
    folder_id = created.json()["folderId"]

    child = await _create_folder(
        client, fastapi_app, action, "2026", parent_folder_id=folder_id
    )
    assert child.status_code == status.HTTP_201_CREATED

    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    moved = await client.put(
        move_url,
        json={"documentIds": [placed.document_id], "folderId": folder_id},
    )
    assert moved.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert [f["name"] for f in tree["folders"]] == ["Permits & Approvals"]
    root_folder = tree["folders"][0]
    assert [c["name"] for c in root_folder["children"]] == ["2026"]
    assert [d["fileName"] for d in root_folder["documents"]] == ["permit.pdf"]
    assert root_folder["documentCount"] == 1
    assert [d["fileName"] for d in tree["rootDocuments"]] == ["root-letter.pdf"]

    # Rename via the single update route.
    update_url = fastapi_app.url_path_for(
        "update_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder_id,
    )
    renamed = await client.put(update_url, json={"name": "Signed agreements"})
    assert renamed.status_code == status.HTTP_200_OK
    assert renamed.json()["name"] == "Signed agreements"


@pytest.mark.anyio
async def test_sibling_names_are_case_insensitively_unique(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLD2")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    first = await _create_folder(client, fastapi_app, action, "Invoices")
    assert first.status_code == status.HTTP_201_CREATED
    duplicate = await _create_folder(client, fastapi_app, action, "invoices")
    assert duplicate.status_code >= 400


@pytest.mark.anyio
async def test_cycles_and_depth_are_rejected(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    action = await _seed_da(dbsession, "IA-26FLD3")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    # Five levels are allowed; the sixth is past the cap.
    parent_id = None
    folder_ids = []
    for depth in range(5):
        created = await _create_folder(
            client, fastapi_app, action, f"Level {depth}", parent_folder_id=parent_id
        )
        assert created.status_code == status.HTTP_201_CREATED
        parent_id = created.json()["folderId"]
        folder_ids.append(parent_id)

    too_deep = await _create_folder(
        client, fastapi_app, action, "Level 5", parent_folder_id=parent_id
    )
    assert too_deep.status_code == status.HTTP_400_BAD_REQUEST

    # Moving the top folder under its own descendant is a cycle.
    update_url = fastapi_app.url_path_for(
        "update_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder_ids[0],
    )
    cycle = await client.put(update_url, json={"parentFolderId": folder_ids[-1]})
    assert cycle.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_system_folders_reject_mutation(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLD4")
    folder = DocumentFolder(
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        name="Evidence",
        is_system=True,
    )
    dbsession.add(folder)
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    update_url = fastapi_app.url_path_for(
        "update_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder.folder_id,
    )
    renamed = await client.put(update_url, json={"name": "Renamed"})
    assert renamed.status_code == status.HTTP_400_BAD_REQUEST

    delete_url = fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder.folder_id,
    )
    deleted = await client.delete(delete_url)
    assert deleted.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_only_empty_folders_can_be_deleted(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    action = await _seed_da(dbsession, "IA-26FLD5")
    document = await _seed_document(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    top = (await _create_folder(client, fastapi_app, action, "Top")).json()
    middle = (
        await _create_folder(
            client, fastapi_app, action, "Middle", parent_folder_id=top["folderId"]
        )
    ).json()
    await _create_folder(
        client, fastapi_app, action, "Leaf", parent_folder_id=middle["folderId"]
    )
    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    await client.put(
        move_url,
        json={"documentIds": [document.document_id], "folderId": middle["folderId"]},
    )

    delete_url = fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=middle["folderId"],
    )
    response = await client.delete(delete_url)
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    # Empty child folders also make their parent non-empty.
    empty = (await _create_folder(client, fastapi_app, action, "Empty")).json()
    delete_empty = fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=empty["folderId"],
    )
    response = await client.delete(delete_empty)
    assert response.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert [folder["name"] for folder in tree["folders"]] == ["Top"]
    assert [child["name"] for child in tree["folders"][0]["children"]] == ["Middle"]
    assert [doc["fileName"] for doc in tree["folders"][0]["documents"]] == [
        "evidence.pdf"
    ]

    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert deleted["folders"] == []
    assert deleted["documents"] == []


@pytest.mark.anyio
async def test_unassociated_documents_cannot_be_placed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLD6")
    other_action = await _seed_da(dbsession, "IA-26FLD7")
    foreign_document = await _seed_document(dbsession, other_action, "foreign.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    folder = (await _create_folder(client, fastapi_app, action, "Mine")).json()
    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    response = await client.put(
        move_url,
        json={
            "documentIds": [foreign_document.document_id],
            "folderId": folder["folderId"],
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_foreign_folders_read_as_missing(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLD8")
    other_action = await _seed_da(dbsession, "IA-26FLD9")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    foreign = (await _create_folder(client, fastapi_app, other_action, "Theirs")).json()
    update_url = fastapi_app.url_path_for(
        "update_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=foreign["folderId"],
    )
    response = await client.put(update_url, json={"name": "Hijack"})
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_placement_rows_die_with_their_document(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The existing delete path knows nothing about folders; the FK cascade
    is what keeps placements from outliving documents."""
    action = await _seed_da(dbsession, "IA-26FLDA")
    document = await _seed_document(dbsession, action)
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    folder = (await _create_folder(client, fastapi_app, action, "Docs")).json()
    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    await client.put(
        move_url,
        json={"documentIds": [document.document_id], "folderId": folder["folderId"]},
    )

    await dbsession.delete(document)
    await dbsession.flush()

    remaining = (
        (
            await dbsession.execute(
                select(DocumentFolderItem).where(
                    DocumentFolderItem.document_id == document.document_id
                )
            )
        )
        .scalars()
        .all()
    )
    assert remaining == []


@pytest.mark.anyio
async def test_folder_management_remains_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLDB")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.get(_tree_url(fastapi_app, action))
    assert response.status_code == status.HTTP_200_OK

    response = await _create_folder(client, fastapi_app, action, "Proponent folder")
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Soft deletion: nothing a user removes is ever destroyed.
# ---------------------------------------------------------------------------


def _deleted_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "get_deleted_documents",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )


def _delete_url(fastapi_app, action, document):
    return fastapi_app.url_path_for(
        "soft_delete_document",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        document_id=document.document_id,
    )


def _restore_url(fastapi_app, action, document):
    return fastapi_app.url_path_for(
        "restore_document",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        document_id=document.document_id,
    )


@pytest.mark.anyio
async def test_deleting_a_document_hides_it_but_keeps_it(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL1")
    document = await _seed_document(dbsession, action, "obsolete.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.delete(_delete_url(fastapi_app, action, document))
    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Gone from the tree...
    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert tree["rootDocuments"] == []

    # ...but the row is still there, stamped.
    row = (
        await dbsession.execute(
            select(Document).where(Document.document_id == document.document_id)
        )
    ).scalar_one()
    assert row.deleted_date is not None
    assert row.deleted_by == "mockuser"


@pytest.mark.anyio
async def test_the_bin_lists_what_was_removed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL2")
    document = await _seed_document(dbsession, action, "obsolete.pdf")
    await _seed_document(dbsession, action, "kept.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    await client.delete(_delete_url(fastapi_app, action, document))

    response = await client.get(_deleted_url(fastapi_app, action))

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert [d["fileName"] for d in data["documents"]] == ["obsolete.pdf"]
    assert data["documents"][0]["deletedBy"] == "mockuser"

    # The one that was not deleted is still in the tree.
    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert [d["fileName"] for d in tree["rootDocuments"]] == ["kept.pdf"]


@pytest.mark.anyio
async def test_restoring_returns_a_document_to_its_folder(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL3")
    document = await _seed_document(dbsession, action, "permit.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    folder = (await _create_folder(client, fastapi_app, action, "Permits")).json()
    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    await client.put(
        move_url,
        json={"documentIds": [document.document_id], "folderId": folder["folderId"]},
    )

    await client.delete(_delete_url(fastapi_app, action, document))
    binned = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert binned["documents"][0]["restoreFolderName"] == "Permits"

    restored = await client.put(_restore_url(fastapi_app, action, document))
    assert restored.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert [d["fileName"] for d in tree["folders"][0]["documents"]] == ["permit.pdf"]
    assert (await client.get(_deleted_url(fastapi_app, action))).json()["total"] == 0


@pytest.mark.anyio
async def test_a_folder_with_a_recoverable_file_cannot_be_deleted(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Deleting a folder must not resurrect it later by the back door."""
    action = await _seed_da(dbsession, "IA-26DEL4")
    document = await _seed_document(dbsession, action, "permit.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    folder = (await _create_folder(client, fastapi_app, action, "Doomed")).json()
    move_url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    await client.put(
        move_url,
        json={"documentIds": [document.document_id], "folderId": folder["folderId"]},
    )
    await client.delete(_delete_url(fastapi_app, action, document))
    delete_folder = await client.delete(
        _folder_delete_url(fastapi_app, action, folder["folderId"])
    )
    assert delete_folder.status_code == status.HTTP_400_BAD_REQUEST

    binned = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert binned["documents"][0]["restoreFolderName"] == "Doomed"

    await client.put(_restore_url(fastapi_app, action, document))

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert tree["folders"][0]["name"] == "Doomed"
    assert [d["fileName"] for d in tree["folders"][0]["documents"]] == ["permit.pdf"]


@pytest.mark.anyio
async def test_deleting_twice_does_not_rewrite_who_removed_it(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL5")
    document = await _seed_document(dbsession, action, "obsolete.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    await client.delete(_delete_url(fastapi_app, action, document))
    first = (await client.get(_deleted_url(fastapi_app, action))).json()["documents"][0]
    await client.delete(_delete_url(fastapi_app, action, document))
    second = (await client.get(_deleted_url(fastapi_app, action))).json()["documents"][
        0
    ]

    assert first["deletedDate"] == second["deletedDate"]


@pytest.mark.anyio
async def test_another_action_cannot_bin_this_ones_document(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL6")
    other = await _seed_da(dbsession, "IA-26DEL7")
    document = await _seed_document(dbsession, action, "permit.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.delete(_delete_url(fastapi_app, other, document))

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_the_bin_is_available_to_bceid_and_scoped_to_the_current_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL8")
    document = await _seed_document(
        dbsession, action, "bceid-file.pdf", create_user="bceid-user"
    )
    set_mock_user(
        fastapi_app,
        [RoleEnum.IA_PROPONENT],
        {"keycloak_username": "bceid-user", "username": "bceid-user"},
    )
    deleted = await client.delete(_delete_url(fastapi_app, action, document))
    assert deleted.status_code == status.HTTP_204_NO_CONTENT

    response = await client.get(_deleted_url(fastapi_app, action))
    assert response.status_code == status.HTTP_200_OK
    assert [row["fileName"] for row in response.json()["documents"]] == [
        "bceid-file.pdf"
    ]
    targets = await client.get(
        fastapi_app.url_path_for(
            "get_designated_action_document_targets",
            initiative_agreement_id=action.initiative_agreement_id,
        )
    )
    assert targets.status_code == status.HTTP_200_OK
    assert targets.json() == [
        {
            "designatedActionId": action.designated_action_id,
            "actionNumber": action.action_number,
        }
    ]

    set_mock_user(
        fastapi_app,
        IDIR_IA_ANALYST,
        {"keycloak_username": "idir-user", "username": "idir-user"},
    )
    response = await client.get(_deleted_url(fastapi_app, action))
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["documents"] == []


@pytest.mark.anyio
async def test_restore_requires_upload_or_delete_involvement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26DEL10")
    document = await _seed_document(
        dbsession, action, "another-users-file.pdf", create_user="uploader"
    )
    set_mock_user(
        fastapi_app,
        IDIR_IA_ANALYST,
        {"keycloak_username": "deleter", "username": "deleter"},
    )
    await client.delete(_delete_url(fastapi_app, action, document))

    set_mock_user(
        fastapi_app,
        IDIR_IA_ANALYST,
        {"keycloak_username": "uninvolved", "username": "uninvolved"},
    )
    assert (await client.get(_deleted_url(fastapi_app, action))).json()[
        "documents"
    ] == []
    response = await client.put(_restore_url(fastapi_app, action, document))
    assert response.status_code == status.HTTP_404_NOT_FOUND

    set_mock_user(
        fastapi_app,
        IDIR_IA_ANALYST,
        {"keycloak_username": "uploader", "username": "uploader"},
    )
    response = await client.get(_deleted_url(fastapi_app, action))
    assert [row["fileName"] for row in response.json()["documents"]] == [
        "another-users-file.pdf"
    ]
    response = await client.put(_restore_url(fastapi_app, action, document))
    assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.anyio
async def test_hard_delete_is_limited_to_files_uploaded_and_deleted_by_the_user(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
    monkeypatch,
):
    action = await _seed_da(dbsession, "IA-26DEL11")
    owned = await _seed_document(dbsession, action, "owned.pdf", create_user="mockuser")
    not_owned = await _seed_document(
        dbsession, action, "not-owned.pdf", create_user="someone-else"
    )
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    await client.delete(_delete_url(fastapi_app, action, owned))
    await client.delete(_delete_url(fastapi_app, action, not_owned))

    listing = (await client.get(_deleted_url(fastapi_app, action))).json()
    hard_delete_flags = {
        row["fileName"]: row["canHardDelete"] for row in listing["documents"]
    }
    assert hard_delete_flags == {"owned.pdf": True, "not-owned.pdf": False}

    async def fake_delete_file(
        _self, document_id, _parent_id, _parent_type, require_physical_delete=False
    ):
        row = await dbsession.get(Document, document_id)
        await dbsession.delete(row)
        await dbsession.flush()
        return True

    monkeypatch.setattr(DocumentService, "delete_file", fake_delete_file)

    unauthorized = await client.delete(
        fastapi_app.url_path_for(
            "hard_delete_document",
            parent_type="designatedAction",
            parent_id=action.designated_action_id,
            document_id=not_owned.document_id,
        )
    )
    assert unauthorized.status_code == status.HTTP_404_NOT_FOUND
    assert await dbsession.get(Document, not_owned.document_id) is not None

    deleted = await client.delete(
        fastapi_app.url_path_for(
            "hard_delete_document",
            parent_type="designatedAction",
            parent_id=action.designated_action_id,
            document_id=owned.document_id,
        )
    )
    assert deleted.status_code == status.HTTP_204_NO_CONTENT
    assert await dbsession.get(Document, owned.document_id) is None
    assert (
        await client.put(_restore_url(fastapi_app, action, owned))
    ).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_a_deleted_document_leaves_the_shared_document_list_too(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The filter belongs in the shared read, not only the tree, so no
    surface can surface a binned document."""
    action = await _seed_da(dbsession, "IA-26DEL9")
    document = await _seed_document(dbsession, action, "obsolete.pdf")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    before = await client.get(
        fastapi_app.url_path_for(
            "get_all_documents",
            parent_type="designatedAction",
            parent_id=action.designated_action_id,
        )
    )
    assert [d["fileName"] for d in before.json()] == ["obsolete.pdf"]

    await client.delete(_delete_url(fastapi_app, action, document))

    after = await client.get(
        fastapi_app.url_path_for(
            "get_all_documents",
            parent_type="designatedAction",
            parent_id=action.designated_action_id,
        )
    )
    assert after.json() == []


# ---------------------------------------------------------------------------
# Restoring folders. A folder is a container, not data: restoring one brings
# back what was inside it and the chain of ancestors it needs for an address,
# and nothing else.
# ---------------------------------------------------------------------------


def _folder_delete_url(fastapi_app, action, folder_id):
    return fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder_id,
    )


def _folder_restore_url(fastapi_app, action, folder_id):
    return fastapi_app.url_path_for(
        "restore_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=folder_id,
    )


async def _place(client, fastapi_app, action, document, folder_id):
    url = fastapi_app.url_path_for(
        "move_document_folder_items",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
    )
    return await client.put(
        url, json={"documentIds": [document.document_id], "folderId": folder_id}
    )


async def _build_nest(client, fastapi_app, action, dbsession):
    """A > B > C with a file in C, plus a sibling D holding its own file."""
    a = (await _create_folder(client, fastapi_app, action, "A")).json()
    b = (
        await _create_folder(
            client, fastapi_app, action, "B", parent_folder_id=a["folderId"]
        )
    ).json()
    c = (
        await _create_folder(
            client, fastapi_app, action, "C", parent_folder_id=b["folderId"]
        )
    ).json()
    d = (
        await _create_folder(
            client, fastapi_app, action, "D", parent_folder_id=a["folderId"]
        )
    ).json()
    in_c = await _seed_document(dbsession, action, "in-c.pdf")
    in_d = await _seed_document(dbsession, action, "in-d.pdf")
    await _place(client, fastapi_app, action, in_c, c["folderId"])
    await _place(client, fastapi_app, action, in_d, d["folderId"])
    return a, b, c, d, in_c, in_d


@pytest.mark.anyio
async def test_restoring_a_folder_brings_its_files_back_in_place(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    action = await _seed_da(dbsession, "IA-26RST1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, c, _d, in_c, _in_d = await _build_nest(client, fastapi_app, action, dbsession)

    await _legacy_bin(dbsession, folders=[c["folderId"]], documents=[in_c])
    await client.put(_folder_restore_url(fastapi_app, action, c["folderId"]))

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    node_a = tree["folders"][0]
    node_b = next(x for x in node_a["children"] if x["name"] == "B")
    node_c = next(x for x in node_b["children"] if x["name"] == "C")
    # Back where it was, not at the root.
    assert [d["fileName"] for d in node_c["documents"]] == ["in-c.pdf"]


@pytest.mark.anyio
async def test_restoring_a_subfolder_rebuilds_only_its_path(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    """The heart of it: A is deleted whole, then only C is restored.

    C has no address without A and B, so they come back — as empty
    shells. A's other child D, and D's file, stay in the bin: nobody
    asked for them back.
    """
    action = await _seed_da(dbsession, "IA-26RST2")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, c, d, in_c, in_d = await _build_nest(client, fastapi_app, action, dbsession)

    await _legacy_bin(
        dbsession,
        folders=[a["folderId"], b["folderId"], c["folderId"], d["folderId"]],
        documents=[in_c, in_d],
    )
    await client.put(_folder_restore_url(fastapi_app, action, c["folderId"]))

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    node_a = tree["folders"][0]
    assert node_a["name"] == "A"
    # A came back as a shell holding only the path to C — D did not.
    assert [x["name"] for x in node_a["children"]] == ["B"]
    node_c = node_a["children"][0]["children"][0]
    assert node_c["name"] == "C"
    assert [d["fileName"] for d in node_c["documents"]] == ["in-c.pdf"]

    # D is still in the bin, restorable on its own terms.
    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert [f["name"] for f in deleted["folders"]] == ["D"]


@pytest.mark.anyio
async def test_restoring_a_parent_leaves_separately_deleted_children_alone(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    """C was removed on its own, before A. Restoring A must not undo that.

    This is what the deletion group buys: without it, A's subtree walk
    would sweep C back up along with everything else.
    """
    action = await _seed_da(dbsession, "IA-26RST3")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, c, d, in_c, in_d = await _build_nest(client, fastapi_app, action, dbsession)

    await _legacy_bin(dbsession, folders=[c["folderId"]], documents=[in_c])
    await _legacy_bin(
        dbsession,
        folders=[a["folderId"], b["folderId"], d["folderId"]],
        documents=[in_d],
    )
    await client.put(_folder_restore_url(fastapi_app, action, a["folderId"]))

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    node_a = tree["folders"][0]
    node_b = next(x for x in node_a["children"] if x["name"] == "B")
    # D came back with A; C stayed in the bin where it was put separately.
    assert [x["name"] for x in node_a["children"]] == ["B", "D"]
    assert node_b["children"] == []

    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert [f["name"] for f in deleted["folders"]] == ["C"]


@pytest.mark.anyio
async def test_an_empty_folder_is_not_worth_a_bin_row(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26RST4")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    empty = (await _create_folder(client, fastapi_app, action, "Nothing here")).json()

    response = await client.delete(
        _folder_delete_url(fastapi_app, action, empty["folderId"])
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT

    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    # Nothing was lost with it, so it is not offered back.
    assert deleted["folders"] == []


@pytest.mark.anyio
async def test_a_restored_folder_yields_a_name_a_live_sibling_took(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    """Nothing is ever purged, so the old name cannot simply be reclaimed.

    Refusing the restore would leave no way forward at all, so the
    returning folder is suffixed instead.
    """
    action = await _seed_da(dbsession, "IA-26RST5")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    original = (await _create_folder(client, fastapi_app, action, "Permits")).json()
    document = await _seed_document(dbsession, action, "permit.pdf")
    await _place(client, fastapi_app, action, document, original["folderId"])

    await _legacy_bin(dbsession, folders=[original["folderId"]], documents=[document])
    # The name is free again while the old folder sits in the bin.
    replacement = await _create_folder(client, fastapi_app, action, "Permits")
    assert replacement.status_code == status.HTTP_201_CREATED

    response = await client.put(
        _folder_restore_url(fastapi_app, action, original["folderId"])
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    names = sorted(f["name"] for f in tree["folders"])
    assert names == ["Permits", "Permits (restored)"]


@pytest.mark.anyio
async def test_restoring_a_file_rebuilds_the_folder_it_lived_in(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    """A lone file follows the same rule as a folder: it goes back where
    it was, not to the root."""
    action = await _seed_da(dbsession, "IA-26RST6")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, c, _d, in_c, _in_d = await _build_nest(client, fastapi_app, action, dbsession)

    await _legacy_bin(
        dbsession,
        folders=[a["folderId"], b["folderId"], c["folderId"]],
        documents=[in_c],
    )
    restore_url = fastapi_app.url_path_for(
        "restore_document",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        document_id=in_c.document_id,
    )
    await client.put(restore_url)

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    node_a = tree["folders"][0]
    node_c = next(x for x in node_a["children"] if x["name"] == "B")["children"][0]
    assert node_c["name"] == "C"
    assert [d["fileName"] for d in node_c["documents"]] == ["in-c.pdf"]
    assert tree["rootDocuments"] == []


@pytest.mark.anyio
async def test_deleting_a_non_empty_folder_does_not_move_its_contents(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    dbsession,
):
    """A non-empty nested folder is not silently reparented."""
    action = await _seed_da(dbsession, "IA-26RST7")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, _c, _d, _in_c, _in_d = await _build_nest(
        client, fastapi_app, action, dbsession
    )

    response = await client.delete(
        _folder_delete_url(fastapi_app, action, b["folderId"])
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert deleted["folders"] == []
    assert deleted["documents"] == []
    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    # The entire subtree stays in place.
    assert sorted(x["name"] for x in tree["folders"][0]["children"]) == ["B", "D"]


@pytest.mark.anyio
async def test_tree_carries_the_display_name_and_uploader_org(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A rename sets display_name, so the tree has to return it.

    Without it the tree keeps reading by the stored file name and a
    rename looks like it silently did nothing.
    """
    action = await _seed_da(dbsession, "IA-26DSP1")
    document = await _seed_document(dbsession, action, "stored-name.pdf")
    document.display_name = "Signed permit.pdf"
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    row = tree["rootDocuments"][0]

    assert row["fileName"] == "stored-name.pdf"
    assert row["displayName"] == "Signed permit.pdf"
    # Present in the payload even when the uploader has no organization.
    assert "uploadingOrganizationCode" in row


@pytest.mark.anyio
async def test_the_bin_shows_one_row_per_deleted_folder_with_its_contents(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Deleting A (A > B > C(file), A > D(file)) is one thing somebody
    did, so the bin shows one row for it: A, counting and listing every
    file a restore brings back, with each file's path beneath A. B, C and
    D ride with A rather than getting rows of their own.
    """
    action = await _seed_da(dbsession, "IA-26BIN1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    a, b, c, d, in_c, in_d = await _build_nest(client, fastapi_app, action, dbsession)

    await _legacy_bin(
        dbsession,
        folders=[a["folderId"], b["folderId"], c["folderId"], d["folderId"]],
        documents=[in_c, in_d],
    )

    deleted = (await client.get(_deleted_url(fastapi_app, action))).json()
    assert [f["name"] for f in deleted["folders"]] == ["A"]
    row = deleted["folders"][0]
    assert row["documentCount"] == 2
    assert [(d["relativePath"], d["fileName"]) for d in row["documents"]] == [
        ("B / C", "in-c.pdf"),
        ("D", "in-d.pdf"),
    ]
    # Those files come back with the folder, so they are not listed twice.
    assert deleted["documents"] == []
