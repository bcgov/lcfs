"""Data access for LCJFIP applications (#5532)."""

import re
from datetime import date
from typing import List, Optional, Sequence, Tuple

from fastapi import Depends
from sqlalchemy import String, and_, asc, cast, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.LCJFIPApplicationInternalComment import (
    LCJFIPApplicationInternalComment,
)
from lcfs.db.models.document.Document import Document
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
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
    LCJFIPPurchaseDetail,
    lcjfip_application_document_association,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationStatus import (
    OrganizationStatus,
    OrgStatusEnum,
)
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.base import PaginationRequestSchema, apply_filter_conditions
from lcfs.web.core.decorators import repo_handler

# The fuel type of low carbon jet fuel. Fuel codes of other jet-category fuel
# types (electricity, hydrogen, fossil jet fuel) are not LCJF.
LCJF_FUEL_TYPE = "Alternative jet fuel"

# ---------------------------------------------------------------------------
# Applications index (#5541)
# ---------------------------------------------------------------------------


# Grid fields, after FilterModel/SortOrder turn them into snake_case, mapped
# to the columns they filter and sort. Fields not listed here are ignored.
_STATUS = LCJFIPApplicationStatus.status
_ORGANIZATION_NAME = Organization.name
_CONTACT_NAME = func.concat_ws(" ", UserProfile.first_name, UserProfile.last_name)
# Submission is stored in UTC; the grid shows and filters the Pacific date.
_SUBMITTED_LOCAL = func.timezone("America/Vancouver", LCJFIPApplication.signed_date)

_LIST_COLUMNS = {
    "status": _STATUS,
    "application_number": LCJFIPApplication.lcjfip_application_id,
    "organization_name": _ORGANIZATION_NAME,
    "contact_name": _CONTACT_NAME,
    "submitted_date": _SUBMITTED_LOCAL,
}


def _filter_value(filter_model):
    if filter_model.filter_type == "set":
        return filter_model.values or []
    if filter_model.filter_type == "date":
        if filter_model.type == "inRange":
            return [
                filter_model.date_from,
                filter_model.date_to or filter_model.date_from,
            ]
        return filter_model.filter or filter_model.date_from
    return filter_model.filter


def _list_condition(filter_model):
    """One grid filter as a SQL condition, or None to ignore it."""
    field = filter_model.field
    if field not in _LIST_COLUMNS:
        return None
    value = _filter_value(filter_model)
    if value in (None, "", []):
        return None
    if field == "application_number":
        # "JF-12", "jf12" and "12" all mean application 12.
        digits = re.sub(r"\D", "", str(value))
        if not digits:
            return None
        return apply_filter_conditions(
            cast(LCJFIPApplication.lcjfip_application_id, String),
            digits,
            filter_model.type,
            "text",
        )
    if field == "submitted_date":
        return apply_filter_conditions(
            _SUBMITTED_LOCAL, value, filter_model.type, "date"
        )
    return apply_filter_conditions(
        _LIST_COLUMNS[field], value, filter_model.type, filter_model.filter_type
    )


class LCJFIPRepository:
    def __init__(
        self, db: AsyncSession = Depends(get_async_db_session, scope="function")
    ) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Reference data
    # ------------------------------------------------------------------

    async def _ordered(self, model) -> List:
        result = await self.db.execute(
            select(model).order_by(model.display_order, model.name)
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_car_types(self) -> List[LCJFIPCarType]:
        return await self._ordered(LCJFIPCarType)

    @repo_handler
    async def get_certificate_types(self) -> List[LCJFIPCertificateType]:
        return await self._ordered(LCJFIPCertificateType)

    @repo_handler
    async def get_feedstock_sources(self) -> List[LCJFIPFeedstockSource]:
        return await self._ordered(LCJFIPFeedstockSource)

    @repo_handler
    async def get_incentive_options(self) -> List[LCJFIPIncentiveOption]:
        return await self._ordered(LCJFIPIncentiveOption)

    @repo_handler
    async def get_incentive_rates(self) -> List[LCJFIPIncentiveRate]:
        result = await self.db.execute(
            select(LCJFIPIncentiveRate).order_by(
                LCJFIPIncentiveRate.display_order,
                LCJFIPIncentiveRate.lcjfip_incentive_rate_id,
            )
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_status(self, status: str) -> Optional[LCJFIPApplicationStatus]:
        result = await self.db.execute(
            select(LCJFIPApplicationStatus).where(
                LCJFIPApplicationStatus.status == status
            )
        )
        return result.scalars().first()

    @repo_handler
    async def get_open_period(self, on_date: date) -> Optional[LCJFIPApplicationPeriod]:
        """The intake period open on a date, if any (both ends inclusive)."""
        result = await self.db.execute(
            select(LCJFIPApplicationPeriod)
            .where(
                LCJFIPApplicationPeriod.open_date <= on_date,
                or_(
                    LCJFIPApplicationPeriod.close_date.is_(None),
                    LCJFIPApplicationPeriod.close_date >= on_date,
                ),
            )
            .order_by(LCJFIPApplicationPeriod.open_date.desc())
        )
        return result.scalars().first()

    @repo_handler
    async def get_lcjf_fuel_codes(
        self, on_date: date, fuel_code_ids: Optional[Sequence[int]] = None
    ) -> List[FuelCode]:
        """Approved, unexpired fuel codes for low carbon jet fuel."""
        query = (
            select(FuelCode)
            .join(
                FuelCodeStatus,
                FuelCodeStatus.fuel_code_status_id == FuelCode.fuel_status_id,
            )
            .join(FuelType, FuelType.fuel_type_id == FuelCode.fuel_type_id)
            .options(selectinload(FuelCode.fuel_code_prefix))
            .where(
                FuelCodeStatus.status == FuelCodeStatusEnum.Approved,
                FuelType.fuel_type == LCJF_FUEL_TYPE,
                or_(
                    FuelCode.effective_date.is_(None),
                    FuelCode.effective_date <= on_date,
                ),
                or_(
                    FuelCode.expiration_date.is_(None),
                    FuelCode.expiration_date > on_date,
                ),
            )
            .order_by(FuelCode.fuel_code_id)
        )
        if fuel_code_ids is not None:
            query = query.where(FuelCode.fuel_code_id.in_(fuel_code_ids))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    @repo_handler
    async def is_registered_organization(self, organization_id: int) -> bool:
        result = await self.db.execute(
            select(Organization.organization_id)
            .join(
                OrganizationStatus,
                OrganizationStatus.organization_status_id
                == Organization.organization_status_id,
            )
            .where(
                Organization.organization_id == organization_id,
                OrganizationStatus.status == OrgStatusEnum.Registered,
            )
        )
        return result.scalar_one_or_none() is not None

    # ------------------------------------------------------------------
    # Applications
    # ------------------------------------------------------------------

    def _application_query(self):
        return select(LCJFIPApplication).options(
            selectinload(LCJFIPApplication.organization).selectinload(
                Organization.org_address
            ),
            selectinload(LCJFIPApplication.fuel_code).selectinload(
                FuelCode.fuel_code_prefix
            ),
            selectinload(LCJFIPApplication.purchase_details).selectinload(
                LCJFIPPurchaseDetail.feedstock_sources
            ),
        )

    @repo_handler
    async def get_by_id(
        self, application_id: int, reload: bool = False
    ) -> Optional[LCJFIPApplication]:
        """With *reload*, refresh an application already in the session, so
        relationships changed through foreign keys are read back."""
        query = self._application_query().where(
            LCJFIPApplication.lcjfip_application_id == application_id
        )
        if reload:
            query = query.execution_options(populate_existing=True)
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def delete_comments(self, internal_comment_ids: Sequence[int]) -> None:
        """Delete comments in SQL: their link rows go by ON DELETE CASCADE."""
        if internal_comment_ids:
            await self.db.execute(
                delete(InternalComment).where(
                    InternalComment.internal_comment_id.in_(internal_comment_ids)
                )
            )

    @repo_handler
    async def list_paginated(
        self,
        pagination: PaginationRequestSchema,
        organization_id: Optional[int] = None,
        exclude_draft: bool = False,
    ) -> Tuple[List[Tuple[LCJFIPApplication, str, Optional[str], str]], int]:
        """
        A page of applications for the index grid, with the total count.

        Each row is (application, status, organization name, contact name).
        organization_id limits the rows to one organization (BCeID users);
        exclude_draft leaves Drafts out (government users).
        """
        query = (
            select(
                LCJFIPApplication,
                _STATUS.label("status_name"),
                _ORGANIZATION_NAME.label("organization_name"),
                _CONTACT_NAME.label("contact_name"),
            )
            .join(LCJFIPApplication.status)
            .outerjoin(
                Organization,
                Organization.organization_id == LCJFIPApplication.organization_id,
            )
            .outerjoin(
                UserProfile,
                UserProfile.user_profile_id
                == LCJFIPApplication.contact_user_profile_id,
            )
        )
        conditions = []
        if organization_id is not None:
            conditions.append(LCJFIPApplication.organization_id == organization_id)
        if exclude_draft:
            conditions.append(_STATUS != LCJFIPApplicationStatusEnum.Draft.value)
        for filter_model in pagination.filters:
            condition = _list_condition(filter_model)
            if condition is not None:
                conditions.append(condition)
        if conditions:
            query = query.where(and_(*conditions))

        order_by = []
        for order in pagination.sort_orders:
            column = _LIST_COLUMNS.get(order.field)
            if column is not None:
                order_by.append(
                    desc(column).nulls_last()
                    if order.direction.lower() == "desc"
                    else asc(column).nulls_last()
                )
        if not order_by:
            order_by = [desc(LCJFIPApplication.update_date)]
        # A unique tiebreaker keeps rows from repeating or vanishing across
        # pages when the sort column ties.
        order_by.append(desc(LCJFIPApplication.lcjfip_application_id))

        total = (
            await self.db.execute(
                select(func.count()).select_from(
                    query.with_only_columns(
                        LCJFIPApplication.lcjfip_application_id
                    ).subquery()
                )
            )
        ).scalar_one()

        result = await self.db.execute(
            query.options(selectinload(LCJFIPApplication.incentive_option))
            .order_by(*order_by)
            .offset((pagination.page - 1) * pagination.size)
            .limit(pagination.size)
        )
        return [tuple(row) for row in result.all()], total

    @repo_handler
    async def get_statuses(self) -> List[LCJFIPApplicationStatus]:
        result = await self.db.execute(
            select(LCJFIPApplicationStatus).order_by(
                LCJFIPApplicationStatus.display_order,
                LCJFIPApplicationStatus.status,
            )
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_by_ids(self, model, id_column, ids: Sequence[int]) -> List:
        if not ids:
            return []
        result = await self.db.execute(select(model).where(id_column.in_(ids)))
        return list(result.scalars().all())

    @repo_handler
    async def add(self, instance):
        self.db.add(instance)
        await self.db.flush()
        return instance

    @repo_handler
    async def flush(self) -> None:
        await self.db.flush()

    @repo_handler
    async def delete(self, instance) -> None:
        await self.db.delete(instance)
        await self.db.flush()

    @repo_handler
    async def add_history(
        self,
        application: LCJFIPApplication,
        status: LCJFIPApplicationStatus,
        user_profile_id: Optional[int],
        snapshot: Optional[dict] = None,
    ) -> LCJFIPApplicationHistory:
        history = LCJFIPApplicationHistory(
            lcjfip_application_id=application.lcjfip_application_id,
            status_id=status.lcjfip_application_status_id,
            user_profile_id=user_profile_id,
            application_snapshot=snapshot,
        )
        self.db.add(history)
        await self.db.flush()
        return history

    @repo_handler
    async def get_comments(self, application_id: int) -> List[InternalComment]:
        """Comments on an application, with their attachments."""
        result = await self.db.execute(
            select(InternalComment)
            .join(
                LCJFIPApplicationInternalComment,
                LCJFIPApplicationInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .options(selectinload(InternalComment.documents))
            .where(
                LCJFIPApplicationInternalComment.lcjfip_application_id == application_id
            )
        )
        return list(result.scalars().unique().all())

    @repo_handler
    async def get_application_documents(self, application_id: int) -> List[Document]:
        result = await self.db.execute(
            select(Document)
            .join(
                lcjfip_application_document_association,
                lcjfip_application_document_association.c.document_id
                == Document.document_id,
            )
            .where(
                lcjfip_application_document_association.c.lcjfip_application_id
                == application_id
            )
        )
        return list(result.scalars().all())
