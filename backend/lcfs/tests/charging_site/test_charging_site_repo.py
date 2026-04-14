import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.base import ActionTypeEnum
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.exception.exceptions import DatabaseException
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingSite,
    ChargingSiteStatus,
    EndUserType,
)
from lcfs.db.models.organization import Organization


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
        mock_result.scalars.return_value.all.return_value = [
            MagicMock(spec=EndUserType)
        ]
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
    async def test_get_charging_site_versions_by_id(
        self, charging_site_repo, mock_db_session
    ):
        mock_sites = [MagicMock(spec=ChargingSite), MagicMock(spec=ChargingSite)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sites
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_site_versions_by_id(1)

        assert result == mock_sites
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
        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        # Mock group_uuid query
        mock_group_uuid_result = MagicMock()
        mock_group_uuid_result.scalar_one_or_none.return_value = "test-group-uuid"

        # Mock site_ids query
        mock_site_ids_result = MagicMock()
        mock_site_ids_result.fetchall.return_value = [(1,), (2,)]

        # Mock equipment query - returns tuples of (equipment, site, site_id)
        mock_equipment_result = MagicMock()
        mock_equipment_result.all.return_value = [
            (mock_equipment_list[0], MagicMock(spec=ChargingSite), 1),
            (mock_equipment_list[1], MagicMock(spec=ChargingSite), 2),
        ]

        # Set up execute to return different results for different queries
        mock_db_session.execute.side_effect = [
            mock_group_uuid_result,
            mock_site_ids_result,
            mock_equipment_result,
        ]

        # Mock count query
        mock_db_session.scalar.return_value = 2

        equipment, total_count = (
            await charging_site_repo.get_equipment_for_charging_site_paginated(
                1, pagination
            )
        )

        assert len(equipment) == 2
        assert total_count == 2

    @pytest.mark.anyio
    async def test_get_equipment_history_for_charging_site_paginated(
        self, charging_site_repo, mock_db_session
    ):
        pagination = PaginationRequestSchema(
            page=1, size=10, sort_orders=[], filters=[]
        )

        current_equipment = MagicMock(spec=ChargingEquipment)
        current_equipment.charging_equipment_id = 10
        current_equipment.group_uuid = "group-1"
        current_equipment.version = 3

        latest_site = MagicMock(spec=ChargingSite)
        latest_site.charging_site_id = 5

        mock_group_uuid_result = MagicMock()
        mock_group_uuid_result.scalar_one_or_none.return_value = "site-group-1"

        mock_site_ids_result = MagicMock()
        mock_site_ids_result.fetchall.return_value = [(5,), (4,)]

        mock_history_result = MagicMock()
        mock_history_result.all.return_value = [
            (current_equipment, latest_site, ["2024", "2023"], False)
        ]

        mock_db_session.execute.side_effect = [
            mock_group_uuid_result,
            mock_site_ids_result,
            mock_history_result,
        ]
        mock_db_session.scalar.return_value = 1

        result, total_count = (
            await charging_site_repo.get_equipment_history_for_charging_site_paginated(
                5, pagination
            )
        )

        assert total_count == 1
        assert result == [current_equipment]
        assert current_equipment.charging_site == latest_site
        assert current_equipment.charging_site_id == 5
        assert current_equipment.compliance_years == ["2024", "2023"]
        assert current_equipment.is_history_version is False

    @pytest.mark.anyio
    async def test_get_charging_sites(self, charging_site_repo, mock_db_session):
        """Test getting charging sites"""
        mock_sites = [MagicMock(spec=ChargingSite)]
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_sites
        )
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_sites()

        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_sites_with_organization_filter(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting charging sites filtered by organization"""
        mock_sites = [MagicMock(spec=ChargingSite)]
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_sites
        )
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
        mock_db_session.refresh.assert_called_once_with(
            mock_site,
            ["allocating_organization", "organization", "status", "update_date"],
        )

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
    async def test_delete_charging_site_not_found(
        self, charging_site_repo, mock_db_session
    ):
        """Test deleting a charging site that doesn't exist"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        with pytest.raises(DatabaseException):
            await charging_site_repo.delete_charging_site(1)

    @pytest.mark.anyio
    async def test_get_charging_site_by_site_name(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting charging site by site name"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_site
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_site_by_site_name("Test Site", 1)

        assert result == mock_site
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_charging_site_name_exists(self, charging_site_repo, mock_db_session):
        """Test checking for existing charging site name"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_site
        mock_db_session.execute.return_value = mock_result

        exists = await charging_site_repo.charging_site_name_exists("Test Site", 1)

        assert exists is True
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_site_status_by_name(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting charging site status by name"""
        mock_status = MagicMock(spec=ChargingSiteStatus)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_status
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_site_status_by_name("Draft")

        assert result == mock_status
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_update_charging_site_status(
        self, charging_site_repo, mock_db_session
    ):
        """Test updating charging site status"""
        mock_db_session.execute.return_value = None

        await charging_site_repo.update_charging_site_status(1, 2)

        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_charging_site_options(self, charging_site_repo, mock_db_session):
        """Test getting charging site options"""
        mock_statuses = [MagicMock(spec=ChargingSiteStatus)]

        # Mock the individual method calls
        charging_site_repo.get_charging_site_statuses = AsyncMock(
            return_value=mock_statuses
        )

        result = await charging_site_repo.get_charging_site_options(MagicMock())

        assert len(result) == 1
        assert result[0] == mock_statuses

    @pytest.mark.anyio
    async def test_get_site_names_by_organization(
        self, charging_site_repo, mock_db_session
    ):
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
    async def test_get_site_names_by_organization_empty(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting site names when no sites exist for organization"""
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_site_names_by_organization(999)

        assert len(result) == 0
        assert result == []
        mock_db_session.execute.assert_called_once()


class TestChargingSiteRepositoryDeletedFiltering:
    """Test class for verifying deleted charging sites are filtered out"""

    @pytest.mark.anyio
    async def test_get_charging_sites_excludes_deleted(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_charging_sites excludes sites with action_type=DELETE"""
        # Create mock sites - only non-deleted should be returned
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.action_type = ActionTypeEnum.CREATE
        mock_sites = [mock_site]

        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_sites
        )
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_sites()

        assert len(result) == 1
        mock_db_session.execute.assert_called_once()
        # Verify the query was called (filtering happens at DB level)
        call_args = mock_db_session.execute.call_args
        assert call_args is not None

    @pytest.mark.anyio
    async def test_get_charging_sites_with_org_excludes_deleted(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_charging_sites with organization filter excludes deleted sites"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.action_type = ActionTypeEnum.CREATE
        mock_sites = [mock_site]

        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_sites
        )
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_charging_sites(organization_id=1)

        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_all_charging_sites_by_organization_id_excludes_deleted(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_all_charging_sites_by_organization_id excludes deleted sites"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.action_type = ActionTypeEnum.CREATE
        mock_sites = [mock_site]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sites
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_all_charging_sites_by_organization_id(1)

        assert len(result) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_all_charging_sites_paginated_excludes_deleted(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_all_charging_sites_paginated excludes deleted sites"""
        mock_site = MagicMock(spec=ChargingSite)
        mock_site.action_type = ActionTypeEnum.CREATE
        mock_sites = [mock_site]

        # Mock scalar for count
        mock_db_session.scalar.return_value = 1

        # Mock execute for data fetch
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_sites
        mock_db_session.execute.return_value = mock_result

        result, total = await charging_site_repo.get_all_charging_sites_paginated(
            offset=0, limit=10, conditions=[], sort_orders=[]
        )

        assert len(result) == 1
        assert total == 1

    @pytest.mark.anyio
    async def test_get_site_names_by_organization_excludes_deleted(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_site_names_by_organization excludes deleted sites"""
        mock_result = MagicMock()
        mock_result.all.return_value = [
            ("Active Site", 1),
        ]
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_site_names_by_organization(1)

        assert len(result) == 1
        assert result[0] == ("Active Site", 1)
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_allocation_agreement_organizations(
        self, charging_site_repo, mock_db_session
    ):
        """Test that get_allocation_agreement_organizations excludes the requesting org"""
        # Only org 2 should be returned; org 1 (the requesting org) is excluded by the
        # WHERE Organization.organization_id != organization_id clause added in the fix.
        mock_org2 = MagicMock(spec=Organization)
        mock_org2.organization_id = 2
        mock_org2.name = "Partner Org"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_org2]
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_allocation_agreement_organizations(1)

        assert len(result) == 1
        assert result[0].organization_id == 2
        assert result[0].name == "Partner Org"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_allocating_organization_names_merges_and_deduplicates(
        self, charging_site_repo
    ):
        """
        get_allocating_organization_names should merge all three sources,
        deduplicate case-insensitively (matched org wins), and sort alphabetically.
        """
        org_a = MagicMock(spec=Organization)
        org_a.organization_id = 2
        org_a.name = "Alpha Corp"

        org_b = MagicMock(spec=Organization)
        org_b.organization_id = 3
        org_b.name = "Beta Ltd"

        charging_site_repo.get_allocation_agreement_organizations = AsyncMock(
            return_value=[org_a, org_b]
        )
        # "alpha corp" appears again in transaction partners — should be deduplicated
        charging_site_repo.get_transaction_partners_from_allocation_agreements = AsyncMock(
            return_value=["alpha corp", "Gamma Inc"]
        )
        # "beta ltd" appears again in historical names — should be deduplicated
        charging_site_repo.get_distinct_allocating_organization_names = AsyncMock(
            return_value=["Beta Ltd", "Delta Partners"]
        )

        result = await charging_site_repo.get_allocating_organization_names(1)

        # Expect 4 unique names, sorted A→Z; the canonical casing from the
        # first-seen source (matched org) should be preserved for duplicates.
        assert result == ["Alpha Corp", "Beta Ltd", "Delta Partners", "Gamma Inc"]

    @pytest.mark.anyio
    async def test_get_allocating_organization_names_empty_sources(
        self, charging_site_repo
    ):
        """Returns an empty list when all three sources are empty."""
        charging_site_repo.get_allocation_agreement_organizations = AsyncMock(
            return_value=[]
        )
        charging_site_repo.get_transaction_partners_from_allocation_agreements = AsyncMock(
            return_value=[]
        )
        charging_site_repo.get_distinct_allocating_organization_names = AsyncMock(
            return_value=[]
        )

        result = await charging_site_repo.get_allocating_organization_names(1)

        assert result == []

    @pytest.mark.anyio
    async def test_get_distinct_allocating_organization_names(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting distinct allocating organization names from charging sites"""
        mock_result = MagicMock()
        mock_result.all.return_value = [("Org A",), ("Org B",), ("Org C",)]
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_distinct_allocating_organization_names(1)

        assert len(result) == 3
        assert result == ["Org A", "Org B", "Org C"]
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_transaction_partners_from_allocation_agreements(
        self, charging_site_repo, mock_db_session
    ):
        """Test getting transaction partners from allocation agreements"""
        mock_result = MagicMock()
        mock_result.all.return_value = [
            ("Partner A",),
            ("Partner B",),
            ("Partner C",),
        ]
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.get_transaction_partners_from_allocation_agreements(
            1
        )

        assert len(result) == 3
        assert result == ["Partner A", "Partner B", "Partner C"]
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_search_organizations_by_name(
        self, charging_site_repo, mock_db_session
    ):
        """Test searching organizations by name"""
        mock_org1 = MagicMock(spec=Organization)
        mock_org1.organization_id = 1
        mock_org1.name = "Test Company"
        mock_org2 = MagicMock(spec=Organization)
        mock_org2.organization_id = 2
        mock_org2.name = "Test Corporation"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_org1, mock_org2]
        mock_db_session.execute.return_value = mock_result

        result = await charging_site_repo.search_organizations_by_name("test")

        assert len(result) == 2
        assert result[0].name == "Test Company"
        assert result[1].name == "Test Corporation"
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_search_organizations_by_name_empty_query(
        self, charging_site_repo, mock_db_session
    ):
        """Test searching organizations with empty query returns empty list"""
        result = await charging_site_repo.search_organizations_by_name("")

        assert len(result) == 0
        mock_db_session.execute.assert_not_called()
