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
    ChargingSiteSchema,
    ChargingSitesSchema,
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
            mock_repo.get_charging_site_by_id.assert_called_once_with(1)

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
        mock_repo.get_all_charging_sites_by_organization_id.assert_called_once_with(1)

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
        self, charging_site_service, mock_repo
    ):
        """Test successful search for allocation organizations"""
        # Mock matched organizations
        mock_org1 = MagicMock(spec=Organization)
        mock_org1.organization_id = 1
        mock_org1.name = "ABC Company"

        mock_org2 = MagicMock(spec=Organization)
        mock_org2.organization_id = 2
        mock_org2.name = "ABC Corporation"

        mock_repo.get_allocation_agreement_organizations.return_value = [
            mock_org1,
            mock_org2,
        ]

        # Mock transaction partners
        mock_repo.get_transaction_partners_from_allocation_agreements.return_value = [
            "ABC Company",  # Duplicate - should be filtered
            "ABC Partner A",
            "ABC Partner B",
        ]

        # Mock historical names
        mock_repo.get_distinct_allocating_organization_names.return_value = [
            "ABC Corporation",  # Duplicate - should be filtered
            "ABC Historical C",
        ]

        result = await charging_site_service.search_allocation_organizations(1, "abc")

        assert len(result) == 5  # 2 matched + 3 unmatched (duplicates removed)
        assert result[0]["name"] == "ABC Company"
        assert result[0]["organizationId"] == 1
        assert result[1]["name"] == "ABC Corporation"
        assert result[1]["organizationId"] == 2

        # Verify unmatched entries have None as organizationId
        unmatched = [r for r in result if r["organizationId"] is None]
        assert len(unmatched) == 3

        mock_repo.get_allocation_agreement_organizations.assert_called_once_with(1)
        mock_repo.get_transaction_partners_from_allocation_agreements.assert_called_once_with(
            1
        )
        mock_repo.get_distinct_allocating_organization_names.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_search_allocation_organizations_with_query_filter(
        self, charging_site_service, mock_repo
    ):
        """Test search filters results by query string"""
        mock_org1 = MagicMock(spec=Organization)
        mock_org1.organization_id = 1
        mock_org1.name = "ABC Company"

        mock_org2 = MagicMock(spec=Organization)
        mock_org2.organization_id = 2
        mock_org2.name = "XYZ Corporation"

        mock_repo.get_allocation_agreement_organizations.return_value = [
            mock_org1,
            mock_org2,
        ]
        mock_repo.get_transaction_partners_from_allocation_agreements.return_value = [
            "ABC Partner"
        ]
        mock_repo.get_distinct_allocating_organization_names.return_value = [
            "XYZ Historical"
        ]

        # Search for "abc" - should only return ABC entries
        result = await charging_site_service.search_allocation_organizations(1, "abc")

        assert len(result) == 2
        assert all("abc" in r["name"].lower() for r in result)

    @pytest.mark.anyio
    async def test_search_allocation_organizations_empty_query(
        self, charging_site_service, mock_repo
    ):
        """Test search with empty query returns all results"""
        mock_org = MagicMock(spec=Organization)
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_repo.get_allocation_agreement_organizations.return_value = [mock_org]
        mock_repo.get_transaction_partners_from_allocation_agreements.return_value = [
            "Partner A"
        ]
        mock_repo.get_distinct_allocating_organization_names.return_value = [
            "Historical B"
        ]

        result = await charging_site_service.search_allocation_organizations(1, "")

        assert len(result) == 3  # All results returned

    @pytest.mark.anyio
    async def test_search_allocation_organizations_limits_results(
        self, charging_site_service, mock_repo
    ):
        """Test search limits results to 50"""
        # Create 60 mock organizations
        mock_orgs = []
        for i in range(60):
            mock_org = MagicMock(spec=Organization)
            mock_org.organization_id = i
            mock_org.name = f"Org {i:02d}"
            mock_orgs.append(mock_org)

        mock_repo.get_allocation_agreement_organizations.return_value = mock_orgs
        mock_repo.get_transaction_partners_from_allocation_agreements.return_value = []
        mock_repo.get_distinct_allocating_organization_names.return_value = []

        result = await charging_site_service.search_allocation_organizations(1, "org")

        assert len(result) == 50  # Limited to 50

    @pytest.mark.anyio
    async def test_search_allocation_organizations_exception(
        self, charging_site_service, mock_repo
    ):
        """Test search handles exceptions properly"""
        mock_repo.get_allocation_agreement_organizations.side_effect = Exception(
            "Database error"
        )

        with pytest.raises(HTTPException) as exc_info:
            await charging_site_service.search_allocation_organizations(1, "test")

        assert exc_info.value.status_code == 500
