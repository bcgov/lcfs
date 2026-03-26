import structlog
from typing import List, Optional, Sequence
from fastapi import Depends
from sqlalchemy import asc, desc, func, select, update, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload, aliased


from lcfs.db.models.compliance import (
    EndUserType,
    ChargingEquipment,
    ChargingSiteStatus,
    ChargingEquipmentStatus,
    ComplianceReport,
    AllocationAgreement,
)
from lcfs.db.models.compliance.ChargingSite import (
    ChargingSite,
    latest_charging_site_version_subquery,
)
from lcfs.db.models.organization import Organization
from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
)


logger = structlog.get_logger(__name__)


def _organization_name_expression():
    """
    Build a correlated subquery that resolves the primary organization name for a charging site.
    """
    return (
        select(Organization.name)
        .where(Organization.organization_id == ChargingSite.organization_id)
        .correlate(ChargingSite)
        .scalar_subquery()
    )


def _allocating_organization_display_name_expression():
    """
    Build an expression that returns the allocating organization's display name.
    Prioritizes the related organization name, falling back to the free-text field.
    """
    allocating_org_name_subquery = (
        select(Organization.name)
        .where(Organization.organization_id == ChargingSite.allocating_organization_id)
        .correlate(ChargingSite)
        .scalar_subquery()
    )
    return func.coalesce(
        allocating_org_name_subquery, ChargingSite.allocating_organization_name
    )


class ChargingSiteRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    def _site_version_subquery(self, government_visible: bool = False):
        if not government_visible:
            latest_versions = latest_charging_site_version_subquery()
            return (
                select(
                    latest_versions.c.group_uuid,
                    latest_versions.c.latest_version.label("selected_version"),
                )
                .subquery()
            )

        status_alias = aliased(ChargingSiteStatus)
        return (
            select(
                ChargingSite.group_uuid.label("group_uuid"),
                ChargingSite.version.label("selected_version"),
                func.row_number()
                .over(
                    partition_by=ChargingSite.group_uuid,
                    order_by=(
                        case(
                            (status_alias.status.in_(("Draft", "Updated")), 1),
                            else_=0,
                        ).asc(),
                        ChargingSite.version.desc(),
                    ),
                )
                .label("rn"),
            )
            .join(
                status_alias,
                ChargingSite.status_id == status_alias.charging_site_status_id,
            )
            .subquery()
        )

    def _apply_latest_version_filter(self, stmt, government_visible: bool = False):
        """
        Ensure the provided statement only returns the appropriate visible
        version of each charging site.
        """
        latest_versions = self._site_version_subquery(government_visible)
        join_conditions = [
            ChargingSite.group_uuid == latest_versions.c.group_uuid,
            ChargingSite.version == latest_versions.c.selected_version,
        ]
        if government_visible and "rn" in latest_versions.c:
            join_conditions.append(latest_versions.c.rn == 1)
        return stmt.join(
            latest_versions,
            and_(*join_conditions),
        )

    async def _get_group_uuid_by_site_id(self, charging_site_id: int) -> Optional[str]:
        """
        Resolve a charging site's group UUID from any version row ID.
        """
        result = await self.db.execute(
            select(ChargingSite.group_uuid)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .order_by(ChargingSite.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve all end user types that are marked as intended use
        """
        return (
            (await self.db.execute(select(EndUserType).where(EndUserType.intended_use)))
            .scalars()
            .all()
        )

    @repo_handler
    async def get_allocation_agreement_organizations(
        self, organization_id: int
    ) -> Sequence[Organization]:
        """
        Retrieve organizations that have allocation agreements with the specified organization.
        Returns organizations from allocation agreements (all statuses, historical included).
        """
        # Get all distinct transaction partners from allocation agreements
        query = (
            select(Organization)
            .join(
                AllocationAgreement,
                AllocationAgreement.transaction_partner == Organization.name,
            )
            .join(
                ComplianceReport,
                AllocationAgreement.compliance_report_id
                == ComplianceReport.compliance_report_id,
            )
            .where(ComplianceReport.organization_id == organization_id)
            .distinct()
            .order_by(Organization.name)
        )

        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_charging_equipment_statuses(
        self,
    ) -> Sequence[ChargingEquipmentStatus]:
        """
        Retrieve a list of charging equipment statuses from the database
        """
        return (await self.db.execute(select(ChargingEquipmentStatus))).scalars().all()

    @repo_handler
    async def get_charging_site_statuses(self) -> Sequence[ChargingSiteStatus]:
        """
        Retrieve a list of charging site statuses from the database
        """
        return (await self.db.execute(select(ChargingSiteStatus))).scalars().all()

    @repo_handler
    async def get_charging_site_by_id(
        self, charging_site_id: int, government_visible: bool = False
    ) -> Optional[ChargingSite]:
        """
        Retrieve the latest charging site record for the group identified by the provided site ID.
        The input ID may point to an older version row; this method always returns the latest version.
        """
        group_uuid_subquery = (
            select(ChargingSite.group_uuid)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .limit(1)
            .scalar_subquery()
        )

        stmt = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.allocating_organization),
                selectinload(ChargingSite.documents),
            )
            .where(ChargingSite.group_uuid == group_uuid_subquery)
        )
        stmt = self._apply_latest_version_filter(
            stmt, government_visible=government_visible
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    @repo_handler
    async def get_equipment_for_charging_site_paginated(
        self,
        site_id: int,
        pagination: PaginationRequestSchema,
        is_government_user: bool = False,
    ):
        """
        Get charging equipment for a specific site with pagination, filtering, and sorting
        """
        site_group_uuid = await self._get_group_uuid_by_site_id(site_id)
        if not site_group_uuid:
            return [], 0

        site_ids_result = await self.db.execute(
            select(ChargingSite.charging_site_id)
            .where(ChargingSite.group_uuid == site_group_uuid)
            .distinct()
        )
        site_rows = site_ids_result.fetchall()
        related_site_ids = (
            [row[0] for row in site_rows]
            if isinstance(site_rows, list) and site_rows
            else [site_id]
        )
        if not related_site_ids:
            return [], 0

        # Conditions for the base subquery (before ranking)
        base_conditions = [ChargingEquipment.charging_site_id.in_(related_site_ids)]

        # Exclude Decommissioned FSE's in the base query for gov users
        if is_government_user:
            base_conditions.append(
                ~ChargingEquipment.status.has(
                    ChargingEquipmentStatus.status == "Decommissioned"
                )
            )

        # Apply status filters to base conditions (before ranking)
        status_conditions = []
        non_status_conditions = []

        if pagination.filters:
            STATUS_FILTER_MAP = {
                "equals": lambda status_value: ChargingEquipment.status.has(
                    ChargingEquipmentStatus.status == status_value
                ),
                "not_equals": lambda status_value: ~ChargingEquipment.status.has(
                    ChargingEquipmentStatus.status == status_value
                ),
            }

            for filter_condition in pagination.filters:
                if filter_condition.field == "status":
                    filter_func = STATUS_FILTER_MAP.get(filter_condition.type)
                    if filter_func:
                        status_conditions.append(filter_func(filter_condition.filter))
                else:
                    non_status_conditions.append(filter_condition)

        # Add status conditions to base conditions
        base_conditions.extend(status_conditions)

        # Prefer validated/submitted equipment versions for government users
        status_alias = aliased(ChargingEquipmentStatus)
        order_by_expressions = [ChargingEquipment.version.desc()]
        if is_government_user:
            status_priority = case(
                (status_alias.status.in_(("Draft", "Updated")), 1),
                else_=0,
            )
            order_by_expressions = [
                status_priority.asc(),
                ChargingEquipment.version.desc(),
            ]

        # Base query for equipment with all base conditions
        ranked_subquery = (
            select(
                ChargingEquipment,
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.group_uuid,
                    order_by=order_by_expressions,
                )
                .label("rn"),
            )
            .join(
                status_alias,
                ChargingEquipment.status_id
                == status_alias.charging_equipment_status_id,
            )
            .where(*base_conditions)  # Apply base conditions here
            .subquery()
        )

        # Create an alias for the subquery
        ranked_equipment = aliased(ChargingEquipment, ranked_subquery)
        source_site = aliased(ChargingSite, name="source_charging_site")
        latest_sites = self._site_version_subquery(is_government_user)
        latest_site_alias = aliased(ChargingSite, name="latest_charging_site")

        latest_site_join_conditions = [source_site.group_uuid == latest_sites.c.group_uuid]
        if "rn" in latest_sites.c:
            latest_site_join_conditions.append(latest_sites.c.rn == 1)

        query = (
            select(
                ranked_equipment,
                latest_site_alias,
                latest_site_alias.charging_site_id.label("latest_charging_site_id"),
            )
            .join(
                source_site,
                ranked_equipment.charging_site_id == source_site.charging_site_id,
            )
            .join(
                latest_sites,
                and_(*latest_site_join_conditions),
            )
            .join(
                latest_site_alias,
                and_(
                    latest_site_alias.group_uuid == latest_sites.c.group_uuid,
                    latest_site_alias.version == latest_sites.c.selected_version,
                ),
            )
            .options(
                joinedload(ranked_equipment.status),
                joinedload(ranked_equipment.level_of_equipment),
                selectinload(ranked_equipment.intended_uses),
                selectinload(ranked_equipment.intended_users),
            )
            .where(ranked_subquery.c.rn == 1)
        )

        # Field mapping for relationship fields to filterable database fields
        field_mappings = {
            "allocating_organization": "organization_name",
        }

        # Apply non-status filters to the main query
        if non_status_conditions:
            for filter_condition in non_status_conditions:
                # Map frontend field names to database field names
                actual_field = field_mappings.get(
                    filter_condition.field, filter_condition.field
                )

                # Use getattr on the aliased entity directly to preserve
                # the subquery alias in WHERE (get_field_for_filter
                # unwraps to the original table column which breaks here)
                field = getattr(ranked_equipment, actual_field, None)
                if field is not None:
                    condition = apply_filter_conditions(
                        field,
                        filter_condition.filter,
                        filter_condition.type,
                        filter_condition.filter_type,
                    )
                    if condition is not None:
                        query = query.where(condition)

        # Apply sorting
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                # Skip status sorting as it's a relationship field
                if sort_order.field == "status":
                    continue

                # Map frontend field names to database field names
                actual_field = field_mappings.get(sort_order.field, sort_order.field)

                # Use getattr on the aliased entity directly to preserve
                # the subquery alias in ORDER BY (get_field_for_filter
                # unwraps to the original table column which breaks here)
                field = getattr(ranked_equipment, actual_field, None)
                if field is not None:
                    if sort_order.direction.lower() == "desc":
                        query = query.order_by(field.desc())
                    else:
                        query = query.order_by(field.asc())
        else:
            # Default sort by update date descending
            query = query.order_by(ranked_equipment.update_date.desc())

        # Get total count using the same base conditions
        count_query = (
            select(func.count(func.distinct(ChargingEquipment.group_uuid)))
            .select_from(ChargingEquipment)
            .where(*base_conditions)
        )
        total_count = await self.db.scalar(count_query)

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        query = query.offset(offset).limit(pagination.size)

        # Execute query
        result = await self.db.execute(query)
        rows = result.unique().all()
        equipment = []
        for row in rows:
            ranked_eq = row[0]
            latest_site = row[1]
            latest_site_id = row[2]
            setattr(ranked_eq, "latest_charging_site", latest_site)
            setattr(ranked_eq, "latest_charging_site_id", latest_site_id)
            equipment.append(ranked_eq)

        return equipment, total_count

    @repo_handler
    async def bulk_update_equipment_status(
        self,
        equipment_ids: List[int],
        new_status_id: int,
        allowed_source_status_ids: List[int],
    ) -> List[int]:
        """
        Bulk update equipment status, only updating equipment that's in one of the allowed source statuses
        """
        # Update only equipment that's currently in one of the allowed source statuses
        stmt = (
            update(ChargingEquipment)
            .where(
                ChargingEquipment.charging_equipment_id.in_(equipment_ids),
                ChargingEquipment.status_id.in_(allowed_source_status_ids),
            )
            .values(status_id=new_status_id)
            .returning(ChargingEquipment.charging_equipment_id)
        )

        result = await self.db.execute(stmt)
        updated_ids = [row[0] for row in result.fetchall()]
        return updated_ids

    @repo_handler
    async def get_charging_sites(
        self, organization_id: Optional[int] = None
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites, optionally filtered by organization.
        Excludes deleted charging sites.
        """
        stmt = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.allocating_organization),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
            )
            .where(ChargingSite.action_type != ActionTypeEnum.DELETE)
        )

        if organization_id:
            stmt = stmt.where(ChargingSite.organization_id == organization_id)

        stmt = self._apply_latest_version_filter(stmt)
        result = await self.db.execute(stmt)
        return result.unique().scalars().all()

    @repo_handler
    async def get_all_charging_sites_by_organization_id(
        self, organization_id: int, government_visible: bool = False
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites for a specific organization, ordered by creation date.
        Excludes deleted charging sites.
        """
        stmt = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.allocating_organization),
                selectinload(ChargingSite.documents),
            )
            .where(
                ChargingSite.organization_id == organization_id,
                ChargingSite.action_type != ActionTypeEnum.DELETE,
            )
            .order_by(asc(ChargingSite.create_date))
        )
        stmt = self._apply_latest_version_filter(
            stmt, government_visible=government_visible
        )
        results = await self.db.execute(stmt)
        sites = results.unique().scalars().all()
        if not isinstance(sites, list):
            sites = results.scalars().all()
        return sites

    @repo_handler
    async def get_charging_sites_by_ids(
        self, charging_site_ids: List[int]
    ) -> Sequence[ChargingSite]:
        """
        Retrieve charging sites by their IDs, ordered by creation date
        """
        stmt = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.allocating_organization),
                selectinload(ChargingSite.documents),
            )
            .where(ChargingSite.charging_site_id.in_(charging_site_ids))
            .order_by(asc(ChargingSite.create_date))
        )
        stmt = self._apply_latest_version_filter(stmt)
        results = await self.db.execute(stmt)
        return results.unique().scalars().all()

    @repo_handler
    async def get_all_charging_sites_paginated(
        self,
        offset: int,
        limit: int,
        conditions: list,
        sort_orders: list,
        exclude_draft: bool = False,
        government_visible: bool = False,
    ) -> tuple[list[ChargingSite], int]:
        """
        Retrieve all charging sites with pagination, filtering, and sorting.
        If exclude_draft is True, excludes sites with DRAFT status.
        Excludes deleted charging sites.
        """
        stmt = (
            select(ChargingSite)
            .join(ChargingSite.status)
            .options(
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.allocating_organization),
                selectinload(ChargingSite.documents),
            )
            .where(ChargingSite.action_type != ActionTypeEnum.DELETE)
        )

        stmt = self._apply_latest_version_filter(
            stmt, government_visible=government_visible
        )

        # Add condition to exclude draft sites if requested
        if exclude_draft:
            stmt = stmt.where(
                ChargingSiteStatus.status.not_in(["Draft", "Updated"])
            )

        # Apply other conditions
        if conditions:
            stmt = stmt.where(and_(*conditions))

        # Apply sort orders
        for order in sort_orders or []:
            direction = asc if getattr(order, "direction", "asc") == "asc" else desc
            field_name = getattr(order, "field", "update_date")

            if field_name == "organization":
                stmt = stmt.order_by(direction(_organization_name_expression()))
            elif field_name == "allocating_organization":
                stmt = stmt.order_by(
                    direction(_allocating_organization_display_name_expression())
                )
            else:
                field = getattr(ChargingSite, field_name, None)
                if field is not None:
                    stmt = stmt.order_by(direction(field))

        if not sort_orders:
            stmt = stmt.order_by(ChargingSite.update_date.desc())

        # Count total
        total = await self.db.scalar(select(func.count()).select_from(stmt.subquery()))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)
        results = await self.db.execute(stmt)
        rows = results.scalars().all()
        return rows, total or 0

    @repo_handler
    async def get_charging_sites_paginated(
        self,
        offset: int,
        limit: int,
        conditions: list,
        sort_orders: list,
        organization_id: int,
        government_visible: bool = False,
    ) -> tuple[list[ChargingSite], int]:
        """
        Retrieve charging sites for a specific organization with pagination.
        """
        org_condition = ChargingSite.organization_id == organization_id
        all_conditions = [org_condition] + (conditions or [])
        return await self.get_all_charging_sites_paginated(
            offset,
            limit,
            all_conditions,
            sort_orders,
            government_visible,
            government_visible,
        )

    @repo_handler
    async def get_charging_site_by_site_name(
        self, site_name: str, organization_id: int
    ) -> Optional[ChargingSite]:
        """
        Retrieve a charging site by its name within an organization.
        """
        stmt = select(ChargingSite).where(
            ChargingSite.organization_id == organization_id,
            func.lower(ChargingSite.site_name) == func.lower(site_name),
        )
        stmt = self._apply_latest_version_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    @repo_handler
    async def charging_site_name_exists(
        self,
        site_name: str,
        organization_id: int,
        exclude_site_id: Optional[int] = None,
    ) -> bool:
        """
        Check if a charging site name already exists within an organization.
        """
        query = select(ChargingSite).where(
            ChargingSite.organization_id == organization_id,
            func.lower(ChargingSite.site_name) == func.lower(site_name),
        )
        if exclude_site_id:
            query = query.where(ChargingSite.charging_site_id != exclude_site_id)

        query = self._apply_latest_version_filter(query)
        result = await self.db.execute(query)
        return result.scalars().first() is not None

    @repo_handler
    async def get_end_user_types_by_ids(self, ids: List[int]) -> List[EndUserType]:
        """
        Retrieve end user types by their IDs
        """
        result = await self.db.execute(
            select(EndUserType).where(EndUserType.end_user_type_id.in_(ids))
        )
        return result.scalars().all()

    @repo_handler
    async def create_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Create a new charging site in the database
        """
        self.db.add(charging_site)
        await self.db.flush()
        await self.db.refresh(
            charging_site,
            [
                "allocating_organization",
                "organization",
                "status",
                "documents",
                "update_date",
            ],
        )
        return charging_site

    @repo_handler
    async def update_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Update an existing charging site in the database
        """
        merged_site = await self.db.merge(charging_site)
        await self.db.flush()
        await self.db.refresh(
            merged_site,
            [
                "allocating_organization",
                "organization",
                "status",
                "update_date",
            ],
        )
        return merged_site

    @repo_handler
    async def delete_charging_site(self, charging_site_id: int) -> None:
        """
        Delete a charging site and all its related data (equipment, documents, user associations)
        """
        result = await self.db.execute(
            select(ChargingSite)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .options(
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
            )
        )
        charging_site = result.scalar_one_or_none()

        if not charging_site:
            # Raise a generic exception so it is wrapped by repo_handler into DatabaseException
            raise Exception(f"Charging site with ID {charging_site_id} not found")

        # Clear many-to-many relationships
        charging_site.documents.clear()

        # Delete related charging equipment
        for equipment in charging_site.charging_equipment:
            await self.db.delete(equipment)

        # Delete the charging site
        await self.db.delete(charging_site)
        await self.db.flush()
        await self.db.commit()

    @repo_handler
    async def update_charging_site_status(
        self,
        charging_site_id: int,
        status_id: int,
    ) -> None:
        """
        Update the status of a charging site
        """
        stmt = (
            update(ChargingSite)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .values(status_id=status_id)
        )

        await self.db.execute(stmt)

    @repo_handler
    async def sync_latest_equipment_to_site_version(
        self, charging_site_id: int
    ) -> int:
        """
        Move the latest version of each equipment series under a charging site group
        to the supplied charging site version.
        """
        site = (
            (
                await self.db.execute(
                    select(ChargingSite).where(
                        ChargingSite.charging_site_id == charging_site_id
                    )
                )
            )
            .scalars()
            .first()
        )
        if not site:
            return 0

        latest_equipment_versions = (
            select(
                ChargingEquipment.group_uuid.label("equipment_group_uuid"),
                func.max(ChargingEquipment.version).label("latest_version"),
            )
            .where(ChargingEquipment.charging_site_group_uuid == site.group_uuid)
            .group_by(ChargingEquipment.group_uuid)
            .subquery()
        )

        result = await self.db.execute(
            update(ChargingEquipment)
            .where(
                and_(
                    ChargingEquipment.group_uuid
                    == latest_equipment_versions.c.equipment_group_uuid,
                    ChargingEquipment.version
                    == latest_equipment_versions.c.latest_version,
                    ChargingEquipment.charging_site_group_uuid == site.group_uuid,
                    ChargingEquipment.charging_site_version != site.version,
                )
            )
            .values(
                charging_site_version=site.version,
            )
        )
        return result.rowcount or 0

    @repo_handler
    async def calculate_site_status_from_equipment(
        self,
        charging_site_id: int,
    ) -> str | None:
        """
        Calculate the appropriate charging site status based on the highest
        status of all non-decommissioned equipment at the site.

        Status priority (highest to lowest): Validated > Submitted > Draft
        Returns None if no non-decommissioned equipment exists.
        """
        # Get all non-decommissioned equipment statuses for this site
        stmt = (
            select(ChargingEquipmentStatus.status)
            .select_from(ChargingEquipment)
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .where(
                and_(
                    ChargingEquipment.charging_site_id == charging_site_id,
                    ChargingEquipmentStatus.status != "Decommissioned",
                )
            )
        )
        result = await self.db.execute(stmt)
        statuses = [row[0] for row in result.fetchall()]

        if not statuses:
            return None

        # Priority: Validated > Submitted > Draft
        # Return the highest priority status found
        if "Validated" in statuses:
            return "Validated"
        elif "Submitted" in statuses:
            return "Submitted"
        else:
            return "Draft"

    @repo_handler
    async def get_charging_site_options(self, organization):
        """
        Get options for charging site dropdowns (statuses only)
        """
        statuses = await self.get_charging_site_statuses()
        return [statuses]

    @repo_handler
    async def get_charging_site_status_by_name(
        self, status_name: str
    ) -> ChargingSiteStatus:
        """
        Retrieve a charging site status by its name from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSiteStatus).where(
                        ChargingSiteStatus.status == status_name
                    )
                )
            )
            .scalars()
            .first()
        )

    @repo_handler
    async def delete_all_charging_sites_by_organization(self, organization_id: int):
        """
        Delete all charging sites for an organization (used for overwrite import)
        """
        # Get all charging sites for the organization
        result = await self.db.execute(
            select(ChargingSite)
            .where(ChargingSite.organization_id == organization_id)
            .options(
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
            )
        )
        charging_sites = result.scalars().all()

        # Delete each charging site and its relationships
        for charging_site in charging_sites:
            # Clear many-to-many relationships
            charging_site.documents.clear()

            # Delete related charging equipment
            for equipment in charging_site.charging_equipment:
                await self.db.delete(equipment)

            # Delete the charging site
            await self.db.delete(charging_site)

        await self.db.flush()

    @repo_handler
    async def get_site_names_by_organization(self, organization_id: int):
        """
        Get site names and charging site IDs for the given organization.
        Excludes deleted charging sites.
        """
        stmt = (
            select(ChargingSite.site_name, ChargingSite.charging_site_id)
            .where(
                ChargingSite.organization_id == organization_id,
                ChargingSite.action_type != ActionTypeEnum.DELETE,
            )
            .order_by(ChargingSite.site_name)
        )
        stmt = self._apply_latest_version_filter(stmt)
        result = await self.db.execute(stmt)
        return result.all()

    @repo_handler
    async def get_distinct_allocating_organization_names(
        self, organization_id: int
    ) -> List[str]:
        """
        Retrieve distinct allocating organization names
        """
        result = await self.db.execute(
            select(func.distinct(ChargingSite.allocating_organization_name))
            .where(
                ChargingSite.organization_id == organization_id,
                ChargingSite.allocating_organization_name.isnot(None),
                ChargingSite.allocating_organization_name != "",
                ChargingSite.action_type != ActionTypeEnum.DELETE,
            )
            .order_by(ChargingSite.allocating_organization_name)
        )
        return [row[0] for row in result.all()]

    @repo_handler
    async def search_organizations_by_name(
        self, query: str, limit: int = 50
    ) -> List[Organization]:
        """
        Search for organizations by name or operating name (case-insensitive partial match).
        """
        if not query or not query.strip():
            # Return empty list if no query provided
            return []

        search_pattern = f"%{query.strip()}%"
        result = await self.db.execute(
            select(Organization)
            .where(
                or_(
                    Organization.name.ilike(search_pattern),
                    Organization.operating_name.ilike(search_pattern),
                )
            )
            .order_by(Organization.name)
            .limit(limit)
        )
        return result.scalars().all()

    @repo_handler
    async def get_transaction_partners_from_allocation_agreements(
        self, organization_id: int
    ) -> List[str]:
        """
        Retrieve distinct transaction partner names from allocation agreements
        """
        query = (
            select(func.distinct(AllocationAgreement.transaction_partner))
            .join(
                ComplianceReport,
                AllocationAgreement.compliance_report_id
                == ComplianceReport.compliance_report_id,
            )
            .where(
                ComplianceReport.organization_id == organization_id,
                AllocationAgreement.transaction_partner.isnot(None),
                AllocationAgreement.transaction_partner != "",
            )
            .order_by(AllocationAgreement.transaction_partner)
        )

        result = await self.db.execute(query)
        return [row[0] for row in result.all()]
