"""Global search against real rows: a Draft stays with whoever is drafting
it (#5231). Each test seeds drafts beside submitted records and searches as
IDIR and as each supplier involved."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from lcfs.db.models.ci_application import CIApplication
from lcfs.db.models.ci_application.CIApplicationStatus import CIApplicationStatus
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.search import services as search_services
from lcfs.web.api.search.entities import SEARCH_ENTITIES
from lcfs.web.api.search.services import SearchService

GOVERNMENT_ROLES = (RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.DIRECTOR)


def _user(*roles, organization_id=None):
    return SimpleNamespace(
        role_names=list(roles),
        organization_id=organization_id,
        user_roles=[
            SimpleNamespace(
                role=SimpleNamespace(
                    name=role, is_government_role=role in GOVERNMENT_ROLES
                )
            )
            for role in roles
        ],
    )


IDIR_ANALYST = _user(RoleEnum.GOVERNMENT, RoleEnum.ANALYST)


@pytest.fixture(autouse=True)
def one_entity_at_a_time(monkeypatch):
    """Run the real search service against one entity per call. The fuel
    code search reads a reporting view the test database does not build."""

    def only(entity_type):
        monkeypatch.setattr(
            search_services,
            "SEARCH_ENTITIES",
            [e for e in SEARCH_ENTITIES if e.entity_type == entity_type],
        )

    return only


async def _ids(dbsession, query, user, entity_type, only):
    only(entity_type)
    response = await SearchService(db=dbsession).search(query, user)
    return {
        item.entity_id
        for group in response.groups
        if group.entity_type == entity_type
        for item in group.items
    }


async def _organization(dbsession, organization_id, name):
    organization = Organization(
        organization_id=organization_id,
        organization_code=f"o{organization_id}",
        name=name,
        total_balance=0,
        reserved_balance=0,
        count_transfers_in_progress=0,
    )
    dbsession.add(organization)
    await dbsession.flush()
    return organization


async def _report_status_id(dbsession, status):
    return (
        await dbsession.execute(
            select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == status
            )
        )
    ).scalar_one()


async def _transfer_status_id(dbsession, status):
    return (
        await dbsession.execute(
            select(TransferStatus.transfer_status_id).where(
                TransferStatus.status == status
            )
        )
    ).scalar_one()


@pytest.mark.anyio
async def test_idir_finds_the_last_submitted_version_and_never_a_draft(
    dbsession, one_entity_at_a_time
):
    period = (await dbsession.execute(select(CompliancePeriod).limit(1))).scalar_one()
    organization = await _organization(dbsession, 95231, "Quillfeather Fuels")
    submitted = await _report_status_id(dbsession, ComplianceReportStatusEnum.Submitted)
    draft = await _report_status_id(dbsession, ComplianceReportStatusEnum.Draft)

    def report(report_id, group_uuid, version, status_id):
        return ComplianceReport(
            compliance_report_id=report_id,
            compliance_period_id=period.compliance_period_id,
            organization_id=organization.organization_id,
            current_status_id=status_id,
            compliance_report_group_uuid=group_uuid,
            version=version,
            reporting_frequency=ReportingFrequency.ANNUAL,
        )

    dbsession.add_all(
        [
            # Submitted, then a supplemental the supplier is still drafting.
            report(952311, "5231-chain", 0, submitted),
            report(952312, "5231-chain", 1, draft),
            # Never submitted at all.
            report(952313, "5231-lone", 0, draft),
        ]
    )
    await dbsession.flush()

    # IDIR sees the submitted version in place of the draft on top of it,
    # and nothing of the report that was never submitted.
    assert await _ids(
        dbsession, "Quillfeather", IDIR_ANALYST, "report", one_entity_at_a_time
    ) == {952311}

    # The supplier still finds its own drafts, newest version first.
    supplier = _user(
        RoleEnum.SUPPLIER,
        RoleEnum.COMPLIANCE_REPORTING,
        organization_id=organization.organization_id,
    )
    assert await _ids(
        dbsession, "Quillfeather", supplier, "report", one_entity_at_a_time
    ) == {
        952312,
        952313,
    }


@pytest.mark.anyio
async def test_transfer_search_follows_each_viewers_visibility_flags(
    dbsession, one_entity_at_a_time
):
    sender = await _organization(dbsession, 95232, "Quillfeather Sender")
    receiver = await _organization(dbsession, 95233, "Quillfeather Receiver")

    async def transfer(transfer_id, status):
        dbsession.add(
            Transfer(
                transfer_id=transfer_id,
                from_organization_id=sender.organization_id,
                to_organization_id=receiver.organization_id,
                agreement_date=datetime(2026, 1, 5),
                quantity=10,
                price_per_unit=25,
                current_status_id=await _transfer_status_id(dbsession, status),
            )
        )

    await transfer(952321, TransferStatusEnum.Draft)
    await transfer(952322, TransferStatusEnum.Sent)
    await transfer(952323, TransferStatusEnum.Submitted)
    await transfer(952324, TransferStatusEnum.Declined)
    await dbsession.flush()

    # Government sees a transfer only once it has been submitted to it.
    assert await _ids(
        dbsession, "Quillfeather", IDIR_ANALYST, "transfer", one_entity_at_a_time
    ) == {952323}
    # The receiver never sees the sender's Draft.
    assert await _ids(
        dbsession,
        "Quillfeather",
        _user(RoleEnum.SUPPLIER, RoleEnum.TRANSFER, organization_id=95233),
        "transfer",
        one_entity_at_a_time,
    ) == {952322, 952323, 952324}
    # The sender sees all of its own.
    assert await _ids(
        dbsession,
        "Quillfeather",
        _user(RoleEnum.SUPPLIER, RoleEnum.TRANSFER, organization_id=95232),
        "transfer",
        one_entity_at_a_time,
    ) == {952321, 952322, 952323, 952324}


@pytest.mark.anyio
async def test_idir_never_finds_a_draft_ci_application(dbsession, one_entity_at_a_time):
    organization = await _organization(dbsession, 95234, "Quillfeather Biofuels")

    async def status_id(name):
        return (
            await dbsession.execute(
                select(CIApplicationStatus.ci_application_status_id).where(
                    CIApplicationStatus.status == name
                )
            )
        ).scalar_one()

    def application(application_id, status):
        return CIApplication(
            ci_application_id=application_id,
            organization_id=organization.organization_id,
            status_id=status,
            facility_country="Canada",
            facility_nameplate_capacity=1000,
            facility_nameplate_capacity_unit=QuantityUnitsEnum.Litres,
            group_uuid=f"5231-ci-{application_id}",
            version=0,
        )

    dbsession.add_all(
        [
            application(952341, await status_id("Draft")),
            application(952342, await status_id("Submitted")),
        ]
    )
    await dbsession.flush()

    assert await _ids(
        dbsession,
        "Quillfeather",
        IDIR_ANALYST,
        "ci_application",
        one_entity_at_a_time,
    ) == {952342}
    assert await _ids(
        dbsession,
        "Quillfeather",
        _user(RoleEnum.SUPPLIER, RoleEnum.CI_APPLICANT, organization_id=95234),
        "ci_application",
        one_entity_at_a_time,
    ) == {952341, 952342}
