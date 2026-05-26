from decimal import Decimal, ROUND_HALF_UP

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.utils.calculations import calculate_compliance_units


class ComplianceUnitsCalculator:
    """Calculates compliance units for fuel supply (Line 18), fuel export (Line 19),
    and quarterly fuel supply totals used in the early-issuance summary."""

    def __init__(
        self,
        fuel_supply_repo: FuelSupplyRepository,
        fuel_export_repo: FuelExportRepository,
    ):
        self.fuel_supply_repo = fuel_supply_repo
        self.fuel_export_repo = fuel_export_repo

    async def calculate_fuel_supply(self, report: ComplianceReport) -> int:
        """Total compliance units for Line 18 based on effective fuel supplies."""
        fuel_supply_records = await self.fuel_supply_repo.get_effective_fuel_supplies(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
        )

        compliance_units_sum = Decimal("0")
        is_historical = int(report.compliance_period.description) < 2024

        for fuel_supply in fuel_supply_records:
            TCI = fuel_supply.target_ci or 0
            EER = fuel_supply.eer or 0
            RCI = fuel_supply.ci_of_fuel or 0
            UCI = fuel_supply.uci or 0
            Q = (
                (fuel_supply.quantity or 0)
                + (fuel_supply.q1_quantity or 0)
                + (fuel_supply.q2_quantity or 0)
                + (fuel_supply.q3_quantity or 0)
                + (fuel_supply.q4_quantity or 0)
            )
            ED = fuel_supply.energy_density or 0

            compliance_units = calculate_compliance_units(
                TCI=TCI,
                EER=EER,
                RCI=RCI,
                UCI=UCI,
                Q=Q,
                ED=ED,
                is_historical=is_historical,
            )

            compliance_units_sum += compliance_units

        return int(
            compliance_units_sum.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )

    async def calculate_quarterly_fuel_supply(
        self, report: ComplianceReport
    ) -> list[int]:
        """Quarterly compliance unit totals for the early issuance summary."""
        fuel_supply_records = await self.fuel_supply_repo.get_effective_fuel_supplies(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
        )

        compliance_units_sum_q1 = Decimal("0")
        compliance_units_sum_q2 = Decimal("0")
        compliance_units_sum_q3 = Decimal("0")
        compliance_units_sum_q4 = Decimal("0")

        for fuel_supply in fuel_supply_records:
            TCI = fuel_supply.target_ci or 0
            EER = fuel_supply.eer or 0
            RCI = fuel_supply.ci_of_fuel or 0
            UCI = fuel_supply.uci or 0
            ED = fuel_supply.energy_density or 0

            compliance_units_sum_q1 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q1_quantity or 0, ED
            )
            compliance_units_sum_q2 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q2_quantity or 0, ED
            )
            compliance_units_sum_q3 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q3_quantity or 0, ED
            )
            compliance_units_sum_q4 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q4_quantity or 0, ED
            )

        return [
            int(
                compliance_units_sum_q1.quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            ),
            int(
                compliance_units_sum_q2.quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            ),
            int(
                compliance_units_sum_q3.quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            ),
            int(
                compliance_units_sum_q4.quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            ),
        ]

    async def calculate_fuel_export(self, report: ComplianceReport) -> int:
        """Total compliance units for Line 19 based on effective fuel exports."""
        fuel_export_records = await self.fuel_export_repo.get_effective_fuel_exports(
            report.compliance_report_group_uuid, report.compliance_report_id
        )

        is_historical = int(report.compliance_period.description) < 2024
        compliance_units_sum = Decimal("0")

        for fuel_export in fuel_export_records:
            TCI = fuel_export.target_ci or 0
            EER = fuel_export.eer or 0
            RCI = fuel_export.ci_of_fuel or 0
            UCI = fuel_export.uci or 0
            Q = fuel_export.quantity or 0
            ED = fuel_export.energy_density or 0

            compliance_units = calculate_compliance_units(
                TCI=TCI,
                EER=EER,
                RCI=RCI,
                UCI=UCI,
                Q=Q,
                ED=ED,
                is_historical=is_historical,
            )

            compliance_units = -compliance_units
            compliance_units = (
                compliance_units if compliance_units < 0 else Decimal("0")
            )

            compliance_units_sum += compliance_units

        return int(
            compliance_units_sum.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
