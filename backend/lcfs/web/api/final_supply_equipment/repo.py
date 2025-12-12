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
    union_all,
)
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import Organization
from lcfs.db.models.compliance import (
    AllocationAgreement,
    ComplianceReport,
    EndUserType,
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
from lcfs.db.models.compliance.ChargingSite import ChargingSite
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
        """
        conditions = [
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

        return result.scalar()

    @repo_handler
    async def check_overlap_of_fse_row(
        self, row: FinalSupplyEquipmentCreateSchema
    ) -> bool:
        """
        Check if there's an overlapping final supply equipment row in the database based on the provided data.
        Returns True if an overlap is found, False otherwise.
        """
        conditions = [
            and_(
                FinalSupplyEquipment.supply_from_date <= row.supply_to_date,
                FinalSupplyEquipment.supply_to_date >= row.supply_from_date,
            ),
            FinalSupplyEquipment.serial_nbr == row.serial_nbr,
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
            select(distinct(ChargingEquipment.manufacturer)).where(
                ChargingEquipment.manufacturer.ilike(f"%{query}%")
            ).limit(10)
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

        return (
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
                intended_uses_subquery.label("intended_uses"),
                intended_users_subquery.label("intended_users"),
                literal(source_priority).label("source_priority"),
            )
            .select_from(ChargingEquipment)
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
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
                if f.field == "compliance_notes":
                    f.field = "notes"
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
    async def get_fse_reporting_list_paginated(
        self,
        organization_id: int,
        pagination: PaginationRequestSchema,
        compliance_report_group_uuid: str | None = None,
        mode: str = "all",
    ) -> tuple[list[dict], int]:
        """
        Get paginated charging equipment with related charging site and FSE compliance reporting data
        """

        filter_conditions: list[Any] = []
        # Apply filters
        if pagination.filters:
            self._apply_filters(filter_conditions, pagination.filters)
        union_queries: list[Any] = []

        if compliance_report_group_uuid is not None and mode != "all":
            union_queries.append(
                self._build_base_select(0, organization_id, filter_conditions).where(
                    ComplianceReportChargingEquipment.compliance_report_group_uuid
                    == compliance_report_group_uuid
                )
            )
        else:
            union_queries.append(
                self._build_base_select(1, organization_id, filter_conditions)
            )

        if len(union_queries) == 1:
            combined_query = union_queries[0]
        else:
            combined_query = union_all(*union_queries)

        combined_subquery = combined_query.subquery()

        row_number_column = (
            func.row_number()
            .over(
                partition_by=(
                    combined_subquery.c.charging_equipment_id,
                    combined_subquery.c.charging_equipment_version,
                ),
                order_by=[
                    combined_subquery.c.source_priority,
                    desc(
                        combined_subquery.c.charging_equipment_compliance_id
                    ).nullslast(),
                ],
            )
            .label("row_number")
        )

        dedup_subquery = select(*combined_subquery.c, row_number_column).subquery()

        selectable_columns = [
            column
            for column in dedup_subquery.c
            if column.key not in {"row_number", "source_priority"}
        ]

        final_query = (
            select(*selectable_columns)
            .select_from(dedup_subquery)
            .where(dedup_subquery.c.row_number == 1)
        )
        # Apply sorting
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                if sort_order.field == "site_name":
                    field = dedup_subquery.c.site_name
                elif sort_order.field in ["serial_number", "manufacturer", "model"]:
                    field = getattr(dedup_subquery.c, sort_order.field)
                elif sort_order.field in [
                    "supply_from_date",
                    "supply_to_date",
                    "kwh_usage",
                    "compliance_report_id",
                ]:
                    field = getattr(dedup_subquery.c, sort_order.field)
                else:
                    continue

                if sort_order.direction.lower() == "desc":
                    final_query = final_query.order_by(desc(field))
                else:
                    final_query = final_query.order_by(asc(field))
        else:
            final_query = final_query.order_by(
                dedup_subquery.c.charging_equipment_id,
                dedup_subquery.c.charging_equipment_version,
            )

        # Count total
        count_query = (
            select(func.count())
            .select_from(dedup_subquery)
            .where(dedup_subquery.c.row_number == 1)
        )
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
            .order_by(asc(ChargingPowerOutput.display_order))
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
