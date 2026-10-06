import pytest
from unittest.mock import AsyncMock, MagicMock

from lcfs.web.api.internal_comment.repo import InternalCommentRepository
from lcfs.web.api.internal_comment.schema import EntityTypeEnum


def _repo(scalar_rows=None, scalar_one=None):
    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = scalar_rows or []
    result.scalar_one_or_none.return_value = scalar_one
    db.execute = AsyncMock(return_value=result)
    return (
        InternalCommentRepository(
            db=db, user_repo=MagicMock(), report_repo=MagicMock()
        ),
        db,
    )


def _sql(db, call=0):
    return str(
        db.execute.await_args_list[call]
        .args[0]
        .compile(compile_kwargs={"literal_binds": True})
    )


@pytest.mark.anyio
async def test_search_mentionable_users_only_active_idir_users():
    repo, db = _repo()

    await repo.search_mentionable_users("jane")

    sql = _sql(db)
    assert "organization_id IS NULL" in sql
    assert "is_active IS true" in sql
    assert "LIKE lower('%jane%')" in sql
    assert "LIMIT 8" in sql


@pytest.mark.anyio
async def test_search_mentionable_users_without_query_has_no_name_filter():
    repo, db = _repo()

    await repo.search_mentionable_users("  ")

    assert "LIKE" not in _sql(db)


@pytest.mark.anyio
async def test_get_active_idir_users_by_ids_skips_query_for_empty_list():
    repo, db = _repo()

    assert await repo.get_active_idir_users_by_ids([]) == []
    db.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_get_active_idir_users_by_ids_filters_to_active_idir():
    repo, db = _repo()

    await repo.get_active_idir_users_by_ids([5, 5, 6])

    sql = _sql(db)
    assert "organization_id IS NULL" in sql
    assert "is_active IS true" in sql


@pytest.mark.anyio
async def test_get_users_by_ids_skips_query_for_empty_list():
    repo, db = _repo()

    assert await repo.get_users_by_ids([]) == []
    db.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_get_comment_entity_returns_first_matching_link():
    repo, db = _repo()
    results = [MagicMock(), MagicMock()]
    results[0].scalar_one_or_none.return_value = None
    results[1].scalar_one_or_none.return_value = 77
    db.execute = AsyncMock(side_effect=results)

    entity = await repo.get_comment_entity(1)

    assert entity == (EntityTypeEnum.INITIATIVE_AGREEMENT, 77)


@pytest.mark.anyio
async def test_get_comment_entity_none_when_unlinked():
    repo, _ = _repo(scalar_one=None)

    assert await repo.get_comment_entity(1) is None


@pytest.mark.anyio
async def test_mention_queries_run_against_the_database(dbsession):
    repo = InternalCommentRepository(
        db=dbsession, user_repo=MagicMock(), report_repo=MagicMock()
    )

    users = await repo.search_mentionable_users("")
    assert users
    assert all(u.organization_id is None and u.is_active for u in users)

    first = users[0]
    by_name = await repo.search_mentionable_users(first.first_name)
    assert first.user_profile_id in {u.user_profile_id for u in by_name}
    assert await repo.search_mentionable_users("no-such-person-zzz") == []

    ids = [first.user_profile_id]
    assert [u.user_profile_id for u in await repo.get_users_by_ids(ids)] == ids
    assert [
        u.user_profile_id for u in await repo.get_active_idir_users_by_ids(ids)
    ] == ids
    assert await repo.get_comment_entity(-1) is None
