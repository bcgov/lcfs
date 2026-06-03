from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
import structlog
from typing import List, Optional, Tuple

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy import asc, case, desc, func, select

from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.web.api.user.repo import UserRepository
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.CommentCategory import CommentCategory
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    InitiativeAgreement,
)
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.ci_application.CIApplication import CIApplication
from lcfs.web.api.internal_comment.schema import EntityTypeEnum
from lcfs.db.models.comment.TransferInternalComment import TransferInternalComment
from lcfs.db.models.comment.InitiativeAgreementInternalComment import (
    InitiativeAgreementInternalComment,
)
from lcfs.db.models.comment.AdminAdjustmentInternalComment import (
    AdminAdjustmentInternalComment,
)
from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from lcfs.db.models.comment.CIApplicationInternalComment import (
    CIApplicationInternalComment,
)

logger = structlog.get_logger(__name__)


class InternalCommentRepository:
    """
    Repository class for internal comments
    """

    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        user_repo: UserRepository = Depends(),
        report_repo: ComplianceReportRepository = Depends(),
    ):
        """
        Initializes the repository with an asynchronous database session.

        Args:
            db (AsyncSession): Injected database session for executing asynchronous queries.
        """
        self.db = db
        self.user_repo = user_repo
        self.report_repo = report_repo

    @repo_handler
    async def create_internal_comment(
        self,
        internal_comment: InternalComment,
        entity_type: EntityTypeEnum,
        entity_id: int,
    ):
        """
        Creates a new internal comment and associates it with a transfer, initiative agreement or admin adjustment entity.

        Args:
            internal_comment (InternalComment): The internal comment object to be added to the database.
            entity_type (str): The type of entity the comment is associated with.
            entity_id (int): The ID of the entity the comment is associated with.

        Returns:
            InternalComment: The newly created internal comment with additional information such as 'full_name'.
        """
        self.db.add(internal_comment)
        await self.db.flush()
        await self.db.refresh(internal_comment)

        # Determine and create the appropriate entity association based on the provided entity type
        if entity_type == EntityTypeEnum.TRANSFER:
            association = TransferInternalComment(
                transfer_id=entity_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        elif entity_type == EntityTypeEnum.INITIATIVE_AGREEMENT:
            association = InitiativeAgreementInternalComment(
                initiative_agreement_id=entity_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        elif entity_type == EntityTypeEnum.ADMIN_ADJUSTMENT:
            association = AdminAdjustmentInternalComment(
                admin_adjustment_id=entity_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        elif entity_type == EntityTypeEnum.COMPLIANCE_REPORT:
            association = ComplianceReportInternalComment(
                compliance_report_id=entity_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )
        elif entity_type == EntityTypeEnum.CI_APPLICATION:
            association = CIApplicationInternalComment(
                ci_application_id=entity_id,
                internal_comment_id=internal_comment.internal_comment_id,
            )

        # Add the association to the session and commit
        self.db.add(association)

        # Update the internal comment with the creator's full name.
        internal_comment.full_name = await self.user_repo.get_full_name(
            internal_comment.create_user
        )

        await self.db.flush()
        await self.db.refresh(internal_comment)
        return internal_comment

    @repo_handler
    async def get_internal_comments(
        self,
        entity_type: EntityTypeEnum,
        entity_id: int,
        visibility_filter: Optional[str] = None,
    ) -> List[dict]:
        """
        Retrieves a list of internal comments associated with a specific entity,
        along with the full name of the user who created each comment.

        Args:
            entity_type (EntityTypeEnum): The type of entity to retrieve comments for.
            entity_id (int): The ID of the entity to retrieve comments for.

        Returns:
            List[Dict[str, any]]: A list of dictionaries containing internal comment
            information and the full name of the comment creator.

        Raises:
            DataNotFoundException: If no comments are found for the given entity.
        """
        # Mapping of entity types to their respective models and where conditions
        entity_mapping = {
            EntityTypeEnum.TRANSFER: (
                TransferInternalComment,
                TransferInternalComment.transfer_id,
            ),
            EntityTypeEnum.INITIATIVE_AGREEMENT: (
                InitiativeAgreementInternalComment,
                InitiativeAgreementInternalComment.initiative_agreement_id,
            ),
            EntityTypeEnum.ADMIN_ADJUSTMENT: (
                AdminAdjustmentInternalComment,
                AdminAdjustmentInternalComment.admin_adjustment_id,
            ),
            EntityTypeEnum.COMPLIANCE_REPORT: (
                ComplianceReportInternalComment,
                ComplianceReportInternalComment.compliance_report_id,
            ),
            EntityTypeEnum.CI_APPLICATION: (
                CIApplicationInternalComment,
                CIApplicationInternalComment.ci_application_id,
            ),
        }

        # Get the specific model and where condition for the given entity_type
        entity_model, where_condition = entity_mapping[entity_type]
        entity_ids = [entity_id]
        if entity_type == EntityTypeEnum.COMPLIANCE_REPORT:
            # Get all related compliance report IDs in the same chain
            entity_ids = await self.report_repo.get_related_compliance_report_ids(
                entity_id
            )

        # First get distinct internal_comment_ids
        distinct_comment_ids_query = (
            select(InternalComment.internal_comment_id)
            .join(
                entity_model,
                entity_model.internal_comment_id == InternalComment.internal_comment_id,
            )
            .where(where_condition.in_(entity_ids))
            .distinct()
        )

        # Then get the full comment data with user info, ordered by update_date
        base_query = (
            select(
                InternalComment,
                (UserProfile.first_name + " " + UserProfile.last_name).label(
                    "full_name"
                ),
            )
            .join(
                UserProfile,
                UserProfile.keycloak_username == InternalComment.create_user,
            )
            .where(InternalComment.internal_comment_id.in_(distinct_comment_ids_query))
        )

        # Apply visibility filter (e.g., BCeID users only see Public comments)
        if visibility_filter:
            base_query = base_query.where(
                InternalComment.visibility == visibility_filter
            )

        base_query = base_query.order_by(asc(InternalComment.create_date))

        # Execute the query
        results = await self.db.execute(base_query)

        # Compile and return the list of internal comments with user info
        comments_with_user_info = [
            {
                "internal_comment_id": internal_comment.internal_comment_id,
                "comment": internal_comment.comment,
                "audience_scope": internal_comment.audience_scope,
                "visibility": internal_comment.visibility,
                "create_user": internal_comment.create_user,
                "create_date": internal_comment.create_date,
                "update_date": internal_comment.update_date,
                "full_name": full_name,
            }
            for internal_comment, full_name in results
        ]

        return comments_with_user_info

    @repo_handler
    async def get_internal_comment_by_id(
        self, internal_comment_id: int
    ) -> InternalComment:
        """
        Fetches an internal comment by its ID.

        Args:
            internal_comment_id (int): The ID of the internal comment.

        Returns:
            InternalComment: The internal comment object if found.

        Raises:
            DataNotFoundException: If no internal comment with the given ID is found.
        """
        base_query = select(InternalComment).where(
            InternalComment.internal_comment_id == internal_comment_id
        )
        result = await self.db.execute(base_query)
        internal_comment = result.scalars().first()

        if not internal_comment:
            raise DataNotFoundException(
                f"Internal comment with ID {internal_comment_id} not found."
            )

        return internal_comment

    @repo_handler
    async def update_internal_comment(
        self,
        internal_comment_id: int,
        new_comment_text: Optional[str] = None,
        visibility: Optional[str] = None,
        audience_scope: Optional[str] = None,
        comment_category_id: Optional[int] = None,
        comment_search_text: Optional[str] = None,
        comment_search_vector=None,
    ) -> InternalComment:
        """
        Updates the text of an existing internal comment.

        Args:
            internal_comment_id (int): The ID of the internal comment to update.
            new_comment_text (str, optional): The new text for the comment.
            visibility (str, optional): The visibility for the comment.
            audience_scope (str, optional): The audience scope for the comment.
            comment_category_id (int, optional): New category FK if changed.
            comment_search_text (str, optional): Refreshed sanitized text.
            comment_search_vector: SQL expression / value for the tsvector.

        Returns:
            InternalComment: The updated internal comment object.

        Raises:
            DataNotFoundException: If no internal comment matching the criteria is found.
        """
        statement = select(InternalComment).where(
            InternalComment.internal_comment_id == internal_comment_id
        )
        result = await self.db.execute(statement)
        internal_comment = result.scalars().first()

        if not internal_comment:
            raise DataNotFoundException(
                f"Internal comment with ID {internal_comment_id} not found."
            )

        if new_comment_text is not None:
            internal_comment.comment = new_comment_text
        if visibility is not None:
            internal_comment.visibility = visibility
        if audience_scope is not None:
            internal_comment.audience_scope = audience_scope
        elif visibility is not None and str(visibility) == "Public":
            internal_comment.audience_scope = None
        if comment_category_id is not None:
            internal_comment.comment_category_id = comment_category_id
        if comment_search_text is not None:
            internal_comment.comment_search_text = comment_search_text
        if comment_search_vector is not None:
            internal_comment.comment_search_vector = comment_search_vector
        await self.db.flush()
        await self.db.refresh(internal_comment)

        # Updated the internal comment with the creator's full name.
        internal_comment.full_name = await self.user_repo.get_full_name(
            internal_comment.create_user
        )
        return internal_comment

    @repo_handler
    async def get_internal_comment_ids_for_entity(
        self, entity_type: EntityTypeEnum, entity_id: int
    ) -> List[int]:
        """
        Retrieves the IDs of internal comments for a specific entity.

        Args:
            entity_type (EntityTypeEnum): The type of entity.
            entity_id (int): The ID of the entity.

        Returns:
            List[int]: List of internal comment IDs.
        """
        # Mapping of entity types to their respective models and where conditions
        entity_mapping = {
            EntityTypeEnum.TRANSFER: (
                TransferInternalComment,
                TransferInternalComment.transfer_id,
            ),
            EntityTypeEnum.INITIATIVE_AGREEMENT: (
                InitiativeAgreementInternalComment,
                InitiativeAgreementInternalComment.initiative_agreement_id,
            ),
            EntityTypeEnum.ADMIN_ADJUSTMENT: (
                AdminAdjustmentInternalComment,
                AdminAdjustmentInternalComment.admin_adjustment_id,
            ),
            EntityTypeEnum.COMPLIANCE_REPORT: (
                ComplianceReportInternalComment,
                ComplianceReportInternalComment.compliance_report_id,
            ),
            EntityTypeEnum.CI_APPLICATION: (
                CIApplicationInternalComment,
                CIApplicationInternalComment.ci_application_id,
            ),
        }

        entity_model, where_condition = entity_mapping[entity_type]
        query = select(entity_model.internal_comment_id).where(
            where_condition == entity_id
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    @repo_handler
    async def get_category_id_by_name(self, display_name: str) -> Optional[int]:
        """Look up a ``comment_category`` row id by display name."""
        if not display_name:
            return None
        result = await self.db.execute(
            select(CommentCategory.comment_category_id).where(
                CommentCategory.display_name == display_name
            )
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_entity_org_and_year(
        self, entity_type: EntityTypeEnum, entity_id: int
    ) -> Tuple[Optional[int], Optional[int]]:
        """
        Derive (organization_id, compliance_year) for a source entity.
        """
        if entity_type == EntityTypeEnum.COMPLIANCE_REPORT:
            stmt = (
                select(ComplianceReport.organization_id, CompliancePeriod.description)
                .join(
                    CompliancePeriod,
                    CompliancePeriod.compliance_period_id
                    == ComplianceReport.compliance_period_id,
                )
                .where(ComplianceReport.compliance_report_id == entity_id)
            )
            row = (await self.db.execute(stmt)).first()
            if row is None:
                return (None, None)
            org_id, period_desc = row
            try:
                year = int(period_desc) if period_desc else None
            except (TypeError, ValueError):
                year = None
            return (org_id, year)

        if entity_type == EntityTypeEnum.TRANSFER:
            stmt = select(Transfer.to_organization_id).where(
                Transfer.transfer_id == entity_id
            )
        elif entity_type == EntityTypeEnum.INITIATIVE_AGREEMENT:
            stmt = select(InitiativeAgreement.to_organization_id).where(
                InitiativeAgreement.initiative_agreement_id == entity_id
            )
        elif entity_type == EntityTypeEnum.ADMIN_ADJUSTMENT:
            stmt = select(AdminAdjustment.to_organization_id).where(
                AdminAdjustment.admin_adjustment_id == entity_id
            )
        elif entity_type == EntityTypeEnum.CI_APPLICATION:
            stmt = select(CIApplication.organization_id).where(
                CIApplication.ci_application_id == entity_id
            )
        else:
            return (None, None)

        org_id = (await self.db.execute(stmt)).scalar_one_or_none()
        return (org_id, None)

    def _entity_meta_subquery(self):
        """
        Per ``internal_comment_id``, choose one (entity_type, entity_id,
        live_org_id, live_year) tuple via ``DISTINCT ON``.
        """
        # CompliancePeriod.description is a varchar; safely cast numeric
        # values to integer, NULL otherwise.
        cp_year = case(
            (
                CompliancePeriod.description.op("~")("^[0-9]+$"),
                func.cast(CompliancePeriod.description, sa.Integer),
            ),
            else_=None,
        )
        return (
            select(
                InternalComment.internal_comment_id.label("ic_id"),
                case(
                    (
                        TransferInternalComment.transfer_id.isnot(None),
                        EntityTypeEnum.TRANSFER.value,
                    ),
                    (
                        InitiativeAgreementInternalComment.initiative_agreement_id.isnot(
                            None
                        ),
                        EntityTypeEnum.INITIATIVE_AGREEMENT.value,
                    ),
                    (
                        AdminAdjustmentInternalComment.admin_adjustment_id.isnot(None),
                        EntityTypeEnum.ADMIN_ADJUSTMENT.value,
                    ),
                    (
                        ComplianceReportInternalComment.compliance_report_id.isnot(
                            None
                        ),
                        EntityTypeEnum.COMPLIANCE_REPORT.value,
                    ),
                    (
                        CIApplicationInternalComment.ci_application_id.isnot(None),
                        EntityTypeEnum.CI_APPLICATION.value,
                    ),
                    else_=None,
                ).label("entity_type"),
                func.coalesce(
                    TransferInternalComment.transfer_id,
                    InitiativeAgreementInternalComment.initiative_agreement_id,
                    AdminAdjustmentInternalComment.admin_adjustment_id,
                    ComplianceReportInternalComment.compliance_report_id,
                    CIApplicationInternalComment.ci_application_id,
                ).label("entity_id"),
                func.coalesce(
                    Transfer.to_organization_id,
                    InitiativeAgreement.to_organization_id,
                    AdminAdjustment.to_organization_id,
                    ComplianceReport.organization_id,
                    CIApplication.organization_id,
                ).label("live_org_id"),
                cp_year.label("live_year"),
            )
            .outerjoin(
                TransferInternalComment,
                TransferInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .outerjoin(
                Transfer,
                Transfer.transfer_id == TransferInternalComment.transfer_id,
            )
            .outerjoin(
                InitiativeAgreementInternalComment,
                InitiativeAgreementInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .outerjoin(
                InitiativeAgreement,
                InitiativeAgreement.initiative_agreement_id
                == InitiativeAgreementInternalComment.initiative_agreement_id,
            )
            .outerjoin(
                AdminAdjustmentInternalComment,
                AdminAdjustmentInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .outerjoin(
                AdminAdjustment,
                AdminAdjustment.admin_adjustment_id
                == AdminAdjustmentInternalComment.admin_adjustment_id,
            )
            .outerjoin(
                ComplianceReportInternalComment,
                ComplianceReportInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .outerjoin(
                ComplianceReport,
                ComplianceReport.compliance_report_id
                == ComplianceReportInternalComment.compliance_report_id,
            )
            .outerjoin(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == ComplianceReport.compliance_period_id,
            )
            .outerjoin(
                CIApplicationInternalComment,
                CIApplicationInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .outerjoin(
                CIApplication,
                CIApplication.ci_application_id
                == CIApplicationInternalComment.ci_application_id,
            )
            .distinct(InternalComment.internal_comment_id)
            .order_by(InternalComment.internal_comment_id)
            .subquery()
        )

    @repo_handler
    async def get_comments_for_organization(
        self,
        organization_id: int,
        page: int,
        size: int,
        visibility_filter: Optional[str] = None,
    ) -> Tuple[List[dict], int]:
        """
        Paginated list of comments scoped to ``organization_id``, with the
        organization and compliance year **derived live** from the source
        parent entity (so parent updates are reflected immediately).
        Returns ``(records, total)``.
        """
        entity_meta = self._entity_meta_subquery()

        where_clauses = [entity_meta.c.live_org_id == organization_id]
        if visibility_filter:
            where_clauses.append(InternalComment.visibility == visibility_filter)

        total = (
            await self.db.execute(
                select(func.count(InternalComment.internal_comment_id))
                .select_from(InternalComment)
                .join(
                    entity_meta,
                    entity_meta.c.ic_id == InternalComment.internal_comment_id,
                )
                .where(*where_clauses)
            )
        ).scalar_one()

        if total == 0:
            return ([], 0)

        full_name_col = (UserProfile.first_name + " " + UserProfile.last_name).label(
            "full_name"
        )

        offset = max(page - 1, 0) * max(size, 1)

        query = (
            select(
                InternalComment.internal_comment_id,
                InternalComment.comment,
                InternalComment.comment_search_text.label("plain_text_comment"),
                entity_meta.c.live_org_id.label("organization_id"),
                entity_meta.c.live_year.label("compliance_year"),
                InternalComment.visibility,
                InternalComment.audience_scope,
                InternalComment.create_user,
                InternalComment.create_date,
                InternalComment.update_date,
                Organization.name.label("organization_name"),
                CommentCategory.display_name.label("category"),
                full_name_col,
                entity_meta.c.entity_type,
                entity_meta.c.entity_id,
            )
            .select_from(InternalComment)
            .join(
                entity_meta,
                entity_meta.c.ic_id == InternalComment.internal_comment_id,
            )
            .outerjoin(
                Organization,
                Organization.organization_id == entity_meta.c.live_org_id,
            )
            .outerjoin(
                CommentCategory,
                CommentCategory.comment_category_id
                == InternalComment.comment_category_id,
            )
            .outerjoin(
                UserProfile,
                UserProfile.keycloak_username == InternalComment.create_user,
            )
            .where(*where_clauses)
            .order_by(
                desc(InternalComment.create_date),
                desc(InternalComment.internal_comment_id),
            )
            .limit(size)
            .offset(offset)
        )

        rows = (await self.db.execute(query)).mappings().all()
        return ([dict(r) for r in rows], int(total))
