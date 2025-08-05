import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.db.models.organization.Organization import Organization
from lcfs.web.exception.exceptions import DataNotFoundException


class TestCreditMarketServices:
    """Test credit market services"""

    @pytest.fixture
    def mock_repo(self):
        """Mock organizations repository"""
        return AsyncMock()

    @pytest.fixture
    def mock_transaction_repo(self):
        """Mock transaction repository"""
        return AsyncMock()

    @pytest.fixture
    def credit_market_service(self, mock_repo, mock_transaction_repo):
        """Create service instance with mocked dependencies"""
        service = OrganizationsService()
        service.repo = mock_repo
        service.transaction_repo = mock_transaction_repo
        service.redis_balance_service = AsyncMock()
        return service

    @pytest.fixture
    def sample_organization(self):
        """Sample organization model"""
        org = Organization()
        org.organization_id = 1
        org.name = "Test Organization"
        org.credit_market_contact_name = "John Doe"
        org.credit_market_contact_email = "john@test.com"
        org.credit_market_contact_phone = "555-1234"
        org.credit_market_is_seller = True
        org.credit_market_is_buyer = False
        org.credits_to_sell = 100
        org.display_in_credit_market = True
        org.credit_trading_enabled = True
        return org

    @pytest.mark.anyio
    async def test_get_credit_market_listings_success(
        self, 
        credit_market_service, 
        mock_repo
    ):
        """Test successful retrieval of credit market listings"""
        
        # Create mock organizations
        org1 = Organization()
        org1.organization_id = 1
        org1.name = "Seller Org"
        org1.credits_to_sell = 150
        org1.display_in_credit_market = True
        org1.credit_market_is_seller = True
        org1.credit_market_is_buyer = False
        org1.credit_market_contact_name = "Seller Contact"
        org1.credit_market_contact_email = "seller@org.com"
        org1.credit_market_contact_phone = "555-0001"

        org2 = Organization()
        org2.organization_id = 2
        org2.name = "Buyer Org"
        org2.credits_to_sell = 0
        org2.display_in_credit_market = True
        org2.credit_market_is_seller = False
        org2.credit_market_is_buyer = True
        org2.credit_market_contact_name = "Buyer Contact"
        org2.credit_market_contact_email = "buyer@org.com"
        org2.credit_market_contact_phone = "555-0002"

        mock_repo.get_credit_market_organizations.return_value = [org1, org2]

        result = await credit_market_service.get_credit_market_listings()

        assert len(result) == 2
        assert result[0].organization_name == "Seller Org"
        assert result[0].credit_market_is_seller is True
        assert result[1].organization_name == "Buyer Org"  
        assert result[1].credit_market_is_buyer is True
        
        mock_repo.get_credit_market_organizations.assert_called_once()

    @pytest.mark.anyio
    async def test_get_credit_market_listings_empty(
        self, 
        credit_market_service, 
        mock_repo
    ):
        """Test credit market listings when no organizations are available"""
        
        mock_repo.get_credit_market_organizations.return_value = []

        result = await credit_market_service.get_credit_market_listings()

        assert result == []
        mock_repo.get_credit_market_organizations.assert_called_once()

    @pytest.mark.anyio
    async def test_update_organization_credit_market_details_success(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test successful update of organization credit market details"""
        
        # Mock getting existing organization
        mock_repo.get_organization.return_value = sample_organization
        
        # Mock balance calculations
        credit_market_service.calculate_total_balance = AsyncMock(return_value=500)

        # Mock the update operation
        updated_org = Organization()
        updated_org.organization_id = 1
        updated_org.name = "Test Organization"
        updated_org.credit_market_contact_name = "Updated Name"
        updated_org.credit_market_contact_email = "updated@test.com"
        updated_org.credit_market_contact_phone = "555-9999"
        updated_org.credit_market_is_seller = True
        updated_org.credit_market_is_buyer = True
        updated_org.credits_to_sell = 250
        updated_org.display_in_credit_market = False
        mock_repo.update_organization.return_value = updated_org

        credit_market_data = {
            "credit_market_contact_name": "Updated Name",
            "credit_market_contact_email": "updated@test.com",  
            "credit_market_contact_phone": "555-9999",
            "credit_market_is_seller": True,
            "credit_market_is_buyer": True,
            "credits_to_sell": 250,
            "display_in_credit_market": False
        }

        result = await credit_market_service.update_organization_credit_market_details(
            1, credit_market_data
        )

        assert result.organization_id == 1
        assert result.credit_market_contact_name == "Updated Name"
        assert result.credit_market_is_seller is True
        assert result.credit_market_is_buyer is True
        assert result.credits_to_sell == 250
        assert result.display_in_credit_market is False

        mock_repo.get_organization.assert_called_once_with(1)
        mock_repo.update_organization.assert_called_once()

    @pytest.mark.anyio
    async def test_update_organization_credit_market_details_not_found(
        self, 
        credit_market_service, 
        mock_repo
    ):
        """Test update when organization is not found"""
        
        mock_repo.get_organization.return_value = None

        credit_market_data = {"credit_market_contact_name": "Updated Name"}

        with pytest.raises(DataNotFoundException):
            await credit_market_service.update_organization_credit_market_details(
                999, credit_market_data
            )

        mock_repo.get_organization.assert_called_once_with(999)
        mock_repo.update_organization.assert_not_called()

    @pytest.mark.anyio
    async def test_update_organization_applies_all_fields(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test that update applies all credit market fields correctly"""
        
        mock_repo.get_organization.return_value = sample_organization
        mock_repo.update_organization.return_value = sample_organization
        
        # Mock balance calculation
        credit_market_service.calculate_total_balance = AsyncMock(return_value=300)

        credit_market_data = {
            "credit_market_contact_name": "Updated Name",
            "credit_market_contact_email": "updated@test.com",
            "credit_market_contact_phone": "555-9999", 
            "credit_market_is_seller": True,
            "credit_market_is_buyer": True,
            "credits_to_sell": 250,
            "display_in_credit_market": False
        }

        await credit_market_service.update_organization_credit_market_details(
            1, credit_market_data
        )

        # Verify that the organization object was updated with correct values
        mock_repo.update_organization.assert_called_once()
        
        # The service should have set all the fields on the organization
        call_args = mock_repo.update_organization.call_args[0][0]
        assert call_args.credit_market_contact_name == "Updated Name"
        assert call_args.credit_market_contact_email == "updated@test.com"
        assert call_args.credit_market_contact_phone == "555-9999"
        assert call_args.credit_market_is_seller is True
        assert call_args.credit_market_is_buyer is True
        assert call_args.credits_to_sell == 250
        assert call_args.display_in_credit_market is False

    @pytest.mark.anyio
    async def test_update_organization_includes_balance_data(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test that organization update includes balance calculations when credits_to_sell is updated"""
        
        mock_repo.get_organization.return_value = sample_organization
        mock_repo.update_organization.return_value = sample_organization
        
        # Mock balance calculation with specific values
        credit_market_service.calculate_total_balance = AsyncMock(return_value=750)

        # Include credits_to_sell to trigger balance calculation
        credit_market_data = {
            "credit_market_contact_name": "Updated Name",
            "credits_to_sell": 100
        }

        result = await credit_market_service.update_organization_credit_market_details(
            1, credit_market_data
        )

        # Verify balance calculation was called when credits_to_sell is updated
        credit_market_service.calculate_total_balance.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_credit_market_listings_filters_registered_orgs(
        self, 
        credit_market_service, 
        mock_repo
    ):
        """Test that credit market listings only includes registered organizations"""
        
        # Create a mock registered organization
        org = Organization()
        org.organization_id = 1
        org.name = "Registered Org"
        org.display_in_credit_market = True
        org.credit_market_contact_name = "Contact 1"
        org.credit_market_contact_email = "contact1@org.com"
        org.credit_market_contact_phone = "555-0001"
        org.credit_market_is_seller = True
        org.credit_market_is_buyer = False
        org.credits_to_sell = 100

        # Repository should only return registered organizations  
        mock_repo.get_credit_market_organizations.return_value = [org]

        result = await credit_market_service.get_credit_market_listings()

        assert len(result) == 1
        assert result[0].organization_name == "Registered Org"
        
        # Verify repository is called to handle filtering
        mock_repo.get_credit_market_organizations.assert_called_once()

    @pytest.mark.anyio
    async def test_get_organization_includes_balance_for_credit_market(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test that get_organization includes balance data for credit market validation"""
        
        mock_repo.get_organization.return_value = sample_organization
        mock_repo.get_current_year_early_issuance.return_value = False
        
        # Mock balance calculations
        credit_market_service.calculate_total_balance = AsyncMock(return_value=400)
        credit_market_service.calculate_reserved_balance = AsyncMock(return_value=25)

        result = await credit_market_service.get_organization(1)

        # Verify balance calculations were called
        credit_market_service.calculate_total_balance.assert_called_once_with(1)
        credit_market_service.calculate_reserved_balance.assert_called_once_with(1)
        
        # Verify original org data is also included
        assert result.organization_id == 1
        assert result.credit_market_contact_name == "John Doe"
        assert result.credits_to_sell == 100

    @pytest.mark.anyio
    async def test_update_handles_database_error(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test update handles database errors gracefully"""
        
        mock_repo.get_organization.return_value = sample_organization
        mock_repo.update_organization.side_effect = Exception("Database connection error")

        credit_market_data = {"credit_market_contact_name": "Updated Name"}

        # The service decorator catches the exception and raises ServiceException
        from lcfs.web.exception.exceptions import ServiceException
        with pytest.raises(ServiceException):
            await credit_market_service.update_organization_credit_market_details(
                1, credit_market_data
            )

    @pytest.mark.anyio
    async def test_credit_market_data_format_consistency(
        self, 
        credit_market_service, 
        mock_repo
    ):
        """Test that credit market data maintains consistent format"""
        
        org = Organization()
        org.organization_id = 1
        org.name = "Test Org"
        org.credit_market_contact_name = "Test Contact"
        org.credit_market_contact_email = "test@org.com"
        org.credit_market_contact_phone = "555-TEST"
        org.credit_market_is_seller = True
        org.credit_market_is_buyer = False
        org.credits_to_sell = 200
        org.display_in_credit_market = True

        mock_repo.get_credit_market_organizations.return_value = [org]

        result = await credit_market_service.get_credit_market_listings()

        # Verify data structure matches expected format
        listing = result[0]
        
        # Verify data types
        assert isinstance(listing.organization_id, int)
        assert isinstance(listing.organization_name, str)
        assert isinstance(listing.credit_market_is_seller, bool)
        assert isinstance(listing.credit_market_is_buyer, bool)
        assert isinstance(listing.credits_to_sell, int)
        assert isinstance(listing.display_in_credit_market, bool)

    @pytest.mark.anyio
    async def test_balance_calculation_integration(
        self, 
        credit_market_service, 
        mock_repo, 
        sample_organization
    ):
        """Test integration with balance calculation for credit market features"""
        
        mock_repo.get_organization.return_value = sample_organization
        mock_repo.get_current_year_early_issuance.return_value = False

        # Mock balance calculations
        credit_market_service.calculate_total_balance = AsyncMock(return_value=125)
        credit_market_service.calculate_reserved_balance = AsyncMock(return_value=25)

        result = await credit_market_service.get_organization(1)

        # Verify balance calculations were integrated properly
        credit_market_service.calculate_total_balance.assert_called_once_with(1)
        credit_market_service.calculate_reserved_balance.assert_called_once_with(1)
        
        assert result.total_balance == 125
        assert result.reserved_balance == 25