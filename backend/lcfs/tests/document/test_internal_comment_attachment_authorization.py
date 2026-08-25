"""Organization scoping on internal-comment attachment reads.

Attachment visibility is meant to "match comment permissions" (issue #4514).
The comment read path admits a non-government caller only to a Public comment,
on a complianceReport or ciApplication, belonging to their own organization.
Attachment reads mirror all three so the two stay consistent.
"""

import uuid
from datetime import datetime

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
from lcfs.db.models.comment.TransferInternalComment import TransferInternalComment
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.document.Document import Document
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import CommentVisibilityEnum

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
    await add_models(
        [UserProfile(keycloak_username=AUTHOR, first_name="Test", last_name="User")]
    )


async def _seed_comment_with_attachment(
    add_models,
    *,
    file_name: str,
    visibility: str = CommentVisibilityEnum.PUBLIC.value,
) -> InternalComment:
    """An internal comment carrying one attachment, with no entity link yet."""
    document = Document(
        file_key=f"lcfs-docs/internal_comment/{file_name}",
        file_name=file_name,
        file_size=2048,
        mime_type="application/pdf",
    )
    ic = InternalComment(
        comment=f"<p>{file_name}</p>",
        visibility=visibility,
        create_user=AUTHOR,
    )
    # Linking via the relationship inserts the association row on flush.
    ic.documents = [document]
    await add_models([document, ic])
    return ic


async def _attach_to_report(
    add_models, ic: InternalComment, *, compliance_report_id: int, organization_id: int
):
    await add_models(
        [
            ComplianceReport(
                compliance_report_id=compliance_report_id,
                compliance_period_id=COMPLIANCE_PERIOD_ID,
                organization_id=organization_id,
                nickname="test",
                reporting_frequency=ReportingFrequency.ANNUAL,
                compliance_report_group_uuid=str(uuid.uuid4()),
                version=1,
            )
        ]
    )
    await add_models(
        [
            ComplianceReportInternalComment(
                compliance_report_id=compliance_report_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )


async def _attach_to_ci_application(
    add_models, ic: InternalComment, *, ci_application_id: int, organization_id: int
):
    await add_models(
        [
            CIApplication(
                ci_application_id=ci_application_id,
                organization_id=organization_id,
                status_id=1,
                facility_country="Canada",
                facility_nameplate_capacity=1000,
                facility_nameplate_capacity_unit=QuantityUnitsEnum.Litres,
                group_uuid=str(uuid.uuid4()),
                version=0,
            )
        ]
    )
    await add_models(
        [
            CIApplicationInternalComment(
                ci_application_id=ci_application_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )


async def _attach_to_transfer(
    add_models, ic: InternalComment, *, transfer_id: int, to_organization_id: int
):
    await add_models(
        [
            Transfer(
                transfer_id=transfer_id,
                from_organization_id=1,
                to_organization_id=to_organization_id,
                agreement_date=datetime.now(),
                transaction_effective_date=datetime.now(),
                price_per_unit=1.0,
                quantity=100,
                transfer_category_id=1,
                current_status_id=1,
                recommendation=TransferRecommendationEnum.Record,
                effective_status=True,
            )
        ]
    )
    await add_models(
        [
            TransferInternalComment(
                transfer_id=transfer_id,
                internal_comment_id=ic.internal_comment_id,
            )
        ]
    )


def _list_url(fastapi_app, comment_id: int) -> str:
    return fastapi_app.url_path_for(
        "get_all_documents", parent_type="internal_comment", parent_id=comment_id
    )


# ======================================================================
# Listing attachments
# ======================================================================
@pytest.mark.anyio
async def test_bceid_can_list_attachments_on_own_orgs_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Control: the supplier still reaches its own report's attachments."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="own-org.pdf")
    await _attach_to_report(
        add_models, ic, compliance_report_id=7701, organization_id=1
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_200_OK
    assert [d["fileName"] for d in response.json()] == ["own-org.pdf"]


@pytest.mark.anyio
async def test_bceid_cannot_list_attachments_on_another_orgs_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Public visibility is not an organization scope."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="other-org.pdf")
    await _attach_to_report(
        add_models, ic, compliance_report_id=7702, organization_id=2
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_can_list_attachments_on_own_orgs_ci_application_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Control: the CI applicant still reaches its own application's attachments."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="own-ci.pdf")
    await _attach_to_ci_application(
        add_models, ic, ci_application_id=7703, organization_id=1
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_200_OK
    assert [d["fileName"] for d in response.json()] == ["own-ci.pdf"]


@pytest.mark.anyio
async def test_bceid_cannot_list_attachments_on_another_orgs_ci_application_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Same gap on the CI application thread."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="other-ci.pdf")
    await _attach_to_ci_application(
        add_models, ic, ci_application_id=7704, organization_id=2
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_list_attachments_on_a_transfer_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """The comment read path refuses Transfer threads to non-government
    callers whatever their visibility, so attachment reads must too — even
    when the transfer names the caller's own organization."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="transfer.pdf")
    await _attach_to_transfer(add_models, ic, transfer_id=7705, to_organization_id=1)

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_list_attachments_on_an_unlinked_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """A comment that resolves to no entity fails closed."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="orphan.pdf")

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_bceid_cannot_list_attachments_on_an_internal_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Regression guard: the existing visibility check still applies to a
    comment on the caller's own report."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(
        add_models,
        file_name="internal.pdf",
        visibility=CommentVisibilityEnum.INTERNAL.value,
    )
    await _attach_to_report(
        add_models, ic, compliance_report_id=7706, organization_id=1
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_government_can_list_attachments_on_any_orgs_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Government behaviour is unchanged: IDIR reaches any organization, any
    visibility, any entity type."""
    set_mock_user(
        fastapi_app, [RoleEnum.GOVERNMENT], user_details={"keycloak_username": AUTHOR}
    )
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(
        add_models,
        file_name="gov-readable.pdf",
        visibility=CommentVisibilityEnum.INTERNAL.value,
    )
    await _attach_to_report(
        add_models, ic, compliance_report_id=7707, organization_id=2
    )

    response = await client.get(_list_url(fastapi_app, ic.internal_comment_id))

    assert response.status_code == status.HTTP_200_OK
    assert [d["fileName"] for d in response.json()] == ["gov-readable.pdf"]


# ======================================================================
# Streaming an attachment
# ======================================================================
@pytest.mark.anyio
async def test_bceid_cannot_stream_attachment_on_another_orgs_comment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, add_models
):
    """Listing is only the first half — the download must be refused too."""
    _set_bceid_user(fastapi_app, set_mock_user, organization_id=1)
    await _seed_author(add_models)
    ic = await _seed_comment_with_attachment(add_models, file_name="other-stream.pdf")
    await _attach_to_report(
        add_models, ic, compliance_report_id=7708, organization_id=2
    )
    document_id = ic.documents[0].document_id

    url = fastapi_app.url_path_for(
        "stream_document",
        parent_type="internal_comment",
        parent_id=ic.internal_comment_id,
        document_id=document_id,
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN
