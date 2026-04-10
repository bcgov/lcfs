import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, Request
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.schema import (
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentForSiteSchema,
    ChargingSiteCreateSchema,
    ChargingEquipmentPaginatedSchema,
    ChargingSiteSchema,
    ChargingSitesSchema,
    ChargingSiteManualStatusUpdateSchema,
    ChargingEquipmentStatusSchema,
    ChargingSiteStatusSchema,
)
from lcfs.web.api.base import PaginationRequestSchema, FilterModel
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingSite,
    ChargingSiteStatus,
    ChargingEquipmentStatus,
    EndUserType,
)
from lcfs.db.models.organization import Organization


@pytest.fixture
def mock_user():
    """Mock user for testing"""
    user = MagicMock(spec=UserProfile)
    user.user_profile_id = 1
    user.keycloak_username = "testuser"
    return user


@pytest.fixture
def mock_repo():
    """Mock repository for testing"""
    return AsyncMock(spec=ChargingSiteRepository)


@pytest.fixture
def mock_request():
    """Mock request for testing"""
    request = MagicMock(spec=Request)
    request.user = MagicMock(spec=UserProfile)
    request.user.organization = MagicMock()
    request.user.organization.organization_id = 1
    request.user.is_government = False
    return request


@pytest.fixture
def charging_site_service(mock_repo, mock_request):
    """ChargingSiteService instance with mocked repository"""
    return ChargingSiteService(repo=mock_repo, request=mock_request)


class TestChargingSiteService:
    """Test class for ChargingSiteService functionality"""

    @pytest.mark.anyio
    async def test_get_intended_user_types_success(
        self, charging_site_service, mock_repo
    ):
        """Test successful retrieval of intended user types"""
        mock_user = MagicMock(spec=EndUserType)
        mock_user.end_user_type_id = 1
        mock_user.type_name = "Public"
        mock_users = [mock_user]
        mock_repo.get_intended_user_types.return_value = mock_users

        result = await charging_site_service.get_intended_user_types()

        assert len(result) == 1
        mock_repo.get_intended_user_types.assert_called_once()

    @pytest.mark.anyio
    async def test_get_intended_user_types_exception(
        self, charging_site_service, mock_repo
    ):
        """Test exception handling in get_intended_user_types"""
        mock_repo.get_intended_user_types.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.get_intended_user_types()

        assert exc_info.value.status_code == 500

    @pytest.mark.anyio
    async def test_get_charging_equipment_statuses(
        self, charging_site_service, mock_repo
    ):
        """Test getting charging equipment statuses"""
        mock_status = MagicMock(spec=ChargingEquipmentStatus)
        mock_status.charging_equipment_status_id = 1
        mock_status.status = "Draft"
        mock_status.description = "Draft status"
        mock_repo.get_charging_equipment_statuses.return_value = [mock_status]

        result = await charging_site_service.get_charging_equipment_statuses()

        assert len(result) == 1
        assert isinstance(result[0], ChargingEquipmentStatusSchema)
        assert result[0].status == "Draft"

    @pytest.mark.anyio
    async def test_get_charging_site_statuses(self, charging_site_service, mock_repo):
        """Test getting charging site statuses"""
        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"
        mock_status.description = "Draft status"
        mock_repo.get_charging_site_statuses.return_value = [mock_status]

        result = await charging_site_service.get_charging_site_statuses()

        assert len(result) == 1
        assert isinstance(result[0], ChargingSiteStatusSchema)
        assert result[0].status == "Draft"

    @pytest.mark.anyio
    async def test_get_charging_site_by_id_success(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test successful retrieval of charging site by ID"""
        # Create properly mocked site with all required string fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.group_uuid = "site-group-1"
        mock_site.organization_id = 1
        mock_site.organization = mock_org
        mock_site.allocating_organization = mock_allocating_org
        mock_site.allocating_organization_name = "Allocating Org"
        mock_site.status_id = 1
        mock_site.status = mock_status
        mock_site.version = 1
        mock_site.site_code = "SITE001"
        mock_site.site_name = "Test Site"
        mock_site.street_address = "123 Main St"
        mock_site.city = "Vancouver"
        mock_site.postal_code = "V6B 1A1"
        mock_site.latitude = 49.2827
        mock_site.longitude = -123.1207
        mock_site.intended_users = []
        mock_site.documents = []
        mock_site.notes = "Test notes"
        mock_site.create_date = None
        mock_site.update_date = None
        mock_site.create_user = "testuser"
        mock_site.update_user = "testuser"

        mock_repo.get_charging_site_by_id.return_value = mock_site

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False

            result = await charging_site_service.get_charging_site_by_id(1)

            assert isinstance(result, ChargingSiteSchema)
            mock_repo.get_charging_site_by_id.assert_called_once_with(1, government_visible=False)

    @pytest.mark.anyio
    async def test_get_charging_site_by_id_not_found(
        self, charging_site_service, mock_repo
    ):
        """Test charging site not found"""
        mock_repo.get_charging_site_by_id.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.get_charging_site_by_id(1)

        assert exc_info.value.status_code == 404

    @pytest.mark.anyio
    async def test_get_charging_site_by_id_with_history_success(
        self, charging_site_service, mock_repo
    ):
        current_site = MagicMock(spec=ChargingSite)
        current_site.charging_site_id = 1
        current_site.group_uuid = "site-group-1"
        current_site.organization_id = 1
        current_site.organization = MagicMock(organization_id=1, name="Test Org")
        current_site.allocating_organization = None
        current_site.allocating_organization_name = "Allocating Org"
        current_site.status_id = 1
        current_site.status = MagicMock(charging_site_status_id=1, status="Validated")
        current_site.version = 3
        current_site.site_code = "SITE001"
        current_site.site_name = "Test Site"
        current_site.street_address = "123 Main St"
        current_site.city = "Vancouver"
        current_site.postal_code = "V6B 1A1"
        current_site.latitude = 49.2827
        current_site.longitude = -123.1207
        current_site.intended_users = []
        current_site.documents = []
        current_site.notes = "Latest"
        current_site.create_date = None
        current_site.update_date = None
        current_site.create_user = "testuser"
        current_site.update_user = "testuser"

        historical_site = MagicMock(spec=ChargingSite)
        historical_site.charging_site_id = 2
        historical_site.group_uuid = "site-group-1"
        historical_site.organization_id = 1
        historical_site.organization = current_site.organization
        historical_site.allocating_organization = None
        historical_site.allocating_organization_name = "Allocating Org"
        historical_site.status_id = 1
        historical_site.status = MagicMock(charging_site_status_id=1, status="Submitted")
        historical_site.version = 2
        historical_site.site_code = "SITE001"
        historical_site.site_name = "Test Site"
        historical_site.street_address = "123 Main St"
        historical_site.city = "Vancouver"
        historical_site.postal_code = "V6B 1A1"
        historical_site.latitude = 49.2827
        historical_site.longitude = -123.1207
        historical_site.intended_users = []
        historical_site.documents = []
        historical_site.notes = "Older"
        historical_site.create_date = None
        historical_site.update_date = None
        historical_site.create_user = "testuser"
        historical_site.update_user = "testuser"

        mock_repo.get_charging_site_by_id.return_value = current_site
        mock_repo.get_charging_site_versions_by_id.return_value = [
            current_site,
            historical_site,
        ]

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False

            result = await charging_site_service.get_charging_site_by_id_with_history(1)

        assert isinstance(result, ChargingSiteSchema)
        assert len(result.history) == 2
        assert result.history[0].version == 3
        assert result.history[1].version == 2
        mock_repo.get_charging_site_versions_by_id.assert_awaited_once_with(1)

    @pytest.mark.anyio
    async def test_get_charging_site_by_id_forbidden(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test forbidden access to charging site"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.organization_id = 2  # Different org
        mock_repo.get_charging_site_by_id.return_value = mock_site

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False  # Not government

            with pytest.raises(HTTPException) as exc_info:
                await charging_site_service.get_charging_site_by_id(1)

            assert exc_info.value.status_code == 403

    @pytest.mark.anyio
    async def test_create_charging_site_success(self, charging_site_service, mock_repo):
        """Test successful charging site creation"""
        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_status.charging_site_status_id = 1
        mock_repo.get_charging_site_status_by_name.return_value = mock_status
        mock_repo.get_end_user_types_by_ids.return_value = []
        mock_repo.charging_site_name_exists.return_value = False

        # Mock the created site
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_repo.create_charging_site.return_value = mock_site

        # Mock the retrieved site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status_obj = MagicMock()
        mock_status_obj.charging_site_status_id = 1
        mock_status_obj.status = "Draft"

        mock_retrieved_site = MagicMock(spec=ChargingSite)
        mock_retrieved_site.charging_site_id = 1
        mock_retrieved_site.group_uuid = "site-group-1"
        mock_retrieved_site.organization_id = 1
        mock_retrieved_site.organization = mock_org
        mock_retrieved_site.allocating_organization = mock_allocating_org
        mock_retrieved_site.allocating_organization_name = "Allocating Org"
        mock_retrieved_site.status_id = 1
        mock_retrieved_site.status = mock_status_obj
        mock_retrieved_site.version = 1
        mock_retrieved_site.site_code = "SITE001"
        mock_retrieved_site.site_name = "Test Site"
        mock_retrieved_site.street_address = "123 Main St"
        mock_retrieved_site.city = "Vancouver"
        mock_retrieved_site.postal_code = "V6B 1A1"
        mock_retrieved_site.latitude = 49.2827
        mock_retrieved_site.longitude = -123.1207
        mock_retrieved_site.intended_users = []
        mock_retrieved_site.documents = []
        mock_retrieved_site.notes = "Test notes"
        mock_retrieved_site.create_date = None
        mock_retrieved_site.update_date = None
        mock_retrieved_site.create_user = "testuser"
        mock_retrieved_site.update_user = "testuser"

        mock_repo.get_charging_site_by_id.return_value = mock_retrieved_site

        create_data = ChargingSiteCreateSchema(
            organization_id=1,
            site_name="Test Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        # Mock the ChargingSite constructor to avoid SQLAlchemy issues
        with patch(
            "lcfs.web.api.charging_site.services.ChargingSite"
        ) as mock_charging_site_class:
            mock_charging_site_class.return_value = mock_site

            result = await charging_site_service.create_charging_site(create_data, 1)

            assert isinstance(result, ChargingSiteSchema)
            mock_repo.create_charging_site.assert_called_once()
            mock_repo.charging_site_name_exists.assert_awaited_once_with("Test Site", 1)

    @pytest.mark.anyio
    async def test_create_charging_site_duplicate_name(
        self, charging_site_service, mock_repo
    ):
        """Test charging site creation failure due to duplicate name"""
        mock_repo.charging_site_name_exists.return_value = True

        create_data = ChargingSiteCreateSchema(
            organization_id=1,
            site_name="Duplicate Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.create_charging_site(create_data, 1)

        assert exc_info.value.status_code == 400
        mock_repo.create_charging_site.assert_not_called()

    @pytest.mark.anyio
    async def test_update_charging_site_success(self, charging_site_service, mock_repo):
        """Test successful charging site update"""
        mock_existing_site = MagicMock(spec=ChargingSite)
        mock_existing_site.status.status = "Draft"
        mock_existing_site.site_name = "Old Site"
        mock_existing_site.organization_id = 1
        mock_existing_site.charging_site_id = 1
        mock_repo.get_charging_site_by_id.return_value = mock_existing_site

        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_status.charging_site_status_id = 1
        mock_repo.get_charging_site_status_by_name.return_value = mock_status
        mock_repo.get_end_user_types_by_ids.return_value = []
        mock_repo.charging_site_name_exists.return_value = False

        # Mock the updated site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status_obj = MagicMock()
        mock_status_obj.charging_site_status_id = 1
        mock_status_obj.status = "Draft"

        mock_updated_site = MagicMock(spec=ChargingSite)
        mock_updated_site.charging_site_id = 1
        mock_updated_site.group_uuid = "site-group-1"
        mock_updated_site.organization_id = 1
        mock_updated_site.organization = mock_org
        mock_updated_site.allocating_organization = mock_allocating_org
        mock_updated_site.allocating_organization_name = "Allocating Org"
        mock_updated_site.status_id = 1
        mock_updated_site.status = mock_status_obj
        mock_updated_site.version = 1
        mock_updated_site.site_code = "SITE001"
        mock_updated_site.site_name = "Updated Site"
        mock_updated_site.street_address = "123 Main St"
        mock_updated_site.city = "Vancouver"
        mock_updated_site.postal_code = "V6B 1A1"
        mock_updated_site.latitude = 49.2827
        mock_updated_site.longitude = -123.1207
        mock_updated_site.intended_users = []
        mock_updated_site.documents = []
        mock_updated_site.notes = "Test notes"
        mock_updated_site.create_date = None
        mock_updated_site.update_date = None
        mock_updated_site.create_user = "testuser"
        mock_updated_site.update_user = "testuser"

        mock_repo.update_charging_site.return_value = mock_updated_site

        update_data = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Updated Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        result = await charging_site_service.update_charging_site(update_data)

        assert isinstance(result, ChargingSiteSchema)
        mock_repo.update_charging_site.assert_called_once()
        mock_repo.charging_site_name_exists.assert_awaited_once_with(
            "Updated Site", 1, exclude_site_id=mock_existing_site.charging_site_id
        )

    @pytest.mark.anyio
    async def test_update_charging_site_status_manual_government_submitted_to_validated(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test IDIR Analyst can set status from Submitted to Validated."""
        mock_request.user.organization = MagicMock()
        mock_request.user.organization.organization_id = 1

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.status = MagicMock()
        mock_site.status.status = "Submitted"

        mock_validated_status = MagicMock(spec=ChargingSiteStatus)
        mock_validated_status.charging_site_status_id = 2
        mock_validated_status.status = "Validated"

        # Second call returns a site that must validate as ChargingSiteSchema
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"
        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"
        mock_updated_site = MagicMock(spec=ChargingSite)
        mock_updated_site.charging_site_id = 1
        mock_updated_site.group_uuid = "site-uuid-1"
        mock_updated_site.organization_id = 1
        mock_updated_site.organization = mock_org
        mock_updated_site.allocating_organization_id = 2
        mock_updated_site.allocating_organization = mock_allocating_org
        mock_updated_site.allocating_organization_name = "Allocating Org"
        mock_updated_site.status_id = 2
        mock_updated_site.status = mock_validated_status
        mock_updated_site.version = 1
        mock_updated_site.site_code = "SITE001"
        mock_updated_site.site_name = "Test Site"
        mock_updated_site.street_address = "123 Main St"
        mock_updated_site.city = "Vancouver"
        mock_updated_site.postal_code = "V6B 1A1"
        mock_updated_site.latitude = 49.2827
        mock_updated_site.longitude = -123.1207
        mock_updated_site.documents = []
        mock_updated_site.notes = "Test notes"
        mock_updated_site.create_date = None
        mock_updated_site.update_date = None
        mock_updated_site.create_user = "testuser"
        mock_updated_site.update_user = "testuser"

        mock_repo.get_charging_site_by_id.return_value = mock_site
        mock_repo.get_charging_site_status_by_name.return_value = mock_validated_status
        mock_repo.update_charging_site_status.return_value = None
        mock_repo.get_charging_site_by_id.side_effect = [mock_site, mock_updated_site]

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            # Government and Analyst return True so IDIR Analyst path is taken
            mock_has_roles.side_effect = lambda user, roles: (
                RoleEnum.GOVERNMENT in roles or RoleEnum.ANALYST in roles
            )

            body = ChargingSiteManualStatusUpdateSchema(new_status="Validated")
            result = await charging_site_service.update_charging_site_status_manual(
                1, body
            )

            assert result.status.status == "Validated"
            mock_repo.update_charging_site_status.assert_called_once_with(1, 2)

    @pytest.mark.anyio
    async def test_update_charging_site_status_manual_unauthorized(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test user without Government or BCeID roles gets 403."""
        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.return_value = False

            body = ChargingSiteManualStatusUpdateSchema(new_status="Validated")
            with pytest.raises(HTTPException) as exc_info:
                await charging_site_service.update_charging_site_status_manual(
                    1, body
                )

            assert exc_info.value.status_code == 403
            mock_repo.get_charging_site_by_id.assert_not_called()

    @pytest.mark.anyio
    async def test_update_charging_site_status_manual_government_not_analyst_forbidden(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test Government user without Analyst role cannot set status to Validated (403)."""
        mock_request.user.organization = MagicMock()
        mock_request.user.organization.organization_id = 1

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.status = MagicMock()
        mock_site.status.status = "Submitted"

        mock_repo.get_charging_site_by_id.return_value = mock_site

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            # Government True, Analyst False (and not compliance/signing)
            mock_has_roles.side_effect = lambda user, roles: (
                RoleEnum.GOVERNMENT in roles and RoleEnum.ANALYST not in roles
            )

            body = ChargingSiteManualStatusUpdateSchema(new_status="Validated")
            with pytest.raises(HTTPException) as exc_info:
                await charging_site_service.update_charging_site_status_manual(
                    1, body
                )

            assert exc_info.value.status_code == 403
            assert "Only IDIR Analyst" in str(exc_info.value.detail)
            mock_repo.update_charging_site_status.assert_not_called()

    @pytest.mark.anyio
    async def test_update_charging_site_status_manual_invalid_transition_government(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Test IDIR Analyst cannot set status to Validated when current is not Submitted."""
        mock_request.user.organization = MagicMock()
        mock_request.user.organization.organization_id = 1

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.status = MagicMock()
        mock_site.status.status = "Draft"

        mock_repo.get_charging_site_by_id.return_value = mock_site

        with patch(
            "lcfs.web.api.charging_site.services.user_has_roles"
        ) as mock_has_roles:
            mock_has_roles.side_effect = lambda user, roles: (
                RoleEnum.GOVERNMENT in roles or RoleEnum.ANALYST in roles
            )

            body = ChargingSiteManualStatusUpdateSchema(new_status="Validated")
            with pytest.raises(HTTPException) as exc_info:
                await charging_site_service.update_charging_site_status_manual(
                    1, body
                )

            assert exc_info.value.status_code == 400
            mock_repo.update_charging_site_status.assert_not_called()

    @pytest.mark.anyio
    async def test_update_charging_site_validated_creates_new_version(
        self, charging_site_service, mock_repo
    ):
        """Validated charging sites should increment version and move to Updated status."""
        existing_status = MagicMock()
        existing_status.status = "Validated"
        mock_existing_site = MagicMock(spec=ChargingSite)
        mock_existing_site.status = existing_status
        mock_existing_site.site_name = "Old Site"
        mock_existing_site.organization_id = 1
        mock_existing_site.charging_site_id = 1
        mock_existing_site.version = 1
        mock_existing_site.allocating_organization_id = None
        mock_existing_site.allocating_organization_name = None
        mock_existing_site.site_code = "SITE001"
        mock_existing_site.street_address = "123 Main St"
        mock_existing_site.city = "Vancouver"
        mock_existing_site.postal_code = "V6B 1A1"
        mock_existing_site.latitude = 49.2827
        mock_existing_site.longitude = -123.1207
        mock_existing_site.notes = "Test notes"
        mock_existing_site.status_id = 1
        mock_existing_site.group_uuid = "test-uuid"
        mock_existing_site.documents = []
        mock_repo.get_charging_site_by_id.return_value = mock_existing_site
        mock_repo.charging_site_name_exists.return_value = False

        updated_status = MagicMock(spec=ChargingSiteStatus)
        updated_status.charging_site_status_id = 2
        updated_status.status = "Updated"
        updated_status._sa_instance_state = MagicMock()
        mock_repo.get_charging_site_status_by_name.return_value = updated_status

        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_updated_site = MagicMock(spec=ChargingSite)
        mock_updated_site.charging_site_id = 1
        mock_updated_site.group_uuid = "test-uuid"
        mock_updated_site.organization_id = 1
        mock_updated_site.organization = mock_org
        mock_updated_site.allocating_organization = None
        mock_updated_site.allocating_organization_name = None
        mock_updated_site.status = updated_status
        mock_updated_site.status_id = updated_status.charging_site_status_id
        mock_updated_site.version = 2
        mock_updated_site.site_code = "SITE001"
        mock_updated_site.site_name = "Updated Site"
        mock_updated_site.street_address = "123 Main St"
        mock_updated_site.city = "Vancouver"
        mock_updated_site.postal_code = "V6B 1A1"
        mock_updated_site.latitude = 49.2827
        mock_updated_site.longitude = -123.1207
        mock_updated_site.intended_users = []
        mock_updated_site.documents = []
        mock_updated_site.notes = "Test notes"
        mock_updated_site.create_date = None
        mock_updated_site.update_date = None
        mock_updated_site.create_user = "testuser"
        mock_updated_site.update_user = "testuser"

        mock_repo.create_charging_site.return_value = mock_updated_site

        update_data = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Updated Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        result = await charging_site_service.update_charging_site(update_data)

        assert isinstance(result, ChargingSiteSchema)
        assert result.version == 2
        mock_repo.get_charging_site_status_by_name.assert_called_once_with("Updated")
        mock_repo.create_charging_site.assert_called_once()

    @pytest.mark.anyio
    async def test_update_charging_site_duplicate_name(
        self, charging_site_service, mock_repo
    ):
        """Test update charging site duplicate name failure"""
        mock_existing_site = MagicMock(spec=ChargingSite)
        mock_existing_site.status.status = "Draft"
        mock_existing_site.site_name = "Old Site"
        mock_existing_site.organization_id = 1
        mock_existing_site.charging_site_id = 1
        mock_repo.get_charging_site_by_id.return_value = mock_existing_site
        mock_repo.charging_site_name_exists.return_value = True

        update_data = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Updated Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.update_charging_site(update_data)

        assert exc_info.value.status_code == 400
        mock_repo.update_charging_site.assert_not_called()

    @pytest.mark.anyio
    async def test_update_charging_site_not_found(
        self, charging_site_service, mock_repo
    ):
        """Test update charging site when site not found"""
        mock_repo.get_charging_site_by_id.return_value = None

        update_data = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Updated Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.update_charging_site(update_data)

        assert exc_info.value.status_code == 404

    @pytest.mark.anyio
    async def test_update_charging_site_not_draft(
        self, charging_site_service, mock_repo
    ):
        """Test update charging site when not in draft state"""
        mock_existing_site = MagicMock(spec=ChargingSite)
        mock_existing_site.status.status = "Submitted"  # Not draft
        mock_repo.get_charging_site_by_id.return_value = mock_existing_site

        update_data = ChargingSiteCreateSchema(
            charging_site_id=1,
            organization_id=1,
            site_name="Updated Site",
            street_address="123 Main St",
            city="Vancouver",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            intended_users=[],
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.update_charging_site(update_data)

        assert exc_info.value.status_code == 400
        assert "not in draft state" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_delete_charging_site_success(self, charging_site_service, mock_repo):
        """Test successful charging site deletion"""
        mock_repo.delete_charging_site.return_value = None

        await charging_site_service.delete_charging_site(1)

        mock_repo.delete_charging_site.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_get_cs_list_success(self, charging_site_service, mock_repo):
        """Test successful charging sites list retrieval"""
        # Create properly mocked site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.group_uuid = "site-group-1"
        mock_site.organization_id = 1
        mock_site.organization = mock_org
        mock_site.allocating_organization = mock_allocating_org
        mock_site.allocating_organization_name = "Allocating Org"
        mock_site.status_id = 1
        mock_site.status = mock_status
        mock_site.version = 1
        mock_site.site_code = "SITE001"
        mock_site.site_name = "Test Site"
        mock_site.street_address = "123 Main St"
        mock_site.city = "Vancouver"
        mock_site.postal_code = "V6B 1A1"
        mock_site.latitude = 49.2827
        mock_site.longitude = -123.1207
        mock_site.intended_users = []
        mock_site.documents = []
        mock_site.notes = "Test notes"
        mock_site.create_date = None
        mock_site.update_date = None
        mock_site.create_user = "testuser"
        mock_site.update_user = "testuser"

        mock_sites = [mock_site]
        mock_repo.get_all_charging_sites_by_organization_id.return_value = mock_sites

        result = await charging_site_service.get_cs_list(1)

        assert isinstance(result, ChargingSitesSchema)
        assert len(result.charging_sites) == 1
        mock_repo.get_all_charging_sites_by_organization_id.assert_called_once_with(1, government_visible=False)

    @pytest.mark.anyio
    async def test_get_charging_sites_paginated(self, charging_site_service, mock_repo):
        """Test paginated charging sites retrieval"""
        # Create properly mocked site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.group_uuid = "site-group-1"
        mock_site.organization_id = 1
        mock_site.organization = mock_org
        mock_site.allocating_organization = mock_allocating_org
        mock_site.allocating_organization_name = "Allocating Org"
        mock_site.status_id = 1
        mock_site.status = mock_status
        mock_site.version = 1
        mock_site.site_code = "SITE001"
        mock_site.site_name = "Test Site"
        mock_site.street_address = "123 Main St"
        mock_site.city = "Vancouver"
        mock_site.postal_code = "V6B 1A1"
        mock_site.latitude = 49.2827
        mock_site.longitude = -123.1207
        mock_site.intended_users = []
        mock_site.documents = []
        mock_site.notes = "Test notes"
        mock_site.create_date = None
        mock_site.update_date = None
        mock_site.create_user = "testuser"
        mock_site.update_user = "testuser"

        mock_sites = [mock_site]
        mock_repo.get_charging_sites_paginated.return_value = (mock_sites, 1)

        # Create pagination with proper list objects
        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        result = await charging_site_service.get_charging_sites_paginated(pagination, 1)

        assert isinstance(result, ChargingSitesSchema)
        assert len(result.charging_sites) == 1
        assert result.pagination.total == 1

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_success(
        self, charging_site_service, mock_repo, mock_user
    ):
        """Test successful bulk equipment status update"""
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Validated"
        )

        # Mock equipment statuses
        mock_statuses = [
            MagicMock(status="Draft", charging_equipment_status_id=1),
            MagicMock(status="Submitted", charging_equipment_status_id=2),
            MagicMock(status="Validated", charging_equipment_status_id=3),
        ]
        mock_repo.get_charging_equipment_statuses.return_value = mock_statuses

        # Mock site statuses
        mock_site_statuses = [
            MagicMock(status="Draft", charging_site_status_id=1),
            MagicMock(status="Submitted", charging_site_status_id=2),
            MagicMock(status="Validated", charging_site_status_id=3),
        ]
        mock_repo.get_charging_site_statuses.return_value = mock_site_statuses
        mock_site = MagicMock()
        mock_site.charging_site_id = 1
        mock_site.status = MagicMock(status="Submitted")
        mock_repo.get_charging_site_by_id.return_value = mock_site

        mock_repo.bulk_update_equipment_status.return_value = [1, 2]
        mock_repo.update_charging_site_status.return_value = None

        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        assert result is True
        mock_repo.bulk_update_equipment_status.assert_called_once()
        mock_repo.get_charging_site_by_id.assert_called_once_with(1)
        mock_repo.update_charging_site_status.assert_called_once_with(1, 3)

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_site_not_updated_when_disallowed(
        self, charging_site_service, mock_repo, mock_user
    ):
        """Site status should remain unchanged when already validated."""
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Validated"
        )

        mock_statuses = [
            MagicMock(status="Draft", charging_equipment_status_id=1),
            MagicMock(status="Submitted", charging_equipment_status_id=2),
            MagicMock(status="Validated", charging_equipment_status_id=3),
        ]
        mock_repo.get_charging_equipment_statuses.return_value = mock_statuses

        mock_site_statuses = [
            MagicMock(status="Draft", charging_site_status_id=1),
            MagicMock(status="Submitted", charging_site_status_id=2),
            MagicMock(status="Validated", charging_site_status_id=3),
        ]
        mock_repo.get_charging_site_statuses.return_value = mock_site_statuses
        mock_site = MagicMock()
        mock_site.charging_site_id = 1
        mock_site.status = MagicMock(status="Validated")
        mock_repo.get_charging_site_by_id.return_value = mock_site
        mock_repo.bulk_update_equipment_status.return_value = [1, 2]

        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        assert result is True
        mock_repo.update_charging_site_status.assert_not_called()

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_invalid_transition(
        self, charging_site_service, mock_repo, mock_user
    ):
        """Test bulk equipment status update with invalid transition"""
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="InvalidStatus"
        )

        with pytest.raises(ValueError, match="Invalid status: InvalidStatus"):
            await charging_site_service.bulk_update_equipment_status(
                bulk_update, 1, mock_user
            )

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_partial_update(
        self, charging_site_service, mock_repo, mock_user
    ):
        """Test bulk equipment status update with partial success"""
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Validated"
        )

        # Mock equipment statuses
        mock_statuses = [
            MagicMock(status="Draft", charging_equipment_status_id=1),
            MagicMock(status="Submitted", charging_equipment_status_id=2),
            MagicMock(status="Validated", charging_equipment_status_id=3),
        ]
        mock_repo.get_charging_equipment_statuses.return_value = mock_statuses

        # Only one equipment updated (partial success)
        mock_repo.bulk_update_equipment_status.return_value = [1]  # Only ID 1 updated

        with pytest.raises(
            ValueError, match="Equipment can only be changed to Validated"
        ):
            await charging_site_service.bulk_update_equipment_status(
                bulk_update, 1, mock_user
            )

    @pytest.mark.anyio
    async def test_get_charging_site_equipment_paginated(
        self, charging_site_service, mock_repo
    ):
        """Test getting paginated charging equipment for a site"""
        # Create properly mocked equipment with all required fields
        mock_status = MagicMock()
        mock_status.charging_equipment_status_id = 1
        mock_status.status = "Draft"
        mock_status.description = "Draft status"

        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_level = MagicMock()
        mock_level.level_of_equipment_id = 1
        mock_level.name = "Level 2"
        mock_level.description = "Level 2 charging"
        mock_level.display_order = 1

        # Create a proper ChargingSiteCreateSchema-compatible mock with camelCase fields
        mock_charging_site = MagicMock()
        mock_charging_site.charging_site_id = 1
        mock_charging_site.group_uuid = "site-group-1"
        mock_charging_site.groupUuid = "site-group-1"
        mock_charging_site.organization_id = 1
        mock_charging_site.allocating_organization_name = "Allocating Org"
        mock_charging_site.allocatingOrganizationName = "Allocating Org"  # camelCase version
        mock_charging_site.status_id = 1
        mock_charging_site.current_status = "Draft"
        mock_charging_site.currentStatus = "Draft"  # camelCase version
        mock_charging_site.site_name = "Test Site"
        mock_charging_site.siteName = "Test Site"  # camelCase version
        mock_charging_site.site_code = "SITE001"
        mock_charging_site.siteCode = "SITE001"  # camelCase version
        mock_charging_site.street_address = "123 Main St"
        mock_charging_site.streetAddress = "123 Main St"  # camelCase version
        mock_charging_site.city = "Vancouver"
        mock_charging_site.postal_code = "V6B 1A1"
        mock_charging_site.postalCode = "V6B 1A1"  # camelCase version
        mock_charging_site.latitude = 49.2827
        mock_charging_site.longitude = -123.1207
        mock_charging_site.intended_users = []
        mock_charging_site.notes = "Test notes"
        mock_charging_site.deleted = None

        mock_equipment = MagicMock(spec=ChargingEquipment)
        mock_equipment.charging_equipment_id = 1
        mock_equipment.charging_site_id = 1
        mock_equipment.status = mock_status
        mock_equipment.equipment_number = "EQ001"
        mock_equipment.organization_name = "Test Org"
        mock_equipment.allocating_organization = mock_org
        mock_equipment.registration_number = "REG001"
        mock_equipment.version = 1
        mock_equipment.serial_number = "SN001"
        mock_equipment.manufacturer = "Test Manufacturer"
        mock_equipment.model = "Test Model"
        mock_equipment.level_of_equipment = mock_level
        mock_equipment.ports = "Single port"
        mock_equipment.intended_use_types = []
        mock_equipment.notes = "Test notes"
        mock_equipment.charging_site = mock_charging_site

        mock_repo.get_equipment_for_charging_site_paginated.return_value = (
            [mock_equipment],
            1,
        )
        mock_repo.get_charging_site_by_id.return_value = MagicMock(charging_site_id=1)

        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        result = await charging_site_service.get_charging_site_equipment_paginated(
            1, pagination
        )

        assert len(result.equipments) == 1
        assert result.pagination.total == 1
        mock_repo.get_equipment_for_charging_site_paginated.assert_called_once_with(
            1, pagination, False
        )

    @pytest.mark.anyio
    async def test_get_charging_site_equipment_history_paginated(
        self, charging_site_service, mock_repo
    ):
        mock_status = MagicMock()
        mock_status.charging_equipment_status_id = 1
        mock_status.status = "Validated"
        mock_status.description = "Validated status"

        mock_level = MagicMock()
        mock_level.level_of_equipment_id = 1
        mock_level.name = "Level 3"
        mock_level.description = "Fast charging"
        mock_level.display_order = 1

        mock_charging_site = MagicMock()
        mock_charging_site.charging_site_id = 1
        mock_charging_site.group_uuid = "site-group-1"
        mock_charging_site.organization_id = 1
        mock_charging_site.allocating_organization_name = "Allocating Org"
        mock_charging_site.site_name = "Test Site"
        mock_charging_site.site_code = "SITE001"
        mock_charging_site.street_address = "123 Main St"
        mock_charging_site.city = "Vancouver"
        mock_charging_site.postal_code = "V6B 1A1"
        mock_charging_site.latitude = 49.2827
        mock_charging_site.longitude = -123.1207
        mock_charging_site.intended_users = []
        mock_charging_site.notes = "Test notes"

        current_equipment = MagicMock(spec=ChargingEquipment)
        current_equipment.charging_equipment_id = 11
        current_equipment.charging_site_id = 1
        current_equipment.status = mock_status
        current_equipment.equipment_number = "REG001"
        current_equipment.organization_name = "Test Org"
        current_equipment.registration_number = "REG001"
        current_equipment.version = 3
        current_equipment.serial_number = "SN001"
        current_equipment.manufacturer = "Current Manufacturer"
        current_equipment.model = "Current Model"
        current_equipment.level_of_equipment = mock_level
        current_equipment.ports = "2"
        current_equipment.intended_uses = []
        current_equipment.intended_users = []
        current_equipment.notes = "Current notes"
        current_equipment.charging_site = mock_charging_site
        current_equipment.compliance_years = ["2024"]

        previous_equipment = MagicMock(spec=ChargingEquipment)
        previous_equipment.charging_equipment_id = 10
        previous_equipment.charging_site_id = 1
        previous_equipment.status = mock_status
        previous_equipment.equipment_number = "REG001"
        previous_equipment.organization_name = "Test Org"
        previous_equipment.registration_number = "REG001"
        previous_equipment.version = 2
        previous_equipment.serial_number = "SN000"
        previous_equipment.manufacturer = "Previous Manufacturer"
        previous_equipment.model = "Previous Model"
        previous_equipment.level_of_equipment = mock_level
        previous_equipment.ports = "1"
        previous_equipment.intended_uses = []
        previous_equipment.intended_users = []
        previous_equipment.notes = "Previous notes"
        previous_equipment.charging_site = mock_charging_site
        previous_equipment.compliance_years = ["2023"]

        mock_repo.get_charging_site_by_id.return_value = MagicMock(charging_site_id=1)
        mock_repo.get_equipment_history_for_charging_site_paginated.return_value = (
            [current_equipment, previous_equipment],
            2,
        )

        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        result = await charging_site_service.get_charging_site_equipment_history_paginated(
            1, pagination
        )

        assert isinstance(result, ChargingEquipmentPaginatedSchema)
        assert len(result.equipments) == 2
        assert result.equipments[0].compliance_years == ["2024"]
        assert result.equipments[1].compliance_years == ["2023"]
        mock_repo.get_equipment_history_for_charging_site_paginated.assert_called_once_with(
            1, pagination
        )

    @pytest.mark.anyio
    async def test_get_all_charging_sites_paginated(
        self, charging_site_service, mock_repo
    ):
        """Test getting all charging sites paginated"""
        # Create properly mocked site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_allocating_org = MagicMock()
        mock_allocating_org.organization_id = 2
        mock_allocating_org.name = "Allocating Org"

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.group_uuid = "site-group-1"
        mock_site.organization_id = 1
        mock_site.organization = mock_org
        mock_site.allocating_organization = mock_allocating_org
        mock_site.allocating_organization_name = "Allocating Org"
        mock_site.status_id = 1
        mock_site.status = mock_status
        mock_site.version = 1
        mock_site.site_code = "SITE001"
        mock_site.site_name = "Test Site"
        mock_site.street_address = "123 Main St"
        mock_site.city = "Vancouver"
        mock_site.postal_code = "V6B 1A1"
        mock_site.latitude = 49.2827
        mock_site.longitude = -123.1207
        mock_site.intended_users = []
        mock_site.documents = []
        mock_site.notes = "Test notes"
        mock_site.create_date = None
        mock_site.update_date = None
        mock_site.create_user = "testuser"
        mock_site.update_user = "testuser"

        mock_sites = [mock_site]
        mock_repo.get_all_charging_sites_paginated.return_value = (mock_sites, 1)

        # Create pagination with proper list objects
        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        result = await charging_site_service.get_all_charging_sites_paginated(
            pagination
        )

        assert isinstance(result, ChargingSitesSchema)
        assert len(result.charging_sites) == 1
        assert result.pagination.total == 1
        # With no filters supplied, service should not add implicit status conditions
        args, _ = mock_repo.get_all_charging_sites_paginated.call_args
        assert args[2] == []

    @pytest.mark.anyio
    async def test_get_all_charging_sites_paginated_with_org_filter(
        self, charging_site_service, mock_repo
    ):
        """Ensure organization name filters are converted to query conditions"""
        mock_repo.get_all_charging_sites_paginated.return_value = ([], 0)

        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(field="organization", filter="Test Org", type="contains")
            ],
        )

        await charging_site_service.get_all_charging_sites_paginated(pagination)

        args, _ = mock_repo.get_all_charging_sites_paginated.call_args
        conditions = args[2]
        assert len(conditions) == 1
        assert "organization" in str(conditions[0]).lower()

    @pytest.mark.anyio
    async def test_get_all_charging_sites_paginated_with_allocating_org_filter(
        self, charging_site_service, mock_repo
    ):
        """Ensure allocating organization filters include correlated expressions"""
        mock_repo.get_all_charging_sites_paginated.return_value = ([], 0)

        pagination = PaginationRequestSchema(
            page=1,
            size=10,
            sort_orders=[],
            filters=[
                FilterModel(
                    field="allocatingOrganization",
                    filter="Alloc Org",
                    type="contains",
                )
            ],
        )

        await charging_site_service.get_all_charging_sites_paginated(pagination)

        args, _ = mock_repo.get_all_charging_sites_paginated.call_args
        conditions = args[2]
        assert len(conditions) == 1
        assert "allocating" in str(conditions[0]).lower()

    @pytest.mark.anyio
    async def test_delete_all_charging_sites(self, charging_site_service, mock_repo):
        """Test deleting all charging sites for an organization"""
        mock_repo.delete_all_charging_sites_by_organization.return_value = None

        await charging_site_service.delete_all_charging_sites(1)

        mock_repo.delete_all_charging_sites_by_organization.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_get_equipment_status_ids_helper(self, charging_site_service):
        """Test the helper method for getting equipment status IDs"""
        mock_statuses = [
            MagicMock(status="Draft", charging_equipment_status_id=1),
            MagicMock(status="Submitted", charging_equipment_status_id=2),
        ]

        result = charging_site_service._get_equipment_status_ids(mock_statuses)

        assert result["Draft"] == 1
        assert result["Submitted"] == 2

    @pytest.mark.anyio
    async def test_get_site_status_ids_helper(self, charging_site_service):
        """Test the helper method for getting site status IDs"""
        mock_statuses = [
            MagicMock(status="Draft", charging_site_status_id=1),
            MagicMock(status="Submitted", charging_site_status_id=2),
        ]

        result = charging_site_service._get_site_status_ids(mock_statuses)

        assert result["Draft"] == 1
        assert result["Submitted"] == 2

    @pytest.mark.anyio
    async def test_get_site_names_by_organization_success(
        self, charging_site_service, mock_repo
    ):
        """Test successful retrieval of site names by organization"""
        # Mock site data with site_name and charging_site_id attributes
        mock_site1 = MagicMock()
        mock_site1.site_name = "Site 1"
        mock_site1.charging_site_id = 1

        mock_site2 = MagicMock()
        mock_site2.site_name = "Site 2"
        mock_site2.charging_site_id = 2

        mock_sites = [mock_site1, mock_site2]
        mock_repo.get_site_names_by_organization.return_value = mock_sites

        result = await charging_site_service.get_site_names_by_organization(1)

        assert len(result) == 2
        assert result[0] == {"siteName": "Site 1", "chargingSiteId": 1}
        assert result[1] == {"siteName": "Site 2", "chargingSiteId": 2}
        mock_repo.get_site_names_by_organization.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_get_site_names_by_organization_empty(
        self, charging_site_service, mock_repo
    ):
        """Test retrieval of site names when no sites exist"""
        mock_repo.get_site_names_by_organization.return_value = []

        result = await charging_site_service.get_site_names_by_organization(1)

        assert len(result) == 0
        assert result == []
        mock_repo.get_site_names_by_organization.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_search_allocation_organizations_success(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Matched orgs carry an organizationId; freeform names carry None."""
        mock_request.user.organization.name = "My Org"

        mock_org1 = MagicMock(spec=Organization)
        mock_org1.organization_id = 2
        mock_org1.name = "ABC Company"

        mock_org2 = MagicMock(spec=Organization)
        mock_org2.organization_id = 3
        mock_org2.name = "ABC Corporation"

        mock_repo.get_allocation_agreement_organizations.return_value = [mock_org1, mock_org2]
        # get_allocating_organization_names returns the merged, deduped list from the repo
        mock_repo.get_allocating_organization_names.return_value = [
            "ABC Company",
            "ABC Corporation",
            "ABC Partner A",
            "ABC Partner B",
            "ABC Historical C",
        ]

        result = await charging_site_service.search_allocation_organizations(1, "abc")

        assert len(result) == 5
        names = [r["name"] for r in result]
        assert "ABC Company" in names
        assert "ABC Corporation" in names

        # Matched orgs resolve to their IDs; freeform names have None
        by_name = {r["name"]: r for r in result}
        assert by_name["ABC Company"]["organizationId"] == 2
        assert by_name["ABC Corporation"]["organizationId"] == 3
        assert by_name["ABC Partner A"]["organizationId"] is None

        mock_repo.get_allocation_agreement_organizations.assert_called_once_with(1)
        mock_repo.get_allocating_organization_names.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_search_allocation_organizations_excludes_own_org_by_name(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Own organization must never appear in search results, even as freeform text."""
        mock_request.user.organization.name = "My Org"

        mock_repo.get_allocation_agreement_organizations.return_value = []
        mock_repo.get_allocating_organization_names.return_value = [
            "My Org",       # own org — must be excluded
            "my org",       # case variant — must also be excluded
            "Partner Org",
        ]

        result = await charging_site_service.search_allocation_organizations(1, "")

        names = [r["name"] for r in result]
        assert "My Org" not in names
        assert "my org" not in names
        assert "Partner Org" in names
        assert len(result) == 1

    @pytest.mark.anyio
    async def test_search_allocation_organizations_with_query_filter(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Query string filters results case-insensitively."""
        mock_request.user.organization.name = "My Org"

        mock_repo.get_allocation_agreement_organizations.return_value = []
        mock_repo.get_allocating_organization_names.return_value = [
            "ABC Company",
            "XYZ Corporation",
            "ABC Partner",
        ]

        result = await charging_site_service.search_allocation_organizations(1, "abc")

        assert len(result) == 2
        assert all("abc" in r["name"].lower() for r in result)

    @pytest.mark.anyio
    async def test_search_allocation_organizations_empty_query(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Empty query returns all names (minus own org)."""
        mock_request.user.organization.name = "My Org"

        mock_repo.get_allocation_agreement_organizations.return_value = []
        mock_repo.get_allocating_organization_names.return_value = [
            "Partner A",
            "Historical B",
            "Historical C",
        ]

        result = await charging_site_service.search_allocation_organizations(1, "")

        assert len(result) == 3

    @pytest.mark.anyio
    async def test_search_allocation_organizations_limits_results(
        self, charging_site_service, mock_repo, mock_request
    ):
        """Results are capped at 50."""
        mock_request.user.organization.name = "My Org"

        mock_repo.get_allocation_agreement_organizations.return_value = []
        mock_repo.get_allocating_organization_names.return_value = [
            f"Org {i:02d}" for i in range(60)
        ]

        result = await charging_site_service.search_allocation_organizations(1, "org")

        assert len(result) == 50

    @pytest.mark.anyio
    async def test_search_allocation_organizations_exception(
        self, charging_site_service, mock_repo
    ):
        """Database errors are wrapped in a 500 HTTPException."""
        mock_repo.get_allocation_agreement_organizations.side_effect = Exception(
            "Database error"
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.search_allocation_organizations(1, "test")

        assert exc_info.value.status_code == 500
