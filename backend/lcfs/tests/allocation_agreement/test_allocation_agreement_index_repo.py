"""
Database-backed tests for the cross-report allocation agreements index.

These run against the real test database (not mocks) because the behaviour
under test is SQL: joins, the Draft exclusion, the OR organization match,
filtering, sorting and paging.
"""

import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance import (
    AllocationAgreement,
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
)
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.organization.Organization import Organization
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.base import FilterModel, PaginationRequestSchema, SortOrder

pytestmark = pytest.mark.anyio


@pytest.fixture
def repo(dbsession):
    return AllocationAgreementRepository(db=dbsession, fuel_repo=MagicMock())


@pytest.fixture
async def lookups(dbsession):
    statuses = {
        s.status: s.compliance_report_status_id
        for s in (await dbsession.execute(select(ComplianceReportStatus))).scalars()
    }
    periods = {
        p.description: p.compliance_period_id
        for p in (await dbsession.execute(select(CompliancePeriod))).scalars()
    }
    transaction_types = {
        t.type: t.allocation_transaction_type_id
        for t in (await dbsession.execute(select(AllocationTransactionType))).scalars()
    }
    fuel_type_id = (
        await dbsession.execute(select(FuelType.fuel_type_id).limit(1))
    ).scalar_one()
    return {
        "statuses": statuses,
        "periods": periods,
        "transaction_types": transaction_types,
        "fuel_type_id": fuel_type_id,
    }


async def _org(dbsession, name):
    org = Organization(
        name=name,
        operating_name=name,
        organization_status_id=2,
        organization_type_id=1,
    )
    dbsession.add(org)
    await dbsession.flush()
    return org


async def _report(
    dbsession, lookups, org, status, period="2024", group_uuid=None, version=0
):
    report = ComplianceReport(
        compliance_period_id=lookups["periods"][period],
        organization_id=org.organization_id,
        current_status_id=lookups["statuses"][status],
        compliance_report_group_uuid=group_uuid or str(uuid.uuid4()),
        version=version,
    )
    dbsession.add(report)
    await dbsession.flush()
    return report


async def _agreement(
    dbsession,
    lookups,
    report,
    partner,
    quantity=100,
    action_type=ActionTypeEnum.CREATE,
    group_uuid=None,
    version=0,
    transaction_type="Allocated from",
    **extra,
):
    agreement = AllocationAgreement(
        compliance_report_id=report.compliance_report_id,
        transaction_partner=partner,
        postal_address="1 Main St",
        quantity=quantity,
        units="L",
        ci_of_fuel=50.5,
        fuel_type_id=lookups["fuel_type_id"],
        allocation_transaction_type_id=lookups["transaction_types"][transaction_type],
        group_uuid=group_uuid or str(uuid.uuid4()),
        version=version,
        action_type=action_type,
        **extra,
    )
    dbsession.add(agreement)
    await dbsession.flush()
    return agreement


def _pagination(page=1, size=25, filters=None, sort_orders=None):
    return PaginationRequestSchema(
        page=page,
        size=size,
        filters=filters or [],
        sort_orders=sort_orders or [],
    )


def _ids(rows):
    return {row.allocation_agreement_id for row in rows}


async def test_draft_report_versions_are_excluded(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org A")
    draft = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Draft)
    submitted = await _report(
        dbsession, lookups, org, ComplianceReportStatusEnum.Submitted, period="2023"
    )
    hidden = await _agreement(dbsession, lookups, draft, "Partner X")
    shown = await _agreement(dbsession, lookups, submitted, "Partner X")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("transaction_partner", "equals", "Partner X")])
    )

    assert _ids(rows) == {shown.allocation_agreement_id}
    assert hidden.allocation_agreement_id not in _ids(rows)
    assert total == 1


async def test_status_period_and_reporting_org_come_from_the_owning_version(
    dbsession, repo, lookups
):
    org = await _org(dbsession, "Index Org B")
    group = str(uuid.uuid4())
    original = await _report(
        dbsession,
        lookups,
        org,
        ComplianceReportStatusEnum.Assessed,
        period="2023",
        group_uuid=group,
        version=0,
    )
    supplemental = await _report(
        dbsession,
        lookups,
        org,
        ComplianceReportStatusEnum.Analyst_adjustment,
        period="2023",
        group_uuid=group,
        version=1,
    )
    agreement_group = str(uuid.uuid4())
    v0 = await _agreement(
        dbsession, lookups, original, "Partner B", group_uuid=agreement_group
    )
    v1 = await _agreement(
        dbsession,
        lookups,
        supplemental,
        "Partner B",
        quantity=250,
        group_uuid=agreement_group,
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("transaction_partner", "equals", "Partner B")])
    )

    by_id = {row.allocation_agreement_id: row for row in rows}
    assert total == 2
    assert by_id[v0.allocation_agreement_id].status == (
        ComplianceReportStatusEnum.Assessed
    )
    assert by_id[v1.allocation_agreement_id].status == (
        ComplianceReportStatusEnum.Analyst_adjustment
    )
    assert by_id[v1.allocation_agreement_id].quantity == 250
    for row in rows:
        assert row.compliance_period == "2023"
        assert row.reporting_organization == "Index Org B"


async def test_delete_tombstones_are_not_listed(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org C")
    report = await _report(
        dbsession, lookups, org, ComplianceReportStatusEnum.Submitted
    )
    live = await _agreement(dbsession, lookups, report, "Partner C")
    tombstone = await _agreement(
        dbsession,
        lookups,
        report,
        "Partner C",
        action_type=ActionTypeEnum.DELETE,
        version=1,
    )

    rows, _ = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("transaction_partner", "equals", "Partner C")])
    )

    assert _ids(rows) == {live.allocation_agreement_id}
    assert tombstone.allocation_agreement_id not in _ids(rows)


async def _every_row_for(dbsession, organization_id):
    """
    Independent oracle for the index: a plain read of the rows that belong to
    one organization's reports, applying only the two documented exclusions
    (Draft report versions and DELETE tombstones).
    """
    result = await dbsession.execute(
        select(
            AllocationAgreement.allocation_agreement_id,
            ComplianceReportStatus.status,
        )
        .join(
            ComplianceReport,
            ComplianceReport.compliance_report_id
            == AllocationAgreement.compliance_report_id,
        )
        .join(
            ComplianceReportStatus,
            ComplianceReportStatus.compliance_report_status_id
            == ComplianceReport.current_status_id,
        )
        .where(
            ComplianceReport.organization_id == organization_id,
            ComplianceReportStatus.status != ComplianceReportStatusEnum.Draft,
            AllocationAgreement.action_type != ActionTypeEnum.DELETE,
        )
    )
    return {agreement_id: status for agreement_id, status in result.all()}


async def test_report_version_chain_lists_each_record_once_under_its_own_version(
    dbsession, repo, lookups
):
    """
    A report series (same group_uuid) with an original and three supplementals.
    Supplementals start empty: a row only exists in a version where that
    agreement was added, edited or deleted. Every non-Draft row is listed once,
    with the status of the version that owns it; only Draft versions and DELETE
    tombstones are left out.
    """
    org = await _org(dbsession, "Versioned Org")
    series = str(uuid.uuid4())
    statuses = ComplianceReportStatusEnum
    v0 = await _report(dbsession, lookups, org, statuses.Assessed, "2023", series, 0)
    v1 = await _report(dbsession, lookups, org, statuses.Submitted, "2023", series, 1)
    v2 = await _report(dbsession, lookups, org, statuses.Draft, "2023", series, 2)
    v3 = await _report(
        dbsession, lookups, org, statuses.Analyst_adjustment, "2023", series, 3
    )
    update, delete = ActionTypeEnum.UPDATE, ActionTypeEnum.DELETE

    # Never touched after the original report
    untouched = await _agreement(dbsession, lookups, v0, "Untouched Partner")

    # Edited in v1, again in the Draft v2 and again in v3
    edited_group = str(uuid.uuid4())
    edited_v0 = await _agreement(
        dbsession, lookups, v0, "Edited Partner", group_uuid=edited_group
    )
    edited_v1 = await _agreement(
        dbsession, lookups, v1, "Edited Partner", 110, update, edited_group, 1
    )
    edited_v2 = await _agreement(
        dbsession, lookups, v2, "Edited Partner", 120, update, edited_group, 2
    )
    edited_v3 = await _agreement(
        dbsession, lookups, v3, "Edited Partner", 130, update, edited_group, 3
    )

    # Deleted in v1: the original row stays, the tombstone is not an agreement
    deleted_group = str(uuid.uuid4())
    deleted_v0 = await _agreement(
        dbsession, lookups, v0, "Deleted Partner", group_uuid=deleted_group
    )
    tombstone = await _agreement(
        dbsession, lookups, v1, "Deleted Partner", 100, delete, deleted_group, 1
    )

    # Added for the first time in a supplemental
    added_in_v1 = await _agreement(dbsession, lookups, v1, "Added Partner")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=org.organization_id
    )

    expected = {
        untouched.allocation_agreement_id: statuses.Assessed,
        edited_v0.allocation_agreement_id: statuses.Assessed,
        edited_v1.allocation_agreement_id: statuses.Submitted,
        edited_v3.allocation_agreement_id: statuses.Analyst_adjustment,
        deleted_v0.allocation_agreement_id: statuses.Assessed,
        added_in_v1.allocation_agreement_id: statuses.Submitted,
    }
    assert {row.allocation_agreement_id: row.status for row in rows} == expected
    assert edited_v2.allocation_agreement_id not in _ids(rows)  # Draft version
    assert tombstone.allocation_agreement_id not in _ids(rows)  # DELETE record

    # Exactly one row per record: no row repeated by any join, and the total
    # matches both the rows returned and an independent read.
    assert len(rows) == len(_ids(rows)) == total == len(expected)
    assert await _every_row_for(dbsession, org.organization_id) == expected

    # Each row carries the values of the version that owns it, not the latest
    by_id = {row.allocation_agreement_id: row for row in rows}
    assert by_id[edited_v0.allocation_agreement_id].quantity == 100
    assert by_id[edited_v1.allocation_agreement_id].quantity == 110
    assert by_id[edited_v3.allocation_agreement_id].quantity == 130
    for row in rows:
        assert row.compliance_period == "2023"
        assert row.reporting_organization == "Versioned Org"


async def test_a_version_appears_once_it_leaves_draft(dbsession, repo, lookups):
    """
    Status is read at query time: a supplemental is hidden while Draft and its
    rows appear (once each) as soon as it is submitted.
    """
    org = await _org(dbsession, "Lifecycle Org")
    series = str(uuid.uuid4())
    original = await _report(
        dbsession,
        lookups,
        org,
        ComplianceReportStatusEnum.Assessed,
        group_uuid=series,
        version=0,
    )
    supplemental = await _report(
        dbsession,
        lookups,
        org,
        ComplianceReportStatusEnum.Draft,
        group_uuid=series,
        version=1,
    )
    group = str(uuid.uuid4())
    await _agreement(
        dbsession, lookups, original, "Lifecycle Partner", group_uuid=group
    )
    edit = await _agreement(
        dbsession,
        lookups,
        supplemental,
        "Lifecycle Partner",
        150,
        ActionTypeEnum.UPDATE,
        group,
        1,
    )

    before, before_total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=org.organization_id
    )
    assert before_total == len(before) == 1
    assert edit.allocation_agreement_id not in _ids(before)

    supplemental.current_status_id = lookups["statuses"][
        ComplianceReportStatusEnum.Submitted
    ]
    await dbsession.flush()

    after, after_total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=org.organization_id
    )
    assert after_total == len(after) == 2
    assert {row.status for row in after} == {
        ComplianceReportStatusEnum.Assessed,
        ComplianceReportStatusEnum.Submitted,
    }


async def test_lookup_joins_do_not_multiply_rows(dbsession, repo, lookups):
    """
    Every optional lookup (fuel category, provision of the act, fuel code and
    its prefix) populated, on records spread across several versions: the
    number of rows must still equal the number of allocation agreement records.
    """
    category_id = (
        await dbsession.execute(select(FuelCategory.fuel_category_id).limit(1))
    ).scalar_one()
    provision_id = (
        await dbsession.execute(
            select(ProvisionOfTheAct.provision_of_the_act_id).limit(1)
        )
    ).scalar_one()
    prefix_id = (
        await dbsession.execute(select(FuelCodePrefix.fuel_code_prefix_id).limit(1))
    ).scalar_one()
    fuel_code = FuelCode(
        prefix_id=prefix_id,
        fuel_suffix="901.0",
        company="Lookup Fuels",
        carbon_intensity=20,
        edrms="edrms-index",
        application_date=date(2024, 1, 1),
        fuel_type_id=lookups["fuel_type_id"],
        feedstock="Feedstock",
        feedstock_location="Canada",
    )
    dbsession.add(fuel_code)
    await dbsession.flush()

    org = await _org(dbsession, "Lookup Org")
    series = str(uuid.uuid4())
    versions = [
        await _report(dbsession, lookups, org, status, "2024", series, version)
        for version, status in enumerate(
            (
                ComplianceReportStatusEnum.Assessed,
                ComplianceReportStatusEnum.Submitted,
                ComplianceReportStatusEnum.Assessed,
            )
        )
    ]
    created = 0
    for version, report in enumerate(versions):
        for number in range(4):
            await _agreement(
                dbsession,
                lookups,
                report,
                f"Lookup Partner {version}-{number}",
                fuel_category_id=category_id,
                provision_of_the_act_id=provision_id,
                fuel_code_id=fuel_code.fuel_code_id,
            )
            created += 1

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(size=100), organization_id=org.organization_id
    )

    assert total == len(rows) == len(_ids(rows)) == created
    assert all(row.fuel_code for row in rows)
    assert all(row.fuel_category for row in rows)
    assert all(row.provision_of_the_act for row in rows)

    # Paging through must visit every record exactly once as well
    seen = []
    for page in (1, 2, 3):
        page_rows, page_total = await repo.get_allocation_agreements_index(
            _pagination(page=page, size=5), organization_id=org.organization_id
        )
        assert page_total == created
        seen.extend(row.allocation_agreement_id for row in page_rows)
    assert len(seen) == len(set(seen)) == created


async def test_organization_filter_matches_reporting_org_or_transaction_partner(
    dbsession, repo, lookups
):
    target = await _org(dbsession, "Target Fuels Ltd.")
    other = await _org(dbsession, "Other Fuels Ltd.")
    third = await _org(dbsession, "Third Fuels Ltd.")

    target_report = await _report(
        dbsession, lookups, target, ComplianceReportStatusEnum.Assessed
    )
    other_report = await _report(
        dbsession, lookups, other, ComplianceReportStatusEnum.Assessed
    )
    third_report = await _report(
        dbsession, lookups, third, ComplianceReportStatusEnum.Assessed
    )

    as_reporter = await _agreement(dbsession, lookups, target_report, "Somebody Else")
    # Partner name differs from the legal name by case and surrounding space
    as_partner = await _agreement(
        dbsession, lookups, other_report, "  target fuels ltd. "
    )
    # Matches on BOTH sides: must still be returned once
    both = await _agreement(dbsession, lookups, target_report, "Target Fuels Ltd.")
    unrelated = await _agreement(dbsession, lookups, third_report, "Nobody Relevant")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=target.organization_id
    )

    assert _ids(rows) == {
        as_reporter.allocation_agreement_id,
        as_partner.allocation_agreement_id,
        both.allocation_agreement_id,
    }
    assert unrelated.allocation_agreement_id not in _ids(rows)
    assert total == 3
    assert len(rows) == len(_ids(rows)), "organization match must not duplicate rows"


async def test_organization_filter_combines_with_other_filters_and_clears(
    dbsession, repo, lookups
):
    target = await _org(dbsession, "Combo Target Inc.")
    other = await _org(dbsession, "Combo Other Inc.")
    target_report = await _report(
        dbsession, lookups, target, ComplianceReportStatusEnum.Submitted, period="2024"
    )
    older_report = await _report(
        dbsession, lookups, target, ComplianceReportStatusEnum.Assessed, period="2023"
    )
    other_report = await _report(
        dbsession, lookups, other, ComplianceReportStatusEnum.Assessed, period="2024"
    )
    in_2024 = await _agreement(dbsession, lookups, target_report, "P1")
    in_2023 = await _agreement(dbsession, lookups, older_report, "P2")
    as_partner_2024 = await _agreement(
        dbsession, lookups, other_report, "Combo Target Inc."
    )

    filtered, total = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("compliance_period", "equals", "2024")]),
        organization_id=target.organization_id,
    )
    assert _ids(filtered) == {
        in_2024.allocation_agreement_id,
        as_partner_2024.allocation_agreement_id,
    }
    assert total == 2

    # Clearing the organization returns every org again (other filters stay)
    cleared, cleared_total = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("compliance_period", "equals", "2024")]),
        organization_id=None,
    )
    assert {
        in_2024.allocation_agreement_id,
        as_partner_2024.allocation_agreement_id,
    } <= _ids(cleared)
    assert in_2023.allocation_agreement_id not in _ids(cleared)
    assert cleared_total >= total


async def test_unknown_organization_returns_nothing(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org D")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    await _agreement(dbsession, lookups, report, "Partner D")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=-1
    )

    assert rows == []
    assert total == 0


async def test_status_filter_matches_display_label(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org E")
    adjusting = await _report(
        dbsession, lookups, org, ComplianceReportStatusEnum.Analyst_adjustment
    )
    assessed = await _report(
        dbsession, lookups, org, ComplianceReportStatusEnum.Assessed, period="2023"
    )
    wanted = await _agreement(dbsession, lookups, adjusting, "Partner E")
    await _agreement(dbsession, lookups, assessed, "Partner E")

    rows, _ = await repo.get_allocation_agreements_index(
        _pagination(
            filters=[
                _text("status", "equals", "Analyst adjustment"),
                _text("transaction_partner", "equals", "Partner E"),
            ]
        )
    )

    assert _ids(rows) == {wanted.allocation_agreement_id}
    assert rows[0].status == ComplianceReportStatusEnum.Analyst_adjustment

    # The enum name form (what the statuses lookup returns) matches as well
    underscored, _ = await repo.get_allocation_agreements_index(
        _pagination(
            filters=[
                _text("status", "equals", "Analyst_adjustment"),
                _text("transaction_partner", "equals", "Partner E"),
            ]
        )
    )
    assert _ids(underscored) == {wanted.allocation_agreement_id}

    as_set, _ = await repo.get_allocation_agreements_index(
        _pagination(
            filters=[
                FilterModel(
                    field="status",
                    filter_type="set",
                    type="set",
                    values=["Assessed", "Analyst_adjustment"],
                ),
                _text("transaction_partner", "equals", "Partner E"),
            ]
        )
    )
    assert len(as_set) == 2


async def test_fuel_code_and_quarterly_columns(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org F")
    report = await _report(
        dbsession, lookups, org, ComplianceReportStatusEnum.Submitted
    )
    agreement = await _agreement(
        dbsession,
        lookups,
        report,
        "Partner F",
        quantity=None,
        q1_quantity=10,
        q2_quantity=20,
        q3_quantity=None,
        q4_quantity=5,
    )

    rows, _ = await repo.get_allocation_agreements_index(
        _pagination(filters=[_text("transaction_partner", "equals", "Partner F")])
    )

    row = rows[0]
    assert row.allocation_agreement_id == agreement.allocation_agreement_id
    assert row.total_quantity == 35
    assert row.fuel_code is None
    assert row.allocation_transaction_type == "Allocated from"

    by_total, _ = await repo.get_allocation_agreements_index(
        _pagination(
            filters=[
                FilterModel(
                    field="total_quantity",
                    filter_type="number",
                    type="greaterThan",
                    filter=30,
                ),
                _text("transaction_partner", "equals", "Partner F"),
            ]
        )
    )
    assert _ids(by_total) == {agreement.allocation_agreement_id}


async def test_sorting_and_paging_are_stable_and_accurate(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org G")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    created = []
    for quantity in (30, 10, 20, 20, 40):
        created.append(
            await _agreement(
                dbsession, lookups, report, "Paging Partner", quantity=quantity
            )
        )

    only_partner = _text("transaction_partner", "equals", "Paging Partner")

    page_one, total = await repo.get_allocation_agreements_index(
        _pagination(
            page=1,
            size=2,
            filters=[only_partner],
            sort_orders=[SortOrder(field="quantity", direction="asc")],
        )
    )
    page_two, _ = await repo.get_allocation_agreements_index(
        _pagination(
            page=2,
            size=2,
            filters=[only_partner],
            sort_orders=[SortOrder(field="quantity", direction="asc")],
        )
    )
    page_three, _ = await repo.get_allocation_agreements_index(
        _pagination(
            page=3,
            size=2,
            filters=[only_partner],
            sort_orders=[SortOrder(field="quantity", direction="asc")],
        )
    )

    assert total == 5
    assert [r.quantity for r in page_one] == [10, 20]
    assert [r.quantity for r in page_two] == [20, 30]
    assert [r.quantity for r in page_three] == [40]
    seen = [r.allocation_agreement_id for r in page_one + page_two + page_three]
    assert len(seen) == len(set(seen)) == 5, "no row repeated or skipped across pages"

    descending, _ = await repo.get_allocation_agreements_index(
        _pagination(
            filters=[only_partner],
            sort_orders=[SortOrder(field="quantity", direction="desc")],
        )
    )
    assert [r.quantity for r in descending] == [40, 30, 20, 20, 10]


async def test_paging_past_the_end_still_reports_the_total(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org H")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    await _agreement(dbsession, lookups, report, "Beyond Partner")
    await _agreement(dbsession, lookups, report, "Beyond Partner")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(
            page=5,
            size=10,
            filters=[_text("transaction_partner", "equals", "Beyond Partner")],
        )
    )

    assert rows == []
    assert total == 2


@pytest.mark.parametrize(
    "field", sorted(AllocationAgreementRepository._index_columns())
)
async def test_every_column_can_be_sorted_and_filtered(dbsession, repo, lookups, field):
    """Each grid column must produce valid SQL for sorting and filtering."""
    org = await _org(dbsession, f"Index Org Col {field}")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    agreement = await _agreement(
        dbsession, lookups, report, f"Column Partner {field}", q1_quantity=1
    )
    only_this = _text("transaction_partner", "equals", f"Column Partner {field}")

    for direction in ("asc", "desc"):
        rows, total = await repo.get_allocation_agreements_index(
            _pagination(
                filters=[only_this],
                sort_orders=[SortOrder(field=field, direction=direction)],
            )
        )
        assert _ids(rows) == {agreement.allocation_agreement_id}
        assert total == 1

    for operator in ("blank", "notBlank"):
        rows, _ = await repo.get_allocation_agreements_index(
            _pagination(
                filters=[
                    only_this,
                    FilterModel(
                        field=field, filter_type="text", type=operator, filter=None
                    ),
                ]
            )
        )
        assert len(rows) <= 1


async def test_text_filters_on_joined_and_computed_columns(dbsession, repo, lookups):
    org = await _org(dbsession, "Joined Filter Org")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    agreement = await _agreement(dbsession, lookups, report, "Joined Filter Partner")
    only_this = _text("transaction_partner", "equals", "Joined Filter Partner")

    for field, value in (
        ("reporting_organization", "joined filter org"),
        ("compliance_period", "2024"),
        ("allocation_transaction_type", "allocated from"),
    ):
        rows, _ = await repo.get_allocation_agreements_index(
            _pagination(filters=[only_this, _text(field, "contains", value)])
        )
        assert _ids(rows) == {agreement.allocation_agreement_id}, field

    miss, total = await repo.get_allocation_agreements_index(
        _pagination(filters=[only_this, _text("reporting_organization", "equals", "x")])
    )
    assert miss == [] and total == 0


@pytest.mark.parametrize(
    "status",
    [s for s in ComplianceReportStatusEnum if s != ComplianceReportStatusEnum.Draft],
)
async def test_every_status_except_draft_is_listed(dbsession, repo, lookups, status):
    """Draft is the only report status that hides rows from the index."""
    org = await _org(dbsession, f"Status Org {status.name}")
    report = await _report(dbsession, lookups, org, status)
    agreement = await _agreement(dbsession, lookups, report, f"{status.name} Partner")

    rows, total = await repo.get_allocation_agreements_index(
        _pagination(), organization_id=org.organization_id
    )

    assert _ids(rows) == {agreement.allocation_agreement_id}
    assert total == 1
    assert rows[0].status == status


async def test_listing_does_not_modify_data(dbsession, repo, lookups):
    org = await _org(dbsession, "Index Org I")
    report = await _report(dbsession, lookups, org, ComplianceReportStatusEnum.Assessed)
    agreement = await _agreement(dbsession, lookups, report, "Readonly Partner")

    await repo.get_allocation_agreements_index(
        _pagination(), organization_id=org.organization_id
    )

    assert not dbsession.new
    assert not dbsession.dirty
    assert not dbsession.deleted
    await dbsession.refresh(agreement)
    assert agreement.quantity == 100


def _text(field, operator, value):
    return FilterModel(field=field, filter_type="text", type=operator, filter=value)
