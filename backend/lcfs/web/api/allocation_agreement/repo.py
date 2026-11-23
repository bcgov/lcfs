import structlog
from fastapi import Depends
from sqlalchemy import String, and_, asc, case, cast, desc, select, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, joinedload
from typing import List, Optional, Tuple

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelType import FuelType, QuantityUnitsEnum
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.base import (
    PaginatedQueryBuilder,
    PaginationRequestSchema,
    apply_filter_conditions,
    validate_pagination,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.allocation_agreement.schema import AllocationAgreementSchema
from lcfs.web.api.versioning_query_helper import VersioningQueryHelper
from lcfs.web.core.decorators import repo_handler
from lcfs.web.core.ownership import delete_one

logger = structlog.get_logger(__name__)


ALLOCATION_AGREEMENT_BULK_DELETE_EXCLUDE_FIELDS = {
    "allocation_agreement_id",
}


class AllocationAgreementRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session, scope="function"),
        fuel_repo: FuelCodeRepository = Depends(),
    ):
        self.db = db
        self.fuel_code_repo = fuel_repo

    @repo_handler
    async def get_table_options(self, compliance_period: str) -> dict:
        """Get all table options"""
        include_legacy = compliance_period < LCFS_Constants.LEGISLATION_TRANSITION_YEAR

        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        fuel_types = await self.fuel_code_repo.get_formatted_fuel_types(
            include_legacy=include_legacy, compliance_period=compliance_period
        )
        units_of_measure = [unit.value for unit in QuantityUnitsEnum]
        allocation_transaction_types = (
            (await self.db.execute(select(AllocationTransactionType))).scalars().all()
        )

        provisions_select = select(ProvisionOfTheAct)
        if include_legacy:
            provisions_select = provisions_select.where(
                ProvisionOfTheAct.is_legacy == True
            )

        provisions_of_the_act = (
            (await self.db.execute(provisions_select)).scalars().all()
        )
        fuel_codes = (await self.db.execute(select(FuelCode))).scalars().all()

        return {
            "allocation_transaction_types": allocation_transaction_types,
            "fuel_types": fuel_types,
            "fuel_categories": fuel_categories,
            "provisions_of_the_act": provisions_of_the_act,
            "fuel_codes": fuel_codes,
            "units_of_measure": units_of_measure,
        }

    @repo_handler
    async def get_allocation_agreements(
        self, compliance_report_id: int, changelog: bool = False
    ) -> List[AllocationAgreement]:
        """
        Queries allocation agreements from the database for a specific compliance report.
        Returns raw ORM model objects.
        """
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return []

        return await self.get_effective_allocation_agreements(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
            changelog=changelog,
        )

    async def get_effective_allocation_agreements(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> List[AllocationAgreement]:
        """
        Queries effective allocation agreements from the database.
        Returns raw ORM model objects.
        """
        # Get all compliance report IDs in the group up to the specified report
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            and_(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report_group_uuid,
                ComplianceReport.compliance_report_id <= compliance_report_id,
            )
        )

        # Get groups where the latest version is a DELETE.
        # We check the latest version rather than any version because
        # ETL-migrated TFRS supplemental chains can have DELETE followed
        # by UPDATE on the same group_uuid (not possible in modern LCFS).
        deleted_groups = VersioningQueryHelper.deleted_groups_subquery(
            AllocationAgreement,
            where_clauses=[
                AllocationAgreement.compliance_report_id.in_(compliance_reports_select)
            ],
        )

        # Build query conditions
        conditions = [
            AllocationAgreement.compliance_report_id.in_(compliance_reports_select)
        ]

        if changelog:
            # In changelog view, include all groups (both active and deleted)
            conditions.extend(
                [
                    or_(
                        ~AllocationAgreement.group_uuid.in_(deleted_groups),
                        AllocationAgreement.group_uuid.in_(deleted_groups),
                    )
                ]
            )
        else:
            # In regular view, exclude any groups that have deleted records
            conditions.extend([~AllocationAgreement.group_uuid.in_(deleted_groups)])

        # Get the latest version of each record
        valid_agreements_subq = VersioningQueryHelper.latest_version_subquery(
            AllocationAgreement,
            version_label="max_version",
            where_clauses=conditions,
        )

        # Get the actual records with their related data
        allocation_agreements_select = (
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
            )
            .join(
                valid_agreements_subq,
                and_(
                    AllocationAgreement.group_uuid
                    == valid_agreements_subq.c.group_uuid,
                    AllocationAgreement.version == valid_agreements_subq.c.max_version,
                ),
            )
            .order_by(AllocationAgreement.create_date)
        )

        result = await self.db.execute(allocation_agreements_select)
        allocation_agreements = result.unique().scalars().all()

        return allocation_agreements

    @repo_handler
    async def get_allocation_agreements_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> Tuple[List[AllocationAgreement], int]:
        conditions = [AllocationAgreement.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size

        query = (
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
                joinedload(AllocationAgreement.compliance_report),
            )
            .where(*conditions)
        )

        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        result = await self.db.execute(
            query.offset(offset)
            .limit(limit)
            .order_by(AllocationAgreement.create_date.desc())
        )
        allocation_agreements = result.unique().scalars().all()

        return allocation_agreements, total_count

    @staticmethod
    def _index_columns() -> dict:
        """
        Column expressions backing the cross-report allocation agreements index.

        Keys are the snake_case field names the grid sends for filtering and
        sorting, and the names used in the response rows.
        """
        q1, q2, q3, q4 = (
            AllocationAgreement.q1_quantity,
            AllocationAgreement.q2_quantity,
            AllocationAgreement.q3_quantity,
            AllocationAgreement.q4_quantity,
        )
        return {
            # "Analyst_adjustment" -> "Analyst adjustment" so text filters and
            # sorting behave like the label the user sees.
            "status": func.replace(
                cast(ComplianceReportStatus.status, String), "_", " "
            ),
            "compliance_period": CompliancePeriod.description,
            "reporting_organization": Organization.name,
            "allocation_transaction_type": AllocationTransactionType.type,
            "transaction_partner": AllocationAgreement.transaction_partner,
            "postal_address": AllocationAgreement.postal_address,
            "transaction_partner_email": AllocationAgreement.transaction_partner_email,
            "transaction_partner_phone": AllocationAgreement.transaction_partner_phone,
            "fuel_type": FuelType.fuel_type,
            "fuel_type_other": AllocationAgreement.fuel_type_other,
            "fuel_category": FuelCategory.category,
            "provision_of_the_act": ProvisionOfTheAct.name,
            "fuel_code": case(
                (FuelCode.fuel_code_id.is_(None), None),
                else_=func.concat(FuelCodePrefix.prefix, FuelCode.fuel_suffix),
            ),
            "ci_of_fuel": AllocationAgreement.ci_of_fuel,
            "quantity": AllocationAgreement.quantity,
            "q1_quantity": AllocationAgreement.q1_quantity,
            "q2_quantity": AllocationAgreement.q2_quantity,
            "q3_quantity": AllocationAgreement.q3_quantity,
            "q4_quantity": AllocationAgreement.q4_quantity,
            # Mirrors the early issuance grid's client-side total column
            "total_quantity": case(
                (
                    and_(q1.is_(None), q2.is_(None), q3.is_(None), q4.is_(None)),
                    None,
                ),
                else_=(
                    func.coalesce(q1, 0)
                    + func.coalesce(q2, 0)
                    + func.coalesce(q3, 0)
                    + func.coalesce(q4, 0)
                ),
            ),
            "units": AllocationAgreement.units,
        }

    @repo_handler
    async def get_allocation_agreements_index(
        self,
        pagination: PaginationRequestSchema,
        organization_id: Optional[int] = None,
    ) -> Tuple[list, int]:
        """
        Allocation agreements across every non-Draft compliance report version,
        with filtering, sorting and paging done in the database.

        One row is returned per ``allocation_agreement`` record. Every join from
        the agreement is many-to-one (report version, status, period, reporting
        organization and the lookups), so joins cannot duplicate or drop
        agreement rows. Draft is judged on the status of the compliance report
        version that owns the record, and DELETE tombstones (which mark an
        agreement as removed in a supplemental) are not agreements, so they are
        excluded.

        ``organization_id`` returns an agreement when the organization is the
        reporting organization of its compliance report OR when the
        organization's legal name is the agreement's transaction partner.
        """
        pagination = validate_pagination(pagination)
        columns = self._index_columns()

        selected = [
            AllocationAgreement.allocation_agreement_id,
            AllocationAgreement.group_uuid,
            AllocationAgreement.version,
            AllocationAgreement.compliance_report_id,
        ]
        for key, expression in columns.items():
            if key == "status":
                # Select the enum itself; the service renders its display value
                selected.append(ComplianceReportStatus.status.label("status"))
            else:
                selected.append(expression.label(key))

        query = (
            select(*selected)
            .select_from(AllocationAgreement)
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
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == ComplianceReport.compliance_period_id,
            )
            .join(
                Organization,
                Organization.organization_id == ComplianceReport.organization_id,
            )
            .join(
                AllocationTransactionType,
                AllocationTransactionType.allocation_transaction_type_id
                == AllocationAgreement.allocation_transaction_type_id,
            )
            .join(FuelType, FuelType.fuel_type_id == AllocationAgreement.fuel_type_id)
            .outerjoin(
                FuelCategory,
                FuelCategory.fuel_category_id == AllocationAgreement.fuel_category_id,
            )
            .outerjoin(
                ProvisionOfTheAct,
                ProvisionOfTheAct.provision_of_the_act_id
                == AllocationAgreement.provision_of_the_act_id,
            )
            .outerjoin(
                FuelCode, FuelCode.fuel_code_id == AllocationAgreement.fuel_code_id
            )
            .outerjoin(
                FuelCodePrefix, FuelCodePrefix.fuel_code_prefix_id == FuelCode.prefix_id
            )
            .where(
                ComplianceReportStatus.status != ComplianceReportStatusEnum.Draft,
                AllocationAgreement.action_type != ActionTypeEnum.DELETE,
            )
        )

        if organization_id is not None:
            # Aliased so the subquery is not correlated to the reporting
            # organization already joined above.
            selected_org = aliased(Organization)
            selected_org_name = (
                select(func.lower(func.trim(selected_org.name)))
                .where(selected_org.organization_id == organization_id)
                .scalar_subquery()
            )
            query = query.where(
                or_(
                    ComplianceReport.organization_id == organization_id,
                    func.lower(func.trim(AllocationAgreement.transaction_partner))
                    == selected_org_name,
                )
            )

        def column_filter(filter_model):
            column = columns.get(filter_model.field)
            if column is None:
                return None
            value = (
                filter_model.values
                if filter_model.filter_type == "set" and filter_model.values is not None
                else filter_model.filter
            )
            if value in (None, "", []) and filter_model.type not in (
                "blank",
                "notBlank",
                "empty",
            ):
                return None
            if filter_model.field == "status":
                # The status column compares on its display label
                # ("Analyst adjustment"); accept the underscored enum name too.
                value = (
                    [str(v).replace("_", " ") for v in value]
                    if isinstance(value, list)
                    else str(value).replace("_", " ")
                )
            return apply_filter_conditions(
                column, value, filter_model.type, filter_model.filter_type
            )

        builder = PaginatedQueryBuilder(
            AllocationAgreement,
            custom_sorts=columns,
            default_filter=column_filter,
        )
        query = builder.apply_filters(query, pagination.filters)

        if not pagination.sort_orders:
            query = query.order_by(
                desc(columns["compliance_period"]),
                asc(columns["reporting_organization"]),
                desc(AllocationAgreement.compliance_report_id),
            )
        # allocation_agreement_id is a unique tiebreaker so paging is stable
        query = builder.apply_sorting(
            query,
            pagination.sort_orders,
            secondary_field="allocation_agreement_id",
            secondary_direction="asc",
        )

        offset, limit = builder.offset_limit(pagination)
        result = await self.db.execute(
            query.add_columns(func.count().over().label("total_count"))
            .offset(offset)
            .limit(limit)
        )
        rows = result.all()
        if rows:
            return rows, rows[0].total_count

        if offset > 0:
            # Paged past the end: the window count has no row to ride on
            total = await self.db.scalar(
                select(func.count()).select_from(query.order_by(None).subquery())
            )
            return [], total or 0
        return [], 0

    @repo_handler
    async def get_allocation_agreement(
        self, allocation_agreement_id: int
    ) -> AllocationAgreement:
        """
        Get a specific allocation agreement by id.
        """
        return await self.db.scalar(
            select(AllocationAgreement)
            .options(
                joinedload(AllocationAgreement.allocation_transaction_type),
                joinedload(AllocationAgreement.fuel_type),
                joinedload(AllocationAgreement.fuel_category),
                joinedload(AllocationAgreement.provision_of_the_act),
                joinedload(AllocationAgreement.fuel_code),
                joinedload(AllocationAgreement.compliance_report),
            )
            .where(
                AllocationAgreement.allocation_agreement_id == allocation_agreement_id
            )
        )

    @repo_handler
    async def update_allocation_agreement(
        self, allocation_agreement: AllocationAgreement
    ) -> AllocationAgreement:
        """
        Update an existing allocation agreement in the database.
        """
        updated_allocation_agreement = await self.db.merge(allocation_agreement)
        await self.db.flush()
        await self.db.refresh(
            allocation_agreement,
            [
                "fuel_category",
                "fuel_type",
                "allocation_transaction_type",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return updated_allocation_agreement

    @repo_handler
    async def create_allocation_agreement(
        self, allocation_agreement: AllocationAgreement
    ) -> AllocationAgreement:
        """
        Create a new allocation agreement in the database.
        """
        self.db.add(allocation_agreement)
        await self.db.flush()
        await self.db.refresh(
            allocation_agreement,
            [
                "fuel_category",
                "fuel_type",
                "allocation_transaction_type",
                "provision_of_the_act",
                "fuel_code",
            ],
        )
        return allocation_agreement

    @repo_handler
    async def delete_allocation_agreement(
        self, allocation_agreement_id: int, compliance_report_id: int, group_uuid: str
    ):
        """Delete an allocation agreement, only if it is in this report and
        this group"""
        await delete_one(
            self.db,
            AllocationAgreement,
            allocation_agreement_id=allocation_agreement_id,
            compliance_report_id=compliance_report_id,
            group_uuid=group_uuid,
        )
        await self.db.flush()

    @repo_handler
    async def get_allocation_transaction_type_by_name(
        self, type: str
    ) -> AllocationTransactionType:
        result = await self.db.execute(
            select(AllocationTransactionType).where(
                AllocationTransactionType.type == type
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_latest_allocation_agreement_by_group_uuid(
        self, group_uuid: str, compliance_report_id: int
    ) -> Optional[AllocationAgreement]:
        """
        Retrieve the latest version of an allocation agreement by group UUID,
        from the chain of the given compliance report only.
        """
        query = (
            select(AllocationAgreement)
            .where(
                AllocationAgreement.group_uuid == group_uuid,
                AllocationAgreement.compliance_report_id.in_(
                    VersioningQueryHelper.report_chain_ids(compliance_report_id)
                ),
            )
            .order_by(
                AllocationAgreement.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.unique().scalars().first()

    async def delete_all_for_report(self, compliance_report_id: int):
        """
        Delete every AllocationAgreement linked to a compliance report
        """
        await self.db.execute(
            delete(AllocationAgreement).where(
                AllocationAgreement.compliance_report_id == compliance_report_id
            )
        )
        await self.db.flush()
