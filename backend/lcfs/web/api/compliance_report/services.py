from collections import defaultdict

from datetime import date
import math
from fastapi.exceptions import RequestValidationError
import structlog
import uuid
from fastapi import Depends
from typing import List, Literal
from typing import Union

from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.user import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.dtos import (
    ChangelogFuelSuppliesDTO,
    ChangelogAllocationAgreementsDTO,
    ChangelogFuelExportsDTO,
    ChangelogNotionalTransfersDTO,
    ChangelogOtherUsesDTO,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
    ComplianceReportStatusSchema,
    ComplianceReportViewSchema,
    ChainedComplianceReportSchema,
)
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

logger = structlog.get_logger(__name__)


class ComplianceReportServices:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        org_repo: OrganizationsRepository = Depends(),
        snapshot_services: OrganizationSnapshotService = Depends(),
    ) -> None:
        self.org_repo = org_repo
        self.repo = repo
        self.snapshot_services = snapshot_services

    @service_handler
    async def get_all_compliance_periods(self) -> List[CompliancePeriodBaseSchema]:
        """Fetches all compliance periods and converts them to Pydantic models."""
        periods = await self.repo.get_all_compliance_periods()
        return [CompliancePeriodBaseSchema.model_validate(period) for period in periods]

    @service_handler
    async def create_compliance_report(
        self,
        organization_id: int,
        report_data: ComplianceReportCreateSchema,
        user: UserProfile,
    ) -> ComplianceReportBaseSchema:
        """Creates a new compliance report."""
        period = await self.repo.get_compliance_period(report_data.compliance_period)
        if not period:
            raise DataNotFoundException("Compliance period not found.")

        draft_status = await self.repo.get_compliance_report_status_by_desc(
            report_data.status
        )
        if not draft_status:
            raise DataNotFoundException(f"Status '{report_data.status}' not found.")

        organization = await self.org_repo.get_organization(organization_id)

        # Determine reporting frequency
        reporting_frequency = (
            ReportingFrequency.QUARTERLY
            if organization.has_early_issuance
            else ReportingFrequency.ANNUAL
        )

        # Generate a new group_uuid for the new report series
        group_uuid = str(uuid.uuid4())

        report = ComplianceReport(
            compliance_period_id=period.compliance_period_id,
            organization_id=organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=reporting_frequency,
            compliance_report_group_uuid=group_uuid,  # New group_uuid for the series
            version=0,  # Start with version 0
            nickname=report_data.nickname or "Original Report" if reporting_frequency == ReportingFrequency.ANNUAL else 'Early Issuance Report',
            summary=ComplianceReportSummary(),  # Create an empty summary object
            legacy_id=report_data.legacy_id,
            create_user=user.keycloak_username,
        )

        # Add the new compliance report
        report = await self.repo.create_compliance_report(report)

        # Snapshot the Organization Details
        await self.snapshot_services.create_organization_snapshot(
            report.compliance_report_id, organization_id
        )

        # Create the history record
        await self.repo.add_compliance_report_history(report, user)

        return ComplianceReportBaseSchema.model_validate(report)

    @service_handler
    async def create_analyst_adjustment_report(
        self, existing_report_id: int, user: UserProfile
    ) -> ComplianceReportBaseSchema:
        """
        Creates a new analyst adjustment report.
        The report_id can be any report in the series (original or supplemental).
        Analyst adjustments are only allowed if the status of the current report is 'Submitted'.
        """
        # Fetch the current report using the provided report_id
        current_report = await self.repo.get_compliance_report_by_id(existing_report_id)
        if not current_report:
            raise DataNotFoundException("Compliance report not found.")

        # Validate that the status of the current report is 'Submitted'
        if current_report.current_status.status != ComplianceReportStatusEnum.Submitted:
            raise ServiceException(
                "An analyst adjustment can only be created if the current report's status is 'Submitted'."
            )

        # Get the group_uuid from the current report
        group_uuid = current_report.compliance_report_group_uuid

        # Fetch the latest version number for the given group_uuid
        latest_report = await self.repo.get_latest_report_by_group_uuid(group_uuid)
        if not latest_report:
            raise DataNotFoundException("Latest compliance report not found.")

        new_version = latest_report.version + 1

        analyst_adjustment_status = (
            await self.repo.get_compliance_report_status_by_desc(
                ComplianceReportStatusEnum.Analyst_adjustment.value
            )
        )
        if not analyst_adjustment_status:
            raise DataNotFoundException("Draft status not found.")

        # Create the new supplemental compliance report
        new_report = ComplianceReport(
            compliance_period_id=current_report.compliance_period_id,
            organization_id=current_report.organization_id,
            current_status_id=analyst_adjustment_status.compliance_report_status_id,
            reporting_frequency=current_report.reporting_frequency,
            compliance_report_group_uuid=group_uuid,  # Use the same group_uuid
            version=new_version,  # Increment the version
            supplemental_initiator=SupplementalInitiatorType.GOVERNMENT_REASSESSMENT,
            nickname=f"Government adjustment {new_version}",
            summary=ComplianceReportSummary(),  # Create an empty summary object
        )

        # Add the new supplemental report
        new_report = await self.repo.create_compliance_report(new_report)

        # Snapshot the Organization Details
        await self.snapshot_services.create_organization_snapshot(
            new_report.compliance_report_id,
            current_report.organization_id,
            current_report.compliance_report_id,
        )

        # Create the history record for the new supplemental report
        await self.repo.add_compliance_report_history(new_report, user)

        return ComplianceReportBaseSchema.model_validate(new_report)

    @service_handler
    async def create_supplemental_report(
        self, report_id: int, user: UserProfile = None, legacy_id: int = None
    ) -> ComplianceReportBaseSchema:
        """
        Creates a new supplemental compliance report.
        The report_id can be any report in the series (original or supplemental).
        Supplemental reports are only allowed if the status of the current report is 'Assessed'.
        """
        # Fetch the current report using the provided report_id
        current_report = await self.repo.get_compliance_report_by_id(report_id)
        if not current_report:
            raise DataNotFoundException("Compliance report not found.")

        # Validate that the user has permission to create a supplemental report
        if user.organization_id != current_report.organization_id:
            raise ServiceException(
                "You do not have permission to create a supplemental report for this organization."
            )

        # TODO this logic to be re-instated once TFRS is shutdown
        # TFRS allows supplementals on previously un-accepted reports
        # so we have to support this until LCFS and TFRS are no longer synced
        # Validate that the status of the current report is 'Assessed'
        # if current_report.current_status.status != ComplianceReportStatusEnum.Assessed:
        #     raise ServiceException(
        #         "A supplemental report can only be created if the current report's status is 'Assessed'."
        #     )

        # Get the group_uuid from the current report
        group_uuid = current_report.compliance_report_group_uuid

        # Fetch the latest version number for the given group_uuid
        latest_report = await self.repo.get_latest_report_by_group_uuid(group_uuid)
        if not latest_report:
            raise DataNotFoundException("Latest compliance report not found.")

        new_version = latest_report.version + 1

        # Get the 'Draft' status
        draft_status = await self.repo.get_compliance_report_status_by_desc(
            ComplianceReportStatusEnum.Draft.value
        )
        if not draft_status:
            raise DataNotFoundException("Draft status not found.")

        # Retrieve the assessed report for the current compliance period
        assessed_report = await self.repo.get_assessed_compliance_report_by_period(
            current_report.organization_id,
            int(current_report.compliance_period.description),
        )
        if not assessed_report or not assessed_report.summary:
            raise DataNotFoundException(
                "Assessed report summary not found for the same period"
            )

        # Copy over the summary lines from the assessed report.
        summary_data = {
            column: getattr(assessed_report.summary, column)
            for column in assessed_report.summary.__table__.columns.keys()
            if any(column.startswith(f"line_{i}") for i in range(6, 10))
        }
        new_summary = ComplianceReportSummary(**summary_data)

        # Create the new supplemental compliance report
        new_report = ComplianceReport(
            compliance_period_id=current_report.compliance_period_id,
            legacy_id=legacy_id,
            organization_id=current_report.organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=current_report.reporting_frequency,
            compliance_report_group_uuid=group_uuid,  # Use the same group_uuid
            version=new_version,  # Increment the version
            supplemental_initiator=SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
            nickname=f"Supplemental report {new_version}",
            summary=new_summary,
        )

        # Add the new supplemental report
        new_report = await self.repo.create_compliance_report(new_report)

        # Snapshot the organization details from the previous report
        await self.snapshot_services.create_organization_snapshot(
            new_report.compliance_report_id,
            current_report.organization_id,
            current_report.compliance_report_id,
        )

        # Create the history record for the new supplemental report
        await self.repo.add_compliance_report_history(new_report, user)

        return ComplianceReportBaseSchema.model_validate(new_report)

    @service_handler
    async def delete_compliance_report(self, report_id: int, user: UserProfile = None):
        """
        Deletes a compliance report.
        - The report_id can be any report in the series (original or supplemental).
        - Supplemental reports are only allowed if the status of the current report is 'Draft'.
        - Compliance/Supplemental report that is in 'Analyst_adjustment / In Re-assessment
          status then allow Gov users to delete the report.
        """
        # Fetch the current report using the provided report_id
        current_report = await self.repo.get_compliance_report_by_id(
            report_id, is_model=True
        )
        if not current_report:
            raise DataNotFoundException("Compliance report not found.")

        # Validate that the user has permission to delete a supplemental report
        if (
            user.organization_id is not None
            and user.organization_id != current_report.organization_id
        ) or (
            user.organization_id is None
            and not user_has_roles(user, [RoleEnum.GOVERNMENT])
        ):
            raise ServiceException(
                "You do not have permission to delete a this report."
            )

        # Validate that the status of the current report is 'Draft'
        if current_report.current_status.status not in [
            ComplianceReportStatusEnum.Draft,
            ComplianceReportStatusEnum.Analyst_adjustment,
        ]:
            raise ServiceException(
                "A supplemental report can only be deleted if the status is 'Draft/Analyst_adjustment'."
            )

        # Delete the compliance report
        await self.repo.delete_compliance_report(report_id)
        return True

    @service_handler
    async def get_compliance_reports_paginated(
        self,
        pagination,
        user: UserProfile,
    ):
        """Fetches all compliance reports"""
        is_bceid_user = user_has_roles(user, [RoleEnum.GOVERNMENT])
        if is_bceid_user:
            for filter in pagination.filters:
                if (
                    filter.field == "status"
                    and filter.filter == ComplianceReportStatusEnum.Submitted.value
                ):
                    filter.filter_type = "set"
                    filter.filter = [
                        ComplianceReportStatusEnum.Recommended_by_analyst,
                        ComplianceReportStatusEnum.Recommended_by_manager,
                        ComplianceReportStatusEnum.Submitted,
                    ]

        reports, total_count = await self.repo.get_reports_paginated(pagination, user)

        reports = self._mask_report_status(reports, user)

        return ComplianceReportListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            reports=reports,
        )

    def _mask_report_status(self, reports: List, user: UserProfile) -> List:
        is_analyst = user_has_roles(user, [RoleEnum.ANALYST])
        is_supplier = user_has_roles(user, [RoleEnum.SUPPLIER])

        becid_only_statuses = {
            ComplianceReportStatusEnum.Recommended_by_analyst.underscore_value(),
            ComplianceReportStatusEnum.Recommended_by_manager.underscore_value(),
        }

        becid_only_statuses_regular = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }

        analyst_only_statuses = {
            ComplianceReportStatusEnum.Analyst_adjustment.underscore_value(),
        }

        analyst_only_statuses_regular = {
            ComplianceReportStatusEnum.Analyst_adjustment.underscore_value(),
        }

        if is_supplier:
            for report in reports:
                if isinstance(report, ComplianceReportViewSchema):
                    if is_supplier and report.report_status in becid_only_statuses:
                        report.report_status, report.report_status_id = (
                            ComplianceReportStatusEnum.Submitted.value,
                            None,
                        )
                    if not is_analyst and report.report_status in analyst_only_statuses:
                        report.report_status, report.report_status_id = (
                            ComplianceReportStatusEnum.Submitted.value,
                            None,
                        )
                elif isinstance(report, ComplianceReportBaseSchema):
                    if (
                        is_supplier
                        and report.current_status.status in becid_only_statuses_regular
                    ):
                        (
                            report.current_status.status,
                            report.current_status.compliance_report_status_id,
                        ) = (
                            ComplianceReportStatusEnum.Submitted.value,
                            None,
                        )
                    if (
                        not is_analyst
                        and report.current_status.status
                        in analyst_only_statuses_regular
                    ):
                        (
                            report.current_status.status,
                            report.current_status.compliance_report_status_id,
                        ) = (
                            ComplianceReportStatusEnum.Submitted.value,
                            None,
                        )
        return reports

    @service_handler
    async def get_compliance_report_chain(
        self,
        report_id: int,
        user: UserProfile,
    ) -> ChainedComplianceReportSchema:
        """
        Fetches a specific compliance report by ID.
        """
        report = await self.get_compliance_report_by_id(report_id, user)

        compliance_report_chain = await self.repo.get_compliance_report_chain(
            report.compliance_report_group_uuid
        )

        is_newest = len(compliance_report_chain) - 1 == report.version
        filtered_chain = [
            chained_report
            for chained_report in compliance_report_chain
            if chained_report.version <= report.version
        ]

        # Apply masking to each report in the chain
        masked_chain = self._mask_report_status(filtered_chain, user)
        # Apply history masking to each report in the chain
        masked_chain = [
            self._mask_report_status_for_history(report, user)
            for report in masked_chain
        ]
        return ChainedComplianceReportSchema(
            report=report, chain=masked_chain, is_newest=is_newest
        )

    @service_handler
    async def get_compliance_report_by_id(
        self,
        report_id: int,
        user: UserProfile,
    ) -> ComplianceReportBaseSchema:
        """
        Fetches a specific compliance report by ID.
        """
        report = await self.repo.get_compliance_report_by_id(report_id)
        if report is None:
            raise DataNotFoundException("Compliance report not found.")

        validated_report = ComplianceReportBaseSchema.model_validate(report)
        masked_report = self._mask_report_status([validated_report], user)[0]

        history_masked_report = self._mask_report_status_for_history(
            masked_report, user
        )

        return history_masked_report

    def _mask_report_status_for_history(
        self, report: ComplianceReportBaseSchema, user: UserProfile
    ) -> ComplianceReportBaseSchema:
        is_bceid = user_has_roles(user, [RoleEnum.GOVERNMENT])
        is_analyst = user_has_roles(user, [RoleEnum.ANALYST])
        bceid_only_status = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }
        if (
            not is_bceid
            or report.current_status.status
            == ComplianceReportStatusEnum.Submitted.value
        ):
            report.history = [
                h for h in report.history if h.status.status not in bceid_only_status
            ]

        if (
            not is_analyst
            and report.current_status.status
            == ComplianceReportStatusEnum.Analyst_adjustment.value
        ):
            report.history = [
                h
                for h in report.history
                if h.status.status
                != ComplianceReportStatusEnum.Analyst_adjustment.value
            ]
        report.history = [
            h
            for h in report.history
            if h.status.status != ComplianceReportStatusEnum.Draft.value
        ]

        return report

    @service_handler
    async def get_all_org_reported_years(
        self, organization_id: int
    ) -> List[CompliancePeriodBaseSchema]:
        return await self.repo.get_all_org_reported_years(organization_id)

    def _model_to_dict(self, record) -> dict:
        """Safely convert a model to a dict, skipping lazy-loaded attributes that raise errors."""
        result = {}
        for key, value in record.__dict__.items():
            if key == "_sa_instance_state":
                continue
            try:
                result[key] = value
            except Exception:
                result[key] = None
        return result

    def _remove_draft_entries(
        self, report: ComplianceReportBaseSchema
    ) -> Union[ComplianceReportBaseSchema, None]:
        """
        Removes 'Draft' entries from the report history.
        """
        # Filter out 'Draft' from the history
        new_history = [
            h
            for h in report.history
            if h.status.status != ComplianceReportStatusEnum.Draft.value
        ]
        report.history = new_history

        return report

    def _remove_draft_reports(
        self, reports: List[ComplianceReportBaseSchema]
    ) -> List[ComplianceReportBaseSchema]:
        """
        Removes 'Draft' reports from the compliance report chain.
        """
        filtered = []
        for r in reports:
            if r.current_status.status == ComplianceReportStatusEnum.Draft.value:
                continue
            filtered.append(r)
        return filtered

    @service_handler
    async def get_compliance_report_statuses(
        self, user: UserProfile
    ) -> List[ComplianceReportStatusSchema]:
        """
        Fetches all compliance report statuses.
        """
        statuses = await self.repo.get_compliance_report_statuses()
        if user_has_roles(user, [RoleEnum.GOVERNMENT]):
            statuses = [
                s
                for s in statuses
                if s.status not in [ComplianceReportStatusEnum.Draft]
            ]
        else:
            statuses = [
                s
                for s in statuses
                if s.status
                not in [
                    ComplianceReportStatusEnum.Recommended_by_analyst,
                    ComplianceReportStatusEnum.Recommended_by_manager,
                    ComplianceReportStatusEnum.Not_recommended_by_analyst,
                    ComplianceReportStatusEnum.Not_recommended_by_manager,
                    ComplianceReportStatusEnum.Analyst_adjustment,
                ]
            ]
        return statuses

    @service_handler
    async def get_changelog_data(
        self,
        compliance_report_group_uuid: str,
        data_type: Literal[
            "fuel_supplies",
            "fuel_exports",
            "notional_transfers",
            "other_uses",
            "allocation_agreements",
        ],
    ) -> List:

        data_map = {
            "fuel_supplies": {
                "model": FuelSupply,
                "dto": ChangelogFuelSuppliesDTO,
                "id_field": "fuel_supply_id",
                "relationships": [
                    ("fuel_supplies", "fuel_type"),
                    ("fuel_supplies", "fuel_category"),
                    ("fuel_supplies", "fuel_code"),
                    ("fuel_supplies", "end_use_type"),
                    ("fuel_supplies", "provision_of_the_act"),
                ],
            },
            "fuel_exports": {
                "model": FuelExport,
                "dto": ChangelogFuelExportsDTO,
                "id_field": "fuel_export_id",
                "relationships": [
                    ("fuel_exports", "fuel_type"),
                    ("fuel_exports", "fuel_category"),
                    ("fuel_exports", "fuel_code"),
                    ("fuel_exports", "end_use_type"),
                    ("fuel_exports", "provision_of_the_act"),
                ],
            },
            "notional_transfers": {
                "model": NotionalTransfer,
                "dto": ChangelogNotionalTransfersDTO,
                "id_field": "notional_transfer_id",
                "relationships": [
                    ("notional_transfers", "fuel_category"),
                ],
            },
            "other_uses": {
                "model": OtherUses,
                "dto": ChangelogOtherUsesDTO,
                "id_field": "other_uses_id",
                "relationships": [
                    ("other_uses", "fuel_type"),
                    ("other_uses", "fuel_category"),
                    ("other_uses", "fuel_code"),
                    ("other_uses", "expected_use"),
                    ("other_uses", "provision_of_the_act"),
                ],
            },
            "allocation_agreements": {
                "model": AllocationAgreement,
                "dto": ChangelogAllocationAgreementsDTO,
                "id_field": "allocation_agreement_id",
                "relationships": [
                    ("allocation_agreements", "allocation_transaction_type"),
                    ("allocation_agreements", "fuel_type"),
                    ("allocation_agreements", "fuel_category"),
                    ("allocation_agreements", "fuel_code"),
                    ("allocation_agreements", "provision_of_the_act"),
                ],
            },
        }

        if data_type not in data_map:
            raise ValueError(f"Invalid data_type: {data_type}")

        config = data_map[data_type]
        dto = config["dto"]
        id_field = config["id_field"]

        reports = await self.repo.get_changelog_data(
            compliance_report_group_uuid, config
        )

        if not reports or len(reports) == 0:
            return []

        group_map = defaultdict(dict)

        for report in reports:
            for data in getattr(report, data_type) or []:
                group_map[data.group_uuid][data.version] = data

        grouped_fs_reports = []

        for report in reports:
            seen_ids = set()
            items = []

            for data in getattr(report, data_type) or []:
                items.append(data)
                seen_ids.add(getattr(data, id_field))

                if data.action_type == "UPDATE":
                    prev = group_map[data.group_uuid].get(data.version - 1)
                    if prev and getattr(prev, id_field) not in seen_ids:
                        diff = []
                        for key, value in data.__dict__.items():
                            prev_value = getattr(prev, key, None)
                            if prev_value != value:
                                camel_case_key = key.split("_")[0] + "".join(
                                    x.capitalize() for x in key.split("_")[1:]
                                )
                                diff.append(camel_case_key)

                        prev.diff = diff
                        prev.updated = True
                        prev.action_type = "UPDATE"
                        data.diff = diff

                        items.append(prev)
                        seen_ids.add(getattr(prev, id_field))

            grouped_fs_reports.append(
                dto(
                    nickname=report.nickname,
                    version=report.version,
                    compliance_report_id=report.compliance_report_id,
                    **{data_type: items},
                )
            )

        latest_entries = {}

        for group_uuid, versions in group_map.items():
            latest_version = max(versions.keys())
            latest_item = versions[latest_version]

            if latest_item.action_type == "DELETE":
                continue

            latest_entries[group_uuid] = latest_item

        latest_entries_list = list(latest_entries.values())

        grouped_fs_reports.insert(
            0,
            dto(
                nickname="Current State",
                version=reports[0].version,
                compliance_report_id=reports[0].compliance_report_id,
                **{data_type: latest_entries_list},
            ),
        )

        return grouped_fs_reports
