import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.login_bg_image.LoginBgImage import LoginBgImage
from lcfs.web.api.login_bg_image.repo import LoginBgImageRepository
from lcfs.web.api.login_bg_image.services import LoginBgImageService


@pytest.fixture
def mock_login_bg_image_service():
    return MagicMock(spec=LoginBgImageService)


@pytest.fixture
def mock_login_bg_image_repo():
    return AsyncMock(spec=LoginBgImageRepository)


@pytest.fixture
def sample_image():
    return LoginBgImage(
        login_bg_image_id=1,
        image_key="login-backgrounds/abc-uuid",
        file_name="photo.jpg",
        display_name="Mountain Sunrise",
        caption="Rockies, BC",
        is_active=False,
    )


@pytest.fixture
def active_image():
    return LoginBgImage(
        login_bg_image_id=2,
        image_key="login-backgrounds/def-uuid",
        file_name="active.jpg",
        display_name="Active Background",
        caption=None,
        is_active=True,
    )


@pytest.fixture
def login_bg_image_service(mock_login_bg_image_repo):
    service = LoginBgImageService.__new__(LoginBgImageService)
    service.repo = mock_login_bg_image_repo
    service.s3_client = MagicMock()
    return service
