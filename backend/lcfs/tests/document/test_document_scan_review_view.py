import pytest
from starlette import status

from lcfs.db.models.document.Document import DocumentScanStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation

FINDINGS = [
    "Contains macros (2 code modules)",
    "Runs automatically when the file is opened",
]


class FakeDocument:
    def __init__(self, scan_status):
        self.document_id = 10
        self.file_name = "model.xlsm"
        self.file_size = 789
        self.display_name = None
        self.create_date = "2024-01-01T00:00:00Z"
        self.create_user = "applicant"
        self.scan_status = scan_status
        self.scan_findings = FINDINGS


class FakeDocumentService:
    status = DocumentScanStatusEnum.pending_approval
    reviews = []

    async def get_by_id_and_type(self, parent_id, parent_type):
        return [FakeDocument(self.status)]

    async def get_uploading_organization_codes(self, usernames):
        return {}

    async def get_object_for_parent(self, document_id, parent_id, parent_type):
        file = {"ContentLength": 3, "Body": [b"abc"], "ContentType": "x"}
        return file, FakeDocument(self.status)

    async def review_scan(self, document_id, parent_id, parent_type, approve, user):
        FakeDocumentService.reviews.append((document_id, parent_id, approve))
        return FakeDocument(
            DocumentScanStatusEnum.approved
            if approve
            else DocumentScanStatusEnum.rejected
        )


class FakeValidation:
    async def validate_organization_access(self, parent_id):
        return


@pytest.fixture(autouse=True)
def override_dependencies(fastapi_app):
    FakeDocumentService.status = DocumentScanStatusEnum.pending_approval
    FakeDocumentService.reviews = []
    fastapi_app.dependency_overrides[DocumentService] = FakeDocumentService
    fastapi_app.dependency_overrides[ComplianceReportValidation] = FakeValidation
    yield
    fastapi_app.dependency_overrides = {}


def stream_url(fastapi_app):
    return fastapi_app.url_path_for(
        "stream_document", parent_type="compliance_report", parent_id=1, document_id=10
    )


def review_url(fastapi_app):
    return fastapi_app.url_path_for(
        "review_document_scan",
        parent_type="compliance_report",
        parent_id=1,
        document_id=10,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "scan_status, message",
    [
        (DocumentScanStatusEnum.pending_approval, "waiting for an administrator"),
        (DocumentScanStatusEnum.rejected, "rejected by an administrator"),
    ],
)
async def test_locked_files_cannot_be_downloaded(
    fastapi_app, client, set_mock_user, scan_status, message
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])
    FakeDocumentService.status = scan_status

    response = await client.get(stream_url(fastapi_app))

    assert response.status_code == status.HTTP_409_CONFLICT
    assert message in response.json()["detail"]


@pytest.mark.anyio
async def test_approved_file_downloads(fastapi_app, client, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    FakeDocumentService.status = DocumentScanStatusEnum.approved

    response = await client.get(stream_url(fastapi_app))

    assert response.status_code == status.HTTP_200_OK
    assert await response.aread() == b"abc"


@pytest.mark.anyio
@pytest.mark.parametrize("decision, approve", [("approve", True), ("reject", False)])
async def test_administrator_reviews_a_file(
    fastapi_app, client, set_mock_user, decision, approve
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])

    response = await client.put(review_url(fastapi_app), json={"decision": decision})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["scanStatus"] == ("approved" if approve else "rejected")
    assert FakeDocumentService.reviews == [(10, 1, approve)]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles",
    [
        [RoleEnum.SUPPLIER],
        [RoleEnum.CI_APPLICANT],
        [RoleEnum.GOVERNMENT, RoleEnum.ANALYST],
    ],
)
async def test_only_administrators_can_review(
    fastapi_app, client, set_mock_user, roles
):
    set_mock_user(fastapi_app, roles)

    response = await client.put(review_url(fastapi_app), json={"decision": "approve"})

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert FakeDocumentService.reviews == []


@pytest.mark.anyio
async def test_unknown_decision_is_refused(fastapi_app, client, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])

    response = await client.put(review_url(fastapi_app), json={"decision": "maybe"})

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles, findings",
    [([RoleEnum.GOVERNMENT], FINDINGS), ([RoleEnum.SUPPLIER], None)],
)
async def test_findings_are_for_government_staff_only(
    fastapi_app, client, set_mock_user, roles, findings
):
    set_mock_user(fastapi_app, roles)

    response = await client.get(
        fastapi_app.url_path_for(
            "get_all_documents", parent_type="compliance_report", parent_id=1
        )
    )

    document = response.json()[0]
    assert document["scanStatus"] == "pending_approval"
    assert document["scanFindings"] == findings
