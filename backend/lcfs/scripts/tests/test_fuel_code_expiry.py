import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, date, timedelta
from collections import namedtuple

from lcfs.scripts.tasks.fuel_code_expiry import (
    notify_expiring_fuel_code,
    _group_codes_by_email,
    _is_valid_email,
)
from lcfs.web.api.base import NotificationTypeEnum


# Mock fuel code data structure
MockFuelCode = namedtuple('MockFuelCode', ['fuel_code', 'contact_email', 'expiry_date'])


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    return AsyncMock()


@pytest.fixture
def mock_fuel_codes():
    """Mock fuel code data"""
    return [
        MockFuelCode(
            fuel_code="FC001",
            contact_email="user1@example.com",
            expiry_date=date.today() + timedelta(days=30)
        ),
        MockFuelCode(
            fuel_code="FC002", 
            contact_email="user2@example.com",
            expiry_date=date.today() + timedelta(days=60)
        ),
        MockFuelCode(
            fuel_code="FC003",
            contact_email="user1@example.com",  # Same email as FC001
            expiry_date=date.today() + timedelta(days=45)
        ),
    ]


@pytest.fixture
def mock_fuel_codes_invalid_emails():
    """Mock fuel code data with invalid emails"""
    return [
        MockFuelCode(
            fuel_code="FC001",
            contact_email="invalid-email",
            expiry_date=date.today() + timedelta(days=30)
        ),
        MockFuelCode(
            fuel_code="FC002",
            contact_email="user@valid.com",
            expiry_date=date.today() + timedelta(days=60)
        ),
        MockFuelCode(
            fuel_code="FC003",
            contact_email="",
            expiry_date=date.today() + timedelta(days=45)
        ),
    ]


class TestNotifyExpiringFuelCode:
    """Tests for the notify_expiring_fuel_code function"""

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_success(self, mock_db_session, mock_fuel_codes):
        """Test successful notification sending"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            # Setup mocks
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = True
            mock_email_service_class.return_value = mock_email_service
            
            # Execute
            result = await notify_expiring_fuel_code(mock_db_session)
            
            # Verify
            assert result is True
            mock_repo.get_expiring_fuel_codes.assert_called_once()
            
            # Should send 2 emails (user1@example.com gets 2 codes, user2@example.com gets 1)
            assert mock_email_service.send_fuel_code_expiry_notifications.call_count == 2

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_no_codes(self, mock_db_session):
        """Test when no fuel codes are expiring"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = []
            mock_repo_class.return_value = mock_repo
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is True
            mock_repo.get_expiring_fuel_codes.assert_called_once()

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_repository_error(self, mock_db_session):
        """Test when repository throws an error"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.side_effect = Exception("Database error")
            mock_repo_class.return_value = mock_repo
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is False

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_email_service_failure(self, mock_db_session, mock_fuel_codes):
        """Test when email service fails"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = False
            mock_email_service_class.return_value = mock_email_service
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is False

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_partial_success(self, mock_db_session, mock_fuel_codes):
        """Test when some emails succeed and some fail"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            # First call succeeds, second fails
            mock_email_service.send_fuel_code_expiry_notifications.side_effect = [True, False]
            mock_email_service_class.return_value = mock_email_service
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is True  # Should return True if at least one email succeeded

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_email_exception(self, mock_db_session, mock_fuel_codes):
        """Test when email sending throws an exception"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.side_effect = Exception("Email service error")
            mock_email_service_class.return_value = mock_email_service
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is False

    @pytest.mark.anyio
    async def test_notify_expiring_fuel_code_invalid_emails(self, mock_db_session, mock_fuel_codes_invalid_emails):
        """Test handling of invalid email addresses"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes_invalid_emails
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = True
            mock_email_service_class.return_value = mock_email_service
            
            result = await notify_expiring_fuel_code(mock_db_session)
            
            assert result is True
            # Should have 2 email groups: valid email and tfrs@gov.bc.ca for invalid emails
            assert mock_email_service.send_fuel_code_expiry_notifications.call_count == 2


class TestGroupCodesByEmail:
    """Tests for the _group_codes_by_email function"""

    def test_group_codes_by_email_valid_emails(self, mock_fuel_codes):
        """Test grouping codes with valid emails"""
        result = _group_codes_by_email(mock_fuel_codes)
        
        assert len(result) == 2  # Two unique emails
        assert "user1@example.com" in result
        assert "user2@example.com" in result
        
        # user1@example.com should have 2 codes
        assert len(result["user1@example.com"]["codes"]) == 2
        assert len(result["user2@example.com"]["codes"]) == 1

    def test_group_codes_by_email_invalid_emails(self, mock_fuel_codes_invalid_emails):
        """Test grouping codes with invalid emails"""
        result = _group_codes_by_email(mock_fuel_codes_invalid_emails)
        
        assert len(result) == 2  # tfrs@gov.bc.ca and user@valid.com
        assert "tfrs@gov.bc.ca" in result
        assert "user@valid.com" in result
        
        # tfrs@gov.bc.ca should get the invalid email codes
        assert len(result["tfrs@gov.bc.ca"]["codes"]) == 2  # invalid-email and empty email
        assert len(result["user@valid.com"]["codes"]) == 1

    def test_group_codes_by_email_empty_list(self):
        """Test grouping with empty fuel codes list"""
        result = _group_codes_by_email([])
        
        assert result == {}

    def test_group_codes_by_email_all_invalid(self):
        """Test grouping when all emails are invalid"""
        invalid_codes = [
            MockFuelCode("FC001", "invalid-email", date.today()),
            MockFuelCode("FC002", "", date.today()),
            MockFuelCode("FC003", None, date.today()),
        ]
        
        result = _group_codes_by_email(invalid_codes)
        
        assert len(result) == 1
        assert "tfrs@gov.bc.ca" in result
        assert len(result["tfrs@gov.bc.ca"]["codes"]) == 3


class TestIsValidEmail:
    """Tests for the _is_valid_email function"""

    def test_valid_emails(self):
        """Test valid email formats"""
        valid_emails = [
            "user@example.com",
            "test.email@domain.co.uk",
            "user+tag@example.org",
            "user123@test-domain.com",
            "a@b.co",
        ]
        
        for email in valid_emails:
            assert _is_valid_email(email) is True, f"Email should be valid: {email}"

    def test_invalid_emails(self):
        """Test invalid email formats"""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user@@example.com",
            "user@.com",
            "user@domain.",
            "user@domain",
            "",
            "user space@example.com",
        ]
        
        for email in invalid_emails:
            assert _is_valid_email(email) is False, f"Email should be invalid: {email}"

    def test_edge_cases(self):
        """Test edge cases for email validation"""
        edge_cases = [
            None,
            123,
            [],
            {},
            True,
        ]
        
        for case in edge_cases:
            assert _is_valid_email(case) is False, f"Should be invalid: {case}"

    def test_email_with_special_characters(self):
        """Test emails with special characters"""
        special_emails = [
            ("user.name+tag@example.com", True),
            ("user_name@example.com", True),
            ("user-name@example.com", True),
            ("user%name@example.com", True),
            ("user@sub.domain.com", True),
            ("user@domain-name.com", True),
            ("user@domain_name.com", False),  # Underscore in domain not allowed
            ("user name@example.com", False),  # Space not allowed
        ]
        
        for email, expected in special_emails:
            assert _is_valid_email(email) is expected, f"Email {email} should be {'valid' if expected else 'invalid'}"


class TestIntegration:
    """Integration tests for the complete workflow"""

    @pytest.mark.anyio
    async def test_end_to_end_workflow(self, mock_db_session):
        """Test the complete workflow from start to finish"""
        # Create test data
        test_codes = [
            MockFuelCode("FC001", "valid@example.com", date.today() + timedelta(days=30)),
            MockFuelCode("FC002", "invalid-email", date.today() + timedelta(days=60)),
        ]
        
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class:
            
            # Setup mocks
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = test_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = True
            mock_email_service_class.return_value = mock_email_service
            
            # Execute
            result = await notify_expiring_fuel_code(mock_db_session)
            
            # Verify
            assert result is True
            
            # Check that the function was called with correct parameters
            calls = mock_email_service.send_fuel_code_expiry_notifications.call_args_list
            assert len(calls) == 2  # Two email groups
            
            # Verify notification type
            for call in calls:
                args, kwargs = call
                assert kwargs['notification_type'] == NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION
                assert 'email' in kwargs
                assert 'notification_context' in kwargs
                
                context = kwargs['notification_context']
                assert 'subject' in context
                assert 'fuel_codes' in context
                assert 'contact_email' in context
                assert 'expiry_count' in context

    @pytest.mark.anyio
    async def test_logging_behavior(self, mock_db_session, mock_fuel_codes):
        """Test that appropriate logging occurs"""
        with patch('lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository') as mock_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository') as mock_email_repo_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService') as mock_email_service_class, \
             patch('lcfs.scripts.tasks.fuel_code_expiry.logger') as mock_logger:
            
            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo
            
            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo
            
            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = True
            mock_email_service_class.return_value = mock_email_service
            
            await notify_expiring_fuel_code(mock_db_session)
            
            # Verify that info logging occurred
            assert mock_logger.info.call_count >= 3  # At least start, found codes, and completion messages