"""Verify bulletin response boundaries and government route authorization."""

import csv
import json
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import jwt
import pytest
import xlrd
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from openpyxl import load_workbook

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.settings import settings
from lcfs.web.api.fuel_code.bulletin_export import FuelCodeBulletinExporter
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.application import get_app

PUBLIC_FIELDS = {
    "fuelCode",
    "fuel",
    "company",
    "carbonIntensity",
    "effectiveDate",
    "expiryDate",
}
ROW = {
    "fuel_code": "BCLCF101.0",
    "fuel": "Diesel",
    "company": "Example",
    "carbon_intensity": 12.5,
    "effective_date": date(2025, 1, 1),
    "expiry_date": date(2028, 12, 31),
    "fuel_code_id": 1,
    "prefix": "BCLCF",
    "fuel_suffix": "101.0",
    "status": "Approved",
    "application_date": date(2024, 10, 1),
    "approval_date": date(2024, 12, 1),
    "edrms": "private-edrms",
    "contact_name": "private-contact",
    "contact_email": "private@example.com",
    "notes": "private-notes",
    "feedstock": "private-feedstock",
    "feedstock_misc": "private-detail",
    "feedstock_location": "private-feedstock-location",
    "co_processed": "No",
    "fuel_production_facility_city": "private-city",
    "fuel_production_facility_province_state": "private-province",
    "fuel_production_facility_country": "private-country",
    "facility_nameplate_capacity": 1000,
    "facility_nameplate_capacity_unit": "L",
    "feedstock_fuel_transport_modes": ["Truck", "Rail"],
    "finished_fuel_transport_modes": ["Ship", "Pipeline"],
    "former_company": "private-former-company",
}


@pytest.fixture(scope="session")
def bulletin_signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
async def bulletin_app(fake_redis_client, bulletin_signing_key):
    """Exercise production routing, middleware and JWT verification offline.

    Only Redis and database I/O are replaced; the identity provider's public
    signing key is cached locally so authentication needs no network calls.
    """
    public_key = json.loads(
        jwt.algorithms.RSAAlgorithm.to_jwk(bulletin_signing_key.public_key())
    )
    public_key["kid"] = "bulletin-test-key"
    await fake_redis_client.set(
        "jwks_data",
        json.dumps(
            {
                "jwks": {"keys": [public_key]},
                "jwks_uri": "https://identity.example.test/jwks",
            }
        ),
    )

    def build(role=None):
        app = get_app()
        session = MagicMock()
        session.begin.return_value.__aenter__ = AsyncMock()
        session.begin.return_value.__aexit__ = AsyncMock(return_value=False)
        session.execute = AsyncMock(return_value=MagicMock())
        session_factory = MagicMock()
        session_factory.return_value.__aenter__ = AsyncMock(return_value=session)
        session_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        app.state.db_session_factory = session_factory
        app.state.redis_client = fake_redis_client
        app.state.settings = settings
        headers = {}
        if role is not None:
            user = UserProfile(user_profile_id=1, is_active=True)
            user.user_roles = [UserRole(role=Role(name=role))]
            session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = (
                user
            )
            token = jwt.encode(
                {
                    "preferred_username": "bulletin-test-user",
                    "aud": settings.keycloak_audience,
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
                },
                bulletin_signing_key,
                algorithm="RS256",
                headers={"kid": public_key["kid"]},
            )
            headers = {"Authorization": f"Bearer {token}"}

        repo = MagicMock()
        repo.get_fuel_code_bulletin_pagination_params.return_value = ([], [])
        repo.get_fuel_code_bulletin_rows = AsyncMock(return_value=([ROW], 1))
        app.dependency_overrides[get_async_db_session] = lambda: session
        app.dependency_overrides[FuelCodeServices] = lambda: FuelCodeServices(repo=repo)
        app.dependency_overrides[FuelCodeBulletinExporter] = (
            lambda: FuelCodeBulletinExporter(repo=repo)
        )
        return app, repo, headers

    return build


def read_export(response, export_format):
    if export_format == "csv":
        return list(csv.reader(response.text.splitlines()))
    if export_format == "xlsx":
        workbook = load_workbook(BytesIO(response.content), read_only=True)
        try:
            return list(workbook.active.values)
        finally:
            workbook.close()
    workbook = xlrd.open_workbook(file_contents=response.content)
    sheet = workbook.sheet_by_index(0)
    return [
        [
            (
                xlrd.xldate_as_datetime(cell.value, workbook.datemode)
                if cell.ctype == xlrd.XL_CELL_DATE
                else cell.value
            )
            for cell in sheet.row(index)
        ]
        for index in range(sheet.nrows)
    ]


def normalize_export_value(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


@pytest.mark.anyio
@pytest.mark.parametrize("bulletin_type", ["current", "archived"])
async def test_anonymous_bulletin_has_only_public_fields(bulletin_app, bulletin_type):
    app, repo, _ = bulletin_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            f"/api/fuel-codes/bulletins?bulletinType={bulletin_type}"
        )
    assert response.status_code == 200
    assert set(response.json()["fuelCodes"][0]) == PUBLIC_FIELDS
    assert (
        repo.get_fuel_code_bulletin_rows.await_args.kwargs["include_internal"] is False
    )


@pytest.mark.anyio
@pytest.mark.parametrize("bulletin_type", ["current", "archived"])
@pytest.mark.parametrize("export_format", ["csv", "xlsx", "xls"])
async def test_anonymous_export_ignores_idir_flag(
    bulletin_app, bulletin_type, export_format
):
    app, repo, _ = bulletin_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            f"/api/fuel-codes/bulletins/export?bulletinType={bulletin_type}&format={export_format}&idir=true"
        )
    assert response.status_code == 200
    rows = read_export(response, export_format)
    assert list(rows[0]) == [
        "Fuel code",
        "Fuel",
        "Company",
        "Carbon intensity (gCO2e/MJ)",
        "Effective date",
        "Expiry date",
    ]
    assert len(rows[1]) == 6
    assert not any("private" in str(value) for row in rows for value in row)
    assert (
        repo.get_fuel_code_bulletin_rows.await_args.kwargs["include_internal"] is False
    )


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["", "/export"])
@pytest.mark.parametrize(
    "role, expected",
    [(None, 401), (RoleEnum.SUPPLIER, 403), (RoleEnum.GOVERNMENT, 200)],
)
async def test_government_bulletin_routes_require_government_role(
    bulletin_app, suffix, role, expected
):
    app, repo, headers = bulletin_app(role)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        response = await client.post(
            f"/api/fuel-codes/government/bulletins{suffix}?bulletinType=current&format=csv&idir=false"
        )
    assert response.status_code == expected
    if expected != 200:
        repo.get_fuel_code_bulletin_rows.assert_not_awaited()
    else:
        assert (
            repo.get_fuel_code_bulletin_rows.await_args.kwargs["include_internal"]
            is True
        )
        if suffix:
            assert "private-edrms" in response.text
            assert "private@example.com" in response.text
            assert "private-notes" in response.text
        else:
            assert response.json()["fuelCodes"][0]["edrms"] == "private-edrms"


@pytest.mark.anyio
@pytest.mark.parametrize("bulletin_type", ["current", "archived"])
@pytest.mark.parametrize("export_format", ["csv", "xlsx", "xls"])
async def test_government_export_preserves_full_column_contract(
    bulletin_app, bulletin_type, export_format
):
    app, repo, headers = bulletin_app(RoleEnum.GOVERNMENT)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        response = await client.post(
            f"/api/fuel-codes/government/bulletins/export?bulletinType={bulletin_type}&format={export_format}"
        )
    assert response.status_code == 200
    rows = read_export(response, export_format)
    assert list(rows[0]) == [
        "Status",
        "Prefix",
        "Fuel code",
        "Carbon intensity",
        "EDRMS#",
        "Company",
        "Contact name",
        "Contact email",
        "Application date",
        "Approval date",
        "Effective date",
        "Expiry date",
        "Fuel",
        "Feedstock",
        "Feedstock location",
        "Misc",
        "Co-processed",
        "Fuel production facility city",
        "Fuel production facility province/state",
        "Fuel production facility country",
        "Facility nameplate capacity",
        "Unit",
        "Feedstock transport mode",
        "Finished fuel transport mode",
        "Former company",
        "Notes",
    ]
    assert [normalize_export_value(value) for value in rows[1]] == [
        "Approved",
        "BCLCF",
        "101.0",
        "12.5",
        "private-edrms",
        "Example",
        "private-contact",
        "private@example.com",
        "2024-10-01",
        "2024-12-01",
        "2025-01-01",
        "2028-12-31",
        "Diesel",
        "private-feedstock",
        "private-feedstock-location",
        "private-detail",
        "No",
        "private-city",
        "private-province",
        "private-country",
        "1000",
        "L",
        "Truck, Rail",
        "Ship, Pipeline",
        "private-former-company",
        "private-notes",
    ]
    assert (
        repo.get_fuel_code_bulletin_rows.await_args.kwargs["bulletin_type"]
        == bulletin_type
    )
    assert (
        repo.get_fuel_code_bulletin_rows.await_args.kwargs["include_internal"] is True
    )


@pytest.mark.anyio
@pytest.mark.parametrize("suffix", ["", "/export"])
async def test_government_bulletin_rejects_invalid_token(bulletin_app, suffix):
    app, repo, _ = bulletin_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            f"/api/fuel-codes/government/bulletins{suffix}?bulletinType=current",
            headers={"Authorization": "Bearer invalid-token"},
        )
    assert response.status_code == 401
    repo.get_fuel_code_bulletin_rows.assert_not_awaited()
