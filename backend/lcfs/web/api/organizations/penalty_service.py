import math
from decimal import Decimal
from typing import List

import structlog
from fastapi import Depends

from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from .repo import OrganizationsRepository
from .schema import (
    PenaltyAnalyticsResponseSchema,
    PenaltyLogCreateSchema,
    PenaltyLogEntrySchema,
    PenaltyLogListResponseSchema,
    PenaltyLogUpdateSchema,
    PenaltyTotalsSchema,
    PenaltyYearlySummarySchema,
)


logger = structlog.get_logger(__name__)


class OrganizationPenaltyService:
    def __init__(
        self,
        repo: OrganizationsRepository = Depends(OrganizationsRepository),
    ) -> None:
        self.repo = repo

    def _map_penalty_log_model(self, penalty_log) -> PenaltyLogEntrySchema:
        compliance_year = None
        if penalty_log and getattr(penalty_log, "compliance_period", None):
            compliance_year = penalty_log.compliance_period.description

        return PenaltyLogEntrySchema(
            penalty_log_id=penalty_log.penalty_log_id,
            compliance_period_id=penalty_log.compliance_period_id,
            compliance_year=compliance_year,
            contravention_type=penalty_log.contravention_type,
            offence_history=bool(penalty_log.offence_history),
            deliberate=bool(penalty_log.deliberate),
            efforts_to_correct=bool(penalty_log.efforts_to_correct),
            economic_benefit_derived=bool(penalty_log.economic_benefit_derived),
            efforts_to_prevent_recurrence=bool(
                penalty_log.efforts_to_prevent_recurrence
            ),
            notes=penalty_log.notes,
            penalty_amount=float(penalty_log.penalty_amount or 0),
        )

    @service_handler
    async def get_penalty_analytics(
        self, organization_id: int
    ) -> PenaltyAnalyticsResponseSchema:
        """
        Assemble penalty analytics data for the organization, combining automatic
        penalties from compliance reports with discretionary penalties from the
        penalty log.
        """

        def _to_float(value) -> float:
            if value is None:
                return 0.0
            if isinstance(value, Decimal):
                return float(value)
            return float(value)

        summaries, penalty_logs = await self.repo.get_penalty_analytics_data(
            organization_id
        )

        yearly_penalties: List[PenaltyYearlySummarySchema] = []
        total_auto_renewable = 0.0
        total_auto_low_carbon = 0.0

        for row in summaries:
            penalty_override_enabled = bool(row.get("penalty_override_enabled"))

            renewable_penalty = (
                _to_float(row.get("renewable_penalty_override"))
                if penalty_override_enabled
                and row.get("renewable_penalty_override") is not None
                else _to_float(row.get("line_11_penalty_gasoline"))
                + _to_float(row.get("line_11_penalty_diesel"))
                + _to_float(row.get("line_11_penalty_jet_fuel"))
            )

            low_carbon_penalty = (
                _to_float(row.get("low_carbon_penalty_override"))
                if penalty_override_enabled
                and row.get("low_carbon_penalty_override") is not None
                else _to_float(row.get("line_21_penalty_payable"))
            )

            compliance_year_value = row.get("compliance_year")
            try:
                compliance_year = (
                    int(compliance_year_value)
                    if compliance_year_value is not None
                    else None
                )
            except (TypeError, ValueError):
                compliance_year = compliance_year_value

            total_automatic = renewable_penalty + low_carbon_penalty
            total_auto_renewable += renewable_penalty
            total_auto_low_carbon += low_carbon_penalty

            yearly_penalties.append(
                PenaltyYearlySummarySchema(
                    compliance_period_id=row.get("compliance_period_id"),
                    compliance_year=compliance_year,
                    auto_renewable=renewable_penalty,
                    auto_low_carbon=low_carbon_penalty,
                    total_automatic=total_automatic,
                )
            )

        penalty_log_entries: List[PenaltyLogEntrySchema] = []
        discretionary_total = 0.0

        for log in penalty_logs:
            penalty_amount = _to_float(log.get("penalty_amount"))
            discretionary_total += penalty_amount

            compliance_year_value = log.get("compliance_year")
            try:
                compliance_year = (
                    int(compliance_year_value)
                    if compliance_year_value is not None
                    else None
                )
            except (TypeError, ValueError):
                compliance_year = compliance_year_value

            penalty_log_entries.append(
                PenaltyLogEntrySchema(
                    penalty_log_id=log.get("penalty_log_id"),
                    compliance_period_id=log.get("compliance_period_id"),
                    compliance_year=compliance_year,
                    contravention_type=log.get("contravention_type"),
                    offence_history=bool(log.get("offence_history")),
                    deliberate=bool(log.get("deliberate")),
                    efforts_to_correct=bool(log.get("efforts_to_correct")),
                    economic_benefit_derived=bool(log.get("economic_benefit_derived")),
                    efforts_to_prevent_recurrence=bool(
                        log.get("efforts_to_prevent_recurrence")
                    ),
                    notes=log.get("notes"),
                    penalty_amount=penalty_amount,
                )
            )

        total_automatic = total_auto_renewable + total_auto_low_carbon

        totals = PenaltyTotalsSchema(
            auto_renewable=total_auto_renewable,
            auto_low_carbon=total_auto_low_carbon,
            discretionary=discretionary_total,
            total_automatic=total_automatic,
            total=total_automatic + discretionary_total,
        )

        return PenaltyAnalyticsResponseSchema(
            yearly_penalties=yearly_penalties,
            totals=totals,
            penalty_logs=penalty_log_entries,
        )

    @service_handler
    async def get_penalty_logs_paginated(
        self, organization_id: int, pagination: PaginationRequestSchema
    ) -> PenaltyLogListResponseSchema:
        pagination = validate_pagination(pagination)

        records, total = await self.repo.get_penalty_logs_paginated(
            organization_id, pagination
        )

        penalty_logs = [
            PenaltyLogEntrySchema(
                penalty_log_id=row["penalty_log_id"],
                compliance_period_id=row["compliance_period_id"],
                compliance_year=row["compliance_year"],
                contravention_type=row["contravention_type"],
                offence_history=bool(row["offence_history"]),
                deliberate=bool(row["deliberate"]),
                efforts_to_correct=bool(row["efforts_to_correct"]),
                economic_benefit_derived=bool(row["economic_benefit_derived"]),
                efforts_to_prevent_recurrence=bool(
                    row["efforts_to_prevent_recurrence"]
                ),
                notes=row["notes"],
                penalty_amount=float(row["penalty_amount"] or 0),
            )
            for row in records
        ]

        total_pages = (
            math.ceil(total / pagination.size) if pagination.size else 1
        ) or 1

        return PenaltyLogListResponseSchema(
            pagination=PaginationResponseSchema(
                total=total,
                page=pagination.page,
                size=pagination.size,
                total_pages=total_pages,
            ),
            penalty_logs=penalty_logs,
        )

    @service_handler
    async def create_penalty_log(
        self,
        organization_id: int,
        payload: PenaltyLogCreateSchema,
    ) -> PenaltyLogEntrySchema:
        penalty_log = await self.repo.create_penalty_log(organization_id, payload)
        return self._map_penalty_log_model(penalty_log)

    @service_handler
    async def update_penalty_log(
        self,
        organization_id: int,
        penalty_log_id: int,
        payload: PenaltyLogUpdateSchema,
    ) -> PenaltyLogEntrySchema:
        existing = await self.repo.get_penalty_log_by_id(
            organization_id, penalty_log_id
        )
        if not existing:
            raise DataNotFoundException("Penalty log not found")

        updated = await self.repo.update_penalty_log(existing, payload)
        return self._map_penalty_log_model(updated)

    @service_handler
    async def delete_penalty_log(
        self, organization_id: int, penalty_log_id: int
    ) -> None:
        existing = await self.repo.get_penalty_log_by_id(
            organization_id, penalty_log_id
        )
        if not existing:
            raise DataNotFoundException("Penalty log not found")

        deleted = await self.repo.delete_penalty_log(organization_id, penalty_log_id)
        if not deleted:
            raise DataNotFoundException("Penalty log not found")
        return None
