from datetime import date
from typing import Any, List, Sequence

import structlog
from fastapi import Depends
from sqlalchemy import (
    and_,
    delete,
    distinct,
    exists,
    func,
    select,
    update,
    asc,
    desc,
    literal,
    union,
    case,
)
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, aliased

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import Organization
from lcfs.db.models.compliance import (
    AllocationAgreement,
    ComplianceReport,
    EndUserType,
    FSEReportingBasePrefView,
    FSEReportingBaseView,
    FinalSupplyEquipment,
    ChargingEquipmentStatus,
    ComplianceReportChargingEquipment,
    ChargingPowerOutput,
)
from lcfs.db.models.compliance.ChargingEquipment import (
    ChargingEquipment,
    charging_equipment_intended_use_association,
    charging_equipment_intended_user_association,
)
from lcfs.db.models.compliance.ChargingSite import (
    ChargingSite,
    latest_charging_site_version_subquery,
)
from lcfs.web.api.base import apply_filter_conditions, get_field_for_filter
from lcfs.db.models.compliance.FinalSupplyEquipmentRegNumber import (
    FinalSupplyEquipmentRegNumber,
)
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentCreateSchema,
    PortsEnum,
    FSEReportingDefaultDates,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class FinalSupplyEquipmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    def _combine_reporting_queries(self, union_queries: list[Any]):
        """
        Combine reporting queries while removing exact duplicate rows.
        """
        if len(union_queries) == 1:
            return union_queries[0]
        return union(*union_queries)

    def _latest_equipment_versions_subquery(self, organization_id: int):
        """
        Keep only the latest non-decommissioned charging equipment row per
        logical equipment series (`group_uuid`) for the organization.
        """
        latest_sites = latest_charging_site_version_subquery()

        return (
            select(
                ChargingEquipment.group_uuid.label("group_uuid"),
                ChargingEquipment.charging_equipment_id.label("charging_equipment_id"),
                ChargingEquipment.version.label("charging_equipment_version"),
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.group_uuid,
                    order_by=(
                        desc(ChargingEquipment.version),
                        desc(ChargingEquipment.charging_equipment_id),
                    ),
                )
                .label("row_number"),
            )
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
            )
            .join(
                latest_sites,
                and_(
                    ChargingSite.group_uuid == latest_sites.c.group_uuid,
                    ChargingSite.version == latest_sites.c.latest_version,
                ),
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .where(
                and_(
                    ChargingSite.organization_id == organization_id,
                    ChargingEquipmentStatus.status != "Decommissioned",
                )
            )
            .subquery()
        )

    @repo_handler
    async def sync_reporting_associations_to_latest_equipment(
        self, compliance_report_group_uuid: str, organization_id: int
    ) -> int:
        """
        Move report-equipment associations forward to the latest charging
        equipment version for each logical equipment `group_uuid`.
        """
        latest_equipment_versions = self._latest_equipment_versions_subquery(
            organization_id
        )
        current_equipment = aliased(ChargingEquipment, name="current_equipment")

        sync_candidates_stmt = (
            select(
                ComplianceReportChargingEquipment,
                current_equipment.group_uuid.label("charging_equipment_group_uuid"),
                latest_equipment_versions.c.charging_equipment_id.label(
                    "latest_charging_equipment_id"
                ),
                latest_equipment_versions.c.charging_equipment_version.label(
                    "latest_charging_equipment_version"
                ),
            )
            .join(
                current_equipment,
                ComplianceReportChargingEquipment.charging_equipment_id
                == current_equipment.charging_equipment_id,
            )
            .join(
                latest_equipment_versions,
                and_(
                    current_equipment.group_uuid
                    == latest_equipment_versions.c.group_uuid,
                    latest_equipment_versions.c.row_number == 1,
                ),
            )
            .where(
                and_(
                    ComplianceReportChargingEquipment.compliance_report_group_uuid
                    == compliance_report_group_uuid,
                    (
                        ComplianceReportChargingEquipment.charging_equipment_id
                        != latest_equipment_versions.c.charging_equipment_id
                    )
                    | (
                        ComplianceReportChargingEquipment.charging_equipment_version
                        != latest_equipment_versions.c.charging_equipment_version
                    ),
                )
            )
        )

        sync_candidates = (await self.db.execute(sync_candidates_stmt)).all()
        if not sync_candidates:
            return 0

        synced_count = 0

        for row in sync_candidates:
            association = row[0]
            charging_equipment_group_uuid = row.charging_equipment_group_uuid
            latest_equipment_id = row.latest_charging_equipment_id
            latest_equipment_version = row.latest_charging_equipment_version

            existing_target_stmt = select(ComplianceReportChargingEquipment).where(
                and_(
                    ComplianceReportChargingEquipment.compliance_report_group_uuid
                    == compliance_report_group_uuid,
                    ComplianceReportChargingEquipment.organization_id
                    == association.organization_id,
                    ComplianceReportChargingEquipment.charging_equipment_id
                    == latest_equipment_id,
                    ComplianceReportChargingEquipment.charging_equipment_version
                    == latest_equipment_version,
                )
            )
            existing_target = (
                await self.db.execute(existing_target_stmt)
            ).scalars().first()

            if (
                existing_target
                and existing_target.charging_equipment_compliance_id
                != association.charging_equipment_compliance_id
            ):
                existing_target.supply_from_date = association.supply_from_date
                existing_target.supply_to_date = association.supply_to_date
                existing_target.kwh_usage = (
                    association.kwh_usage
                    if association.kwh_usage is not None
                    else existing_target.kwh_usage
                )
                existing_target.compliance_notes = (
                    association.compliance_notes
                    if association.compliance_notes is not None
                    else existing_target.compliance_notes
                )
                existing_target.is_active = (
                    association.is_active or existing_target.is_active
                )
                existing_target.compliance_report_id = association.compliance_report_id
                await self.db.delete(association)
                retained_association_id = existing_target.charging_equipment_compliance_id
            else:
                association.charging_equipment_id = latest_equipment_id
                association.charging_equipment_version = latest_equipment_version
                association.is_active = True
                retained_association_id = association.charging_equipment_compliance_id

            previous_versions_subquery = (
                select(ComplianceReportChargingEquipment.charging_equipment_compliance_id)
                .join(
                    current_equipment,
                    ComplianceReportChargingEquipment.charging_equipment_id
                    == current_equipment.charging_equipment_id,
                )
                .where(
                    and_(
                        ComplianceReportChargingEquipment.compliance_report_group_uuid
                        == compliance_report_group_uuid,
                        ComplianceReportChargingEquipment.compliance_report_id
                        == association.compliance_report_id,
                        current_equipment.group_uuid
                        == charging_equipment_group_uuid,
                        ComplianceReportChargingEquipment.charging_equipment_compliance_id
                        != retained_association_id,
                    )
                )
            )
            await self.db.execute(
                update(ComplianceReportChargingEquipment)
                .where(
                    ComplianceReportChargingEquipment.charging_equipment_compliance_id.in_(
                        previous_versions_subquery
                    )
                )
                .values(is_active=False)
            )

            synced_count += 1

        await self.db.flush()
        return synced_count

    def _apply_latest_site_filter(self, stmt):
        """
        Constrains statements involving ChargingSite to only include the most recent version.
        """
        latest_sites = latest_charging_site_version_subquery()
        return stmt.join(
            latest_sites,
            and_(
                ChargingSite.group_uuid == latest_sites.c.group_uuid,
                ChargingSite.version == latest_sites.c.latest_version,
            ),
        )

    @repo_handler
    async def get_fse_options(self, organization) -> tuple[
        Sequence[EndUseType],
        Sequence[LevelOfEquipment],
        Sequence[EndUserType],
        list[str],
        list[str],
    ]:
        """
        Retrieve all FSE options in a single database transaction
        """
        intended_use_types = await self.get_intended_use_types()
        levels_of_equipment = await self.get_levels_of_equipment()
        intended_user_types = await self.get_intended_user_types()
        organization_names = await self.get_organization_names(organization)
        ports = [PortsEnum.SINGLE.value, PortsEnum.DUAL.value]
        return (
            intended_use_types,
            levels_of_equipment,
            intended_user_types,
            ports,
            organization_names,
        )

    async def get_intended_use_types(self) -> Sequence[EndUseType]:
        """
        Retrieve a list of intended use types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUseType).where(EndUseType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_intended_use_by_name(self, intended_use: str) -> EndUseType:
        """
        Retrieve intended use type by name from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUseType).where(
                        and_(
                            EndUseType.type == intended_use,
                            EndUseType.intended_use == True,
                        )
                    )
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve a list of intended user types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(EndUserType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    async def get_organization_names(self, organization: Organization) -> List[str]:
        """
        Retrieve unique organization names for Final Supply Equipment dropdown including:
        1. User's own organization name (as default)
        2. Transaction partner names from allocation agreements
        3. Organization names from existing FSE records

        Args:
            organization (Organization): The user's organization.

        Returns:
            List[str]: A list of unique organization names, with user's org first.
        """
        try:
            if not organization or not organization.organization_id:
                return []

            organization_names = set()

            # 1. Add user's own organization name (primary option)
            if organization.name:
                organization_names.add(organization.name)

            # 2. Add transaction partner names from allocation agreements
            allocation_partners = (
                await self.db.execute(
                    select(distinct(AllocationAgreement.transaction_partner))
                    .join(
                        ComplianceReport,
                        AllocationAgreement.compliance_report_id
                        == ComplianceReport.compliance_report_id,
                    )
                    .filter(
                        ComplianceReport.organization_id == organization.organization_id
                    )
                    .filter(AllocationAgreement.transaction_partner.isnot(None))
                )
            ).all()

            for partner in allocation_partners:
                organization_names.add(partner[0])

            # 3. Add organization names from existing FSE records
            existing_fse_orgs = (
                await self.db.execute(
                    select(distinct(FinalSupplyEquipment.organization_name))
                    .join(
                        ComplianceReport,
                        FinalSupplyEquipment.compliance_report_id
                        == ComplianceReport.compliance_report_id,
                    )
                    .filter(
                        ComplianceReport.organization_id == organization.organization_id
                    )
                    .filter(FinalSupplyEquipment.organization_name.isnot(None))
                )
            ).all()

            for fse_org in existing_fse_orgs:
                organization_names.add(fse_org[0])

            # Convert to sorted list with user's organization first
            result = []
            if organization.name and organization.name in organization_names:
                result.append(organization.name)
                organization_names.remove(organization.name)

            # Add remaining organizations in alphabetical order
            result.extend(sorted(list(organization_names)))

            return result

        except Exception as e:
            logger.error("Error getting organization names", error=str(e))
            return []

    @repo_handler
    async def get_intended_user_by_name(self, intended_user: str) -> EndUserType | None:
        """
        Retrieve intended user type name from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(
                        and_(
                            EndUserType.type_name == intended_user,
                            EndUserType.intended_use == True,
                        )
                    )
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    async def get_levels_of_equipment(self) -> Sequence[LevelOfEquipment]:
        """
        Retrieve a list of levels of equipment from the database
        """
        return (await self.db.execute(select(LevelOfEquipment))).scalars().all()

    @repo_handler
    async def get_level_of_equipment_by_name(self, name: str) -> LevelOfEquipment:
        """
        Get the levels of equipment by name
        """
        return (
            (
                await self.db.execute(
                    select(LevelOfEquipment).where(LevelOfEquipment.name == name)
                )
            )
            .unique()
            .scalar_one_or_none()
        )

    @repo_handler
    async def get_fse_list(self, report_id: int) -> Sequence[FinalSupplyEquipment]:
        """
        Retrieve a list of final supply equipment from the database
        """
        result = await self.db.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(FinalSupplyEquipment.compliance_report_id == report_id)
            .order_by(FinalSupplyEquipment.create_date.asc())
        )
        return result.unique().scalars().all()

    @repo_handler
    async def get_fse_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> tuple[Sequence[FinalSupplyEquipment], Any]:
        """
        Retrieve a list of final supply equipment from the database with pagination
        """
        conditions = [FinalSupplyEquipment.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        query = (
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(*conditions)
        )
        count_query = query.with_only_columns(
            func.count(FinalSupplyEquipment.final_supply_equipment_id)
        ).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.offset(offset)
            .limit(limit)
            .order_by(FinalSupplyEquipment.create_date.asc())
        )
        final_supply_equipments = result.unique().scalars().all()
        return final_supply_equipments, total_count

    @repo_handler
    async def get_final_supply_equipment_by_id(
        self, final_supply_equipment_id: int
    ) -> FinalSupplyEquipment:
        """
        Retrieve a final supply equipment from the database
        """
        result = await self.db.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
                joinedload(FinalSupplyEquipment.level_of_equipment),
            )
            .where(
                FinalSupplyEquipment.final_supply_equipment_id
                == final_supply_equipment_id
            )
        )
        return result.unique().scalar_one_or_none()

    @repo_handler
    async def update_final_supply_equipment(
        self, final_supply_equipment: FinalSupplyEquipment
    ) -> FinalSupplyEquipment:
        """
        Update an existing final supply equipment in the database.
        """
        updated_final_supply_equipment = await self.db.merge(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(
            final_supply_equipment,
            ["level_of_equipment", "intended_use_types", "intended_user_types"],
        )
        return updated_final_supply_equipment

    @repo_handler
    async def create_final_supply_equipment(
        self, final_supply_equipment: FinalSupplyEquipment
    ) -> FinalSupplyEquipment:
        """
        Create a new final supply equipment in the database.
        """
        self.db.add(final_supply_equipment)
        await self.db.flush()
        await self.db.refresh(
            final_supply_equipment,
            ["level_of_equipment", "intended_use_types"],
        )
        return final_supply_equipment

    @repo_handler
    async def delete_final_supply_equipment(self, final_supply_equipment_id: int):
        """Delete a final supply equipment from the database"""
        await self.db.execute(
            delete(FinalSupplyEquipment).where(
                FinalSupplyEquipment.final_supply_equipment_id
                == final_supply_equipment_id
            )
        )
        await self.db.flush()

    @repo_handler
    async def get_current_seq_by_org_and_postal_code(
        self, organization_code: str, postal_code: str
    ) -> int:
        """
        Retrieve the current sequence number for a given organization code and postal code.
        """
        result = await self.db.execute(
            select(FinalSupplyEquipmentRegNumber.current_sequence_number).where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                    FinalSupplyEquipmentRegNumber.postal_code == postal_code,
                )
            )
        )
        current_sequence_number = result.scalar()
        return current_sequence_number if current_sequence_number is not None else 0

    @repo_handler
    async def increment_seq_by_org_and_postal_code(
        self, organization_code: str, postal_code: str
    ) -> int:
        """
        Increment and return the next sequence number for a given organization code and postal code.
        """
        # Try to update the existing sequence
        result = await self.db.execute(
            update(FinalSupplyEquipmentRegNumber)
            .where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                    FinalSupplyEquipmentRegNumber.postal_code == postal_code,
                )
            )
            .values(
                current_sequence_number=FinalSupplyEquipmentRegNumber.current_sequence_number
                + 1
            )
            .returning(FinalSupplyEquipmentRegNumber.current_sequence_number)
        )
        sequence_number = result.scalar()

        if sequence_number is None:
            # If no existing sequence, insert a new one
            new_record = FinalSupplyEquipmentRegNumber(
                organization_code=organization_code,
                postal_code=postal_code,
                current_sequence_number=1,
            )
            self.db.add(new_record)
            await self.db.flush()
            sequence_number = 1

        return sequence_number

    @repo_handler
    async def reset_seq_by_org(self, organization_code: str):
        """
        Resets the sequence number for a given organization code.
        """
        await self.db.execute(
            update(FinalSupplyEquipmentRegNumber)
            .where(
                and_(
                    FinalSupplyEquipmentRegNumber.organization_code
                    == organization_code,
                )
            )
            .values(current_sequence_number=1)
        )

    @repo_handler
    async def check_uniques_of_fse_row(
        self, row: FinalSupplyEquipmentCreateSchema
    ) -> bool:
        """
        Check if a duplicate final supply equipment row exists in the database based on the provided data.
        Returns True if a duplicate is found, False otherwise.
        Only checks within the current compliance report to avoid false duplicates across versions.
        """
        conditions = [
            FinalSupplyEquipment.compliance_report_id == row.compliance_report_id,
            FinalSupplyEquipment.supply_from_date == row.supply_from_date,
            FinalSupplyEquipment.supply_to_date == row.supply_to_date,
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
            FinalSupplyEquipment.postal_code == row.postal_code,
            FinalSupplyEquipment.latitude == row.latitude,
            FinalSupplyEquipment.longitude == row.longitude,
        ]

        if row.final_supply_equipment_id is not None:
            conditions.append(
                FinalSupplyEquipment.final_supply_equipment_id
                != row.final_supply_equipment_id
            )

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)
        found_duplicate = result.scalar()

        return found_duplicate

    @repo_handler
    async def check_overlap_of_fse_row(
        self, row: FinalSupplyEquipmentCreateSchema
    ) -> bool:
        """
        Check if there's an overlapping final supply equipment row in the database based on the provided data.
        Returns True if an overlap is found, False otherwise.
        Only checks within the current compliance report to avoid false overlaps across versions.
        """
        conditions = [
            FinalSupplyEquipment.compliance_report_id == row.compliance_report_id,
            and_(
                FinalSupplyEquipment.supply_from_date <= row.supply_to_date,
                FinalSupplyEquipment.supply_to_date >= row.supply_from_date,
            ),
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
            FinalSupplyEquipment.postal_code == row.postal_code,
            FinalSupplyEquipment.latitude == row.latitude,
            FinalSupplyEquipment.longitude == row.longitude,
        ]

        if row.final_supply_equipment_id is not None:
            conditions.append(
                FinalSupplyEquipment.final_supply_equipment_id
                != row.final_supply_equipment_id
            )

        query = select(exists().where(*conditions))
        result = await self.db.execute(query)

        return result.scalar()

    @repo_handler
    async def search_manufacturers(self, query: str) -> Sequence[str]:
        """
        Search for manufacturers based on the provided query.
        """
        result = await self.db.execute(
            select(distinct(ChargingEquipment.manufacturer))
            .where(ChargingEquipment.manufacturer.ilike(f"%{query}%"))
            .limit(10)
        )
        return result.scalars().all()

    @repo_handler
    async def delete_all(self, compliance_report_id):
        """
        Deletes all FinalSupplyEquipment records corresponding to a specific
        compliance_report_id.

        :param compliance_report_id: The target compliance report ID.
        :return: The number of deleted records.
        """
        result = await self.db.execute(
            delete(FinalSupplyEquipment).where(
                FinalSupplyEquipment.compliance_report_id == compliance_report_id
            )
        )

        return result.rowcount

    def _build_base_select(
        self,
        source_priority: int,
        organization_id: int,
        filter_conditions: list[Any] = [],
    ):
        source_site = aliased(ChargingSite, name="source_charging_site")
        latest_sites = latest_charging_site_version_subquery()
        latest_equipment_versions = self._latest_equipment_versions_subquery(
            organization_id
        )

        # Subquery for intended_uses (from charging equipment)
        intended_uses_subquery = (
            select(func.array_agg(EndUseType.type).label("intended_uses"))
            .select_from(charging_equipment_intended_use_association)
            .join(
                EndUseType,
                charging_equipment_intended_use_association.c.end_use_type_id
                == EndUseType.end_use_type_id,
            )
            .where(
                charging_equipment_intended_use_association.c.charging_equipment_id
                == ChargingEquipment.charging_equipment_id
            )
            .correlate(ChargingEquipment)
            .scalar_subquery()
        )

        # Subquery for intended_users (from charging equipment)
        intended_users_subquery = (
            select(func.array_agg(EndUserType.type_name).label("intended_users"))
            .select_from(charging_equipment_intended_user_association)
            .join(
                EndUserType,
                charging_equipment_intended_user_association.c.end_user_type_id
                == EndUserType.end_user_type_id,
            )
            .where(
                charging_equipment_intended_user_association.c.charging_equipment_id
                == ChargingEquipment.charging_equipment_id
            )
            .correlate(ChargingEquipment)
            .scalar_subquery()
        )

        common_conditions = [
            ChargingSite.organization_id == organization_id,
            ChargingEquipmentStatus.status != "Decommissioned",
        ]

        stmt = (
            select(
                ChargingEquipment.charging_equipment_id,
                ChargingEquipment.serial_number,
                ChargingEquipment.manufacturer,
                ChargingEquipment.model,
                (
                    ChargingSite.site_code + "-" + ChargingEquipment.equipment_number
                ).label("registration_number"),
                ChargingSite.site_name,
                ChargingSite.charging_site_id,
                ChargingEquipment.notes.label("equipment_notes"),
                ComplianceReportChargingEquipment.supply_from_date,
                ComplianceReportChargingEquipment.supply_to_date,
                ComplianceReportChargingEquipment.kwh_usage,
                ComplianceReportChargingEquipment.compliance_notes,
                ComplianceReportChargingEquipment.charging_equipment_compliance_id,
                ComplianceReportChargingEquipment.compliance_report_id,
                ComplianceReportChargingEquipment.compliance_report_group_uuid,
                ComplianceReportChargingEquipment.is_active,
                func.coalesce(
                    ComplianceReportChargingEquipment.charging_equipment_version,
                    ChargingEquipment.version,
                ).label("charging_equipment_version"),
                ChargingSite.street_address,
                ChargingSite.city,
                ChargingSite.postal_code,
                ChargingSite.latitude,
                ChargingSite.longitude,
                LevelOfEquipment.name.label("level_of_equipment"),
                ChargingEquipment.level_of_equipment_id,
                ChargingEquipment.ports,
                ChargingSite.allocating_organization_name,
                intended_uses_subquery.label("intended_uses"),
                intended_users_subquery.label("intended_users"),
                ChargingEquipmentStatus.status.label("status"),
                literal(source_priority).label("source_priority"),
            )
            .select_from(ChargingEquipment)
            .join(
                latest_equipment_versions,
                and_(
                    ChargingEquipment.charging_equipment_id
                    == latest_equipment_versions.c.charging_equipment_id,
                    latest_equipment_versions.c.row_number == 1,
                ),
            )
            .join(
                source_site,
                ChargingEquipment.charging_site_id == source_site.charging_site_id,
            )
            .join(
                latest_sites,
                source_site.group_uuid == latest_sites.c.group_uuid,
            )
            .join(
                ChargingSite,
                and_(
                    ChargingSite.group_uuid == latest_sites.c.group_uuid,
                    ChargingSite.version == latest_sites.c.latest_version,
                ),
            )
            .join(
                LevelOfEquipment,
                ChargingEquipment.level_of_equipment_id
                == LevelOfEquipment.level_of_equipment_id,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .outerjoin(
                ComplianceReportChargingEquipment,
                and_(
                    ChargingEquipment.charging_equipment_id
                    == ComplianceReportChargingEquipment.charging_equipment_id,
                    ChargingEquipment.version
                    == ComplianceReportChargingEquipment.charging_equipment_version,
                ),
            )
            .where(*common_conditions, *filter_conditions)
        )
        return stmt

    def _apply_filters(self, filter_conditions, filters):
        for f in filters:
            if f.field in [
                "site_name",
                "registration_number",
                "street_address",
                "charging_site_id",
            ]:
                if f.field == "registration_number":
                    f.field = "site_code"
                field = get_field_for_filter(ChargingSite, f.field)
            elif f.field in [
                "serial_number",
                "manufacturer",
                "model",
                "equipment_notes",
            ]:
                if f.field == "equipment_notes":
                    f.field = "notes"
                field = get_field_for_filter(ChargingEquipment, f.field)
            elif f.field in [
                "supply_from_date",
                "supply_to_date",
                "kwh_usage",
                "compliance_report_id",
                "compliance_notes",
            ]:
                field = get_field_for_filter(ComplianceReportChargingEquipment, f.field)
            else:
                continue

            if field is not None:
                condition = apply_filter_conditions(
                    field, f.filter, f.type, f.filter_type
                )
                if condition is not None:
                    filter_conditions.append(condition)

    @repo_handler
    async def get_latest_active_equipments(self, organization_id: int) -> list:
        """
        Get the latest non-decommissioned version for each charging equipment
        belonging to the given organization.
        """
        stmt = (
            select(
                ChargingEquipment.charging_equipment_id,
                func.max(ChargingEquipment.version).label("charging_equipment_version"),
            )
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .where(
                ChargingSite.organization_id == organization_id,
                ChargingEquipmentStatus.status != "Decommissioned",
            )
            .group_by(ChargingEquipment.charging_equipment_id)
        )
        stmt = self._apply_latest_site_filter(stmt)
        result = await self.db.execute(stmt)
        return result.all()

    @repo_handler
    async def get_reporting_equipment_versions_for_group(
        self, compliance_report_group_uuid: str
    ) -> set[tuple[int, int]]:
        """
        Return the set of charging equipment/version pairs already recorded
        for the given compliance report group.
        """
        stmt = select(
            ComplianceReportChargingEquipment.charging_equipment_id,
            ComplianceReportChargingEquipment.charging_equipment_version,
        ).where(
            ComplianceReportChargingEquipment.compliance_report_group_uuid
            == compliance_report_group_uuid
        )
        result = await self.db.execute(stmt)
        return {
            (row.charging_equipment_id, row.charging_equipment_version)
            for row in result.all()
        }

    @repo_handler
    async def has_charging_equipment_for_organization(
        self, organization_id: int
    ) -> bool:
        """
        Check if an organization has any charging equipment (excluding decommissioned).
        """
        query = (
            select(func.count())
            .select_from(ChargingEquipment)
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .where(
                and_(
                    ChargingSite.organization_id == organization_id,
                    ChargingEquipmentStatus.status != "Decommissioned",
                )
            )
        )
        query = self._apply_latest_site_filter(query)
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return count > 0

    @repo_handler
    async def get_total_kwh_usage_for_report_group(
        self, compliance_report_group_uuid: str, only_active: bool = True
    ) -> float:
        """
        Return total kWh usage for effective FSE records in a report group.

        Effective records are derived by keeping the latest record per
        equipment group_uuid (which spans all versions of the same equipment).
        """
        conditions = [
            ComplianceReportChargingEquipment.compliance_report_group_uuid
            == compliance_report_group_uuid
        ]
        if only_active:
            conditions.append(ComplianceReportChargingEquipment.is_active.is_(True))

        dedup_subquery = (
            select(
                ChargingEquipment.group_uuid.label("equipment_group_uuid"),
                ComplianceReportChargingEquipment.kwh_usage.label("kwh_usage"),
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.group_uuid,
                    order_by=(
                        desc(ComplianceReportChargingEquipment.charging_equipment_version),
                        desc(
                            ComplianceReportChargingEquipment.charging_equipment_compliance_id
                        ),
                    ),
                )
                .label("row_number"),
            )
            .join(
                ChargingEquipment,
                ChargingEquipment.charging_equipment_id
                == ComplianceReportChargingEquipment.charging_equipment_id,
            )
            .where(and_(*conditions))
            .subquery()
        )

        total_query = (
            select(func.coalesce(func.sum(dedup_subquery.c.kwh_usage), 0))
            .select_from(dedup_subquery)
            .where(dedup_subquery.c.row_number == 1)
        )
        return float(await self.db.scalar(total_query) or 0)

    @repo_handler
    async def get_fse_reporting_list_paginated(
        self,
        organization_id: int,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
        mode: str = "all",
    ) -> tuple[list[dict], int]:
        """
        Get paginated charging equipment reporting rows from reporting views.
        """
        view_model = (
            FSEReportingBasePrefView if mode == "all" else FSEReportingBaseView
        )
        vt = view_model.__table__

        stmt = select(
            vt.c.charging_equipment_compliance_id,
            vt.c.charging_equipment_id,
            vt.c.charging_equipment_version,
            vt.c.charging_site_id,
            vt.c.serial_number,
            vt.c.manufacturer,
            vt.c.model,
            vt.c.site_name,
            vt.c.street_address,
            vt.c.city,
            vt.c.postal_code,
            vt.c.latitude,
            vt.c.longitude,
            vt.c.level_of_equipment,
            vt.c.level_of_equipment_id,
            vt.c.ports,
            vt.c.allocating_organization_name,
            vt.c.supply_from_date,
            vt.c.supply_to_date,
            vt.c.kwh_usage,
            vt.c.compliance_notes,
            vt.c.equipment_notes,
            vt.c.compliance_report_id,
            vt.c.compliance_report_group_uuid,
            vt.c.organization_id,
            vt.c.registration_number,
            vt.c.intended_uses,
            vt.c.intended_users,
            vt.c.power_output,
            vt.c.capacity_utilization_percent,
            vt.c.charging_equipment_status.label("status"),
            vt.c.is_active,
        ).select_from(vt)

        conditions = [
            vt.c.organization_id == organization_id,
            vt.c.compliance_report_id == compliance_report_id,
        ]
        if mode == "summary":
            conditions.append(vt.c.is_active.is_(True))

        filter_field_map = {
            "site_name": vt.c.site_name,
            "registration_number": vt.c.registration_number,
            "street_address": vt.c.street_address,
            "charging_site_id": vt.c.charging_site_id,
            "serial_number": vt.c.serial_number,
            "manufacturer": vt.c.manufacturer,
            "model": vt.c.model,
            "equipment_notes": vt.c.equipment_notes,
            "supply_from_date": vt.c.supply_from_date,
            "supply_to_date": vt.c.supply_to_date,
            "kwh_usage": vt.c.kwh_usage,
            "compliance_report_id": vt.c.compliance_report_id,
            "compliance_notes": vt.c.compliance_notes,
            "level_of_equipment": vt.c.level_of_equipment,
            "ports": vt.c.ports,
            "status": vt.c.charging_equipment_status,
            "is_active": vt.c.is_active,
            "power_output": vt.c.power_output,
            "capacity_utilization_percent": vt.c.capacity_utilization_percent,
        }
        if pagination.filters:
            for f in pagination.filters:
                field = filter_field_map.get(f.field)
                if field is None:
                    continue
                condition = apply_filter_conditions(
                    field, f.filter, f.type, f.filter_type
                )
                if condition is not None:
                    conditions.append(condition)

        final_query = stmt.where(*conditions)
        # Apply sorting
        sort_field_map = {
            "site_name": vt.c.site_name,
            "serial_number": vt.c.serial_number,
            "manufacturer": vt.c.manufacturer,
            "model": vt.c.model,
            "supply_from_date": vt.c.supply_from_date,
            "supply_to_date": vt.c.supply_to_date,
            "kwh_usage": vt.c.kwh_usage,
            "compliance_report_id": vt.c.compliance_report_id,
            "registration_number": vt.c.registration_number,
            "level_of_equipment": vt.c.level_of_equipment,
            "power_output": vt.c.power_output,
            "capacity_utilization_percent": vt.c.capacity_utilization_percent,
            "status": vt.c.charging_equipment_status,
            "is_active": vt.c.is_active,
        }
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                field = sort_field_map.get(sort_order.field)
                if field is None:
                    continue

                if sort_order.direction.lower() == "desc":
                    final_query = final_query.order_by(desc(field))
                else:
                    final_query = final_query.order_by(asc(field))
        else:
            final_query = final_query.order_by(
                vt.c.charging_equipment_id,
                vt.c.charging_equipment_version,
            )

        # Count total
        count_query = select(func.count()).select_from(vt).where(*conditions)
        total = await self.db.scalar(count_query)

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        paginated_query = final_query.offset(offset).limit(pagination.size)

        result = await self.db.execute(paginated_query)
        data = result.fetchall()

        return data, total or 0

    @repo_handler
    async def get_charging_power_output(
        self,
        level_of_equipment_id: int | None,
        intended_use_names: list[str] | None,
        intended_user_names: list[str] | None,
    ) -> float | None:
        """
        Retrieve the prioritized charging power output for the supplied identifiers.
        """
        if (
            not level_of_equipment_id
            or not intended_user_names
            or len(intended_user_names) == 0
        ):
            return None

        stmt = (
            select(ChargingPowerOutput.charger_power_output)
            .join(
                EndUserType,
                ChargingPowerOutput.end_user_type_id == EndUserType.end_user_type_id,
            )
            .outerjoin(
                EndUseType,
                and_(
                    ChargingPowerOutput.end_use_type_id == EndUseType.end_use_type_id,
                    EndUseType.type.in_(intended_use_names or []),
                ),
            )
            .where(
                and_(
                    ChargingPowerOutput.level_of_equipment_id == level_of_equipment_id,
                    EndUserType.type_name.in_(intended_user_names or []),
                )
            )
            .order_by(asc(EndUseType.end_use_type_id))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() or 0

    @repo_handler
    async def create_fse_reporting_batch(self, data) -> dict:
        """
        Create FSE compliance reporting data
        """

        records = [ComplianceReportChargingEquipment(**item) for item in data]
        self.db.add_all(records)
        await self.db.flush()
        return {"message": "FSE compliance reporting data created successfully"}

    @repo_handler
    async def bulk_update_reporting_dates(self, data: FSEReportingDefaultDates) -> int:
        stmt = (
            update(ComplianceReportChargingEquipment)
            .where(
                and_(
                    ComplianceReportChargingEquipment.charging_equipment_id.in_(
                        data.equipment_ids
                    ),
                    ComplianceReportChargingEquipment.compliance_report_id
                    == data.compliance_report_id,
                    ComplianceReportChargingEquipment.organization_id
                    == data.organization_id,
                    ComplianceReportChargingEquipment.is_active.is_(True),
                )
            )
            .values(
                supply_from_date=data.supply_from_date,
                supply_to_date=data.supply_to_date,
            )
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount or 0

    @repo_handler
    async def update_fse_reporting(
        self, charging_equipment_compliance_id: int, data
    ) -> dict:
        """
        Update FSE compliance reporting data
        """
        stmt = (
            update(ComplianceReportChargingEquipment)
            .where(
                ComplianceReportChargingEquipment.charging_equipment_compliance_id
                == charging_equipment_compliance_id
            )
            .values(**data)
        )
        await self.db.execute(stmt)
        await self.db.flush()
        return {"id": charging_equipment_compliance_id, **data}

    @repo_handler
    async def update_reporting_active_status(
        self, reporting_ids: List[int], is_active: bool
    ) -> int:
        stmt = (
            update(ComplianceReportChargingEquipment)
            .where(
                ComplianceReportChargingEquipment.charging_equipment_compliance_id.in_(
                    reporting_ids
                )
            )
            .values(is_active=is_active)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount or 0

    @repo_handler
    async def delete_fse_reporting(self, charging_equipment_compliance_id: int) -> None:
        """
        Delete FSE compliance reporting data
        """
        stmt = delete(ComplianceReportChargingEquipment).where(
            ComplianceReportChargingEquipment.charging_equipment_compliance_id
            == charging_equipment_compliance_id
        )
        await self.db.execute(stmt)
        await self.db.flush()

    @repo_handler
    async def delete_fse_reporting_batch(self, reporting_ids: List[int]) -> int:
        """
        Delete multiple FSE compliance reporting records
        """
        stmt = delete(ComplianceReportChargingEquipment).where(
            ComplianceReportChargingEquipment.charging_equipment_compliance_id.in_(
                reporting_ids
            )
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    @repo_handler
    async def get_fse_for_bulk_update_template(
        self,
        organization_id: int,
        compliance_report_group_uuid: str | None = None,
    ) -> list:
        latest_sites_main = latest_charging_site_version_subquery()
        latest_sites_rank = latest_charging_site_version_subquery()

        source_site_rank = aliased(ChargingSite, name="source_site_rank")
        source_site_main = aliased(ChargingSite, name="source_site_main")

        # Deduplicate to latest version per ChargingEquipment group_uuid
        ce_latest_subquery = (
            select(
                ChargingEquipment.charging_equipment_id.label("ce_id"),
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.group_uuid,
                    order_by=ChargingEquipment.version.desc(),
                )
                .label("rn"),
            )
            .join(
                source_site_rank,
                ChargingEquipment.charging_site_id
                == source_site_rank.charging_site_id,
            )
            .join(
                latest_sites_rank,
                source_site_rank.group_uuid == latest_sites_rank.c.group_uuid,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .where(
                and_(
                    source_site_rank.organization_id == organization_id,
                    ChargingEquipmentStatus.status != "Decommissioned",
                )
            )
            .subquery()
        )

        # Mirror the UI "all" mode: outer join all CRCE for the org, then dedup
        # using row_number prioritising current compliance report group first.
        dedup_priority = case(
            (
                ComplianceReportChargingEquipment.compliance_report_group_uuid
                == compliance_report_group_uuid,
                0,
            ),
            else_=1,
        )

        all_rows_subquery = (
            select(
                ChargingEquipment.charging_equipment_id,
                ChargingEquipment.version.label("charging_equipment_version"),
                (
                    ChargingSite.site_code + "-" + ChargingEquipment.equipment_number
                ).label("registration_number"),
                ChargingSite.site_name.label("site_name"),
                ChargingEquipment.serial_number.label("serial_number"),
                ComplianceReportChargingEquipment.charging_equipment_compliance_id,
                ComplianceReportChargingEquipment.supply_from_date,
                ComplianceReportChargingEquipment.supply_to_date,
                ComplianceReportChargingEquipment.kwh_usage,
                ComplianceReportChargingEquipment.compliance_notes,
                ComplianceReportChargingEquipment.organization_id,
                ComplianceReportChargingEquipment.is_active,
                ComplianceReportChargingEquipment.compliance_report_group_uuid,
                func.row_number()
                .over(
                    partition_by=(
                        ChargingEquipment.charging_equipment_id,
                        ChargingEquipment.version,
                    ),
                    order_by=[
                        dedup_priority,
                        desc(
                            ComplianceReportChargingEquipment.charging_equipment_compliance_id
                        ).nullslast(),
                    ],
                )
                .label("row_num"),
            )
            .select_from(ChargingEquipment)
            .join(
                ce_latest_subquery,
                and_(
                    ChargingEquipment.charging_equipment_id
                    == ce_latest_subquery.c.ce_id,
                    ce_latest_subquery.c.rn == 1,
                ),
            )
            .join(
                source_site_main,
                ChargingEquipment.charging_site_id
                == source_site_main.charging_site_id,
            )
            .join(
                latest_sites_main,
                source_site_main.group_uuid == latest_sites_main.c.group_uuid,
            )
            .join(
                ChargingSite,
                and_(
                    ChargingSite.group_uuid == latest_sites_main.c.group_uuid,
                    ChargingSite.version == latest_sites_main.c.latest_version,
                ),
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .outerjoin(
                ComplianceReportChargingEquipment,
                and_(
                    ChargingEquipment.charging_equipment_id
                    == ComplianceReportChargingEquipment.charging_equipment_id,
                    ChargingEquipment.version
                    == ComplianceReportChargingEquipment.charging_equipment_version,
                ),
            )
            .where(
                and_(
                    source_site_main.organization_id == organization_id,
                    ChargingEquipmentStatus.status != "Decommissioned",
                )
            )
            .subquery()
        )

        stmt = (
            select(
                all_rows_subquery.c.charging_equipment_id,
                all_rows_subquery.c.charging_equipment_version,
                all_rows_subquery.c.registration_number,
                all_rows_subquery.c.site_name,
                all_rows_subquery.c.serial_number,
                all_rows_subquery.c.charging_equipment_compliance_id,
                all_rows_subquery.c.supply_from_date,
                all_rows_subquery.c.supply_to_date,
                all_rows_subquery.c.kwh_usage,
                all_rows_subquery.c.compliance_notes,
                all_rows_subquery.c.organization_id,
                all_rows_subquery.c.is_active,
                all_rows_subquery.c.compliance_report_group_uuid,
            )
            .where(all_rows_subquery.c.row_num == 1)
            .order_by(
                asc(all_rows_subquery.c.site_name),
                asc(all_rows_subquery.c.registration_number),
            )
        )

        result = await self.db.execute(stmt)
        return result.fetchall()

    @repo_handler
    async def get_charging_equipment_by_registration_number(
        self,
        registration_number: str,
        organization_id: int,
    ) -> Any | None:
        """
        Find the latest-version ChargingEquipment whose composite registration number
        ({site_code}-{equipment_number}) matches the provided value.
        """
        latest_sites = latest_charging_site_version_subquery()

        source_site = aliased(ChargingSite, name="source_site_lookup")
        latest_site = aliased(ChargingSite, name="latest_site_lookup")

        ranked_subquery = (
            select(
                ChargingEquipment.charging_equipment_id.label("ce_id"),
                ChargingEquipment.version.label("ce_version"),
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.group_uuid,
                    order_by=ChargingEquipment.version.desc(),
                )
                .label("rn"),
            )
            .join(
                source_site,
                ChargingEquipment.charging_site_id == source_site.charging_site_id,
            )
            .join(
                latest_sites,
                source_site.group_uuid == latest_sites.c.group_uuid,
            )
            .join(
                latest_site,
                and_(
                    latest_site.group_uuid == latest_sites.c.group_uuid,
                    latest_site.version == latest_sites.c.latest_version,
                ),
            )
            .where(
                and_(
                    source_site.organization_id == organization_id,
                    (
                        latest_site.site_code + "-" + ChargingEquipment.equipment_number
                    )
                    == registration_number,
                )
            )
            .subquery()
        )

        stmt = (
            select(
                ChargingEquipment.charging_equipment_id,
                ChargingEquipment.version.label("charging_equipment_version"),
            )
            .join(
                ranked_subquery,
                and_(
                    ChargingEquipment.charging_equipment_id == ranked_subquery.c.ce_id,
                    ChargingEquipment.version == ranked_subquery.c.ce_version,
                    ranked_subquery.c.rn == 1,
                ),
            )
        )

        result = await self.db.execute(stmt)
        return result.fetchone()

    @repo_handler
    async def get_fse_reporting_record_for_group(
        self,
        charging_equipment_id: int,
        charging_equipment_version: int,
        compliance_report_group_uuid: str,
    ) -> Any | None:
        """
        Retrieve the ComplianceReportChargingEquipment record for the given
        equipment + version + compliance report group, if it exists.
        """
        # Match on id + group_uuid only (version-agnostic) so that equipment
        # stored against an older version is still found; take the highest version.
        stmt = (
            select(ComplianceReportChargingEquipment)
            .where(
                and_(
                    ComplianceReportChargingEquipment.charging_equipment_id
                    == charging_equipment_id,
                    ComplianceReportChargingEquipment.compliance_report_group_uuid
                    == compliance_report_group_uuid,
                )
            )
            .order_by(
                ComplianceReportChargingEquipment.charging_equipment_version.desc()
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    @repo_handler
    async def bulk_update_fse_reporting_record(
        self,
        charging_equipment_compliance_id: int,
        supply_from_date,
        supply_to_date,
        kwh_usage,
        compliance_notes: str | None,
        activate: bool = False,
        deactivate: bool = False,
    ) -> None:
        """
        Update supply dates, kWh usage, and compliance notes for a single
        ComplianceReportChargingEquipment record.
        Only fields that are not None are updated; blank values are skipped.
        When activate=True the record's is_active flag is set to True.
        When deactivate=True all editable fields are cleared and is_active set to False.
        """
        values: dict = {}
        if deactivate:
            # supply_from_date and supply_to_date are NOT NULL — cannot be cleared.
            # Only clear optional fields and mark the row inactive.
            values["is_active"] = False
            values["kwh_usage"] = None
            values["compliance_notes"] = None
        else:
            if supply_from_date is not None:
                values["supply_from_date"] = supply_from_date
            if supply_to_date is not None:
                values["supply_to_date"] = supply_to_date
            if kwh_usage is not None:
                values["kwh_usage"] = kwh_usage
            if compliance_notes is not None:
                values["compliance_notes"] = compliance_notes
            if activate:
                values["is_active"] = True

        if not values:
            return

        stmt = (
            update(ComplianceReportChargingEquipment)
            .where(
                ComplianceReportChargingEquipment.charging_equipment_compliance_id
                == charging_equipment_compliance_id
            )
            .values(**values)
        )
        await self.db.execute(stmt)
        await self.db.flush()
