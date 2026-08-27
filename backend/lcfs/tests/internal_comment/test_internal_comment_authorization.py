"""Organization scoping on the entity-scoped internal comment endpoints.

``GET /internal_comments/{entity_type}/{entity_id}`` and
``POST /internal_comments/`` admit BCeID users to comments on compliance
reports and CI applications. Entity type and visibility do not bound which
organization a caller reaches, so those endpoints also resolve the entity's
owner and admit only the caller's own organization.
"""

import uuid

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.db.models import UserProfile
from lcfs.db.models.ci_application.CIApplication import CIApplication
from lcfs.db.models.comment.CIApplicationInternalComment import (
    CIApplicationInternalComment,
)
from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import (
    CommentVisibilityEnum,
    EntityTypeEnum,
)

# Compliance period 15 is 2024 (seeded by migration).
COMPLIANCE_PERIOD_ID = 15
AUTHOR = "IDIRUSER"


def _set_bceid_user(fastapi_app, set_mock_user, organization_id: int = 1):
    set_mock_user(
        fastapi_app,
        [RoleEnum.SUPPLIER],
        user_details={
            "keycloak_username": "BCEIDUSER",
            "organization_id": organization_id,
        },
    )


async def _seed_author(add_models):
    """The comment read path inner-joins user_profile on create_user."""
    await add_models(
        [UserProfile(keycloak_username=AUTHOR, first_name="Test", last_name="User")]
    )


async def _seed_report_comment(
    add_models,
    *,
    compliance_report_id: int,
    organization_id: int,
    visibility: str = CommentVisibilityEnum.PUBLIC.value,
    comment: str = "<p>report note</p>",
) -> InternalComment:
    report = ComplianceReport(
        compliance_report_id=compliance_report_id,
        compliance_period_id=COMPLIANCE_PERIOD_ID,
        organization_id=organization_id,
        nickname="test",
        reporting_frequency=ReportingFrequency.ANNUAL,
        compliance_report_group_uuid=str(uuid.uuid4()),
        version=1,
    )
    await add_models([report])

    ic = InternalComment(
        comment=comment,
        comment_search_text=comment,
        visibility=visibility,
        create_user=AUTHOR,
    )
    await add_models([ic])
    await add_models(
        [
            ComplianceReportInternalComment(
                compliance_report_id=compliance_report_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )
    return ic


async def _seed_ci_application_comment(
    add_models,
    *,
    ci_application_id: int,
    organization_id: int,
    visibility: str = CommentVisibilityEnum.PUBLIC.value,
    comment: str = "<p>ci note</p>",
) -> InternalComment:
    application = CIApplication(
        ci_application_id=ci_application_id,
        organization_id=organization_id,
        status_id=1,
        facility_country="Canada",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit=QuantityUnitsEnum.Litres,
        group_uuid=str(uuid.uuid4()),
        version=0,
    )
    await add_models([application])

    ic = InternalComment(
        comment=comment,
        comment_search_text=comment,
        visibility=visibility,
        create_user=AUTHOR,
    )
    await add_models([ic])
    await add_models(
        [
            CIApplicationInternalComment(
                ci_application_id=ci_application_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )
    return ic


# ======================================================================
# Read: GET /internal_comments/{entity_type}/{entity_id}
# ======================================================================
@pytest.mark.anyio
async def test_bceid_can_read_own_orgs_compliance_report_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Control: a supplier still reads the Public thread on its own report."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_report_comment(
        add_models, compliance_report_id=8801, organization_id=1
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=8801,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert [c["internalCommentId"] for c in body] == [ic.internal_comment_id]


@pytest.mark.anyio
async def test_bceid_cannot_read_another_orgs_compliance_report_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Public visibility is not an organization scope: a Public comment on
    another organization's report is not readable."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    await _seed_report_comment(
        add_models,
        compliance_report_id=8802,
        organization_id=2,
        comment="<p>another org's note</p>",
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=8802,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_read_another_orgs_ci_application_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Same gap on the CI application thread."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    await _seed_ci_application_comment(
        add_models,
        ci_application_id=8803,
        organization_id=2,
        comment="<p>another org's ci note</p>",
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.CI_APPLICATION.value,
        entity_id=8803,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_can_read_own_orgs_ci_application_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Control: the CI applicant still reads its own application's thread."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_ci_application_comment(
        add_models, ci_application_id=8804, organization_id=1
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.CI_APPLICATION.value,
        entity_id=8804,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert [c["internalCommentId"] for c in response.json()] == [ic.internal_comment_id]


@pytest.mark.anyio
async def test_government_can_read_any_orgs_compliance_report_comments(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Government behaviour is unchanged: IDIR reads any organization."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.GOVERNMENT],
        user_details={"keycloak_username": AUTHOR},
    )
    await _seed_author(add_models)
    ic = await _seed_report_comment(
        add_models,
        compliance_report_id=8805,
        organization_id=2,
        visibility=CommentVisibilityEnum.INTERNAL.value,
    )

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=8805,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert [c["internalCommentId"] for c in response.json()] == [ic.internal_comment_id]


@pytest.mark.anyio
async def test_reading_comments_on_a_missing_entity_is_refused_for_bceid(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """An entity id that resolves to no organization must fail closed."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)

    url = fastapi_app.url_path_for(
        "get_comments",
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=987654,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ======================================================================
# Write: POST /internal_comments/
# ======================================================================
async def _post_comment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    *,
    entity_type: str,
    entity_id: int,
    visibility: str = CommentVisibilityEnum.PUBLIC.value,
):
    url = fastapi_app.url_path_for("create_comment")
    return await client.post(
        url,
        json={
            "entity_type": entity_type,
            "entity_id": entity_id,
            "comment": "<p>posted by a supplier</p>",
            "visibility": visibility,
        },
    )


@pytest.mark.anyio
async def test_bceid_can_comment_on_own_orgs_compliance_report(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Control: the supplier still posts on its own report."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await add_models(
        [
            ComplianceReport(
                compliance_report_id=8811,
                compliance_period_id=COMPLIANCE_PERIOD_ID,
                organization_id=1,
                nickname="test",
                reporting_frequency=ReportingFrequency.ANNUAL,
                compliance_report_group_uuid=str(uuid.uuid4()),
                version=1,
            )
        ]
    )

    response = await _post_comment(
        client,
        fastapi_app,
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=8811,
    )

    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_bceid_cannot_comment_on_another_orgs_compliance_report(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Creates are scoped the same way reads are."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await add_models(
        [
            ComplianceReport(
                compliance_report_id=8812,
                compliance_period_id=COMPLIANCE_PERIOD_ID,
                organization_id=2,
                nickname="test",
                reporting_frequency=ReportingFrequency.ANNUAL,
                compliance_report_group_uuid=str(uuid.uuid4()),
                version=1,
            )
        ]
    )

    response = await _post_comment(
        client,
        fastapi_app,
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=8812,
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_comment_on_another_orgs_ci_application(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    """Same gap on the CI application thread."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await add_models(
        [
            CIApplication(
                ci_application_id=8813,
                organization_id=2,
                status_id=1,
                facility_country="Canada",
                facility_nameplate_capacity=1000,
                facility_nameplate_capacity_unit=QuantityUnitsEnum.Litres,
                group_uuid=str(uuid.uuid4()),
                version=0,
            )
        ]
    )

    response = await _post_comment(
        client,
        fastapi_app,
        entity_type=EntityTypeEnum.CI_APPLICATION.value,
        entity_id=8813,
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_comment_on_a_missing_compliance_report(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    """An entity id that resolves to no organization must fail closed."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)

    response = await _post_comment(
        client,
        fastapi_app,
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT.value,
        entity_id=987654,
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
