import uuid

from datetime import datetime

import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema, FilterModel, SortOrder
from fakeredis.aioredis import FakeRedis

from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportOrganizationSchema,
    ComplianceReportStatusSchema,
    SummarySchema,
    ComplianceReportHistorySchema,
    ComplianceReportUserSchema,
    ComplianceReportViewSchema,
)


@pytest.fixture
def pagination_request_schema():
    return PaginationRequestSchema(
        page=1,
        size=10,
        sort_orders=[
            SortOrder(field="createdDate", direction="asc"),
            SortOrder(field="status", direction="desc"),
        ],
        filters=[
            FilterModel(
                filter_type="text",
                type="contains",
                filter="exampleValue",
                field="exampleField",
                date_from="2024-01-01",
                date_to="2024-12-31",
            ),
            FilterModel(
                filter_type="date",
                type="range",
                field="createdDate",
                date_from="2024-01-01",
                date_to="2024-12-31",
            ),
        ],
    )


@pytest.fixture
def mock_user_profile(
    role=RoleEnum.GOVERNMENT,
    organization_id=1,
    email="john.doe@example.com",
    user_profile_id=1,
):
    class MockUserProfile:
        def __init__(self):
            self.user_profile_id = user_profile_id
            self.first_name = "John"
            self.last_name = "Doe"
            self.keycloak_username = "johndoe"
            self.organization_id = organization_id
            self.email = email
            self.role_names = [role]

        def role_names(self):
            return self.role_names

    return MockUserProfile()


@pytest.fixture
async def redis_client():
    """
    Fixture to provide a fake Redis client for tests.
    """
    client = FakeRedis()
    try:
        yield client
    finally:
        await client.close()


@pytest.fixture
def compliance_period_schema():
    return CompliancePeriodBaseSchema(
        compliance_period_id=1,
        description="2024",
        effective_date=datetime(2024, 1, 1),
        expiration_date=datetime(2024, 3, 31),
        display_order=1,
    )


@pytest.fixture
def compliance_report_organization_schema():
    return ComplianceReportOrganizationSchema(
        organization_id=1, name="Acme Corporation"
    )


@pytest.fixture
def compliance_report_status_schema():
    return ComplianceReportStatusSchema(compliance_report_status_id=1, status="Draft")


@pytest.fixture
def summary_schema():
    return SummarySchema(
        summary_id=1,
        is_locked=False,
        line_21_non_compliance_penalty_payable=0.0,
        line_11_fossil_derived_base_fuel_total=0.0,
    )


@pytest.fixture
def compliance_report_user_schema(compliance_report_organization_schema):
    return ComplianceReportUserSchema(
        first_name="John",
        last_name="Doe",
        organization=compliance_report_organization_schema,
    )


@pytest.fixture
def compliance_report_history_schema(
    compliance_report_status_schema, compliance_report_user_schema
):
    return ComplianceReportHistorySchema(
        compliance_report_history_id=1,
        compliance_report_id=1,
        status=compliance_report_status_schema,
        user_profile=compliance_report_user_schema,
        create_date=datetime(2024, 4, 1, 12, 0, 0),
    )


@pytest.fixture
def compliance_report_schema(
    compliance_period_schema,
    compliance_report_organization_schema,
    compliance_report_status_schema,
):
    def _create_compliance_report_schema(
        compliance_report_id: int = 1,
        compliance_report_group_uuid: str = None,
        version: int = 0,
        compliance_period_id: int = None,
        compliance_period: CompliancePeriodBaseSchema = None,
        organization_id: int = None,
        organization: ComplianceReportOrganizationSchema = None,
        report_type: str = "Annual Compliance",
        report_status_id: int = None,
        report_status: str = "Submitted",
        update_date: datetime = datetime(2024, 4, 1, 12, 0, 0),
    ):
        compliance_period_id = (
            compliance_period_id or compliance_period_schema.compliance_period_id
        )
        compliance_period = compliance_period or compliance_period_schema
        if isinstance(compliance_period, CompliancePeriodBaseSchema):
            compliance_period = compliance_period.description
        organization_id = (
            organization_id or compliance_report_organization_schema.organization_id
        )
        organization = organization or compliance_report_organization_schema
        organization_name = organization.name if organization else "Default Org"
        compliance_report_group_uuid = compliance_report_group_uuid or str(uuid.uuid4())
        report_status_id = (
            report_status_id
            or compliance_report_status_schema.compliance_report_status_id
        )
        report_status = report_status or compliance_report_status_schema.status

        return ComplianceReportViewSchema(
            compliance_report_id=compliance_report_id,
            compliance_report_group_uuid=compliance_report_group_uuid,
            version=version,
            compliance_period_id=compliance_period_id,
            compliance_period=compliance_period,
            organization_id=organization_id,
            organization_name=organization_name,
            report_type=report_type,
            report_status_id=report_status_id,
            report_status=report_status,
            update_date=update_date,
        )

    return _create_compliance_report_schema


@pytest.fixture
def compliance_report_base_schema(
    compliance_period_schema,
    compliance_report_organization_schema,
    summary_schema,
    compliance_report_status_schema,
    compliance_report_history_schema,
):
    def _create_compliance_report_base_schema(
        compliance_report_id: int = 1,
        compliance_period_id: int = None,
        compliance_period: CompliancePeriodBaseSchema = None,
        organization_id: int = None,
        organization: ComplianceReportOrganizationSchema = None,
        summary: SummarySchema = None,
        current_status_id: int = None,
        current_status: ComplianceReportStatusSchema = None,
        transaction_id: int = None,
        nickname: str = "Annual Compliance",
        supplemental_note: str = "Initial submission.",
        update_date=datetime(2024, 4, 1, 12, 0, 0),
        history: list = None,
        compliance_report_group_uuid: str = None,
        version: int = 0,
        supplemental_initiator: str = None,
        has_supplemental: bool = False,
    ):
        # Assign default values from dependent fixtures if not overridden
        compliance_period_id = (
            compliance_period_id or compliance_period_schema.compliance_period_id
        )
        compliance_period = compliance_period or compliance_period_schema
        organization_id = (
            organization_id or compliance_report_organization_schema.organization_id
        )
        organization = organization or compliance_report_organization_schema
        summary = summary or summary_schema
        current_status_id = (
            current_status_id
            or compliance_report_status_schema.compliance_report_status_id
        )
        current_status = current_status or compliance_report_status_schema
        history = history or [compliance_report_history_schema]
        compliance_report_group_uuid = compliance_report_group_uuid or str(uuid.uuid4())
        supplemental_initiator = supplemental_initiator

        return ComplianceReportBaseSchema(
            compliance_report_id=compliance_report_id,
            compliance_period_id=compliance_period_id,
            compliance_period=compliance_period,
            organization_id=organization_id,
            organization=organization,
            summary=summary,
            current_status_id=current_status_id,
            current_status=current_status,
            transaction_id=transaction_id,
            nickname=nickname,
            supplemental_note=supplemental_note,
            update_date=update_date,
            history=history,
            compliance_report_group_uuid=compliance_report_group_uuid,
            version=version,
            supplemental_initiator=supplemental_initiator,
            has_supplemental=has_supplemental,
        )

    return _create_compliance_report_base_schema
