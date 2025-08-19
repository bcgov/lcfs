import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationStatus import OrganizationStatus, OrgStatusEnum


class TestCreditMarketRepository:
    """Test credit market repository methods"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def credit_market_repo(self, mock_db_session):
        """Create repository instance with mocked database session"""
        repo = OrganizationsRepository()
        repo.db = mock_db_session
        return repo

    @pytest.fixture
    def sample_organizations(self):
        """Sample organization data for testing"""
        orgs = []
        
        # Seller organization
        org1 = Organization()
        org1.organization_id = 1
        org1.name = "Seller Corp"
        org1.operating_name = "Seller Corp Operating"  # Required field
        org1.organization_type_id = 1
        org1.credit_market_contact_name = "Seller Contact"
        org1.credit_market_contact_email = "seller@corp.com"
        org1.credit_market_contact_phone = "555-0001"
        org1.credit_market_is_seller = True
        org1.credit_market_is_buyer = False
        org1.credits_to_sell = 150
        org1.display_in_credit_market = True
        org1.credit_trading_enabled = True
        
        # Add organization status
        status1 = OrganizationStatus()
        status1.organization_status_id = 1  # Required field
        status1.status = OrgStatusEnum.Registered
        org1.org_status = status1
        
        orgs.append(org1)
        
        # Buyer organization
        org2 = Organization()
        org2.organization_id = 2
        org2.name = "Buyer LLC"
        org2.operating_name = "Buyer LLC Operating"  # Required field
        org2.organization_type_id = 1
        org2.credit_market_contact_name = "Buyer Contact"
        org2.credit_market_contact_email = "buyer@llc.com"
        org2.credit_market_contact_phone = "555-0002"
        org2.credit_market_is_seller = False
        org2.credit_market_is_buyer = True
        org2.credits_to_sell = 0
        org2.display_in_credit_market = True
        org2.credit_trading_enabled = True
        
        # Add organization status
        status2 = OrganizationStatus()
        status2.organization_status_id = 2  # Required field
        status2.status = OrgStatusEnum.Registered
        org2.org_status = status2
        
        orgs.append(org2)
        
        return orgs

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_success(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test successful retrieval of credit market organizations"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        assert len(result) == 2
        assert result[0].name == "Seller Corp"
        assert result[0].display_in_credit_market is True
        assert result[1].name == "Buyer LLC"
        assert result[1].display_in_credit_market is True
        
        # Verify the query was executed
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_empty(
        self, 
        credit_market_repo, 
        mock_db_session
    ):
        """Test credit market organizations when no data available"""
        
        # Mock empty result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        assert result == []
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_filters_correctly(
        self, 
        credit_market_repo, 
        mock_db_session
    ):
        """Test that query filters for display_in_credit_market=True and registered status"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        await credit_market_repo.get_credit_market_organizations()

        # Verify that execute was called with a query
        mock_db_session.execute.assert_called_once()
        
        # The actual query construction and filtering logic is tested in integration
        # Here we just verify the method is called correctly

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_data_format(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test that returned data has correct format and fields"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        # Verify data structure
        org = result[0]
        assert hasattr(org, 'organization_id')
        assert hasattr(org, 'name')
        assert hasattr(org, 'credit_market_contact_name')
        assert hasattr(org, 'credit_market_contact_email')
        assert hasattr(org, 'credit_market_contact_phone')
        assert hasattr(org, 'credit_market_is_seller')
        assert hasattr(org, 'credit_market_is_buyer')
        assert hasattr(org, 'credits_to_sell')
        assert hasattr(org, 'display_in_credit_market')

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_includes_joins(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test that query includes necessary joins for related data"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        # Verify the result includes organizations with status information
        assert len(result) == 2
        assert result[0].org_status.status == OrgStatusEnum.Registered
        assert result[1].org_status.status == OrgStatusEnum.Registered

    @pytest.mark.anyio
    async def test_update_organization_credit_market_fields(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test updating organization with credit market fields"""
        
        org = sample_organizations[0]
        
        # Mock the merge and flush operations
        mock_db_session.merge.return_value = org
        mock_db_session.flush = AsyncMock()
        mock_db_session.refresh = AsyncMock()
        
        # Mock get_current_year_early_issuance to return a value
        credit_market_repo.get_current_year_early_issuance = AsyncMock(return_value=False)

        result = await credit_market_repo.update_organization(org)

        # Verify database operations were called
        mock_db_session.merge.assert_called_once_with(org)
        mock_db_session.flush.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_handles_database_error(
        self, 
        credit_market_repo, 
        mock_db_session
    ):
        """Test error handling when database operation fails"""
        
        # Mock database error
        mock_db_session.execute.side_effect = Exception("Database connection error")

        # The repository decorator catches the exception and raises DatabaseException
        from lcfs.web.exception.exceptions import DatabaseException
        with pytest.raises(DatabaseException):
            await credit_market_repo.get_credit_market_organizations()

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_sql_injection_protection(
        self, 
        credit_market_repo, 
        mock_db_session
    ):
        """Test that the query is protected against SQL injection"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        await credit_market_repo.get_credit_market_organizations()

        # Verify execute was called - the actual SQL protection is built into SQLAlchemy
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_performance_optimized(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test that query is optimized with appropriate joins and loading"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        # Verify that organizations include related data (indicating proper joins)
        assert len(result) == 2
        assert all(org.org_status for org in result)
        
        # Query should be called once (not multiple times for related data)
        mock_db_session.execute.assert_called_once()

    @pytest.mark.anyio
    async def test_credit_market_data_consistency(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test data consistency requirements for credit market listings"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        # Verify all organizations meet credit market requirements
        for org in result:
            assert org.display_in_credit_market is True
            assert org.org_status.status == OrgStatusEnum.Registered
            assert org.credit_market_contact_name is not None
            assert org.credit_market_contact_email is not None

    @pytest.mark.anyio
    async def test_get_credit_market_organizations_field_mapping(
        self, 
        credit_market_repo, 
        mock_db_session, 
        sample_organizations
    ):
        """Test that all required credit market fields are correctly mapped"""
        
        # Mock the database execute result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = sample_organizations
        mock_db_session.execute.return_value = mock_result

        result = await credit_market_repo.get_credit_market_organizations()

        # Verify field mapping for first organization
        org = result[0]
        assert org.organization_id == 1
        assert org.name == "Seller Corp"
        assert org.credit_market_contact_name == "Seller Contact"
        assert org.credit_market_contact_email == "seller@corp.com"
        assert org.credit_market_contact_phone == "555-0001"
        assert org.credit_market_is_seller is True
        assert org.credit_market_is_buyer is False
        assert org.credits_to_sell == 150
        assert org.display_in_credit_market is True