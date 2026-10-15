import pytest
from sqlalchemy import select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
    FuelSupply,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.fuel import FuelCategory, FuelType, ProvisionOfTheAct
from lcfs.db.models.organization import Organization
from lcfs.web.api.base import FilterModel
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository


@pytest.mark.anyio
async def test_get_organization_fuel_supply_analytics_fuel_category_trend(
    dbsession,
):
    """Issue #5047: the Supply History fuel category breakdown groups rows by
    their reported fuel category.

    Quantities within a category are in mixed units, so energy sums every row,
    litres only sums litre-denominated rows, and early-issuance rows fall back
    to their quarterly quantities.
    """
    # Reference rows come from the migrations' seed data.
    period = (await dbsession.execute(select(CompliancePeriod).limit(1))).scalar_one()
    status = (
        await dbsession.execute(select(ComplianceReportStatus).limit(1))
    ).scalar_one()
    fuel_type = (await dbsession.execute(select(FuelType).limit(1))).scalar_one()
    provision = (
        await dbsession.execute(select(ProvisionOfTheAct).limit(1))
    ).scalar_one()
    categories = {
        row.category: row
        for row in (await dbsession.execute(select(FuelCategory))).scalars()
    }

    org = Organization(
        organization_id=95047,
        organization_code="o95047",
        name="org95047",
        total_balance=0,
        reserved_balance=0,
        count_transfers_in_progress=0,
    )
    dbsession.add(org)
    await dbsession.flush()

    report = ComplianceReport(
        compliance_report_id=95047,
        compliance_period_id=period.compliance_period_id,
        organization_id=org.organization_id,
        current_status_id=status.compliance_report_status_id,
        compliance_report_group_uuid="5047-chain",
        version=0,
        reporting_frequency=ReportingFrequency.ANNUAL,
    )
    dbsession.add(report)
    await dbsession.flush()

    def _row(fuel_supply_id, category, units, energy, compliance_units, **quantities):
        return FuelSupply(
            fuel_supply_id=fuel_supply_id,
            compliance_report_id=report.compliance_report_id,
            group_uuid=f"5047-{fuel_supply_id}",
            version=0,
            action_type=ActionTypeEnum.CREATE,
            units=units,
            energy=energy,
            compliance_units=compliance_units,
            fuel_type_id=fuel_type.fuel_type_id,
            fuel_category_id=categories[category].fuel_category_id,
            provision_of_the_act_id=provision.provision_of_the_act_id,
            **quantities,
        )

    dbsession.add_all(
        [
            _row(950470, "Gasoline", "Litres", 3400, 1.5, quantity=100),
            # kWh counts towards energy and compliance units, not litres.
            _row(950471, "Gasoline", "Kilowatt_hour", 3600, 2, quantity=1000),
            # Early issuance: quarterly quantities only.
            _row(
                950472,
                "Diesel",
                "Litres",
                3800,
                -0.5,
                q1_quantity=10,
                q2_quantity=20,
                q3_quantity=30,
                q4_quantity=40,
            ),
            # Missing energy counts as zero rather than failing the total.
            _row(950473, "Diesel", "Litres", None, None, quantity=5),
        ]
    )
    await dbsession.flush()

    repo = FuelSupplyRepository(db=dbsession)
    analytics = await repo.get_organization_fuel_supply_analytics(
        org.organization_id, None
    )

    trend = {row["fuelCategory"]: row for row in analytics["fuel_category_trend"]}
    assert trend == {
        "Gasoline": {
            "reportingYear": period.description,
            "fuelCategory": "Gasoline",
            "totalEnergy": 7000,
            "totalLitres": 100,
            "totalComplianceUnits": 3.5,
        },
        "Diesel": {
            "reportingYear": period.description,
            "fuelCategory": "Diesel",
            "totalEnergy": 3800,
            "totalLitres": 105,
            "totalComplianceUnits": -0.5,
        },
    }

    # The year filter narrows the trend the same way as the other charts.
    other_year = (
        (
            await dbsession.execute(
                select(CompliancePeriod.description).where(
                    CompliancePeriod.compliance_period_id != period.compliance_period_id
                )
            )
        )
        .scalars()
        .first()
    )
    year_filter = FilterModel(
        field="compliancePeriod",
        values=[other_year],
        type="set",
        filter_type="set",
    )
    filtered = await repo.get_organization_fuel_supply_analytics(
        org.organization_id, [year_filter]
    )
    assert filtered["fuel_category_trend"] == []
