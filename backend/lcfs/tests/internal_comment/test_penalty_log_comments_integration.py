"""Persistence and Comment Search integration for the organization penalty log."""

from io import BytesIO
from unittest.mock import MagicMock

import pytest

from lcfs.db.models import UserProfile
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.PenaltyLogInternalComment import PenaltyLogInternalComment
from lcfs.db.models.document import Document
from lcfs.services.s3.dependency import get_s3_client
from lcfs.settings import settings
from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
async def test_penalty_thread_persists_documents_and_is_searchable(
    client,
    fastapi_app,
    set_mock_user,
    add_models,
    monkeypatch,
):
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={
            "keycloak_username": "PENALTY_AUTHOR",
        },
    )
    await add_models(
        [
            UserProfile(
                keycloak_username="PENALTY_AUTHOR",
                first_name="Penalty",
                last_name="Author",
            )
        ]
    )
    storage = MagicMock()
    fastapi_app.dependency_overrides[get_s3_client] = lambda: storage
    monkeypatch.setattr(settings, "clamav_enabled", False)
    ids = []
    for text in ["Payment correspondence", "Enforcement documentation"]:
        response = await client.post(
            fastapi_app.url_path_for("create_comment"),
            json={
                "entityType": "penaltyLog",
                "entityId": 1,
                "comment": f"<p>{text}</p>",
                "visibility": "Public",
                "commentCategory": "Company Overview",
            },
        )
        assert response.status_code == 201, response.text
        ids.append(response.json()["internalCommentId"])
        assert response.json()["visibility"] == "Internal"
    assert len(set(ids)) == 2

    uploaded = await client.post(
        f"/api/documents/internal_comment/{ids[0]}",
        files={"file": ("confirmation.pdf", b"Payment evidence", "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["documentId"]
    storage.upload_fileobj.assert_called_once()
    storage.get_object.return_value = {
        "Body": BytesIO(b"Payment evidence"),
        "ContentLength": len(b"Payment evidence"),
        "ContentType": "application/pdf",
    }
    downloaded = await client.get(
        f"/api/documents/internal_comment/{ids[0]}/{document_id}"
    )
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == b"Payment evidence"
    assert "confirmation.pdf" in downloaded.headers["content-disposition"]

    invalid_upload = await client.post(
        f"/api/documents/internal_comment/{ids[0]}",
        files={"file": ("invalid.exe", b"invalid", "application/x-msdownload")},
    )
    assert invalid_upload.status_code == 400
    storage.upload_fileobj.assert_called_once()

    penalty_payload = {
        "compliancePeriodId": 15,
        "contraventionType": "Single contravention",
        "penaltyAmount": 100,
    }
    penalty = await client.post(
        fastapi_app.url_path_for("create_penalty_log", organization_id=1),
        json=penalty_payload,
    )
    assert penalty.status_code == 201, penalty.text
    reassessed = await client.put(
        fastapi_app.url_path_for(
            "update_penalty_log",
            organization_id=1,
            penalty_log_id=penalty.json()["penaltyLogId"],
        ),
        json={**penalty_payload, "penaltyAmount": 150},
    )
    assert reassessed.status_code == 200, reassessed.text

    thread_url = fastapi_app.url_path_for(
        "get_comments", entity_type="penaltyLog", entity_id=1
    )
    for _ in range(2):
        thread = await client.get(thread_url)
        assert thread.status_code == 200
        matching = next(c for c in thread.json() if c["internalCommentId"] == ids[0])
        assert matching["fullName"] == "Penalty Author"
        attachment = matching["documents"][0]
        assert attachment["fileName"] == "confirmation.pdf"
        assert attachment["createUser"] == "PENALTY_AUTHOR"
        assert attachment["createDate"]

    updated = await client.put(
        fastapi_app.url_path_for("update_comment", internal_comment_id=ids[0]),
        json={"comment": "<p>Payment verified</p>", "visibility": "Public"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["visibility"] == "Internal"
    assert updated.json()["documents"][0]["documentId"] == document_id

    search = await client.get(
        fastapi_app.url_path_for("get_organization_comments", organization_id=1),
        params={"category": "Penalty notes", "search": "verified"},
    )
    assert search.status_code == 200, search.text
    record = next(
        c for c in search.json()["comments"] if c["internalCommentId"] == ids[0]
    )
    assert record["entityType"] == "penaltyLog"
    assert record["entityId"] == 1
    assert record["organizationId"] == 1
    assert record["category"] == "Penalty notes"
    attachment = record["documents"][0]
    assert attachment["documentId"] == document_id
    assert attachment["fileName"] == "confirmation.pdf"
    assert attachment["fileSize"] == len(b"Payment evidence")
    assert attachment["createUser"] == "PENALTY_AUTHOR"
    assert attachment["createDate"]

    # Attachments belong to individual comments, and do not change pagination.
    feed_url = fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    paged_comments = []
    for page in (1, 2):
        page_response = await client.get(
            feed_url, params={"category": "Penalty notes", "page": page, "size": 1}
        )
        assert page_response.status_code == 200, page_response.text
        assert page_response.json()["pagination"]["total"] == 2
        paged_comments.extend(page_response.json()["comments"])
    assert [c["internalCommentId"] for c in paged_comments] == ids
    assert paged_comments[0]["documents"][0]["documentId"] == document_id
    assert paged_comments[1]["documents"] == []

    replacement = await client.post(
        f"/api/documents/internal_comment/{ids[0]}",
        files={"file": ("replacement.pdf", b"Revised evidence", "application/pdf")},
    )
    assert replacement.status_code == 201, replacement.text
    removed = await client.delete(
        f"/api/documents/internal_comment/{ids[0]}/{document_id}"
    )
    assert removed.status_code == 200, removed.text
    replaced_thread = await client.get(thread_url)
    replaced_comment = next(
        c for c in replaced_thread.json() if c["internalCommentId"] == ids[0]
    )
    assert [d["fileName"] for d in replaced_comment["documents"]] == ["replacement.pdf"]
    refreshed_search = await client.get(
        feed_url, params={"category": "Penalty notes", "search": "verified"}
    )
    assert refreshed_search.status_code == 200, refreshed_search.text
    assert [
        d["documentId"] for d in refreshed_search.json()["comments"][0]["documents"]
    ] == [replacement.json()["documentId"]]

    deleted = await client.delete(
        fastapi_app.url_path_for("delete_comment", internal_comment_id=ids[0])
    )
    assert deleted.status_code == 204, deleted.text
    assert storage.delete_object.call_count == 2
    refreshed = await client.get(thread_url)
    assert ids[0] not in [c["internalCommentId"] for c in refreshed.json()]


@pytest.mark.anyio
async def test_suppliers_cannot_read_penalty_log_thread(
    client, fastapi_app, set_mock_user, add_models
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details={"organization_id": 1})
    fastapi_app.dependency_overrides[get_s3_client] = lambda: MagicMock()
    document = Document(
        file_name="internal-evidence.pdf",
        file_key="internal-evidence-key",
        file_size=16,
        mime_type="application/pdf",
        create_user="PENALTY_AUTHOR",
    )
    comment = InternalComment(
        comment="<p>Internal penalty discussion</p>",
        visibility="Internal",
        create_user="PENALTY_AUTHOR",
        documents=[document],
    )
    await add_models([comment])
    await add_models(
        [
            PenaltyLogInternalComment(
                organization_id=1, internal_comment_id=comment.internal_comment_id
            )
        ]
    )
    forbidden = await client.get(
        fastapi_app.url_path_for("get_comments", entity_type="penaltyLog", entity_id=1)
    )
    assert forbidden.status_code == 403

    # Feed metadata and direct document requests must follow the same visibility.
    supplier_feed = await client.get(
        fastapi_app.url_path_for("get_organization_comments", organization_id=1)
    )
    assert supplier_feed.status_code == 200, supplier_feed.text
    assert supplier_feed.json()["comments"] == []
    forbidden_document = await client.get(
        f"/api/documents/internal_comment/{comment.internal_comment_id}/{document.document_id}"
    )
    assert forbidden_document.status_code == 403, forbidden_document.text


@pytest.mark.anyio
async def test_penalty_comment_for_unknown_organization_returns_not_found(
    client,
    fastapi_app,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    response = await client.post(
        fastapi_app.url_path_for("create_comment"),
        json={
            "entityType": "penaltyLog",
            "entityId": 999999,
            "comment": "<p>Evidence</p>",
        },
    )
    assert response.status_code == 404, response.text
