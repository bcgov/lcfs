import uuid

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from redis.asyncio import ConnectionPool, Redis
from starlette import status


@pytest.mark.anyio
async def test_setting_value(
    fastapi_app: FastAPI,
    fake_redis_pool: ConnectionPool,
    client: AsyncClient,
) -> None:
    """
    Tests that you can set value in redis.

    :param fastapi_app: current application fixture.
    :param fake_redis_pool: fake redis pool.
    :param client: client fixture.
    """
    url = fastapi_app.url_path_for("set_redis_value")

    test_key = uuid.uuid4().hex
    test_val = uuid.uuid4().hex
    response = await client.put(
        url,
        json={
            "key": test_key,
            "value": test_val,
        },
    )

    assert response.status_code == status.HTTP_200_OK
    async with Redis(connection_pool=fake_redis_pool) as redis:
        actual_value = await redis.get(test_key)
    assert actual_value.decode() == test_val


@pytest.mark.anyio
async def test_getting_value(
    fastapi_app: FastAPI,
    fake_redis_pool: ConnectionPool,
    client: AsyncClient,
) -> None:
    """
    Tests that you can get value from redis by key.

    :param fastapi_app: current application fixture.
    :param fake_redis_pool: fake redis pool.
    :param client: client fixture.
    """
    test_key = uuid.uuid4().hex
    test_val = uuid.uuid4().hex
    async with Redis(connection_pool=fake_redis_pool) as redis:
        await redis.set(test_key, test_val)
    url = fastapi_app.url_path_for("get_redis_value")
    response = await client.get(url, params={"key": test_key})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["key"] == test_key
    assert response.json()["value"] == test_val
