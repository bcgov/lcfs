import pytest
import json
from httpx import AsyncClient
from fastapi import FastAPI, status
from pathlib import Path


@pytest.mark.anyio
async def test_save_fuel_codes(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    try:
        with open(Path(__file__).parent / "fuel_code_payload.json") as f_data:
            payload = json.load(f_data)
            url = fastapi_app.url_path_for("save_fuel_codes")
            response = await client.post(url, json=payload["addFuelCodes"])
            assert response.status_code == status.HTTP_201_CREATED
            f_data.close()
    except Exception as e:
        raise AssertionError("Failed to save fuel codes:", e)


@pytest.mark.anyio
async def test_save_fuel_codes_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    try:
        with open(Path(__file__).parent / "fuel_code_payload.json") as f_data:
            payload = json.load(f_data)
            url = fastapi_app.url_path_for("save_fuel_codes")
            response = await client.post(url, json=payload["addFuelCodes"])
            assert response.status_code == status.HTTP_403_FORBIDDEN
            f_data.close()
    except Exception as e:
        raise AssertionError("Failed to save fuel codes:", e)


@pytest.mark.anyio
async def test_get_energy_densities(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_energy_densities")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_energy_effectiveness_ratios(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_energy_effectiveness_ratios")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_use_of_a_carbon_intensities(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_use_of_a_carbon_intensities")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_get_fuel_codes(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    try:
        with open(Path(__file__).parent / "fuel_code_payload.json") as f_data:
            payload = json.load(f_data)
            url = fastapi_app.url_path_for("save_fuel_codes")
            response = await client.post(url, json=payload["addFuelCodes"])
            assert response.status_code == status.HTTP_201_CREATED
            url = fastapi_app.url_path_for("get_fuel_codes")
            response = await client.post(url, json=payload["getPaginatedFuelCodes"])
            assert response.status_code == status.HTTP_200_OK
            f_data.close()
    except Exception as e:
        raise AssertionError("Failed to get fuel codes:", e)
