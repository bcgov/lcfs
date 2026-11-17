"""Data model tests for the LCJFIP application (#5501).

These run against the real migrated test database, so they cover the
migration (tables, constraints, seeds, views) as well as the ORM mappings.
"""

import datetime
from decimal import Decimal

import pytest
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError

from lcfs.db.models.comment.CommentCategory import CommentCategory
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.LCJFIPApplicationInternalComment import (
    LCJFIPApplicationInternalComment,
)
from lcfs.db.models.document.Document import Document
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.lcjfip import (
    LCJFIPApplication,
    LCJFIPApplicationHistory,
    LCJFIPApplicationPeriod,
    LCJFIPApplicationStatus,
    LCJFIPApplicationStatusEnum,
    LCJFIPCarType,
    LCJFIPCertificateType,
    LCJFIPFeedstockSource,
    LCJFIPIncentiveOption,
    LCJFIPIncentiveRate,
    LCJFIPIncentiveTypeEnum,
    LCJFIPPurchaseDetail,
    lcjfip_application_document_association,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.UserProfile import UserProfile

CASH = "Cash incentive"
CREDIT = "LCFS credit option"
CREDIT_TRANSFER = "LCFS credit option - Fuel supplier incentive transfer"
UCO = "Used cooking oil (UCO)"
TALLOW = "Tallow / animal fats"
CANOLA = "Canola / rapeseed oil"
CAR_704 = "CAR 704 - Commuter operations"
CAR_705 = "CAR 705 - Airline operations"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _organizations(dbsession):
    result = await dbsession.execute(
        select(Organization).order_by(Organization.organization_id).limit(2)
    )
    return result.scalars().all()


async def _bceid_user(dbsession):
    result = await dbsession.execute(
        select(UserProfile)
        .where(UserProfile.organization_id.is_not(None))
        .order_by(UserProfile.user_profile_id)
        .limit(1)
    )
    return result.scalars().first()


async def _by_name(dbsession, model, name):
    result = await dbsession.execute(select(model).where(model.name == name))
    return result.scalars().one()


async def _status(dbsession, status: LCJFIPApplicationStatusEnum):
    result = await dbsession.execute(
        select(LCJFIPApplicationStatus).where(
            LCJFIPApplicationStatus.status == status.value
        )
    )
    return result.scalars().one()


async def _period(dbsession, description="Test intake"):
    period = LCJFIPApplicationPeriod(
        description=description,
        open_date=datetime.date(2026, 1, 1),
        close_date=datetime.date(2026, 6, 30),
        display_order=1,
    )
    dbsession.add(period)
    await dbsession.flush()
    return period


async def _application(
    dbsession, status=LCJFIPApplicationStatusEnum.Draft, **overrides
):
    organization = (await _organizations(dbsession))[0]
    user = await _bceid_user(dbsession)
    values = {
        "organization_id": organization.organization_id,
        "contact_user_profile_id": user.user_profile_id,
        "status_id": (await _status(dbsession, status)).lcjfip_application_status_id,
    }
    values.update(overrides)
    application = LCJFIPApplication(**values)
    dbsession.add(application)
    await dbsession.flush()
    return application


async def _purchase(dbsession, application, feedstocks=(), **overrides):
    values = {
        "lcjfip_application_id": application.lcjfip_application_id,
        "estimated_volume": 500_000,
        "anticipated_delivery_date": datetime.date(2027, 3, 31),
        "estimated_blend_percentage": Decimal("30.00"),
        "assumed_jet_a_price": Decimal("0.9000"),
        "price_premium_from": Decimal("1.5000"),
        "price_premium_to": Decimal("1.7000"),
    }
    values.update(overrides)
    purchase = LCJFIPPurchaseDetail(**values)
    purchase.feedstock_sources = [
        await _by_name(dbsession, LCJFIPFeedstockSource, name) for name in feedstocks
    ]
    dbsession.add(purchase)
    await dbsession.flush()
    return purchase


async def _submit(dbsession, application, period):
    user = await _bceid_user(dbsession)
    submitted = await _status(dbsession, LCJFIPApplicationStatusEnum.Submitted)
    application.status_id = submitted.lcjfip_application_status_id
    application.application_period_id = period.lcjfip_application_period_id
    application.signed_by_user_profile_id = user.user_profile_id
    application.signed_date = datetime.datetime(
        2026, 3, 2, 18, 0, tzinfo=datetime.timezone.utc
    )
    dbsession.add(
        LCJFIPApplicationHistory(
            lcjfip_application_id=application.lcjfip_application_id,
            status_id=submitted.lcjfip_application_status_id,
            user_profile_id=user.user_profile_id,
            application_snapshot={"requested_incentive_volume": 1},
        )
    )
    await dbsession.flush()


async def _car_types(dbsession, *names):
    """Pass to _application(car_types=...): collections are set before the
    first flush, since replacing one later would lazy-load under asyncio."""
    return [await _by_name(dbsession, LCJFIPCarType, name) for name in names]


async def _attach_comment_and_document(dbsession, application, visibility):
    comment = InternalComment(comment="Program note", visibility=visibility)
    document = Document(
        file_key="lcjfip/test.pdf",
        file_name="test.pdf",
        file_size=1,
        mime_type="application/pdf",
    )
    dbsession.add_all([comment, document])
    await dbsession.flush()
    dbsession.add(
        LCJFIPApplicationInternalComment(
            lcjfip_application_id=application.lcjfip_application_id,
            internal_comment_id=comment.internal_comment_id,
        )
    )
    await dbsession.execute(
        lcjfip_application_document_association.insert().values(
            lcjfip_application_id=application.lcjfip_application_id,
            document_id=document.document_id,
        )
    )
    await dbsession.flush()
    return comment.internal_comment_id, document.document_id


async def _count(dbsession, sql, **params):
    return (await dbsession.execute(text(sql), params)).scalar_one()


async def _max_rates(dbsession, incentive_type, carbon_intensity):
    """The rate-band lookup a service would run (lower exclusive, upper inclusive)."""
    ci = Decimal(str(carbon_intensity))
    result = await dbsession.execute(
        select(LCJFIPIncentiveRate.max_rate_per_litre).where(
            LCJFIPIncentiveRate.incentive_type == incentive_type,
            LCJFIPIncentiveRate.effective_status.is_(True),
            or_(
                LCJFIPIncentiveRate.ci_lower_bound.is_(None),
                LCJFIPIncentiveRate.ci_lower_bound < ci,
            ),
            or_(
                LCJFIPIncentiveRate.ci_upper_bound.is_(None),
                LCJFIPIncentiveRate.ci_upper_bound >= ci,
            ),
        )
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Seeded reference data
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_statuses_seeded_and_match_enum(dbsession):
    result = await dbsession.execute(
        select(LCJFIPApplicationStatus.status).order_by(
            LCJFIPApplicationStatus.display_order
        )
    )
    assert result.scalars().all() == [s.value for s in LCJFIPApplicationStatusEnum]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "model, expected",
    [
        (
            LCJFIPCarType,
            [
                "CAR 701 - Foreign air operations",
                "CAR 703 - Air taxi operations",
                CAR_704,
                CAR_705,
            ],
        ),
        (
            LCJFIPCertificateType,
            [
                "Domestic",
                "Foreign - air transport service",
                "Foreign - code share",
                "Foreign - free trade agreement",
                "Private",
            ],
        ),
        (
            LCJFIPFeedstockSource,
            [
                "Agricultural residues",
                "Alcohol-derived feedstock",
                CANOLA,
                "Corn oil",
                "Forestry / woody biomass residues",
                "Municipal solid waste / waste-derived feedstock",
                "Other",
                "Other vegetable oils",
                "Soybean oil",
                TALLOW,
                "Unknown / To be determined",
                UCO,
            ],
        ),
    ],
)
async def test_select_lists_seeded_in_display_order(dbsession, model, expected):
    result = await dbsession.execute(select(model).order_by(model.display_order))
    rows = result.scalars().all()
    assert [row.name for row in rows] == expected
    assert all(row.effective_status for row in rows)


@pytest.mark.anyio
async def test_incentive_options_seeded(dbsession):
    result = await dbsession.execute(
        select(LCJFIPIncentiveOption).order_by(LCJFIPIncentiveOption.display_order)
    )
    options = [
        (o.name, o.incentive_type, o.requires_fuel_supplier)
        for o in result.scalars().all()
    ]
    assert options == [
        (CASH, LCJFIPIncentiveTypeEnum.Cash, False),
        (CREDIT, LCJFIPIncentiveTypeEnum.Credit, False),
        (CREDIT_TRANSFER, LCJFIPIncentiveTypeEnum.Credit, True),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "incentive_type, carbon_intensity, expected_rate",
    [
        (LCJFIPIncentiveTypeEnum.Cash, -5, Decimal("1.1250")),
        (LCJFIPIncentiveTypeEnum.Cash, 9.99, Decimal("1.1250")),
        (LCJFIPIncentiveTypeEnum.Cash, 10, Decimal("1.1250")),
        (LCJFIPIncentiveTypeEnum.Cash, 10.01, Decimal("0.7500")),
        (LCJFIPIncentiveTypeEnum.Cash, 80, Decimal("0.7500")),
        (LCJFIPIncentiveTypeEnum.Credit, 10, Decimal("0.0075")),
        (LCJFIPIncentiveTypeEnum.Credit, 10.01, Decimal("0.0050")),
    ],
)
async def test_incentive_rate_bands_match_exactly_one_rate(
    dbsession, incentive_type, carbon_intensity, expected_rate
):
    # "CI less than or equal to 10" includes 10 itself.
    assert await _max_rates(dbsession, incentive_type, carbon_intensity) == [
        expected_rate
    ]


@pytest.mark.anyio
async def test_comment_category_seeded(dbsession):
    result = await dbsession.execute(
        select(CommentCategory).where(
            CommentCategory.display_name == "LCJFIP application notes"
        )
    )
    assert result.scalars().one().display_order == 70


# ---------------------------------------------------------------------------
# Application graph
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_draft_can_be_saved_with_only_applicant_and_status(dbsession):
    application = await _application(dbsession)
    assert application.lcjfip_application_id is not None
    assert application.application_period_id is None
    assert application.incentive_option_id is None


@pytest.mark.anyio
async def test_full_application_graph_round_trips(dbsession):
    period = await _period(dbsession)
    application = await _application(
        dbsession,
        certificate_type_id=(
            await _by_name(dbsession, LCJFIPCertificateType, "Domestic")
        ).lcjfip_certificate_type_id,
        incentive_option_id=(
            await _by_name(dbsession, LCJFIPIncentiveOption, CASH)
        ).lcjfip_incentive_option_id,
        estimated_carbon_intensity=Decimal("8.50"),
        requested_incentive_volume=1_000_000,
        estimated_incentive_amount=Decimal("1125000.00"),
        car_types=await _car_types(dbsession, CAR_705, CAR_704),
    )
    await _purchase(dbsession, application, feedstocks=(UCO, TALLOW))
    await _purchase(
        dbsession, application, feedstocks=(CANOLA,), estimated_volume=500_000
    )
    await _submit(dbsession, application, period)
    comment_id, document_id = await _attach_comment_and_document(
        dbsession, application, "Internal"
    )
    app_id = application.lcjfip_application_id
    organization_id = application.organization_id

    dbsession.expire_all()
    loaded = (
        (
            await dbsession.execute(
                select(LCJFIPApplication).where(
                    LCJFIPApplication.lcjfip_application_id == app_id
                )
            )
        )
        .scalars()
        .one()
    )

    assert loaded.status.status == "Submitted"
    assert loaded.application_period.description == "Test intake"
    assert loaded.certificate_type.name == "Domestic"
    assert loaded.incentive_option.incentive_type == LCJFIPIncentiveTypeEnum.Cash
    # car_types is ordered by the lookup's display order, not insertion order.
    assert [c.name for c in loaded.car_types] == [CAR_704, CAR_705]
    assert loaded.organization.organization_id == organization_id
    assert loaded.signed_by_user.user_profile_id == loaded.contact_user_profile_id
    assert len(loaded.purchase_details) == 2
    assert [f.name for f in loaded.purchase_details[0].feedstock_sources] == [
        TALLOW,
        UCO,
    ]
    assert sum(p.estimated_volume for p in loaded.purchase_details) == 1_000_000

    history = (
        (
            await dbsession.execute(
                select(LCJFIPApplicationHistory).where(
                    LCJFIPApplicationHistory.lcjfip_application_id == app_id
                )
            )
        )
        .scalars()
        .one()
    )
    assert history.status.status == "Submitted"
    assert history.application_snapshot == {"requested_incentive_volume": 1}

    links = (
        (
            await dbsession.execute(
                select(LCJFIPApplicationInternalComment).where(
                    LCJFIPApplicationInternalComment.lcjfip_application_id == app_id
                )
            )
        )
        .scalars()
        .all()
    )
    assert [link.internal_comment_id for link in links] == [comment_id]
    assert (
        await _count(
            dbsession,
            "SELECT document_id FROM lcjfip_application_document_association "
            "WHERE lcjfip_application_id = :id",
            id=app_id,
        )
        == document_id
    )


@pytest.mark.anyio
async def test_deleting_an_application_cascades_to_its_rows(dbsession):
    period = await _period(dbsession)
    application = await _application(
        dbsession, car_types=await _car_types(dbsession, CAR_705)
    )
    purchase = await _purchase(dbsession, application, feedstocks=(UCO, TALLOW))
    await _submit(dbsession, application, period)
    comment_id, document_id = await _attach_comment_and_document(
        dbsession, application, "Public"
    )
    app_id = application.lcjfip_application_id
    purchase_id = purchase.lcjfip_purchase_detail_id

    # Delete in SQL so the database cascades, not the ORM, are under test.
    await dbsession.execute(
        text("DELETE FROM lcjfip_application WHERE lcjfip_application_id = :id"),
        {"id": app_id},
    )
    dbsession.expunge_all()

    for table in (
        "lcjfip_purchase_detail",
        "lcjfip_application_car_type",
        "lcjfip_application_history",
        "lcjfip_application_internal_comment",
        "lcjfip_application_document_association",
    ):
        assert (
            await _count(
                dbsession,
                f"SELECT count(*) FROM {table} WHERE lcjfip_application_id = :id",
                id=app_id,
            )
            == 0
        ), table
    assert (
        await _count(
            dbsession,
            "SELECT count(*) FROM lcjfip_purchase_detail_feedstock "
            "WHERE lcjfip_purchase_detail_id = :id",
            id=purchase_id,
        )
        == 0
    )
    # Shared rows are left for their own services to clean up.
    assert (
        await _count(
            dbsession,
            "SELECT count(*) FROM internal_comment WHERE internal_comment_id = :id",
            id=comment_id,
        )
        == 1
    )
    assert (
        await _count(
            dbsession,
            "SELECT count(*) FROM document WHERE document_id = :id",
            id=document_id,
        )
        == 1
    )


@pytest.mark.anyio
async def test_deleting_a_fuel_code_clears_the_reference(dbsession):
    fuel_code = FuelCode(
        fuel_status_id=(await dbsession.execute(select(FuelCodeStatus)))
        .scalars()
        .first()
        .fuel_code_status_id,
        prefix_id=(await dbsession.execute(select(FuelCodePrefix)))
        .scalars()
        .first()
        .fuel_code_prefix_id,
        fuel_suffix="901.0",
        company="Test producer",
        carbon_intensity=Decimal("8.50"),
        edrms="TEST",
        application_date=datetime.date(2026, 1, 1),
        fuel_type_id=(await dbsession.execute(select(FuelType)))
        .scalars()
        .first()
        .fuel_type_id,
        feedstock="Test feedstock",
        feedstock_location="Test location",
    )
    dbsession.add(fuel_code)
    await dbsession.flush()
    application = await _application(dbsession, fuel_code_id=fuel_code.fuel_code_id)

    await dbsession.execute(
        text("DELETE FROM fuel_code WHERE fuel_code_id = :id"),
        {"id": fuel_code.fuel_code_id},
    )
    assert (
        await _count(
            dbsession,
            "SELECT count(*) FROM lcjfip_application "
            "WHERE lcjfip_application_id = :id AND fuel_code_id IS NULL",
            id=application.lcjfip_application_id,
        )
        == 1
    )


# ---------------------------------------------------------------------------
# Integrity constraints (each violation is the last statement of its test)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "overrides, constraint",
    [
        ({"estimated_blend_percentage": Decimal("100.01")}, "blend_percentage_range"),
        ({"estimated_blend_percentage": Decimal("-1")}, "blend_percentage_range"),
        ({"estimated_volume": -1}, "volume_non_negative"),
        ({"assumed_jet_a_price": Decimal("-0.01")}, "jet_a_price_non_negative"),
        ({"price_premium_from": Decimal("-0.10")}, "premium_non_negative"),
        (
            {
                "price_premium_from": Decimal("1.80"),
                "price_premium_to": Decimal("1.60"),
            },
            "premium_range_ordered",
        ),
    ],
)
async def test_purchase_detail_rejects_out_of_range_values(
    dbsession, overrides, constraint
):
    application = await _application(dbsession)
    with pytest.raises(IntegrityError, match=f"ck_lcjfip_purchase_detail_{constraint}"):
        await _purchase(dbsession, application, **overrides)


@pytest.mark.anyio
async def test_purchase_detail_allows_partial_draft_rows(dbsession):
    application = await _application(dbsession)
    purchase = await _purchase(
        dbsession,
        application,
        estimated_volume=None,
        anticipated_delivery_date=None,
        estimated_blend_percentage=None,
        assumed_jet_a_price=None,
        price_premium_from=None,
        price_premium_to=None,
    )
    assert purchase.lcjfip_purchase_detail_id is not None


@pytest.mark.anyio
@pytest.mark.parametrize(
    "overrides, constraint",
    [
        ({"requested_incentive_volume": -1}, "requested_volume_non_negative"),
        (
            {"estimated_incentive_amount": Decimal("-0.01")},
            "incentive_amount_non_negative",
        ),
        (
            {
                "signed_date": datetime.datetime(
                    2026, 3, 2, tzinfo=datetime.timezone.utc
                )
            },
            "signature_complete",
        ),
    ],
)
async def test_application_rejects_invalid_values(dbsession, overrides, constraint):
    with pytest.raises(IntegrityError, match=f"ck_lcjfip_application_{constraint}"):
        await _application(dbsession, **overrides)


@pytest.mark.anyio
async def test_application_rejects_signer_without_signed_date(dbsession):
    user = await _bceid_user(dbsession)
    with pytest.raises(
        IntegrityError, match="ck_lcjfip_application_signature_complete"
    ):
        await _application(dbsession, signed_by_user_profile_id=user.user_profile_id)


@pytest.mark.anyio
async def test_fuel_supplier_is_either_linked_or_named(dbsession):
    supplier = (await _organizations(dbsession))[1]
    linked = await _application(
        dbsession, fuel_supplier_organization_id=supplier.organization_id
    )
    named = await _application(
        dbsession, fuel_supplier_legal_name="Unregistered supplier"
    )
    assert linked.fuel_supplier_organization_id == supplier.organization_id
    assert linked.organization_id != linked.fuel_supplier_organization_id
    assert named.fuel_supplier_organization_id is None
    with pytest.raises(
        IntegrityError, match="ck_lcjfip_application_fuel_supplier_org_or_name"
    ):
        await _application(
            dbsession,
            fuel_supplier_organization_id=supplier.organization_id,
            fuel_supplier_legal_name="Duplicated name",
        )


@pytest.mark.anyio
async def test_period_close_date_cannot_precede_open_date(dbsession):
    dbsession.add(
        LCJFIPApplicationPeriod(
            description="Backwards",
            open_date=datetime.date(2026, 6, 1),
            close_date=datetime.date(2026, 5, 31),
        )
    )
    with pytest.raises(
        IntegrityError, match="ck_lcjfip_application_period_close_after_open"
    ):
        await dbsession.flush()


@pytest.mark.anyio
async def test_rate_bounds_must_be_ordered(dbsession):
    dbsession.add(
        LCJFIPIncentiveRate(
            incentive_type=LCJFIPIncentiveTypeEnum.Cash,
            ci_lower_bound=Decimal("20"),
            ci_upper_bound=Decimal("10"),
            max_rate_per_litre=Decimal("0.5"),
        )
    )
    with pytest.raises(
        IntegrityError, match="ck_lcjfip_incentive_rate_ci_bounds_ordered"
    ):
        await dbsession.flush()


@pytest.mark.anyio
async def test_lookup_names_are_unique(dbsession):
    dbsession.add(LCJFIPFeedstockSource(name=UCO))
    with pytest.raises(IntegrityError, match="uq_lcjfip_feedstock_source_name"):
        await dbsession.flush()


# ---------------------------------------------------------------------------
# Metabase reporting views
# ---------------------------------------------------------------------------


async def _view_row(dbsession, view, key, value):
    result = await dbsession.execute(
        text(f"SELECT * FROM {view} WHERE {key} = :value"), {"value": value}
    )
    return result.mappings().all()


@pytest.mark.anyio
async def test_application_view_excludes_drafts(dbsession):
    draft = await _application(dbsession)
    await _purchase(dbsession, draft, feedstocks=(UCO,))
    assert (
        await _view_row(
            dbsession,
            "vw_lcjfip_application_base",
            "lcjfip_application_id",
            draft.lcjfip_application_id,
        )
        == []
    )
    assert (
        await _view_row(
            dbsession,
            "vw_lcjfip_purchase_detail_base",
            "lcjfip_application_id",
            draft.lcjfip_application_id,
        )
        == []
    )


@pytest.mark.anyio
async def test_application_view_rolls_up_a_cash_application(dbsession):
    period = await _period(dbsession)
    application = await _application(
        dbsession,
        incentive_option_id=(
            await _by_name(dbsession, LCJFIPIncentiveOption, CASH)
        ).lcjfip_incentive_option_id,
        estimated_carbon_intensity=Decimal("8.50"),
        requested_incentive_volume=1_000_000,
        estimated_incentive_amount=Decimal("1000000.00"),
        car_types=await _car_types(dbsession, CAR_705, CAR_704),
    )
    await _purchase(
        dbsession, application, feedstocks=(UCO, TALLOW), estimated_volume=600_000
    )
    await _purchase(
        dbsession, application, feedstocks=(CANOLA,), estimated_volume=400_000
    )
    await _submit(dbsession, application, period)

    (row,) = await _view_row(
        dbsession,
        "vw_lcjfip_application_base",
        "lcjfip_application_id",
        application.lcjfip_application_id,
    )
    assert row["application_number"] == f"LCJFIP-{application.lcjfip_application_id}"
    assert row["application_status"] == "Submitted"
    assert row["application_period"] == "Test intake"
    assert row["car_types"] == f"{CAR_704}, {CAR_705}"
    assert row["incentive_type"] == "Cash"
    assert row["incentive_unit"] == "CAD"
    assert row["purchase_detail_count"] == 2
    assert row["total_estimated_volume"] == 1_000_000
    assert row["estimated_incentive_cad"] == Decimal("1000000.00")
    assert row["estimated_incentive_credits"] is None
    assert row["max_incentive_rate_per_litre"] == Decimal("1.1250")
    assert row["max_eligible_incentive_amount"] == Decimal("1125000.0000")
    assert row["fuel_supplier_name"] is None
    assert row["fuel_supplier_is_lcfs_organization"] is False
    # 18:00 UTC on 2026-03-02 is 10:00 Pacific the same day.
    assert row["last_submitted_date"] == datetime.datetime(2026, 3, 2, 10, 0)
    assert row["first_submitted_date"] is not None

    rows = await _view_row(
        dbsession,
        "vw_lcjfip_purchase_detail_base",
        "lcjfip_application_id",
        application.lcjfip_application_id,
    )
    by_volume = {r["estimated_volume"]: r for r in rows}
    assert by_volume[600_000]["feedstock_sources"] == f"{TALLOW}, {UCO}"
    assert by_volume[600_000]["feedstock_source_count"] == 2
    assert by_volume[400_000]["feedstock_sources"] == CANOLA
    assert by_volume[400_000]["anticipated_delivery_year"] == 2027
    assert by_volume[400_000]["price_premium_range_width"] == Decimal("0.2000")


@pytest.mark.anyio
async def test_application_view_reports_credit_transfer_to_lcfs_supplier(dbsession):
    period = await _period(dbsession)
    supplier = (await _organizations(dbsession))[1]
    application = await _application(
        dbsession,
        incentive_option_id=(
            await _by_name(dbsession, LCJFIPIncentiveOption, CREDIT_TRANSFER)
        ).lcjfip_incentive_option_id,
        estimated_carbon_intensity=Decimal("25.00"),
        requested_incentive_volume=200_000,
        estimated_incentive_amount=Decimal("1000.00"),
        fuel_supplier_organization_id=supplier.organization_id,
        fuel_supplier_contact_first_name="Test",
        fuel_supplier_contact_last_name="Contact",
        fuel_supplier_contact_email="contact@example.com",
    )
    await _submit(dbsession, application, period)

    (row,) = await _view_row(
        dbsession,
        "vw_lcjfip_application_base",
        "lcjfip_application_id",
        application.lcjfip_application_id,
    )
    assert row["incentive_unit"] == "Credits"
    assert row["estimated_incentive_cad"] is None
    assert row["estimated_incentive_credits"] == Decimal("1000.00")
    assert row["max_incentive_rate_per_litre"] == Decimal("0.0050")
    assert row["fuel_supplier_name"] == supplier.name
    assert row["fuel_supplier_is_lcfs_organization"] is True
    assert row["purchase_detail_count"] == 0
    # Contact details stay out of the reporting views.
    assert "fuel_supplier_contact_email" not in row
