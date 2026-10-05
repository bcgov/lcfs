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

    first = await client.post(
        url,
        json={"title": "List of major permits", "description": "List of major permits"},
    )
    second = await client.post(
        url,
        json={"title": "Environmental review", "description": "Environmental review"},
    )

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
        _create_url(fastapi_app, action),
        json={"title": "Environmental review", "description": "Environmental review"},
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
        _create_url(fastapi_app, action),
        json={"title": "Risk register", "description": "Risk register"},
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
        _create_url(fastapi_app, action),
        json={"title": "Risk register", "description": "Risk register"},
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
        _create_url(fastapi_app, action),
        json={"title": "Original wording", "description": "Original wording"},
    )
    requirement_id = created.json()["evidenceRequirementId"]
    await client.put(
        _update_url(fastapi_app, requirement_id),
        json={"reviewOutcome": REVIEW_OUTCOME_SATISFACTORY},
    )

    renamed = await client.put(
        _update_url(fastapi_app, requirement_id),
        json={"title": "Corrected wording", "description": "Corrected wording"},
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
        _create_url(fastapi_app, action),
        json={"title": "Withdrawn requirement", "description": "Withdrawn requirement"},
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
    first = await client.post(url, json={"title": "First", "description": "First"})
    await client.delete(
        fastapi_app.url_path_for(
            "deactivate_evidence_requirement",
            evidence_requirement_id=first.json()["evidenceRequirementId"],
        )
    )

    replacement = await client.post(
        url, json={"title": "Replacement", "description": "Replacement"}
    )

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


@pytest.mark.anyio
async def test_a_requirement_needs_a_title(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The heading is the title now, so a requirement cannot go without."""
    action = await _seed_da(dbsession, "IA-26EOC9")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)

    response = await client.post(
        _create_url(fastapi_app, action),
        json={"title": "   ", "description": "Risk register"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "title" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_saving_wording_or_evaluation_is_recorded_with_before_and_after(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A deliberate Save of the title, description or evaluation reaches
    the activity trail as a details-edited event carrying what changed.
    Outcome and notes do not: those are captured whole in the workflow
    snapshots.
    """
    action = await _seed_da(dbsession, "IA-26EOC10")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = (
        await client.post(
            _create_url(fastapi_app, action),
            json={"title": "Permits", "description": "List of major permits"},
        )
    ).json()

    response = await client.put(
        _update_url(fastapi_app, created["evidenceRequirementId"]),
        json={
            "title": "Permits and approvals",
            "analystReview": "All permits are in hand.",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["title"] == "Permits and approvals"

    history_url = fastapi_app.url_path_for(
        "get_designated_action_history",
        designated_action_id=action.designated_action_id,
    )
    entries = (await client.get(history_url)).json()
    edits = [e for e in entries if e["event"] == "DETAILS_EDITED"]
    assert len(edits) == 1
    changed = edits[0]["snapshot"]["changed"]
    assert changed["title"] == {"from": "Permits", "to": "Permits and approvals"}
    assert changed["evaluation"]["to"] == "All permits are in hand."
    assert "description" not in changed
    assert edits[0]["snapshot"]["requirement_number"] == 1

    # Ticking an outcome alone writes no edit event.
    await client.put(
        _update_url(fastapi_app, created["evidenceRequirementId"]),
        json={"reviewOutcome": "Satisfactory"},
    )
    entries = (await client.get(history_url)).json()
    assert len([e for e in entries if e["event"] == "DETAILS_EDITED"]) == 1


@pytest.mark.anyio
async def test_saving_unchanged_wording_records_nothing(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    action = await _seed_da(dbsession, "IA-26EOC11")
    set_mock_user(fastapi_app, IDIR_IA_ANALYST)
    created = (
        await client.post(
            _create_url(fastapi_app, action),
            json={"title": "Permits", "description": "List of major permits"},
        )
    ).json()

    await client.put(
        _update_url(fastapi_app, created["evidenceRequirementId"]),
        json={"title": "Permits", "description": "List of major permits"},
    )

    history_url = fastapi_app.url_path_for(
        "get_designated_action_history",
        designated_action_id=action.designated_action_id,
    )
    entries = (await client.get(history_url)).json()
    assert [e for e in entries if e["event"] == "DETAILS_EDITED"] == []
