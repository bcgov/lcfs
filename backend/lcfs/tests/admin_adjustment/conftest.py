import pytest
from unittest.mock import MagicMock, AsyncMock
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.admin_adjustment.repo import AdminAdjustmentRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.internal_comment.services import InternalCommentService
from lcfs.db.models.user.Role import RoleEnum


def _make_mock_user(roles):
    user = MagicMock()
    user.user_profile_id = 1
    user.first_name = "Test"
    user.last_name = "User"
    user.role_names = set(roles)
    return user


@pytest.fixture
def mock_repo():
    return MagicMock(spec=AdminAdjustmentRepository)


@pytest.fixture
def mock_org_service():
    return MagicMock(spec=OrganizationsService)


@pytest.fixture
def mock_internal_comment_service():
    return MagicMock(spec=InternalCommentService)


@pytest.fixture
def mock_request():
    request = MagicMock()
    request.user = _make_mock_user([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
    return request


@pytest.fixture
def admin_adjustment_service(mock_repo, mock_org_service, mock_internal_comment_service, mock_request):
    service = AdminAdjustmentServices()
    service.repo = mock_repo
    service.org_service = mock_org_service
    service.internal_comment_service = mock_internal_comment_service
    service.request = mock_request
    return service
