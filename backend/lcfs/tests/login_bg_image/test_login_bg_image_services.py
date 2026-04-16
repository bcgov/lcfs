import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from io import BytesIO

from fastapi import HTTPException, UploadFile

from lcfs.db.models.login_bg_image.LoginBgImage import LoginBgImage
from lcfs.web.api.login_bg_image.schema import LoginBgImageUpdateSchema


# ---------------------------------------------------------------------------
# get_all
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_all_returns_list(
    login_bg_image_service, mock_login_bg_image_repo, sample_image, active_image
):
    mock_login_bg_image_repo.get_all = AsyncMock(return_value=[sample_image, active_image])

    result = await login_bg_image_service.get_all()

    assert len(result) == 2
    assert result[0].login_bg_image_id == sample_image.login_bg_image_id
    mock_login_bg_image_repo.get_all.assert_called_once()


@pytest.mark.anyio
async def test_get_all_returns_empty(login_bg_image_service, mock_login_bg_image_repo):
    mock_login_bg_image_repo.get_all = AsyncMock(return_value=[])

    result = await login_bg_image_service.get_all()

    assert result == []


# ---------------------------------------------------------------------------
# get_active
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_active_returns_schema_when_active_exists(
    login_bg_image_service, mock_login_bg_image_repo, active_image
):
    mock_login_bg_image_repo.get_active = AsyncMock(return_value=active_image)

    result = await login_bg_image_service.get_active()

    assert result is not None
    assert result.is_active is True
    assert result.login_bg_image_id == active_image.login_bg_image_id


@pytest.mark.anyio
async def test_get_active_returns_none_when_no_active(
    login_bg_image_service, mock_login_bg_image_repo
):
    mock_login_bg_image_repo.get_active = AsyncMock(return_value=None)

    result = await login_bg_image_service.get_active()

    assert result is None


# ---------------------------------------------------------------------------
# upload
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_upload_success(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    file_content = b"fake-image-bytes"
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "image/jpeg"
    mock_file.filename = "photo.jpg"
    mock_file.file = MagicMock()
    mock_file.file.fileno.return_value = 0
    mock_file.file.seek = MagicMock()

    mock_login_bg_image_repo.create = AsyncMock(return_value=sample_image)

    with patch("os.fstat") as mock_fstat:
        mock_fstat.return_value.st_size = 1024  # 1 KB — well under limit
        result = await login_bg_image_service.upload(
            mock_file, "Mountain Sunrise", "Rockies, BC"
        )

    login_bg_image_service.s3_client.upload_fileobj.assert_called_once()
    mock_login_bg_image_repo.create.assert_called_once()
    assert result.display_name == sample_image.display_name


@pytest.mark.anyio
async def test_upload_rejects_invalid_content_type(login_bg_image_service):
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "application/pdf"
    mock_file.filename = "document.pdf"

    with pytest.raises(HTTPException) as exc_info:
        await login_bg_image_service.upload(mock_file, "Name", None)

    assert exc_info.value.status_code == 400
    assert "not allowed" in exc_info.value.detail


@pytest.mark.anyio
async def test_upload_rejects_oversized_file(login_bg_image_service):
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "image/png"
    mock_file.filename = "huge.png"
    mock_file.file = MagicMock()
    mock_file.file.fileno.return_value = 0

    with patch("os.fstat") as mock_fstat:
        mock_fstat.return_value.st_size = 25 * 1024 * 1024  # 25 MB — over limit
        with pytest.raises(HTTPException) as exc_info:
            await login_bg_image_service.upload(mock_file, "Name", None)

    assert exc_info.value.status_code == 400
    assert "20 MB" in exc_info.value.detail


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_success(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    sample_image.display_name = "Updated Name"
    sample_image.caption = "New caption"
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=sample_image)
    mock_login_bg_image_repo.update = AsyncMock(return_value=sample_image)

    data = LoginBgImageUpdateSchema(display_name="Updated Name", caption="New caption")
    result = await login_bg_image_service.update(1, data)

    assert result.display_name == "Updated Name"
    assert result.caption == "New caption"
    mock_login_bg_image_repo.update.assert_called_once()


@pytest.mark.anyio
async def test_update_raises_404_when_not_found(
    login_bg_image_service, mock_login_bg_image_repo
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=None)

    data = LoginBgImageUpdateSchema(display_name="Name", caption=None)
    with pytest.raises(HTTPException) as exc_info:
        await login_bg_image_service.update(99, data)

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_success(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=sample_image)
    mock_login_bg_image_repo.delete = AsyncMock(return_value=None)

    await login_bg_image_service.delete(1)

    login_bg_image_service.s3_client.delete_object.assert_called_once_with(
        Bucket=login_bg_image_service.s3_client.delete_object.call_args[1]["Bucket"],
        Key=sample_image.image_key,
    )
    mock_login_bg_image_repo.delete.assert_called_once_with(sample_image)


@pytest.mark.anyio
async def test_delete_raises_404_when_not_found(
    login_bg_image_service, mock_login_bg_image_repo
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await login_bg_image_service.delete(99)

    assert exc_info.value.status_code == 404


@pytest.mark.anyio
async def test_delete_continues_when_s3_fails(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=sample_image)
    mock_login_bg_image_repo.delete = AsyncMock(return_value=None)
    login_bg_image_service.s3_client.delete_object.side_effect = Exception("S3 error")

    # Should not raise — S3 failure is logged and swallowed
    await login_bg_image_service.delete(1)

    mock_login_bg_image_repo.delete.assert_called_once_with(sample_image)


# ---------------------------------------------------------------------------
# activate
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_activate_deactivates_all_then_sets_active(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    sample_image.is_active = True
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=sample_image)
    mock_login_bg_image_repo.deactivate_all = AsyncMock(return_value=None)
    mock_login_bg_image_repo.update = AsyncMock(return_value=sample_image)

    result = await login_bg_image_service.activate(1)

    mock_login_bg_image_repo.deactivate_all.assert_called_once()
    mock_login_bg_image_repo.update.assert_called_once()
    assert result.is_active is True


@pytest.mark.anyio
async def test_activate_raises_404_when_not_found(
    login_bg_image_service, mock_login_bg_image_repo
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await login_bg_image_service.activate(99)

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# stream_image
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_stream_image_returns_s3_response(
    login_bg_image_service, mock_login_bg_image_repo, sample_image
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=sample_image)
    fake_s3_response = {
        "Body": BytesIO(b"image-bytes"),
        "ContentLength": 11,
        "ContentType": "image/jpeg",
    }
    login_bg_image_service.s3_client.get_object.return_value = fake_s3_response

    s3_resp, image = await login_bg_image_service.stream_image(1)

    login_bg_image_service.s3_client.get_object.assert_called_once_with(
        Bucket=login_bg_image_service.s3_client.get_object.call_args[1]["Bucket"],
        Key=sample_image.image_key,
    )
    assert s3_resp["ContentType"] == "image/jpeg"
    assert image == sample_image


@pytest.mark.anyio
async def test_stream_image_raises_404_when_not_found(
    login_bg_image_service, mock_login_bg_image_repo
):
    mock_login_bg_image_repo.get_by_id = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await login_bg_image_service.stream_image(99)

    assert exc_info.value.status_code == 404
