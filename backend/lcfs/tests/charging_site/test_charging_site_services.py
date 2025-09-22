import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.schema import (
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentForSiteSchema,
)
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment


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
    repo = AsyncMock(spec=ChargingSiteRepository)
    repo.db = AsyncMock()  # Add the db attribute that services expect
    return repo


@pytest.fixture
def charging_site_service(mock_repo):
    """ChargingSiteService instance with mocked repository"""
    service = ChargingSiteService()
    service.repo = mock_repo
    return service


class TestChargingSiteService:
    """Test class for ChargingSiteService bulk update functionality"""

    @pytest.mark.anyio
    async def test_bulk_update_to_validated_success(
        self,
        charging_site_service,
        mock_repo,
        mock_user,
        mock_equipment_list,
        mock_validated_status,
    ):
        """Test successful bulk update to Validated status"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Validated"
        )

        # Mock the database query to return equipment in Submitted status
        with patch("sqlalchemy.select") as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.where.return_value = mock_query

            # Mock database execution
            mock_result = MagicMock()
            mock_result.unique.return_value.scalars.return_value.all.return_value = (
                mock_equipment_list
            )
            mock_repo.db.execute.return_value = mock_result

            # Mock successful repository update
            mock_repo.bulk_update_equipment_status.return_value = mock_equipment_list
            mock_repo.get_charging_site_by_id.return_value = MagicMock()
            mock_repo.update_charging_site_status.return_value = None

        # Act
        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        # Assert
        mock_repo.bulk_update_equipment_status.assert_called_once_with(
            [1, 2], "Validated"
        )
        assert isinstance(result, list)

    @pytest.mark.anyio
    async def test_bulk_update_validation_failure_wrong_status(
        self,
        charging_site_service,
        mock_repo,
        mock_user,
        mock_equipment_with_draft_status,
    ):
        """Test bulk update validation failure when equipment is in wrong status"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[3], new_status="Validated"
        )

        # Mock equipment in Draft status (invalid for validation)
        mock_equipment_with_draft_status.status.status = "Draft"

        with patch("sqlalchemy.select") as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.where.return_value = mock_query

            mock_result = MagicMock()
            mock_result.unique.return_value.scalars.return_value.all.return_value = [
                mock_equipment_with_draft_status
            ]
            mock_repo.db.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(
            ValueError, match="Equipment can only be validated from Submitted status"
        ):
            await charging_site_service.bulk_update_equipment_status(
                bulk_update, 1, mock_user
            )

    @pytest.mark.anyio
    async def test_bulk_update_to_draft_success(
        self, charging_site_service, mock_repo, mock_user, mock_equipment_list
    ):
        """Test successful bulk update to Draft status"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Draft"
        )

        # Ensure equipment is in Submitted status (valid for returning to draft)
        for equipment in mock_equipment_list:
            equipment.status.status = "Submitted"

        with patch("sqlalchemy.select") as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.where.return_value = mock_query

            mock_result = MagicMock()
            mock_result.unique.return_value.scalars.return_value.all.return_value = (
                mock_equipment_list
            )
            mock_repo.db.execute.return_value = mock_result

            mock_repo.bulk_update_equipment_status.return_value = mock_equipment_list

        # Act
        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        # Assert
        mock_repo.bulk_update_equipment_status.assert_called_once_with([1, 2], "Draft")
        assert isinstance(result, list)

    @pytest.mark.anyio
    async def test_bulk_update_to_draft_validation_failure(
        self,
        charging_site_service,
        mock_repo,
        mock_user,
        mock_equipment_with_draft_status,
    ):
        """Test bulk update to Draft fails when equipment is not in Submitted status"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[3], new_status="Draft"
        )

        # Mock equipment in Draft status (invalid for returning to draft)
        mock_equipment_with_draft_status.status.status = "Validated"

        with patch("sqlalchemy.select") as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.where.return_value = mock_query

            mock_result = MagicMock()
            mock_result.unique.return_value.scalars.return_value.all.return_value = [
                mock_equipment_with_draft_status
            ]
            mock_repo.db.execute.return_value = mock_result

        # Act & Assert
        with pytest.raises(
            ValueError,
            match="Equipment can only be returned to Draft from Submitted status",
        ):
            await charging_site_service.bulk_update_equipment_status(
                bulk_update, 1, mock_user
            )

    @pytest.mark.anyio
    async def test_bulk_update_to_submitted_success(
        self, charging_site_service, mock_repo, mock_user, mock_equipment_list
    ):
        """Test successful bulk update to Submitted status (no validation required)"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Submitted"
        )

        mock_repo.bulk_update_equipment_status.return_value = mock_equipment_list

        # Act
        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        # Assert
        mock_repo.bulk_update_equipment_status.assert_called_once_with(
            [1, 2], "Submitted"
        )
        assert isinstance(result, list)

    @pytest.mark.anyio
    async def test_bulk_update_triggers_site_status_update(
        self,
        charging_site_service,
        mock_repo,
        mock_user,
        mock_equipment_list,
        mock_charging_site,
    ):
        """Test that bulk update to Validated triggers site status update"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[1, 2], new_status="Validated"
        )

        with patch("sqlalchemy.select") as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.where.return_value = mock_query

            mock_result = MagicMock()
            mock_result.unique.return_value.scalars.return_value.all.return_value = (
                mock_equipment_list
            )
            mock_repo.db.execute.return_value = mock_result

            mock_repo.bulk_update_equipment_status.return_value = mock_equipment_list
            mock_repo.get_charging_site_by_id.return_value = mock_charging_site
            mock_repo.update_charging_site_status.return_value = None

        # Act
        await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        # Assert
        mock_repo.get_charging_site_by_id.assert_called_once_with(1)
        mock_repo.update_charging_site_status.assert_called_once_with(
            1, 2
        )  # 2 is validated status ID

    @pytest.mark.anyio
    async def test_bulk_update_empty_equipment_list(
        self, charging_site_service, mock_repo, mock_user
    ):
        """Test bulk update with empty equipment list"""
        # Arrange
        bulk_update = BulkEquipmentStatusUpdateSchema(
            equipment_ids=[], new_status="Validated"
        )

        # Mock database execution properly for the empty list case
        mock_result = MagicMock()
        mock_result.unique.return_value.scalars.return_value.all.return_value = []
        mock_repo.db.execute.return_value = mock_result

        mock_repo.bulk_update_equipment_status.return_value = []

        # Act
        result = await charging_site_service.bulk_update_equipment_status(
            bulk_update, 1, mock_user
        )

        # Assert
        mock_repo.bulk_update_equipment_status.assert_called_once_with([], "Validated")
        assert isinstance(result, list)
        assert len(result) == 0
