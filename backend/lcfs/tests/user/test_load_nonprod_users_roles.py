from types import SimpleNamespace

import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.seeders import load_nonprod_users as loader_module


class _FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def all(self):
        return self._rows


class _FakeSession:
    async def execute(self, stmt, *_args, **_kwargs):
        # First query in loader reads role_id -> role enum map.
        if "SELECT role.role_id, role.name" in str(stmt):
            return _FakeResult(
                rows=[
                    (1, RoleEnum.GOVERNMENT),
                    (2, RoleEnum.SUPPLIER),
                ]
            )
        return _FakeResult(rows=[])

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return self


class _FakeEngine:
    async def dispose(self):
        return None


@pytest.mark.anyio
async def test_load_nonprod_users_fails_fast_on_mixed_seed_roles(monkeypatch):
    monkeypatch.setattr(
        loader_module,
        "get_seed_user_data",
        lambda _env: (
            [{"user_profile_id": 100, "organization_id": None}],
            [{"user_profile_id": 100, "role_id": 2}],  # SUPPLIER on gov user
        ),
    )
    monkeypatch.setattr(
        loader_module, "create_async_engine", lambda *_args, **_kwargs: _FakeEngine()
    )
    monkeypatch.setattr(
        loader_module,
        "sessionmaker",
        lambda **_kwargs: (lambda: _FakeSession()),
    )
    monkeypatch.setattr(
        loader_module, "settings", SimpleNamespace(db_url="postgresql+asyncpg://test")
    )

    with pytest.raises(ValueError, match="Invalid seeded role assignments"):
        await loader_module.load_nonprod_users("local")
