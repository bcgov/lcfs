"""Setting an initiative agreement package Underway (#5553).

A Director releases a completed Draft to its organization. The package (the
agreement, its notes, designated actions and evidence requirements) has one
lifecycle, the agreement's, so the whole package moves in one update. Until
then the organization does not see any of it.
"""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException, status
from httpx import AsyncClient
from sqlalchemy import select

from lcfs.db.models.document import Document
from lcfs.db.models.initiative_agreement import (
    InitiativeAgreement,
    InitiativeAgreementLifecycleHistory,
    InitiativeAgreementNote,
)
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import EvidenceRequirement
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    initiative_agreement_document_association,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.initiative_agreement.test_designated_actions_api import (
    IDIR_DIRECTOR,
    IDIR_IA_MANAGER,
    _seed_action,
)
from lcfs.tests.initiative_agreement.test_initiative_agreement_api import (
    IDIR_IA_ANALYST,
    PAGINATION_BODY,
    _lifecycle_status_id,
    _seed_agreement,
    _two_org_ids,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices

PROPONENT = [RoleEnum.SUPPLIER, RoleEnum.IA_PROPONENT]


async def _seed_draft_package(dbsession, ia_code, organization_id="first"):
    """A Draft agreement with one of everything its package holds: a note, a
    designated action with an evidence requirement, and a document on each
    of the agreement and the action."""
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id if organization_id == "first" else organization_id,
        ia_code,
        lifecycle_status_id=await _lifecycle_status_id(dbsession, "Draft"),
    )
    note = InitiativeAgreementNote(
        initiative_agreement_id=agreement.initiative_agreement_id,
        note_number=1,
        note_text="<p>Prepared by government</p>",
    )
    action = await _seed_action(dbsession, agreement, 1, "Commission the station")
    requirement = EvidenceRequirement(
        designated_action_id=action.designated_action_id,
        requirement_number=1,
        title="Permits",
        description="List of major permits",
    )
    agreement_file = Document(
        file_key="ia/signed-agreement.pdf",
        file_name="signed-agreement.pdf",
        file_size=4096,
        mime_type="application/pdf",
    )
    action_file = Document(
        file_key="da/award-letter.pdf",
        file_name="award-letter.pdf",
        file_size=4096,
        mime_type="application/pdf",
    )
    dbsession.add_all([note, requirement, agreement_file, action_file])
    await dbsession.flush()
    await dbsession.execute(
        initiative_agreement_document_association.insert().values(
            initiative_agreement_id=agreement.initiative_agreement_id,
            document_id=agreement_file.document_id,
        )
    )
    await dbsession.execute(
        designated_action_document_association.insert().values(
            designated_action_id=action.designated_action_id,
            document_id=action_file.document_id,
        )
    )
    await dbsession.flush()
    return SimpleNamespace(
        org_id=org_id,
        agreement=agreement,
        note=note,
        action=action,
        requirement=requirement,
    )


def _underway_url(fastapi_app, agreement_id):
    return fastapi_app.url_path_for(
        "set_agreement_underway", initiative_agreement_id=agreement_id
    )


async def _history(dbsession, agreement_id):
    result = await dbsession.execute(
        select(InitiativeAgreementLifecycleHistory)
        .where(
            InitiativeAgreementLifecycleHistory.initiative_agreement_id == agreement_id
        )
        .order_by(
            InitiativeAgreementLifecycleHistory.initiative_agreement_lifecycle_history_id
        )
    )
    return list(result.scalars().all())


async def _lifecycle_of(dbsession, agreement):
    await dbsession.refresh(agreement, ["lifecycle_status"])
    return agreement.lifecycle_status.status


def _service(dbsession):
    return InitiativeAgreementServices(
        repo=InitiativeAgreementRepository(dbsession),
        org_service=None,
        internal_comment_service=None,
        notfn_service=None,
    )


def _user(*roles, user_profile_id=None, username="director"):
    return SimpleNamespace(
        role_names=list(roles),
        keycloak_username=username,
        user_profile_id=user_profile_id,
        first_name="Dana",
        last_name="Director",
    )


# ---------------------------------------------------------------------------
# The transition
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_a_director_sets_a_draft_package_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _seed_draft_package(dbsession, "IA-26UW01")
    agreement_id = package.agreement.initiative_agreement_id
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(_underway_url(fastapi_app, agreement_id))

    assert response.status_code == status.HTTP_200_OK, response.text
    body = response.json()
    assert body["lifecycleStatus"]["status"] == "Underway"
    assert [a["name"] for a in body["designatedActions"]] == ["Commission the station"]
    assert await _lifecycle_of(dbsession, package.agreement) == "Underway"
    await dbsession.refresh(package.agreement)
    assert package.agreement.update_user == "mockuser"

    # The audit history records who set it and when.
    history = await _history(dbsession, agreement_id)
    assert len(history) == 1
    assert history[0].lifecycle_status_id == await _lifecycle_status_id(
        dbsession, "Underway"
    )
    assert history[0].user_profile_id == 1
    assert history[0].display_name == "Test User"
    assert history[0].create_user == "mockuser"
    assert history[0].create_date is not None


@pytest.mark.anyio
async def test_the_whole_package_moves_with_the_agreement(dbsession):
    """Notes, designated actions and evidence requirements have no
    lifecycle of their own: every route to them checks the agreement's. So
    the one update moves all of them, and none can be left behind as a
    Draft. Their own records, and the action's review status, are
    untouched."""
    from lcfs.web.api.initiative_agreement.workflow import is_hidden_from

    package = await _seed_draft_package(dbsession, "IA-26UW02")
    agreement_id = package.agreement.initiative_agreement_id
    proponent = _user(*PROPONENT, username="proponent")
    repo = InitiativeAgreementRepository(dbsession)

    before = await repo.get_initiative_agreement_by_id(agreement_id)
    assert is_hidden_from(before, proponent)

    await _service(dbsession).set_agreement_underway(
        agreement_id, _user(RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT)
    )

    after = await repo.get_initiative_agreement_by_id(agreement_id)
    assert after.lifecycle_status.status == "Underway"
    assert not is_hidden_from(after, proponent)

    # The package's records are the same rows, still on this agreement.
    note_rows = await repo.get_notes_with_editors(agreement_id)
    assert [(n.initiative_agreement_note_id, n.note_text) for n, _ in note_rows] == [
        (package.note.initiative_agreement_note_id, "<p>Prepared by government</p>")
    ]
    action = await repo.get_designated_action_by_id(package.action.designated_action_id)
    assert action.initiative_agreement_id == agreement_id
    assert action.current_status.status == "Not started"
    requirement = await repo.get_evidence_requirement(
        package.requirement.evidence_requirement_id
    )
    assert (requirement.designated_action_id, requirement.is_active) == (
        action.designated_action_id,
        True,
    )


@pytest.mark.anyio
async def test_setting_underway_twice_records_it_once(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """A second confirm, say from a second tab, is refused: the package is
    already Underway, and the history holds one entry."""
    package = await _seed_draft_package(dbsession, "IA-26UW03")
    agreement_id = package.agreement.initiative_agreement_id
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    first = await client.put(_underway_url(fastapi_app, agreement_id))
    second = await client.put(_underway_url(fastapi_app, agreement_id))

    assert first.status_code == status.HTTP_200_OK
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert "Only a draft" in second.json()["detail"]
    assert len(await _history(dbsession, agreement_id)) == 1


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles",
    [
        IDIR_IA_ANALYST,
        IDIR_IA_MANAGER,
        [RoleEnum.GOVERNMENT],
        [RoleEnum.ANALYST, RoleEnum.GOVERNMENT],
        [RoleEnum.COMPLIANCE_MANAGER, RoleEnum.GOVERNMENT],
        [RoleEnum.ADMINISTRATOR, RoleEnum.GOVERNMENT],
        PROPONENT,
        [RoleEnum.SUPPLIER, RoleEnum.IA_SIGNER],
    ],
    ids=lambda roles: "+".join(role.name for role in roles),
)
async def test_only_a_director_may_set_an_agreement_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, roles
):
    package = await _seed_draft_package(dbsession, "IA-26UW04")
    agreement_id = package.agreement.initiative_agreement_id
    set_mock_user(fastapi_app, roles, {"organization_id": package.org_id})

    response = await client.put(_underway_url(fastapi_app, agreement_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert await _lifecycle_of(dbsession, package.agreement) == "Draft"
    assert await _history(dbsession, agreement_id) == []


@pytest.mark.anyio
async def test_the_service_refuses_anyone_but_a_director(dbsession):
    """The route checks the role, and so does the service, so no other
    caller of it can skip the check."""
    package = await _seed_draft_package(dbsession, "IA-26UW05")
    agreement_id = package.agreement.initiative_agreement_id

    with pytest.raises(HTTPException) as error:
        await _service(dbsession).set_agreement_underway(
            agreement_id, _user(RoleEnum.IA_MANAGER, RoleEnum.GOVERNMENT)
        )

    assert error.value.status_code == status.HTTP_403_FORBIDDEN
    assert await _lifecycle_of(dbsession, package.agreement) == "Draft"
    assert await _history(dbsession, agreement_id) == []


# ---------------------------------------------------------------------------
# What can be set Underway
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize("lifecycle", ["Underway", "Completed", "Terminated"])
async def test_only_a_draft_can_be_set_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, lifecycle
):
    org_id, _ = await _two_org_ids(dbsession)
    agreement = await _seed_agreement(
        dbsession,
        org_id,
        "IA-26UW06",
        lifecycle_status_id=await _lifecycle_status_id(dbsession, lifecycle),
    )
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(
        _underway_url(fastapi_app, agreement.initiative_agreement_id)
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert lifecycle in response.json()["detail"]
    assert await _lifecycle_of(dbsession, agreement) == lifecycle
    assert await _history(dbsession, agreement.initiative_agreement_id) == []


@pytest.mark.anyio
async def test_a_draft_without_an_organization_cannot_be_set_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """Underway opens the package to its organization, so it needs one; the
    edit that fills one in is closed once it is Underway."""
    package = await _seed_draft_package(dbsession, "IA-26UW07", organization_id=None)
    agreement_id = package.agreement.initiative_agreement_id
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(_underway_url(fastapi_app, agreement_id))

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "organization" in response.json()["detail"]
    assert await _lifecycle_of(dbsession, package.agreement) == "Draft"
    assert await _history(dbsession, agreement_id) == []


@pytest.mark.anyio
@pytest.mark.parametrize("target", ["missing", "legacy_award"])
async def test_a_missing_agreement_or_a_legacy_award_reads_as_missing(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession, target
):
    agreement_id = 999999
    if target == "legacy_award":
        org_id, _ = await _two_org_ids(dbsession)
        award = InitiativeAgreement(to_organization_id=org_id, compliance_units=100)
        dbsession.add(award)
        await dbsession.flush()
        agreement_id = award.initiative_agreement_id
    set_mock_user(fastapi_app, IDIR_DIRECTOR)

    response = await client.put(_underway_url(fastapi_app, agreement_id))

    assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# What the organization sees, before and after
# ---------------------------------------------------------------------------


async def _organization_view(client, fastapi_app, package):
    """What an organization's proponent can ask for about the package: the
    grid, the page, the agreement's and the action's documents, and the
    dashboard card."""
    agreement_id = package.agreement.initiative_agreement_id
    grid = await client.post(
        fastapi_app.url_path_for("get_initiative_agreements"),
        json={**PAGINATION_BODY, "size": 200},
    )
    return {
        "in_grid": package.agreement.ia_code
        in {row["iaCode"] for row in grid.json()["initiativeAgreements"]},
        "profile": (
            await client.get(
                fastapi_app.url_path_for(
                    "get_initiative_agreement_profile",
                    initiative_agreement_id=agreement_id,
                )
            )
        ).status_code,
        "agreement_documents": (
            await client.get(
                fastapi_app.url_path_for(
                    "get_all_documents",
                    parent_type="initiativeAgreement",
                    parent_id=agreement_id,
                )
            )
        ).status_code,
        "action_documents": (
            await client.get(
                fastapi_app.url_path_for(
                    "get_all_documents",
                    parent_type="designatedAction",
                    parent_id=package.action.designated_action_id,
                )
            )
        ).status_code,
        "card": (
            await client.get("/api/dashboard/org-initiative-agreement-counts")
        ).json(),
    }


@pytest.mark.anyio
async def test_the_organization_does_not_see_a_draft_package(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _seed_draft_package(dbsession, "IA-26UW08")
    set_mock_user(fastapi_app, PROPONENT, {"organization_id": package.org_id})

    view = await _organization_view(client, fastapi_app, package)

    assert view["in_grid"] is False
    assert view["profile"] == status.HTTP_404_NOT_FOUND
    assert view["agreement_documents"] == status.HTTP_404_NOT_FOUND
    assert view["action_documents"] == status.HTTP_404_NOT_FOUND
    assert view["card"] == {"underway": 0, "completed": 0}


@pytest.mark.anyio
async def test_the_organization_sees_the_package_once_it_is_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    """The Director's transition runs through the service here because the
    test client signs in one user per test."""
    package = await _seed_draft_package(dbsession, "IA-26UW09")
    await _service(dbsession).set_agreement_underway(
        package.agreement.initiative_agreement_id,
        _user(RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT),
    )
    set_mock_user(fastapi_app, PROPONENT, {"organization_id": package.org_id})

    view = await _organization_view(client, fastapi_app, package)

    assert view["in_grid"] is True
    assert view["profile"] == status.HTTP_200_OK
    assert view["agreement_documents"] == status.HTTP_200_OK
    assert view["action_documents"] == status.HTTP_200_OK
    assert view["card"] == {"underway": 1, "completed": 0}


@pytest.mark.anyio
async def test_another_organization_still_does_not_see_it_once_underway(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    package = await _seed_draft_package(dbsession, "IA-26UW10")
    await _service(dbsession).set_agreement_underway(
        package.agreement.initiative_agreement_id,
        _user(RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT),
    )
    _, other_org = await _two_org_ids(dbsession)
    set_mock_user(fastapi_app, PROPONENT, {"organization_id": other_org})

    view = await _organization_view(client, fastapi_app, package)

    assert view["in_grid"] is False
    assert view["profile"] == status.HTTP_403_FORBIDDEN
    assert view["agreement_documents"] == status.HTTP_403_FORBIDDEN
    assert view["action_documents"] == status.HTTP_403_FORBIDDEN
