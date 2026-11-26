"""Data access for LCJFIP applications (#5532)."""

from datetime import date
from typing import List, Optional, Sequence

from fastapi import Depends
from sqlalchemy import delete, or_, select
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
from lcfs.web.core.decorators import repo_handler

# The fuel type of low carbon jet fuel. Fuel codes of other jet-category fuel
# types (electricity, hydrogen, fossil jet fuel) are not LCJF.
LCJF_FUEL_TYPE = "Alternative jet fuel"


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
    async def list_for_organization(
        self, organization_id: int
    ) -> List[LCJFIPApplication]:
        result = await self.db.execute(
            select(LCJFIPApplication)
            .where(LCJFIPApplication.organization_id == organization_id)
            .order_by(LCJFIPApplication.lcjfip_application_id.desc())
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
