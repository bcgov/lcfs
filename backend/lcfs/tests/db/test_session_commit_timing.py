"""
The request's database transaction commits before the response is sent.

Since FastAPI 0.118, a yield dependency with the default "request" scope runs
its exit code after the response has been sent. get_async_db_session commits
in that exit code, so it must be used with scope="function".
"""

import uuid

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db import dependencies
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.application import get_app


def _session_dependants(dependant):
    for sub_dependant in dependant.dependencies:
        if sub_dependant.call is get_async_db_session:
            yield sub_dependant
        yield from _session_dependants(sub_dependant)


def test_every_route_uses_function_scoped_db_session():
    app = get_app()
    uses = [
        (route.path, sub_dependant)
        for route in app.routes
        if getattr(route, "dependant", None) is not None
        for sub_dependant in _session_dependants(route.dependant)
    ]

    assert uses
    # A default-scope use commits after the response is sent.
    assert sorted({path for path, dep in uses if dep.scope != "function"}) == []
    # FastAPI solves a dependency once per request per cache key, so every
    # repository and service in a request shares one session.
    assert len({dep.cache_key for _, dep in uses}) == 1
    assert all(dep.use_cache for _, dep in uses)


@pytest.fixture
async def probe_table(_engine, monkeypatch):
    """A scratch table, and get_async_db_session pointed at the test database."""
    table = f"session_commit_probe_{uuid.uuid4().hex[:8]}"
    async with _engine.begin() as conn:
        await conn.execute(
            text(
                f"CREATE TABLE {table} (id integer, "
                f"CONSTRAINT {table}_id_key UNIQUE (id) DEFERRABLE INITIALLY DEFERRED)"
            )
        )
    monkeypatch.setattr(dependencies, "async_engine", _engine)
    try:
        yield table
    finally:
        async with _engine.begin() as conn:
            await conn.execute(text(f"DROP TABLE {table}"))


def _probe_app(table, engine, rows_at_response_start):
    app = FastAPI()

    @app.post("/probe")
    async def probe(
        ids: list[int],
        db: AsyncSession = Depends(get_async_db_session, scope="function"),
    ):
        for row_id in ids:
            await db.execute(
                text(f"INSERT INTO {table} (id) VALUES (:id)"), {"id": row_id}
            )
        return {"inserted": len(ids)}

    async def asgi(scope, receive, send):
        # No authentication middleware here: an anonymous request.
        scope["user"] = None

        async def send_and_record(message):
            if message["type"] == "http.response.start":
                # Read from a separate connection, as the next request would.
                async with engine.connect() as conn:
                    count = await conn.scalar(text(f"SELECT count(*) FROM {table}"))
                rows_at_response_start.append(count)
            await send(message)

        await app(scope, receive, send_and_record)

    return asgi


@pytest.mark.anyio
async def test_write_is_committed_when_response_starts(_engine, probe_table):
    rows_at_response_start = []
    app = _probe_app(probe_table, _engine, rows_at_response_start)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/probe", json=[1])

    assert response.status_code == 200
    assert rows_at_response_start == [1]


@pytest.mark.anyio
async def test_commit_failure_reaches_the_client(_engine, probe_table):
    rows_at_response_start = []
    app = _probe_app(probe_table, _engine, rows_at_response_start)

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        # The deferred unique constraint fails at COMMIT, not at INSERT.
        response = await client.post("/probe", json=[1, 1])

    assert response.status_code == 500
    assert rows_at_response_start == [0]
