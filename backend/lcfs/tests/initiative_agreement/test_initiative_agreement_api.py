import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.initiative_agreement import (
    DesignatedAction,
    DesignatedActionStatus,
    InitiativeAgreement,
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.Role import RoleEnum

PAGINATION_BODY = {"page": 1, "size": 10, "sortOrders": [], "filters": []}


async def _agreement_status_id(dbsession, status_enum):
    result = await dbsession.execute(
        select(InitiativeAgreementStatus).where(
            InitiativeAgreementStatus.status == status_enum
        )
    )
    return result.scalars().first().initiative_agreement_status_id


async def _action_status_id(dbsession, status_name):
    result = await dbsession.execute(
        select(DesignatedActionStatus).where(
            DesignatedActionStatus.status == status_name
        )
    )
    return result.scalars().first().designated_action_status_id


async def _two_org_ids(dbsession):
    result = await dbsession.execute(
        select(Organization.organization_id).order_by(Organization.organization_id)
    )
    org_ids = result.scalars().all()
    assert len(org_ids) >= 2, "pytest seed data must include at least two orgs"
    return org_ids[0], org_ids[1]


async def _seed_agreement(dbsession, org_id, ia_code, title="Test agreement"):
    agreement = InitiativeAgreement(
        to_organization_id=org_id,
        current_status_id=await _agreement_status_id(
            dbsession, InitiativeAgreementStatusEnum.Underway
        ),
        ia_code=ia_code,
        title=title,
    )
    dbsession.add(agreement)
    await dbsession.flush()
    return agreement


@pytest.mark.anyio
async def test_list_agreements_for_government(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org1, org2 = await _two_org_ids(dbsession)
    await _seed_agreement(dbsession, org1, "IA-26API1")
    await _seed_agreement(dbsession, org2, "IA-26API2")
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for("get_initiative_agreements")
    response = await client.post(url, json=PAGINATION_BODY)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["total"] >= 2
    codes = {item["iaCode"] for item in data["initiativeAgreements"]}
    assert {"IA-26API1", "IA-26API2"} <= codes
    row = next(
        item for item in data["initiativeAgreements"] if item["iaCode"] == "IA-26API1"
    )
    assert row["currentStatus"]["status"] == "Underway"
    assert row["organization"]["organizationId"] == org1
    assert row["agreementType"] == "Initiative Agreement"


@pytest.mark.anyio
async def test_list_agreements_filters_by_code(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org1, org2 = await _two_org_ids(dbsession)
    await _seed_agreement(dbsession, org1, "IA-26FLT1")
    await _seed_agreement(dbsession, org2, "IA-26FLT2")
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for("get_initiative_agreements")
    response = await client.post(
        url,
        json={
            **PAGINATION_BODY,
            "filters": [
                {
                    "field": "iaCode",
                    "filterType": "text",
                    "type": "contains",
                    "filter": "26FLT1",
                }
            ],
        },
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["pagination"]["total"] == 1
    assert data["initiativeAgreements"][0]["iaCode"] == "IA-26FLT1"


@pytest.mark.anyio
async def test_list_agreements_scoped_for_proponent(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    # The mock user belongs to organization 1
    org1, org2 = await _two_org_ids(dbsession)
    await _seed_agreement(dbsession, 1, "IA-26OWN1")
    other_org = org2 if org2 != 1 else org1
    await _seed_agreement(dbsession, other_org, "IA-26OTH1")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    url = fastapi_app.url_path_for("get_initiative_agreements")
    response = await client.post(url, json=PAGINATION_BODY)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    codes = {item["iaCode"] for item in data["initiativeAgreements"]}
    assert "IA-26OWN1" in codes
    assert "IA-26OTH1" not in codes
    org_ids = {
        item["organization"]["organizationId"] for item in data["initiativeAgreements"]
    }
    assert org_ids == {1}


@pytest.mark.anyio
async def test_profile_returns_designated_actions(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    org1, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org1, "IA-26PRF1")
    not_started_id = await _action_status_id(dbsession, "Not started")
    for number, name in ((2, "Fleet procurement"), (1, "Environmental permitting")):
        dbsession.add(
            DesignatedAction(
                initiative_agreement_id=agreement.initiative_agreement_id,
                action_number=number,
                name=name,
                credit_allocation=1000 * number,
                current_status_id=not_started_id,
            )
        )
    await dbsession.flush()
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    url = fastapi_app.url_path_for(
        "get_initiative_agreement_profile",
        initiative_agreement_id=agreement.initiative_agreement_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["iaCode"] == "IA-26PRF1"
    actions = data["designatedActions"]
    assert [action["actionNumber"] for action in actions] == [1, 2]
    assert actions[0]["name"] == "Environmental permitting"
    assert actions[1]["creditAllocation"] == 2000
    assert actions[0]["currentStatus"]["status"] == "Not started"


@pytest.mark.anyio
async def test_profile_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for(
        "get_initiative_agreement_profile", initiative_agreement_id=999999
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_404_NOT_FOUND
