"""Exercise the production session dependency through real HTTP requests.

These tests deliberately avoid the usual client/dbsession fixtures, which replace
the dependency and roll back an outer transaction instead of testing real commits.
"""

from types import SimpleNamespace
from uuid import uuid4

import anyio
import pytest
from fastapi import Depends, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.responses import StreamingResponse

from lcfs.db import dependencies


@pytest.fixture
async def transaction_app(_engine, monkeypatch):
    engine = create_async_engine(_engine.url, poolclass=NullPool)
    monkeypatch.setattr(dependencies, "async_engine", engine)
    table = f"transaction_probe_{uuid4().hex}"
    active_connections = set()

    @event.listens_for(engine.sync_engine, "checkout")
    def track_checkout(connection, record, proxy):
        active_connections.add(id(connection))

    @event.listens_for(engine.sync_engine, "checkin")
    def track_checkin(connection, record):
        active_connections.discard(id(connection))

    async with engine.begin() as connection:
        # A deferred constraint makes the INSERT succeed and COMMIT fail.
        await connection.execute(
            text(
                f'CREATE TABLE "{table}" ('
                "id integer PRIMARY KEY, marker text UNIQUE DEFERRABLE INITIALLY DEFERRED)"
            )
        )

    async def rows():
        async with engine.connect() as connection:
            result = await connection.execute(
                text(f'SELECT id, marker FROM "{table}" ORDER BY id')
            )
            return [tuple(row) for row in result]

    async def insert(session, row_id=1, marker="written"):
        await session.execute(
            text(f'INSERT INTO "{table}" (id, marker) VALUES (:id, :marker)'),
            {"id": row_id, "marker": marker},
        )

    class TestUserMiddleware:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            scope["user"] = SimpleNamespace(keycloak_username="transaction_test")
            await self.app(scope, receive, send)

    app = FastAPI()
    app.add_middleware(TestUserMiddleware)
    stream_closed = anyio.Event()

    @app.post("/write", status_code=201)
    async def write(session: AsyncSession = Depends(dependencies.get_async_db_session)):
        await insert(session)
        username = await session.scalar(text("SELECT current_setting('app.username')"))
        return {"username": username}

    @app.post("/rollback/{failure}")
    async def rollback(
        failure: str, session: AsyncSession = Depends(dependencies.get_async_db_session)
    ):
        await insert(session)
        if failure == "http":
            raise HTTPException(status_code=409, detail="Rejected")
        raise RuntimeError("Handler failed")

    @app.post("/commit-error", status_code=201)
    async def commit_error(
        session: AsyncSession = Depends(dependencies.get_async_db_session),
    ):
        await insert(session, 1, "duplicate")
        await insert(session, 2, "duplicate")
        return {"unexpected": "success"}

    @app.get("/stream/{mode}")
    async def stream(
        mode: str, session: AsyncSession = Depends(dependencies.get_async_db_session)
    ):
        await insert(session)

        async def chunks():
            try:
                yield b"first"
                if mode == "error":
                    raise RuntimeError("Stream failed")
                if mode == "disconnect":
                    await anyio.sleep_forever()
                yield b"second"
            finally:
                stream_closed.set()

        return StreamingResponse(chunks())

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            yield SimpleNamespace(
                app=app,
                client=client,
                rows=rows,
                connections=active_connections,
                stream_closed=stream_closed,
            )
    finally:
        try:
            async with engine.begin() as connection:
                await connection.execute(text(f'DROP TABLE "{table}"'))
        finally:
            await engine.dispose()


@pytest.mark.anyio
async def test_success_commits_and_sets_audit_context(transaction_app):
    response = await transaction_app.client.post("/write")

    assert response.status_code == 201
    assert response.json() == {"username": "transaction_test"}
    assert await transaction_app.rows() == [(1, "written")]
    assert not transaction_app.connections


@pytest.mark.anyio
@pytest.mark.parametrize("failure,status", [("http", 409), ("unexpected", 500)])
async def test_request_failure_rolls_back(transaction_app, failure, status):
    response = await transaction_app.client.post(f"/rollback/{failure}")

    assert response.status_code == status
    assert await transaction_app.rows() == []
    assert not transaction_app.connections


@pytest.mark.anyio
async def test_commit_failure_returns_error_and_releases_connection(transaction_app):
    response = await transaction_app.client.post("/commit-error")

    assert response.status_code == 500
    assert await transaction_app.rows() == []
    assert not transaction_app.connections

    # A fresh request must succeed after the failed transaction.
    response = await transaction_app.client.post("/write")
    assert response.status_code == 201
    assert await transaction_app.rows() == [(1, "written")]
    assert not transaction_app.connections


@pytest.mark.anyio
@pytest.mark.parametrize("mode", ["complete", "error", "disconnect"])
async def test_transaction_finishes_before_streaming_headers(transaction_app, mode):
    """Freeze the 3.11/FastAPI baseline, including stream errors and disconnects.

    The transaction commits before streaming begins. A later stream failure or
    disconnect cannot undo that commit, and must not leave a connection open.
    """
    disconnected = anyio.Event()
    sent_request = False
    messages = []
    observations = []

    async def receive():
        nonlocal sent_request
        if not sent_request:
            sent_request = True
            return {"type": "http.request", "body": b"", "more_body": False}
        await disconnected.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.start":
            observations.append(await transaction_app.rows())
            assert not transaction_app.connections
        messages.append(message)
        if mode == "disconnect" and message.get("body") == b"first":
            disconnected.set()

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": f"/stream/{mode}",
        "raw_path": f"/stream/{mode}".encode(),
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }
    with anyio.fail_after(5):
        if mode == "error":
            with pytest.raises(RuntimeError, match="Stream failed"):
                await transaction_app.app(scope, receive, send)
        else:
            await transaction_app.app(scope, receive, send)

    assert observations == [[(1, "written")]]
    assert messages[0]["status"] == 200
    assert transaction_app.stream_closed.is_set()
    assert await transaction_app.rows() == [(1, "written")]
    assert not transaction_app.connections
    bodies = b"".join(message.get("body", b"") for message in messages)
    assert bodies == (b"firstsecond" if mode == "complete" else b"first")
