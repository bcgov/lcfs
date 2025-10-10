import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.exception.exceptions import DatabaseException
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingEquipmentStatus,
    ChargingSite,
    ChargingSiteStatus,
    EndUserType
)


@pytest.fixture
def mock_db_session():
    """Mock database session for testing"""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def charging_site_repo(mock_db_session):
    """ChargingSiteRepository instance with mocked database session"""
    return ChargingSiteRepository(db=mock_db_session)


@pytest.fixture
def mock_equipment_list():
    """Mock equipment list for testing"""
    return [MagicMock(spec=ChargingEquipment), MagicMock(spec=ChargingEquipment)]


class TestChargingSiteRepository:
    """Test class for ChargingSiteRepository functionality"""

    @pytest.mark.anyio
    async def test_get_intended_user_types(self, charging_site_repo, mock_db_session):
        """Test getting intended user types"""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [MagicMock(spec=EndUserType)]
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_intended_user_types()
        
        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_site_by_id(self, charging_site_repo, mock_db_session):
        """Test getting charging site by ID"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_site
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_charging_site_by_id(1)
        
        assert result == mock_site
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status(
        self, charging_site_repo, mock_db_session
    ):
        """Test bulk update equipment status"""
        equipment_ids = [1, 2]
        new_status_id = 2
        allowed_source_status_ids = [1]
        
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(1,), (2,)]
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.bulk_update_equipment_status(
            equipment_ids, new_status_id, allowed_source_status_ids
        )
        
        assert result == [1, 2]
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_equipment_for_charging_site_paginated(
        self, charging_site_repo, mock_db_session, mock_equipment_list
    ):
        """Test getting paginated equipment for charging site"""
        # Create pagination with proper list objects instead of Query objects
        pagination = PaginationRequestSchema(
            page=1, 
            size=10, 
            sort_orders=[], 
            filters=[]
        )
        
        # Mock count query
        mock_db_session.scalar.return_value = 2
        
        # Mock equipment query
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = mock_equipment_list
        mock_db_session.execute.return_value = mock_result
        
        equipment, total_count = await charging_site_repo.get_equipment_for_charging_site_paginated(
            1, pagination
        )
        
        assert len(equipment) == 2
        assert total_count == 2

    @pytest.mark.anyio
    async def test_get_charging_sites(self, charging_site_repo, mock_db_session):
        """Test getting charging sites"""
        mock_sites = [MagicMock(spec=ChargingSite)]
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = mock_sites
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_charging_sites()
        
        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_sites_with_organization_filter(self, charging_site_repo, mock_db_session):
        """Test getting charging sites filtered by organization"""
        mock_sites = [MagicMock(spec=ChargingSite)]
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = mock_sites
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_charging_sites(organization_id=1)
        
        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_create_charging_site(self, charging_site_repo, mock_db_session):
        """Test creating a charging site"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_db_session.add.return_value = None
        mock_db_session.flush.return_value = None
        
        result = await charging_site_repo.create_charging_site(mock_site)
        
        assert result == mock_site
        mock_db_session.add.assert_called_once_with(mock_site)
        mock_db_session.flush.assert_called_once()

    @pytest.mark.anyio
    async def test_update_charging_site(self, charging_site_repo, mock_db_session):
        """Test updating a charging site"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_db_session.merge.return_value = mock_site
        mock_db_session.flush.return_value = None
        mock_db_session.refresh.return_value = None
        
        result = await charging_site_repo.update_charging_site(mock_site)
        
        assert result == mock_site
        mock_db_session.merge.assert_called_once_with(mock_site)
        mock_db_session.flush.assert_called_once()
        mock_db_session.refresh.assert_called_once_with(mock_site)

    @pytest.mark.anyio
    async def test_delete_charging_site(self, charging_site_repo, mock_db_session):
        """Test deleting a charging site"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.intended_users = []
        mock_site.documents = []
        mock_site.charging_equipment = []
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_site
        mock_db_session.execute.return_value = mock_result
        mock_db_session.delete.return_value = None
        mock_db_session.flush.return_value = None
        mock_db_session.commit.return_value = None
        
        await charging_site_repo.delete_charging_site(1)
        
        mock_db_session.delete.assert_called_once_with(mock_site)
        mock_db_session.flush.assert_called_once()
        mock_db_session.commit.assert_called_once()

    @pytest.mark.anyio
    async def test_delete_charging_site_not_found(self, charging_site_repo, mock_db_session):
        """Test deleting a charging site that doesn't exist"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result
        
        with pytest.raises(DatabaseException):
            await charging_site_repo.delete_charging_site(1)

    @pytest.mark.anyio
    async def test_get_charging_site_by_site_name(self, charging_site_repo, mock_db_session):
        """Test getting charging site by site name"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_site
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_charging_site_by_site_name("Test Site")
        
        assert result == mock_site
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_site_status_by_name(self, charging_site_repo, mock_db_session):
        """Test getting charging site status by name"""
        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_status
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_charging_site_status_by_name("Draft")
        
        assert result == mock_status
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_update_charging_site_status(self, charging_site_repo, mock_db_session):
        """Test updating charging site status"""
        mock_db_session.execute.return_value = None
        
        await charging_site_repo.update_charging_site_status(1, 2)
        
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_site_options(self, charging_site_repo, mock_db_session):
        """Test getting charging site options"""
        mock_statuses = [MagicMock(spec=ChargingSiteStatus)]
        mock_users = [MagicMock(spec=EndUserType)]
        
        # Mock the individual method calls
        charging_site_repo.get_charging_site_statuses = AsyncMock(return_value=mock_statuses)
        charging_site_repo.get_intended_user_types = AsyncMock(return_value=mock_users)
        
        result = await charging_site_repo.get_charging_site_options(MagicMock())
        
        assert len(result) == 2
        assert result[0] == mock_statuses
        assert result[1] == mock_users

    @pytest.mark.anyio
    async def test_get_site_names_by_organization(self, charging_site_repo, mock_db_session):
        """Test getting site names by organization"""
        # Mock the result with site_name and charging_site_id
        mock_result = MagicMock()
        mock_result.all.return_value = [
            ("Site 1", 1),
            ("Site 2", 2),
        ]
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_site_names_by_organization(1)
        
        assert len(result) == 2
        assert result[0] == ("Site 1", 1)
        assert result[1] == ("Site 2", 2)
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_site_names_by_organization_empty(self, charging_site_repo, mock_db_session):
        """Test getting site names when no sites exist for organization"""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db_session.execute.return_value = mock_result
        
        result = await charging_site_repo.get_site_names_by_organization(999)
        
        assert len(result) == 0
        assert result == []
        mock_db_session.execute.assert_called_once()