from unittest.mock import MagicMock, AsyncMock, Mock

from lcfs.web.api.initiative_agreement.schema import (
    CreateInitiativeAgreementHistorySchema,
)
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.fixture
def mock_db_session():
    return MagicMock(spec=AsyncSession)


@pytest.fixture
def repository(mock_db_session):
    return InitiativeAgreementRepository(db=mock_db_session)


@pytest.mark.anyio
async def test_get_initiative_agreement_by_id(repository, mock_db_session):
    mock_agreement = InitiativeAgreement(initiative_agreement_id=1)

    mock_scalars = Mock()
    mock_scalars.first.return_value = mock_agreement
    mock_result = Mock()
    mock_result.scalars.return_value = mock_scalars
    mock_query = AsyncMock()
    mock_query.return_value = mock_result
    mock_db_session.execute = mock_query

    result = await repository.get_initiative_agreement_by_id(1)
    # print(result)
    assert result == mock_agreement


@pytest.mark.anyio
async def test_create_initiative_agreement(repository, mock_db_session):
    mock_agreement = InitiativeAgreement(initiative_agreement_id=1)

    result = await repository.create_initiative_agreement(mock_agreement)

    assert result == mock_agreement
    mock_db_session.add.assert_called_once_with(mock_agreement)
    mock_db_session.flush.assert_called_once()
    mock_db_session.refresh.assert_called_once_with(
        mock_agreement, ["to_organization", "current_status", "history"]
    )


@pytest.mark.anyio
async def test_update_initiative_agreement(repository, mock_db_session):
    mock_agreement = InitiativeAgreement(initiative_agreement_id=1)
    mock_db_session.merge.return_value = mock_agreement

    result = await repository.update_initiative_agreement(mock_agreement)

    assert result == mock_agreement
    mock_db_session.merge.assert_called_once_with(mock_agreement)
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_get_initiative_agreement_status_by_name(repository, mock_db_session):
    mock_status = InitiativeAgreementStatus(status="Pending")

    mock_scalars = Mock()
    mock_scalars.first.return_value = mock_status
    mock_result = Mock()
    mock_result.scalars.return_value = mock_scalars
    mock_query = AsyncMock()
    mock_query.return_value = mock_result
    mock_db_session.execute = mock_query

    result = await repository.get_initiative_agreement_status_by_name("Pending")

    assert result == mock_status
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_initiative_agreement_status_by_name_not_found(
    repository, mock_db_session
):
    # mock_first = MagicMock(return_value=False)

    mock_scalars = Mock()
    mock_scalars.first.return_value = None
    mock_result = Mock()
    mock_result.scalars.return_value = mock_scalars
    mock_query = AsyncMock()
    mock_query.return_value = mock_result
    mock_db_session.execute = mock_query

    with pytest.raises(DataNotFoundException):
        await repository.get_initiative_agreement_status_by_name("NonExistent")


@pytest.mark.anyio
async def test_add_initiative_agreement_history(repository, mock_db_session):
    result = await repository.add_initiative_agreement_history(
        CreateInitiativeAgreementHistorySchema(
            initiative_agreement_id=1,
            initiative_agreement_status_id=1,
            user_profile_id=1,
            display_name="History User",
        )
    )

    assert isinstance(result, InitiativeAgreementHistory)
    mock_db_session.add.assert_called_once()
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_update_initiative_agreement_history(repository, mock_db_session):
    mock_history = InitiativeAgreementHistory(
        initiative_agreement_id=1, initiative_agreement_status_id=1, user_profile_id=1
    )
    mock_db_session.scalar.return_value = mock_history

    result = await repository.update_initiative_agreement_history(
        CreateInitiativeAgreementHistorySchema(
            initiative_agreement_id=1,
            initiative_agreement_status_id=1,
            user_profile_id=2,
            display_name="History User",
        )
    )

    assert result.user_profile_id == 2
    mock_db_session.add.assert_called_once_with(mock_history)
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_refresh_initiative_agreement(repository, mock_db_session):
    mock_agreement = InitiativeAgreement(initiative_agreement_id=1)

    result = await repository.refresh_initiative_agreement(mock_agreement)

    assert result == mock_agreement
    mock_db_session.flush.assert_called_once()
    mock_db_session.refresh.assert_called_once_with(mock_agreement)
