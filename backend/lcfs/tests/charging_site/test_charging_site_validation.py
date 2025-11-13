import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, Request
from starlette import status

from lcfs.web.api.charging_site.validation import ChargingSiteValidation
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.schema import ChargingSiteCreateSchema
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.compliance.ChargingSite import ChargingSite


@pytest.fixture
def mock_request():
    request = MagicMock(spec=Request)
    request.user = MagicMock(spec=UserProfile)
    request.user.organization = MagicMock(spec=Organization)
    request.user.organization.organization_id = 1
    return request


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=ChargingSiteRepository)


@pytest.fixture
def mock_charging_site():
    site = MagicMock(spec=ChargingSite)
    site.charging_site_id = 1
    site.organization_id = 1
    site.site_name = "Test Site"
    return site


@pytest.fixture
def mock_charging_site_create_schema():
    return ChargingSiteCreateSchema(
        organization_id=1,
        site_name="Test Site",
        street_address="123 Main St",
        city="Vancouver",
        postal_code="V6B 1A1",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[],
    )


@pytest.fixture
def validation(mock_request, mock_repo):
    return ChargingSiteValidation(request=mock_request, cs_repo=mock_repo)


class TestChargingSiteValidation:

    @pytest.mark.anyio
    async def test_get_charging_site_success(self, validation, mock_request):
        """Test successful charging site access validation"""
        mock_request.user.organization.organization_id = 1

        # Should not raise exception
        await validation.get_charging_site(1, 1)

    @pytest.mark.anyio
    async def test_get_charging_site_forbidden(self, validation, mock_request):
        """Test charging site access validation failure"""
        mock_request.user.organization.organization_id = 2  # Different org

        with pytest.raises(HTTPException) as exc_info:
            await validation.get_charging_site(1, 1)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "authorization failed" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_charging_site_create_access_success(
        self, validation, mock_request, mock_charging_site_create_schema
    ):
        """Test successful create access validation"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.charging_site_name_exists.return_value = False

        result = await validation.charging_site_create_access(
            1, mock_charging_site_create_schema
        )

        assert result is True
        validation.cs_repo.charging_site_name_exists.assert_awaited_once_with(
            "Test Site", 1
        )

    @pytest.mark.anyio
    async def test_charging_site_create_access_forbidden_org(
        self, validation, mock_request, mock_charging_site_create_schema
    ):
        """Test create access validation failure - wrong organization"""
        mock_request.user.organization.organization_id = 2  # Different org

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_create_access(
                1, mock_charging_site_create_schema
            )

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.anyio
    async def test_charging_site_create_access_duplicate_name(
        self,
        validation,
        mock_request,
        mock_charging_site_create_schema,
        mock_charging_site,
    ):
        """Test create access validation failure - duplicate site name"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.charging_site_name_exists.return_value = True

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_create_access(
                1, mock_charging_site_create_schema
            )

        assert exc_info.value.status_code == status.HTTP_409_CONFLICT
        assert "already exists" in exc_info.value.detail
        assert "unique" in exc_info.value.detail.lower()

    @pytest.mark.anyio
    async def test_charging_site_create_access_org_id_mismatch(
        self, validation, mock_request
    ):
        """Test create access validation failure - organization ID mismatch"""
        mock_request.user.organization.organization_id = 1
        schema = ChargingSiteCreateSchema(
            organization_id=2,  # Different from URL org_id
            site_name="Test Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )
        validation.cs_repo.charging_site_name_exists.return_value = False

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_create_access(1, schema)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Organization ID" in exc_info.value.detail
        assert "do not match" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_charging_site_delete_update_access_success(
        self, validation, mock_request, mock_charging_site
    ):
        """Test successful delete/update access validation"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        result = await validation.charging_site_delete_update_access(1, 1)

        assert result is True
        validation.cs_repo.get_charging_site_by_id.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_charging_site_delete_update_access_not_found(
        self, validation, mock_request
    ):
        """Test delete/update access validation failure - site not found"""
        validation.cs_repo.get_charging_site_by_id.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_delete_update_access(1, 1)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "Charging site not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_charging_site_delete_update_access_forbidden(
        self, validation, mock_request, mock_charging_site
    ):
        """Test delete/update access validation failure - wrong organization"""
        mock_request.user.organization.organization_id = 2  # Different org
        mock_charging_site.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_delete_update_access(1, 1)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.anyio
    async def test_charging_site_update_access_duplicate_name(
        self, validation, mock_request, mock_charging_site
    ):
        """Test update access validation failure - duplicate site name"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site
        validation.cs_repo.charging_site_name_exists.return_value = True

        update_schema = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="New Duplicate Name",  # Different from existing "Test Site"
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        with pytest.raises(HTTPException) as exc_info:
            await validation.charging_site_delete_update_access(1, 1, update_schema)

        assert exc_info.value.status_code == status.HTTP_409_CONFLICT
        assert "already exists" in exc_info.value.detail
        assert "unique" in exc_info.value.detail.lower()
        validation.cs_repo.charging_site_name_exists.assert_awaited_once_with(
            "New Duplicate Name", 1, exclude_site_id=1
        )

    @pytest.mark.anyio
    async def test_charging_site_update_access_same_name(
        self, validation, mock_request, mock_charging_site
    ):
        """Test update access validation success - keeping same name"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        update_schema = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Test Site",  # Same as existing
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        result = await validation.charging_site_delete_update_access(
            1, 1, update_schema
        )

        assert result is True
        # Should not check for duplicate name if the name hasn't changed
        validation.cs_repo.charging_site_name_exists.assert_not_called()

    @pytest.mark.anyio
    async def test_validate_organization_access_success_same_org(
        self, validation, mock_request, mock_charging_site
    ):
        """Test successful organization access validation for same org"""
        mock_request.user.organization.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        with patch(
            "lcfs.web.api.charging_site.validation.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False  # Not government user

            result = await validation.validate_organization_access(1)

            assert result == mock_charging_site
            validation.cs_repo.get_charging_site_by_id.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_validate_organization_access_success_government(
        self, validation, mock_request, mock_charging_site
    ):
        """Test successful organization access validation for government user"""
        mock_request.user.organization.organization_id = 2  # Different org
        mock_charging_site.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        with patch(
            "lcfs.web.api.charging_site.validation.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = True  # Government user

            result = await validation.validate_organization_access(1)

            assert result == mock_charging_site
            mock_has_roles.assert_called_once_with(
                mock_request.user, [RoleEnum.GOVERNMENT]
            )

    @pytest.mark.anyio
    async def test_validate_organization_access_site_not_found(
        self, validation, mock_request
    ):
        """Test organization access validation failure - site not found"""
        validation.cs_repo.get_charging_site_by_id.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await validation.validate_organization_access(1)

        assert exc_info.value.status_code == 404
        assert "Charging site with ID 1 not found" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_validate_organization_access_forbidden_non_government(
        self, validation, mock_request, mock_charging_site
    ):
        """Test organization access validation failure - non-government user, different org"""
        mock_request.user.organization.organization_id = 2  # Different org
        mock_charging_site.organization_id = 1
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        with patch(
            "lcfs.web.api.charging_site.validation.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False  # Not government user

            with pytest.raises(HTTPException) as exc_info:
                await validation.validate_organization_access(1)

            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            assert "User does not have access to this site" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_validate_organization_access_no_user_org(
        self, validation, mock_request, mock_charging_site
    ):
        """Test organization access validation when user has no organization"""
        mock_request.user.organization = None
        validation.cs_repo.get_charging_site_by_id.return_value = mock_charging_site

        with patch(
            "lcfs.web.api.charging_site.validation.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False  # Not government user

            with pytest.raises(HTTPException) as exc_info:
                await validation.validate_organization_access(1)

            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
