"""Folder layer for designated action documents (#4925, phase 1).

The isolation guarantee comes first: folders exist only for the surfaces
in FOLDER_ENABLED_PARENT_TYPES, and every other parent type is refused
before any work happens. The rest covers CRUD, the tree shape, and the
six server-side invariants.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.document import Document, DocumentFolder, DocumentFolderItem
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.db.models.user.Role import RoleEnum
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


async def _seed_document(dbsession, action, name="evidence.pdf"):
    document = Document(
        file_key=f"da/{name}",
        file_name=name,
        file_size=2048,
        mime_type="application/pdf",
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
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
async def test_delete_reparents_by_default_and_cascades_on_request(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
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

    # Reparent: Middle's contents move up under Top.
    delete_url = fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=middle["folderId"],
    )
    response = await client.delete(delete_url)
    assert response.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    top_node = tree["folders"][0]
    assert [c["name"] for c in top_node["children"]] == ["Leaf"]
    assert [d["fileName"] for d in top_node["documents"]] == ["evidence.pdf"]

    # Cascade: the whole subtree goes; the file falls to the root.
    delete_top = fastapi_app.url_path_for(
        "delete_document_folder",
        parent_type="designatedAction",
        parent_id=action.designated_action_id,
        folder_id=top["folderId"],
    )
    response = await client.delete(f"{delete_top}?strategy=cascade")
    assert response.status_code == status.HTTP_204_NO_CONTENT

    tree = (await client.get(_tree_url(fastapi_app, action))).json()
    assert tree["folders"] == []
    assert [d["fileName"] for d in tree["rootDocuments"]] == ["evidence.pdf"]


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
async def test_folder_routes_are_idir_only(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26FLDB")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.get(_tree_url(fastapi_app, action))
    assert response.status_code == status.HTTP_403_FORBIDDEN
