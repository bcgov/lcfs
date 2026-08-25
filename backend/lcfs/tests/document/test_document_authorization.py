import pytest
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.exception.exceptions import DataNotFoundException


class _Doc:
    def __init__(self, document_id):
        self.document_id = document_id


class _ScopedService(DocumentService):
    """Exercises get_object_for_parent's scoping without S3 or a database."""

    def __init__(self, owned_ids):
        self._owned = [_Doc(i) for i in owned_ids]
        self.fetched = None

    async def get_by_id_and_type(self, parent_id, parent_type="compliance_report"):
        return self._owned

    async def get_object(self, document_id):
        self.fetched = document_id
        return {
            "ContentLength": 1,
            "Body": [b""],
            "ContentType": "application/pdf",
        }, _Doc(document_id)


@pytest.mark.anyio
async def test_get_object_for_parent_allows_a_document_of_that_parent():
    service = _ScopedService([10, 11])
    await service.get_object_for_parent(
        11, parent_id=5, parent_type="initiativeAgreement"
    )
    assert service.fetched == 11


@pytest.mark.anyio
async def test_get_object_for_parent_rejects_a_document_of_another_parent():
    """
    Validating access to parent_id is meaningless if any document id can then
    be streamed through it.
    """
    service = _ScopedService([10, 11])
    with pytest.raises(DataNotFoundException):
        await service.get_object_for_parent(
            999, parent_id=5, parent_type="initiativeAgreement"
        )
    assert service.fetched is None


@pytest.mark.anyio
async def test_listing_documents_of_an_unsupported_parent_type_is_refused(
    fastapi_app, client, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for(
        "get_all_documents", parent_type="not_a_parent", parent_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_streaming_a_document_of_an_unsupported_parent_type_is_refused(
    fastapi_app, client, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for(
        "stream_document", parent_type="not_a_parent", parent_id=1, document_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_listing_documents_requires_authentication(fastapi_app, client):
    """get_all_documents previously carried no view_handler at all."""
    from lcfs.web.api.document import views

    assert hasattr(
        views.get_all_documents, "__wrapped__"
    ), "get_all_documents must be wrapped by view_handler"
    assert hasattr(
        views.stream_document, "__wrapped__"
    ), "stream_document must be wrapped by view_handler"
