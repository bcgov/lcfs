"""
Once a CI application leaves Draft, the applicant can no longer edit Step 1,
edit Step 3 or delete it, and their document uploads, renames and deletes are
refused, with one exception: while government has documentation requested on
a Submitted application, the applicant may change documents and save Step 3,
which closes the request. Government users keep document access throughout.

These run against the database through the API. The document service is
replaced with a recorder so no file storage is needed: a refused write never
reaches it.
"""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select

from lcfs.db.models import Organization
from lcfs.db.models.ci_application import CIApplication, CIApplicationStatus
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService

AFTER_DRAFT = ["Submitted", "Recommended", "Completed", "Withdrawn"]


async def _scalar(dbsession, stmt):
    return (await dbsession.execute(stmt)).scalar_one()


@pytest.fixture
async def own_org(dbsession):
    return await _scalar(
        dbsession,
        select(Organization.organization_id)
        .order_by(Organization.organization_id)
        .limit(1),
    )


@pytest.fixture
def seed_application(dbsession, add_models, own_org):
    async def _seed(status_name, document_upload_enabled=False):
        status_id = await _scalar(
            dbsession,
            select(CIApplicationStatus.ci_application_status_id).where(
                CIApplicationStatus.status == status_name
            ),
        )
        application = CIApplication(
            organization_id=own_org,
            status_id=status_id,
            facility_city="Original City",
            facility_province_state="BC",
            facility_country="Canada",
            facility_nameplate_capacity=1000,
            facility_nameplate_capacity_unit=QuantityUnitsEnum.Litres,
            supporting_document_other="Original notes",
            document_upload_enabled=document_upload_enabled,
            group_uuid=str(uuid.uuid4()),
            version=0,
        )
        await add_models([application])
        return application.ci_application_id

    return _seed


@pytest.fixture
def as_applicant(fastapi_app: FastAPI, set_mock_user, own_org):
    def _sign_in():
        set_mock_user(
            fastapi_app,
            [RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY],
            {"organization_id": own_org},
        )

    return _sign_in


@pytest.fixture
def as_government(fastapi_app: FastAPI, set_mock_user):
    def _sign_in():
        set_mock_user(fastapi_app, [RoleEnum.ANALYST], {"organization_id": None})

    return _sign_in


class _RecordingDocuments:
    """Stands in for DocumentService behind the document routes."""

    def __init__(self):
        self.calls = []

    @staticmethod
    def _document():
        return SimpleNamespace(document_id=1, file_name="file.pdf", file_size=4)

    async def upload_file(self, file, parent_id, parent_type, user=None, **kwargs):
        self.calls.append(("upload", parent_id))
        return self._document()

    async def rename_file(self, document_id, parent_id, parent_type, display_name):
        self.calls.append(("rename", parent_id))
        return self._document()

    async def delete_file(self, document_id, parent_id, parent_type, **kwargs):
        self.calls.append(("delete", parent_id))
        return True


@pytest.fixture
def documents(fastapi_app: FastAPI):
    recorder = _RecordingDocuments()
    fastapi_app.dependency_overrides[DocumentService] = lambda: recorder
    yield recorder
    fastapi_app.dependency_overrides.pop(DocumentService, None)


def _step1_body():
    return {
        "facilityCity": "Changed City",
        "facilityProvinceState": "BC",
        "facilityCountry": "Canada",
        "facilityNameplateCapacity": 2000,
        "facilityNameplateCapacityUnit": "L",
    }


async def _application_row(dbsession, ci_application_id):
    return (
        await dbsession.execute(
            select(
                CIApplication.facility_city,
                CIApplication.supporting_document_other,
                CIApplication.document_upload_enabled,
            ).where(CIApplication.ci_application_id == ci_application_id)
        )
    ).one()


async def _application_exists(dbsession, ci_application_id):
    return bool(
        await _scalar(
            dbsession,
            select(func.count()).where(
                CIApplication.ci_application_id == ci_application_id
            ),
        )
    )


async def _upload(client, fastapi_app, ci_application_id):
    url = fastapi_app.url_path_for(
        "upload_file", parent_type="ci_application", parent_id=ci_application_id
    )
    return await client.post(
        url, files={"file": ("file.pdf", b"%PDF", "application/pdf")}
    )


async def _rename(client, fastapi_app, ci_application_id):
    url = fastapi_app.url_path_for(
        "rename_file",
        parent_type="ci_application",
        parent_id=ci_application_id,
        document_id=1,
    )
    return await client.put(url, json={"displayName": "renamed.pdf"})


async def _delete_document(client, fastapi_app, ci_application_id):
    url = fastapi_app.url_path_for(
        "delete_file",
        parent_type="ci_application",
        parent_id=ci_application_id,
        document_id=1,
    )
    return await client.delete(url)


# ---------------------------------------------------------------------------
# Step 1, Step 3 and delete
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize("status_name", AFTER_DRAFT)
async def test_step1_after_draft_returns_403_and_changes_nothing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
    status_name,
):
    ci_application_id = await seed_application(status_name)
    as_applicant()

    url = fastapi_app.url_path_for(
        "update_ci_application_step1", ci_application_id=ci_application_id
    )
    response = await client.put(url, json=_step1_body())

    assert response.status_code == 403
    row = await _application_row(dbsession, ci_application_id)
    assert row.facility_city == "Original City"


@pytest.mark.anyio
@pytest.mark.parametrize("status_name", AFTER_DRAFT)
async def test_delete_after_draft_returns_403_and_keeps_application(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
    status_name,
):
    ci_application_id = await seed_application(status_name)
    as_applicant()

    url = fastapi_app.url_path_for(
        "delete_ci_application", ci_application_id=ci_application_id
    )
    response = await client.delete(url)

    assert response.status_code == 403
    assert await _application_exists(dbsession, ci_application_id)


@pytest.mark.anyio
@pytest.mark.parametrize("status_name", AFTER_DRAFT)
async def test_step3_after_draft_returns_403_and_changes_nothing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
    status_name,
):
    ci_application_id = await seed_application(status_name)
    as_applicant()

    url = fastapi_app.url_path_for(
        "update_ci_application_step3", ci_application_id=ci_application_id
    )
    response = await client.put(url, json={"supportingDocumentOther": "Changed"})

    assert response.status_code == 403
    row = await _application_row(dbsession, ci_application_id)
    assert row.supporting_document_other == "Original notes"


@pytest.mark.anyio
@pytest.mark.parametrize("status_name", ["Recommended", "Completed", "Withdrawn"])
async def test_step3_cannot_close_a_request_outside_submitted(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
    status_name,
):
    ci_application_id = await seed_application(
        status_name, document_upload_enabled=True
    )
    as_applicant()

    url = fastapi_app.url_path_for(
        "update_ci_application_step3", ci_application_id=ci_application_id
    )
    response = await client.put(url, json={"supportingDocumentOther": "Changed"})

    assert response.status_code == 403
    row = await _application_row(dbsession, ci_application_id)
    assert row.supporting_document_other == "Original notes"
    assert row.document_upload_enabled is True


@pytest.mark.anyio
async def test_draft_step1_step3_and_delete_still_work(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
):
    ci_application_id = await seed_application("Draft")
    as_applicant()

    step1 = await client.put(
        fastapi_app.url_path_for(
            "update_ci_application_step1", ci_application_id=ci_application_id
        ),
        json=_step1_body(),
    )
    step3 = await client.put(
        fastapi_app.url_path_for(
            "update_ci_application_step3", ci_application_id=ci_application_id
        ),
        json={"supportingDocumentOther": "Changed"},
    )

    assert step1.status_code == 200
    assert step3.status_code == 200
    row = await _application_row(dbsession, ci_application_id)
    assert row.facility_city == "Changed City"
    assert row.supporting_document_other == "Changed"

    deleted = await client.delete(
        fastapi_app.url_path_for(
            "delete_ci_application", ci_application_id=ci_application_id
        )
    )

    assert deleted.status_code == 200
    assert not await _application_exists(dbsession, ci_application_id)


@pytest.mark.anyio
async def test_step3_during_documentation_request_saves_and_closes_it(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    seed_application,
    as_applicant,
):
    ci_application_id = await seed_application(
        "Submitted", document_upload_enabled=True
    )
    as_applicant()

    url = fastapi_app.url_path_for(
        "update_ci_application_step3", ci_application_id=ci_application_id
    )
    response = await client.put(url, json={"supportingDocumentOther": "Changed"})

    assert response.status_code == 200
    row = await _application_row(dbsession, ci_application_id)
    assert row.supporting_document_other == "Changed"
    assert row.document_upload_enabled is False


# ---------------------------------------------------------------------------
# Document upload, rename and delete
# ---------------------------------------------------------------------------

DOCUMENT_WRITES = [_upload, _rename, _delete_document]


@pytest.mark.anyio
@pytest.mark.parametrize("write", DOCUMENT_WRITES)
@pytest.mark.parametrize("status_name", AFTER_DRAFT)
async def test_applicant_document_write_after_draft_returns_403(
    client: AsyncClient,
    fastapi_app: FastAPI,
    seed_application,
    as_applicant,
    documents,
    status_name,
    write,
):
    ci_application_id = await seed_application(status_name)
    as_applicant()

    response = await write(client, fastapi_app, ci_application_id)

    assert response.status_code == 403
    assert documents.calls == []


@pytest.mark.anyio
@pytest.mark.parametrize("write", DOCUMENT_WRITES)
@pytest.mark.parametrize(
    ("status_name", "document_upload_enabled"),
    [("Draft", False), ("Submitted", True)],
)
async def test_applicant_document_write_on_draft_or_during_request_still_works(
    client: AsyncClient,
    fastapi_app: FastAPI,
    seed_application,
    as_applicant,
    documents,
    status_name,
    document_upload_enabled,
    write,
):
    ci_application_id = await seed_application(status_name, document_upload_enabled)
    as_applicant()

    response = await write(client, fastapi_app, ci_application_id)

    assert response.status_code in (200, 201)
    assert len(documents.calls) == 1


@pytest.mark.anyio
@pytest.mark.parametrize("write", DOCUMENT_WRITES)
async def test_government_document_write_after_submission_still_works(
    client: AsyncClient,
    fastapi_app: FastAPI,
    seed_application,
    as_government,
    documents,
    write,
):
    ci_application_id = await seed_application("Submitted")
    as_government()

    response = await write(client, fastapi_app, ci_application_id)

    assert response.status_code in (200, 201)
    assert len(documents.calls) == 1
