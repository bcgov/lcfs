import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus


@pytest.fixture
def mock_db_session():
    """Mock database session for testing"""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def charging_site_repo(mock_db_session):
    """ChargingSiteRepository instance with mocked database session"""
    repo = ChargingSiteRepository()
    repo.db = mock_db_session
    return repo


class TestChargingSiteRepository:
    """Test class for ChargingSiteRepository bulk update functionality"""

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_success(
        self,
        charging_site_repo,
        mock_db_session,
        mock_equipment_list,
        mock_validated_status,
    ):
        """Test successful bulk update of equipment status"""
        # Arrange
        equipment_ids = [1, 2]
        new_status = "Validated"

        # Mock status query result
        status_result = MagicMock()
        status_result.scalar_one_or_none.return_value = mock_validated_status

        # Mock equipment query result
        equipment_result = MagicMock()
        equipment_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_equipment_list
        )

        # Setup mock database execution
        mock_db_session.execute.side_effect = [status_result, equipment_result]
        mock_db_session.flush.return_value = None

        # Act
        result = await charging_site_repo.bulk_update_equipment_status(
            equipment_ids, new_status
        )

        # Assert
        assert len(result) == 2
        assert result == mock_equipment_list

        # Verify status was updated for each equipment
        for equipment in mock_equipment_list:
            assert (
                equipment.status_id
                == mock_validated_status.charging_equipment_status_id
            )

        mock_db_session.flush.assert_called_once()

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_invalid_status(
        self, charging_site_repo, mock_db_session
    ):
        """Test bulk update with invalid status raises ValueError"""
        # Arrange
        equipment_ids = [1, 2]
        new_status = "InvalidStatus"

        # Mock status query returning None (status not found)
        status_result = MagicMock()
        status_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = status_result

        # Act & Assert
        with pytest.raises(
            Exception
        ):  # The decorator wraps ValueError in DatabaseException
            await charging_site_repo.bulk_update_equipment_status(
                equipment_ids, new_status
            )

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_empty_list(
        self, charging_site_repo, mock_db_session, mock_validated_status
    ):
        """Test bulk update with empty equipment list"""
        # Arrange
        equipment_ids = []
        new_status = "Validated"

        # Mock status query result
        status_result = MagicMock()
        status_result.scalar_one_or_none.return_value = mock_validated_status

        # Mock equipment query result (empty)
        equipment_result = MagicMock()
        equipment_result.unique.return_value.scalars.return_value.all.return_value = []

        mock_db_session.execute.side_effect = [status_result, equipment_result]
        mock_db_session.flush.return_value = None

        # Act
        result = await charging_site_repo.bulk_update_equipment_status(
            equipment_ids, new_status
        )

        # Assert
        assert len(result) == 0
        assert result == []
        mock_db_session.flush.assert_called_once()

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_queries_execution(
        self,
        charging_site_repo,
        mock_db_session,
        mock_equipment_list,
        mock_validated_status,
    ):
        """Test that bulk update executes correct SQL queries"""
        # Arrange
        equipment_ids = [1, 2]
        new_status = "Validated"

        status_result = MagicMock()
        status_result.scalar_one_or_none.return_value = mock_validated_status

        equipment_result = MagicMock()
        equipment_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_equipment_list
        )

        mock_db_session.execute.side_effect = [status_result, equipment_result]
        mock_db_session.flush.return_value = None

        with patch("lcfs.web.api.charging_site.repo.select") as mock_select:
            mock_select.side_effect = [MagicMock(), MagicMock()]

            # Act
            await charging_site_repo.bulk_update_equipment_status(
                equipment_ids, new_status
            )

            # Assert - verify select was called twice (status query + equipment query)
            assert mock_select.call_count == 2

            # Verify database execute was called twice
            assert mock_db_session.execute.call_count == 2

    @pytest.mark.anyio
    async def test_bulk_update_equipment_status_updates_all_equipment(
        self, charging_site_repo, mock_db_session, mock_validated_status
    ):
        """Test that bulk update correctly updates status for all equipment"""
        # Arrange
        equipment_ids = [1, 2, 3]
        new_status = "Validated"

        # Create mock equipment with different initial statuses
        equipment_1 = MagicMock()
        equipment_1.status_id = 1  # Draft
        equipment_2 = MagicMock()
        equipment_2.status_id = 2  # Submitted
        equipment_3 = MagicMock()
        equipment_3.status_id = 2  # Submitted

        mock_equipment_list = [equipment_1, equipment_2, equipment_3]

        status_result = MagicMock()
        status_result.scalar_one_or_none.return_value = mock_validated_status

        equipment_result = MagicMock()
        equipment_result.unique.return_value.scalars.return_value.all.return_value = (
            mock_equipment_list
        )

        mock_db_session.execute.side_effect = [status_result, equipment_result]
        mock_db_session.flush.return_value = None

        # Act
        result = await charging_site_repo.bulk_update_equipment_status(
            equipment_ids, new_status
        )

        # Assert
        assert len(result) == 3

        # Verify all equipment had their status updated
        for equipment in mock_equipment_list:
            assert (
                equipment.status_id
                == mock_validated_status.charging_equipment_status_id
            )
