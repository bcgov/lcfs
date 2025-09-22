import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from io import BytesIO
from starlette.responses import StreamingResponse

from lcfs.web.api.charging_site.export import ChargingSiteExporter
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.compliance.ChargingSite import ChargingSite


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=ChargingSiteRepository)


@pytest.fixture
def mock_user():
    user = MagicMock(spec=UserProfile)
    user.user_profile_id = 1
    user.keycloak_username = "testuser"
    return user


@pytest.fixture
def mock_organization():
    org = MagicMock(spec=Organization)
    org.organization_id = 1
    org.name = "Test Organization"
    return org


@pytest.fixture
def mock_charging_sites():
    site1 = MagicMock(spec=ChargingSite)
    site1.organization.name = "Test Org"
    site1.site_name = "Site 1"
    site1.street_address = "123 Main St"
    site1.city = "Vancouver"
    site1.postal_code = "V6B 1A1"
    site1.latitude = 49.2827
    site1.longitude = -123.1207
    site1.intended_users = []
    site1.status.status = "Draft"
    site1.notes = "Test notes"
    
    return [site1]


@pytest.fixture
def exporter(mock_repo):
    return ChargingSiteExporter(repo=mock_repo)


class TestChargingSiteExporter:
    
    @pytest.mark.anyio
    async def test_export_with_data_success(self, exporter, mock_user, mock_organization, mock_charging_sites):
        """Test successful export with data"""
        # Mock repository methods
        exporter.repo.get_charging_site_options.return_value = [[], []]
        exporter.repo.get_all_charging_sites_by_organization_id.return_value = mock_charging_sites
        
        with patch('lcfs.web.api.charging_site.export.SpreadsheetBuilder') as mock_builder:
            mock_builder_instance = MagicMock()
            mock_builder.return_value = mock_builder_instance
            mock_builder_instance.build_spreadsheet.return_value = b'test_content'
            
            result = await exporter.export(1, mock_user, mock_organization, include_data=True)
            
            assert isinstance(result, StreamingResponse)
            assert result.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
            # Verify repo methods were called
            exporter.repo.get_charging_site_options.assert_called_once_with(mock_organization)
            exporter.repo.get_charging_sites_by_ids.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_export_template_without_data(self, exporter, mock_user, mock_organization):
        """Test export template without data"""
        exporter.repo.get_charging_site_options.return_value = [[], []]
        
        with patch('lcfs.web.api.charging_site.export.SpreadsheetBuilder') as mock_builder:
            mock_builder_instance = MagicMock()
            mock_builder.return_value = mock_builder_instance
            mock_builder_instance.build_spreadsheet.return_value = b'template_content'
            
            result = await exporter.export(1, mock_user, mock_organization, include_data=False)
            
            assert isinstance(result, StreamingResponse)
            # Should not call get_charging_sites_by_ids when include_data=False
            exporter.repo.get_charging_sites_by_ids.assert_not_called()

    @pytest.mark.anyio
    async def test_create_validators(self, exporter, mock_organization):
        """Test validator creation"""
        # Mock options
        status_options = [MagicMock(status="Draft"), MagicMock(status="Submitted")]
        user_type_options = [MagicMock(type_name="Public"), MagicMock(type_name="Fleet")]
        exporter.repo.get_charging_site_options.return_value = [status_options, user_type_options]
        
        with patch('lcfs.web.api.charging_site.export.SpreadsheetBuilder') as mock_builder:
            mock_builder_instance = MagicMock()
            mock_builder.return_value = mock_builder_instance
            
            validators = await exporter._create_validators(mock_organization, mock_builder_instance)
            
            assert len(validators) >= 4  # Should have multiple validators
            exporter.repo.get_charging_site_options.assert_called_once_with(mock_organization)

    @pytest.mark.anyio
    async def test_load_charging_site_data(self, exporter, mock_charging_sites):
        """Test loading charging site data"""
        exporter.repo.get_all_charging_sites_by_organization_id.return_value = mock_charging_sites
        
        data = await exporter.load_charging_site_data(1)
        
        assert len(data) == 1
        assert len(data[0]) == 10  # Should have 10 columns based on CS_EXPORT_COLUMNS
        exporter.repo.get_all_charging_sites_by_organization_id.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_export_filename_format(self, exporter, mock_user, mock_organization):
        """Test that export filename includes organization name"""
        exporter.repo.get_charging_site_options.return_value = [[], []]
        
        with patch('lcfs.web.api.charging_site.export.SpreadsheetBuilder') as mock_builder:
            mock_builder_instance = MagicMock()
            mock_builder.return_value = mock_builder_instance
            mock_builder_instance.build_spreadsheet.return_value = b'test_content'
            
            result = await exporter.export(1, mock_user, mock_organization, include_data=False)
            
            # Check headers contain organization name
            headers = result.headers
            assert "Content-Disposition" in headers
            assert mock_organization.name in headers["Content-Disposition"]
            assert "ChargingSites_" in headers["Content-Disposition"]