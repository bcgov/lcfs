"""Seed helpers for the compliance report write tests that run against the
database through the API (organization snapshot, schedule inputs, schedule
version scoping).

Reference data (fuel types, categories, provisions, EERs, energy densities)
comes from the migrations, so lookups go by name at runtime.
"""

import itertools
import uuid
from datetime import date
from types import SimpleNamespace

from sqlalchemy import select

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import Organization
from lcfs.db.models.compliance import CompliancePeriod, ComplianceReport
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.ComplianceReport import (
    QuantityUnitsEnum,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportOrganizationSnapshot import (
    ComplianceReportOrganizationSnapshot,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import (
    NotionalTransfer,
    ReceivedOrTransferredEnum,
)
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct

YEAR = 2025
FUEL_CODE_PROVISION = "Fuel code - section 19 (b) (i)"
DEFAULT_CI_PROVISION = "Default carbon intensity - section 19 (b) (ii)"

_suffixes = itertools.count(101)


async def scalar(dbsession, stmt):
    return (await dbsession.execute(stmt)).scalar_one()


async def id_by(dbsession, id_column, column, value) -> int:
    return await scalar(dbsession, select(id_column).where(column == value))


async def organization_ids(dbsession) -> list[int]:
    rows = (
        (
            await dbsession.execute(
                select(Organization.organization_id)
                .order_by(Organization.organization_id)
                .limit(2)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2, "the pytest seed needs two organizations"
    return rows


async def seed_report(
    dbsession,
    add_models,
    organization_id: int,
    status: ComplianceReportStatusEnum = ComplianceReportStatusEnum.Draft,
    *,
    group_uuid: str | None = None,
    version: int = 0,
) -> ComplianceReport:
    report = ComplianceReport(
        compliance_period_id=await id_by(
            dbsession,
            CompliancePeriod.compliance_period_id,
            CompliancePeriod.description,
            str(YEAR),
        ),
        organization_id=organization_id,
        compliance_report_group_uuid=group_uuid or str(uuid.uuid4()),
        version=version,
        reporting_frequency=ReportingFrequency.ANNUAL,
        current_status_id=await id_by(
            dbsession,
            ComplianceReportStatus.compliance_report_status_id,
            ComplianceReportStatus.status,
            status,
        ),
    )
    await add_models([report])
    return report


async def seed_snapshot(
    add_models, compliance_report_id: int, name: str
) -> ComplianceReportOrganizationSnapshot:
    snapshot = ComplianceReportOrganizationSnapshot(
        compliance_report_id=compliance_report_id,
        name=name,
        operating_name=name,
        email="org@example.com",
        phone="250-555-0100",
        head_office_address="1 Test Street, Victoria, BC",
        records_address="1 Test Street, Victoria, BC",
        service_address="1 Test Street, Victoria, BC",
        latitude=48.4,
        longitude=-123.3,
        is_edited=False,
    )
    await add_models([snapshot])
    return snapshot


async def fuel_reference(dbsession) -> SimpleNamespace:
    """A recognized fuel with an EER and energy density for YEAR (Biodiesel,
    Diesel category), plus the Other fuel and the provisions the tests use."""
    period_id = await id_by(
        dbsession,
        CompliancePeriod.compliance_period_id,
        CompliancePeriod.description,
        str(YEAR),
    )
    biodiesel = await scalar(
        dbsession, select(FuelType).where(FuelType.fuel_type == "Biodiesel")
    )
    diesel = await scalar(
        dbsession, select(FuelCategory).where(FuelCategory.category == "Diesel")
    )
    eer = (
        (
            await dbsession.execute(
                select(EnergyEffectivenessRatio).where(
                    EnergyEffectivenessRatio.fuel_type_id == biodiesel.fuel_type_id,
                    EnergyEffectivenessRatio.fuel_category_id
                    == diesel.fuel_category_id,
                    EnergyEffectivenessRatio.compliance_period_id == period_id,
                    EnergyEffectivenessRatio.end_use_type_id.is_not(None),
                )
            )
        )
        .scalars()
        .first()
    )
    density = await scalar(
        dbsession,
        select(EnergyDensity.density).where(
            EnergyDensity.fuel_type_id == biodiesel.fuel_type_id,
            EnergyDensity.compliance_period_id == period_id,
        ),
    )
    end_use = await scalar(
        dbsession,
        select(EndUseType).where(EndUseType.end_use_type_id == eer.end_use_type_id),
    )
    other_fuel = await scalar(
        dbsession, select(FuelType).where(FuelType.unrecognized.is_(True))
    )
    ethanol = await scalar(
        dbsession, select(FuelType).where(FuelType.fuel_type == "Ethanol")
    )
    return SimpleNamespace(
        period_id=period_id,
        fuel_type=biodiesel,
        other_fuel_type=other_fuel,
        different_fuel_type=ethanol,
        fuel_category=diesel,
        end_use=end_use,
        energy_density=float(density),
        fuel_code_provision_id=await id_by(
            dbsession,
            ProvisionOfTheAct.provision_of_the_act_id,
            ProvisionOfTheAct.name,
            FUEL_CODE_PROVISION,
        ),
        default_ci_provision_id=await id_by(
            dbsession,
            ProvisionOfTheAct.provision_of_the_act_id,
            ProvisionOfTheAct.name,
            DEFAULT_CI_PROVISION,
        ),
        expected_use_id=(
            await dbsession.execute(select(ExpectedUseType.expected_use_type_id))
        )
        .scalars()
        .first(),
        allocation_type_id=(
            await dbsession.execute(
                select(AllocationTransactionType.allocation_transaction_type_id)
            )
        )
        .scalars()
        .first(),
    )


async def seed_fuel_code(
    dbsession,
    add_models,
    *,
    fuel_type_id: int,
    status: FuelCodeStatusEnum = FuelCodeStatusEnum.Approved,
    effective_date: date = date(YEAR, 1, 1),
    expiration_date: date = date(YEAR + 2, 12, 31),
    carbon_intensity: float = 12.34,
) -> FuelCode:
    fuel_code = FuelCode(
        prefix_id=await id_by(
            dbsession,
            FuelCodePrefix.fuel_code_prefix_id,
            FuelCodePrefix.prefix,
            "BCLCF",
        ),
        fuel_suffix=f"{next(_suffixes)}.0",
        fuel_status_id=await id_by(
            dbsession,
            FuelCodeStatus.fuel_code_status_id,
            FuelCodeStatus.status,
            status,
        ),
        company="Test fuel producer",
        carbon_intensity=carbon_intensity,
        edrms="TEST",
        application_date=date(YEAR - 1, 6, 1),
        approval_date=date(YEAR - 1, 7, 1),
        effective_date=effective_date,
        expiration_date=expiration_date,
        fuel_type_id=fuel_type_id,
        feedstock="Test feedstock",
        feedstock_location="Test location",
        effective_status=True,
    )
    await add_models([fuel_code])
    return fuel_code


def _versioned(group_uuid: str | None, version: int, action_type: ActionTypeEnum):
    return {
        "group_uuid": group_uuid or str(uuid.uuid4()),
        "version": version,
        "action_type": action_type,
    }


async def seed_fuel_supply(
    add_models,
    ref,
    compliance_report_id: int,
    *,
    group_uuid: str | None = None,
    version: int = 0,
    action_type: ActionTypeEnum = ActionTypeEnum.CREATE,
    fuel_code_id: int | None = None,
    quantity: int = 1000,
) -> FuelSupply:
    row = FuelSupply(
        compliance_report_id=compliance_report_id,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        fuel_category_id=ref.fuel_category.fuel_category_id,
        end_use_id=ref.end_use.end_use_type_id,
        provision_of_the_act_id=(
            ref.fuel_code_provision_id if fuel_code_id else ref.default_ci_provision_id
        ),
        fuel_code_id=fuel_code_id,
        quantity=quantity,
        units=QuantityUnitsEnum.Litres,
        **_versioned(group_uuid, version, action_type),
    )
    await add_models([row])
    return row


async def seed_fuel_export(
    add_models,
    ref,
    compliance_report_id: int,
    *,
    group_uuid: str | None = None,
    version: int = 0,
    action_type: ActionTypeEnum = ActionTypeEnum.CREATE,
) -> FuelExport:
    row = FuelExport(
        compliance_report_id=compliance_report_id,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        fuel_category_id=ref.fuel_category.fuel_category_id,
        end_use_id=ref.end_use.end_use_type_id,
        provision_of_the_act_id=ref.default_ci_provision_id,
        export_date=date(YEAR, 6, 1),
        quantity=1000,
        units=QuantityUnitsEnum.Litres,
        **_versioned(group_uuid, version, action_type),
    )
    await add_models([row])
    return row


async def seed_other_use(
    add_models,
    ref,
    compliance_report_id: int,
    *,
    group_uuid: str | None = None,
    version: int = 0,
    action_type: ActionTypeEnum = ActionTypeEnum.CREATE,
) -> OtherUses:
    row = OtherUses(
        compliance_report_id=compliance_report_id,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        fuel_category_id=ref.fuel_category.fuel_category_id,
        provision_of_the_act_id=ref.default_ci_provision_id,
        expected_use_id=ref.expected_use_id,
        quantity_supplied=1000,
        units="Litres",
        **_versioned(group_uuid, version, action_type),
    )
    await add_models([row])
    return row


async def seed_notional_transfer(
    add_models,
    ref,
    compliance_report_id: int,
    *,
    group_uuid: str | None = None,
    version: int = 0,
    action_type: ActionTypeEnum = ActionTypeEnum.CREATE,
    quantity: int = 1000,
) -> NotionalTransfer:
    row = NotionalTransfer(
        compliance_report_id=compliance_report_id,
        legal_name="Trading partner",
        address_for_service="1 Partner Street, Victoria, BC",
        fuel_category_id=ref.fuel_category.fuel_category_id,
        received_or_transferred=ReceivedOrTransferredEnum.Received,
        quantity=quantity,
        **_versioned(group_uuid, version, action_type),
    )
    await add_models([row])
    return row


async def seed_allocation_agreement(
    add_models,
    ref,
    compliance_report_id: int,
    *,
    group_uuid: str | None = None,
    version: int = 0,
    action_type: ActionTypeEnum = ActionTypeEnum.CREATE,
) -> AllocationAgreement:
    row = AllocationAgreement(
        compliance_report_id=compliance_report_id,
        allocation_transaction_type_id=ref.allocation_type_id,
        transaction_partner="Trading partner",
        postal_address="1 Partner Street, Victoria, BC",
        fuel_type_id=ref.fuel_type.fuel_type_id,
        fuel_category_id=ref.fuel_category.fuel_category_id,
        provision_of_the_act_id=ref.default_ci_provision_id,
        quantity=1000,
        units="Litres",
        **_versioned(group_uuid, version, action_type),
    )
    await add_models([row])
    return row
