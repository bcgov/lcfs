import pytest
from unittest.mock import AsyncMock, patch
from datetime import date, timedelta
from collections import namedtuple

from lcfs.scripts.tasks.fuel_code_expiry import (
    notify_expiring_fuel_code,
    _group_codes_by_email_then_company,
    _is_valid_email,
)
from lcfs.web.api.base import NotificationTypeEnum


# Mock fuel code data structure
MockFuelCode = namedtuple(
    "MockFuelCode", ["fuel_code", "contact_email", "expiry_date", "company"]
)


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
            expiry_date=date.today() + timedelta(days=30),
            company="Company A",
        ),
        MockFuelCode(
            fuel_code="FC002",
            contact_email="user2@example.com",
            expiry_date=date.today() + timedelta(days=60),
            company="Company B",
        ),
        MockFuelCode(
            fuel_code="FC003",
            contact_email="user1@example.com",  # Same email as FC001
            expiry_date=date.today() + timedelta(days=45),
            company="Company A",  # Same company as FC001
        ),
    ]


@pytest.fixture
def mock_fuel_codes_invalid_emails():
    """Mock fuel code data with invalid emails"""
    return [
        MockFuelCode(
            fuel_code="FC001",
            contact_email="invalid-email",
            expiry_date=date.today() + timedelta(days=30),
            company="Company A",
        ),
        MockFuelCode(
            fuel_code="FC002",
            contact_email="user@valid.com",
            expiry_date=date.today() + timedelta(days=60),
            company="Company B",
        ),
        MockFuelCode(
            fuel_code="FC003",
            contact_email="",
            expiry_date=date.today() + timedelta(days=45),
            company="Company C",
        ),
    ]


class TestNotifyExpiringFuelCode:
    """Tests for the notify_expiring_fuel_code function"""

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_success(
        self, mock_db_session, mock_fuel_codes
    ):
        """Test successful notification sending"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

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

            # Should send 2 emails (user1@example.com gets 1 for Company A, user2@example.com gets 1 for Company B)
            assert (
                mock_email_service.send_fuel_code_expiry_notifications.call_count == 2
            )

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        False,
    )
    async def test_notify_expiring_fuel_code_flag_disabled(self, mock_db_session):
        """Test that the task does nothing when the feature flag is disabled"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class:

            mock_repo = AsyncMock()
            mock_repo_class.return_value = mock_repo

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is True
            mock_repo.get_expiring_fuel_codes.assert_not_called()

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_no_codes(self, mock_db_session):
        """Test when no fuel codes are expiring"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class:

            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = []
            mock_repo_class.return_value = mock_repo

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is True
            mock_repo.get_expiring_fuel_codes.assert_called_once()

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_repository_error(self, mock_db_session):
        """Test when repository throws an error"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class:

            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.side_effect = Exception("Database error")
            mock_repo_class.return_value = mock_repo

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is False

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_email_service_failure(
        self, mock_db_session, mock_fuel_codes
    ):
        """Test when email service fails"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

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
    async def test_notify_expiring_fuel_code_partial_success(
        self, mock_db_session, mock_fuel_codes
    ):
        """Test when some emails succeed and some fail"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo

            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo

            mock_email_service = AsyncMock()
            # First call succeeds, second fails
            mock_email_service.send_fuel_code_expiry_notifications.side_effect = [
                True,
                False,
            ]
            mock_email_service_class.return_value = mock_email_service

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is True  # Should return True if at least one email succeeded

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_email_exception(
        self, mock_db_session, mock_fuel_codes
    ):
        """Test when email sending throws an exception"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = mock_fuel_codes
            mock_repo_class.return_value = mock_repo

            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo

            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.side_effect = (
                Exception("Email error")
            )

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is False


class TestGroupCodesByEmailThenCompany:
    """Tests for the _group_codes_by_email_then_company function"""

    def test_group_codes_by_email_then_company_basic(self, mock_fuel_codes):
        """Test basic grouping functionality"""
        result = _group_codes_by_email_then_company(mock_fuel_codes)

        # Should have 2 email addresses
        assert len(result) == 2
        assert "user1@example.com" in result
        assert "user2@example.com" in result

        # user1@example.com should have Company A with 2 codes
        user1_data = result["user1@example.com"]
        assert len(user1_data["companies"]) == 1
        assert "Company A" in user1_data["companies"]
        assert len(user1_data["companies"]["Company A"]["codes"]) == 2

        # user2@example.com should have Company B with 1 code
        user2_data = result["user2@example.com"]
        assert len(user2_data["companies"]) == 1
        assert "Company B" in user2_data["companies"]
        assert len(user2_data["companies"]["Company B"]["codes"]) == 1

    def test_group_codes_invalid_emails_fallback(self, mock_fuel_codes_invalid_emails):
        """Test that invalid emails are routed to fallback"""
        result = _group_codes_by_email_then_company(mock_fuel_codes_invalid_emails)

        # Should have 2 email addresses (valid one + fallback)
        assert len(result) == 2
        assert "user@valid.com" in result
        assert "tfrs@gov.bc.ca" in result  # fallback email

        # Fallback should have 2 companies (invalid-email and empty email cases)
        fallback_data = result["tfrs@gov.bc.ca"]
        assert len(fallback_data["companies"]) == 2
        assert "Company A" in fallback_data["companies"]
        assert "Company C" in fallback_data["companies"]

    def test_group_codes_empty_list(self):
        """Test with empty fuel codes list"""
        result = _group_codes_by_email_then_company([])
        assert result == {}


class TestIsValidEmail:
    """Tests for the _is_valid_email function"""

    def test_valid_emails(self):
        """Test valid email formats"""
        valid_emails = [
            "user@example.com",
            "test.email@domain.co.uk",
            "user+tag@example.org",
            "user123@test-domain.com",
        ]
        for email in valid_emails:
            assert _is_valid_email(email) is True

    def test_invalid_emails(self):
        """Test invalid email formats"""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user@.com",
            "",
            None,
            "user space@example.com",
        ]
        for email in invalid_emails:
            assert _is_valid_email(email) is False

    def test_non_string_input(self):
        """Test non-string inputs"""
        assert _is_valid_email(123) is False
        assert _is_valid_email([]) is False
        assert _is_valid_email({}) is False

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_notify_expiring_fuel_code_invalid_emails(
        self, mock_db_session, mock_fuel_codes_invalid_emails
    ):
        """Test handling of invalid email addresses"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

            mock_repo = AsyncMock()
            mock_repo.get_expiring_fuel_codes.return_value = (
                mock_fuel_codes_invalid_emails
            )
            mock_repo_class.return_value = mock_repo

            mock_email_repo = AsyncMock()
            mock_email_repo_class.return_value = mock_email_repo

            mock_email_service = AsyncMock()
            mock_email_service.send_fuel_code_expiry_notifications.return_value = True
            mock_email_service_class.return_value = mock_email_service

            result = await notify_expiring_fuel_code(mock_db_session)

            assert result is True
            # Should have 3 email groups: valid email + tfrs@gov.bc.ca for 2 invalid companies
            assert (
                mock_email_service.send_fuel_code_expiry_notifications.call_count == 3
            )

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
            assert (
                _is_valid_email(email) is expected
            ), f"Email {email} should be {'valid' if expected else 'invalid'}"


class TestIntegration:
    """Integration tests for the complete workflow"""

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_end_to_end_workflow(self, mock_db_session):
        """Test the complete workflow from start to finish"""
        # Create test data
        test_codes = [
            MockFuelCode(
                "FC001", "valid@example.com", date.today() + timedelta(days=30), "Company A"
            ),
            MockFuelCode("FC002", "invalid-email", date.today() + timedelta(days=60), "Company B"),
        ]

        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class:

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
            calls = (
                mock_email_service.send_fuel_code_expiry_notifications.call_args_list
            )
            assert len(calls) == 2  # Two email groups

            # Verify notification type
            for call in calls:
                args, kwargs = call
                assert (
                    kwargs["notification_type"]
                    == NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION
                )
                assert "email" in kwargs
                assert "notification_context" in kwargs

                context = kwargs["notification_context"]
                assert "subject" in context
                assert "fuel_codes" in context
                assert "contact_email" in context
                assert "expiry_count" in context

    @pytest.mark.anyio
    @patch(
        "lcfs.scripts.tasks.fuel_code_expiry.settings.feature_fuel_code_expiry_email",
        True,
    )
    async def test_logging_behavior(self, mock_db_session, mock_fuel_codes):
        """Test that appropriate logging occurs"""
        with patch(
            "lcfs.scripts.tasks.fuel_code_expiry.FuelCodeRepository"
        ) as mock_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailRepository"
        ) as mock_email_repo_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.CHESEmailService"
        ) as mock_email_service_class, patch(
            "lcfs.scripts.tasks.fuel_code_expiry.logger"
        ) as mock_logger:

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
            assert (
                mock_logger.info.call_count >= 3
            )  # At least start, found codes, and completion messages
