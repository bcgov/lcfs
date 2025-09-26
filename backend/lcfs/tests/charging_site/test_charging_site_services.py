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
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingSite,
    ChargingSiteStatus,
    ChargingEquipmentStatus,
    EndUserType,
)


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

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.organization = mock_org
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

        # Mock the created site
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_repo.create_charging_site.return_value = mock_site

        # Mock the retrieved site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_status_obj = MagicMock()
        mock_status_obj.charging_site_status_id = 1
        mock_status_obj.status = "Draft"

        mock_retrieved_site = MagicMock(spec=ChargingSite)
        mock_retrieved_site.charging_site_id = 1
        mock_retrieved_site.organization_id = 1
        mock_retrieved_site.organization = mock_org
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

    @pytest.mark.anyio
    async def test_update_charging_site_success(self, charging_site_service, mock_repo):
        """Test successful charging site update"""
        mock_existing_site = MagicMock(spec=ChargingSite)
        mock_existing_site.status.status = "Draft"
        mock_repo.get_charging_site_by_id.return_value = mock_existing_site

        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_status.charging_site_status_id = 1
        mock_repo.get_charging_site_status_by_name.return_value = mock_status
        mock_repo.get_end_user_types_by_ids.return_value = []

        # Mock the updated site with all required fields
        mock_org = MagicMock()
        mock_org.organization_id = 1
        mock_org.name = "Test Org"

        mock_status_obj = MagicMock()
        mock_status_obj.charging_site_status_id = 1
        mock_status_obj.status = "Draft"

        mock_updated_site = MagicMock(spec=ChargingSite)
        mock_updated_site.charging_site_id = 1
        mock_updated_site.organization_id = 1
        mock_updated_site.organization = mock_org
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

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.organization = mock_org
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

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.organization = mock_org
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

        mock_repo.bulk_update_equipment_status.return_value = [1, 2]
        mock_repo.update_charging_site_status.return_value = None

        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        assert result is True
        mock_repo.bulk_update_equipment_status.assert_called_once()
        mock_repo.update_charging_site_status.assert_called_once_with(1, 3)

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

        mock_status = MagicMock()
        mock_status.charging_site_status_id = 1
        mock_status.status = "Draft"

        mock_site = MagicMock(spec=ChargingSite)
        mock_site.charging_site_id = 1
        mock_site.organization_id = 1
        mock_site.organization = mock_org
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
