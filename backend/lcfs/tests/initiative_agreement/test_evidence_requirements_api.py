"""Evidence of completion requirements and analyst assessment (#4899).

Also closes the outstanding acceptance criterion on #4846: requirements
carry a long-form analyst review field.
"""

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
    REVIEW_OUTCOME_SATISFACTORY,
    EvidenceRequirement,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_IA_MANAGER,
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    _seed_agreement,
    _two_org_ids,
)

IDIR_DIRECTOR = [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT]


async def _seed_da(dbsession, code):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(dbsession, org_id, code)
    return await _seed_action(dbsession, agreement, 1, "Commission station")


def _list_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "get_evidence_requirements",
        designated_action_id=action.designated_action_id,
    )


def _create_url(fastapi_app, action):
    return fastapi_app.url_path_for(
        "create_evidence_requirement",
        designated_action_id=action.designated_action_id,
    )


def _update_url(fastapi_app, requirement_id):
    return fastapi_app.url_path_for(
        "update_evidence_requirement",
        evidence_requirement_id=requirement_id,
    )


@pytest.mark.anyio
async def test_requirements_are_added_numbered_and_listed_in_order(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC1")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    url = _create_url(fastapi_app, action)

    first = await client.post(url, json={"description": "List of major permits"})
    second = await client.post(url, json={"description": "Environmental review"})

    assert first.status_code == status.HTTP_201_CREATED
    assert first.json()["requirementNumber"] == 1
    assert second.json()["requirementNumber"] == 2

    listed = await client.get(_list_url(fastapi_app, action))
    assert listed.status_code == status.HTTP_200_OK
    rows = listed.json()
    assert [r["description"] for r in rows] == [
        "List of major permits",
        "Environmental review",
    ]
    # Nothing is reviewed until someone reviews it.
    assert all(r["reviewOutcome"] is None for r in rows)
    assert all(r["reviewedBy"] is None for r in rows)


@pytest.mark.anyio
async def test_recording_an_assessment_stamps_who_and_when(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC2")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = await client.post(
        _create_url(fastapi_app, action), json={"description": "Environmental review"}
    )
    requirement_id = created.json()["evidenceRequirementId"]

    response = await client.put(
        _update_url(fastapi_app, requirement_id),
        json={
            "analystReview": "Permits received and verified against the register.",
            "reviewOutcome": REVIEW_OUTCOME_SATISFACTORY,
            "reviewNotes": "Copies filed in the evidence folder.",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["reviewOutcome"] == REVIEW_OUTCOME_SATISFACTORY
    assert data["analystReview"].startswith("Permits received")
    assert data["reviewNotes"] == "Copies filed in the evidence folder."
    assert data["reviewedDate"] is not None
    assert data["reviewedBy"]["firstName"] is not None


@pytest.mark.anyio
async def test_an_unknown_outcome_is_refused(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC3")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = await client.post(
        _create_url(fastapi_app, action), json={"description": "Risk register"}
    )

    response = await client.put(
        _update_url(fastapi_app, created.json()["evidenceRequirementId"]),
        json={"reviewOutcome": "Looks fine to me"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.anyio
async def test_an_outcome_can_be_cleared_back_to_unreviewed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Unchecking both boxes in the UI returns the requirement to pending."""
    action = await _seed_da(dbsession, "IA-26EOC4")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = await client.post(
        _create_url(fastapi_app, action), json={"description": "Risk register"}
    )
    requirement_id = created.json()["evidenceRequirementId"]
    await client.put(
        _update_url(fastapi_app, requirement_id),
        json={"reviewOutcome": REVIEW_OUTCOME_INFORMATION_REQUESTED},
    )

    cleared = await client.put(
        _update_url(fastapi_app, requirement_id), json={"clearReviewOutcome": True}
    )

    assert cleared.json()["reviewOutcome"] is None


@pytest.mark.anyio
async def test_editing_wording_does_not_touch_the_assessment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC5")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = await client.post(
        _create_url(fastapi_app, action), json={"description": "Original wording"}
    )
    requirement_id = created.json()["evidenceRequirementId"]
    await client.put(
        _update_url(fastapi_app, requirement_id),
        json={"reviewOutcome": REVIEW_OUTCOME_SATISFACTORY},
    )

    renamed = await client.put(
        _update_url(fastapi_app, requirement_id),
        json={"description": "Corrected wording"},
    )

    assert renamed.json()["description"] == "Corrected wording"
    assert renamed.json()["reviewOutcome"] == REVIEW_OUTCOME_SATISFACTORY


@pytest.mark.anyio
async def test_removing_a_requirement_hides_it_but_keeps_the_record(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC6")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = await client.post(
        _create_url(fastapi_app, action), json={"description": "Withdrawn requirement"}
    )
    requirement_id = created.json()["evidenceRequirementId"]

    removed = await client.delete(
        fastapi_app.url_path_for(
            "deactivate_evidence_requirement",
            evidence_requirement_id=requirement_id,
        )
    )
    assert removed.status_code == status.HTTP_204_NO_CONTENT

    listed = await client.get(_list_url(fastapi_app, action))
    assert listed.json() == []

    row = (
        await dbsession.execute(
            select(EvidenceRequirement).where(
                EvidenceRequirement.evidence_requirement_id == requirement_id
            )
        )
    ).scalar_one()
    assert row.is_active is False


@pytest.mark.anyio
async def test_numbers_are_not_reused_after_removal(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC7")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    url = _create_url(fastapi_app, action)
    first = await client.post(url, json={"description": "First"})
    await client.delete(
        fastapi_app.url_path_for(
            "deactivate_evidence_requirement",
            evidence_requirement_id=first.json()["evidenceRequirementId"],
        )
    )

    replacement = await client.post(url, json={"description": "Replacement"})

    assert replacement.json()["requirementNumber"] == 2


@pytest.mark.anyio
async def test_a_manager_may_also_record_an_assessment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC8")
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        description="Environmental review",
    )
    dbsession.add(requirement)
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_IA_MANAGER)

    response = await client.put(
        _update_url(fastapi_app, requirement.evidence_requirement_id),
        json={"reviewOutcome": REVIEW_OUTCOME_SATISFACTORY},
    )

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_a_director_may_read_but_not_record(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC9")
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        description="Environmental review",
    )
    dbsession.add(requirement)
    await dbsession.flush()
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    listed = await client.get(_list_url(fastapi_app, action))
    assert listed.status_code == status.HTTP_200_OK
    assert len(listed.json()) == 1

    blocked = await client.put(
        _update_url(fastapi_app, requirement.evidence_requirement_id),
        json={"reviewOutcome": REVIEW_OUTCOME_SATISFACTORY},
    )
    assert blocked.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_proponents_are_refused_entirely(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOCA")
    set_mock_user(fastapi_app, [RoleEnum.IA_PROPONENT])

    response = await client.get(_list_url(fastapi_app, action))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_requirements_of_a_missing_action_are_a_404(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.get(
        fastapi_app.url_path_for(
            "get_evidence_requirements", designated_action_id=999999
        )
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
