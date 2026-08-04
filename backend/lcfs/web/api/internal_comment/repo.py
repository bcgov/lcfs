import re
from datetime import date, datetime, time
from typing import List, Optional, Tuple

import structlog
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import selectinload

from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.web.api.user.repo import UserRepository
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.document import Document
from lcfs.db.models.comment.InternalComment import (
    InternalComment,
    internal_comment_document_association,
)
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
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
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
from lcfs.db.models.comment.OrganizationInternalComment import (
    OrganizationInternalComment,
)

logger = structlog.get_logger(__name__)

_SEARCH_NORMALIZE_RE = re.compile(r"[^0-9A-Za-z]+")


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
        elif entity_type == EntityTypeEnum.ORGANIZATION:
            association = OrganizationInternalComment(
                organization_id=entity_id,
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
        # Load the (empty) documents relationship so response serialization
        # does not trigger a lazy load outside the async context.
        await self.db.refresh(internal_comment, ["documents"])

        # On create the editor equals the author.
        internal_comment.update_full_name = internal_comment.full_name
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
            EntityTypeEnum.ORGANIZATION: (
                OrganizationInternalComment,
                OrganizationInternalComment.organization_id,
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

        # Compile the list of internal comments with user info
        comments_with_user_info = [
            {
                "internal_comment_id": internal_comment.internal_comment_id,
                "comment": internal_comment.comment,
                "audience_scope": internal_comment.audience_scope,
                "visibility": internal_comment.visibility,
                "create_user": internal_comment.create_user,
                "create_date": internal_comment.create_date,
                "update_date": internal_comment.update_date,
                "update_user": internal_comment.update_user,
                "update_full_name": None,
                "full_name": full_name,
                "documents": [],
            }
            for internal_comment, full_name in results
        ]

        # Batched lookup of editor names (avoids N+1 on the comment list).
        update_usernames = {
            c["update_user"] for c in comments_with_user_info if c.get("update_user")
        }
        if update_usernames:
            update_users_result = await self.db.execute(
                select(
                    UserProfile.keycloak_username,
                    (UserProfile.first_name + " " + UserProfile.last_name).label(
                        "full_name"
                    ),
                ).where(UserProfile.keycloak_username.in_(update_usernames))
            )
            full_name_by_username = {
                row.keycloak_username: row.full_name
                for row in update_users_result.all()
            }
            for comment in comments_with_user_info:
                username = comment.get("update_user")
                if username:
                    comment["update_full_name"] = full_name_by_username.get(username)

        # Attach any document attachments in a single batched query to avoid
        # an N+1 across the comment list.
        comment_ids = [c["internal_comment_id"] for c in comments_with_user_info]
        if comment_ids:
            docs_result = await self.db.execute(
                select(
                    internal_comment_document_association.c.internal_comment_id,
                    Document,
                )
                .join(
                    Document,
                    Document.document_id
                    == internal_comment_document_association.c.document_id,
                )
                .where(
                    internal_comment_document_association.c.internal_comment_id.in_(
                        comment_ids
                    )
                )
            )
            documents_by_comment = {}
            for comment_id, document in docs_result.all():
                documents_by_comment.setdefault(comment_id, []).append(document)
            for comment in comments_with_user_info:
                comment["documents"] = documents_by_comment.get(
                    comment["internal_comment_id"], []
                )

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
        base_query = (
            select(InternalComment)
            .options(selectinload(InternalComment.documents))
            .where(InternalComment.internal_comment_id == internal_comment_id)
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
        # Load documents so response serialization does not lazy-load outside
        # the async context.
        await self.db.refresh(internal_comment, ["documents"])

        # Attach creator + editor names; reuse creator on self-edit to skip a lookup.
        internal_comment.full_name = await self.user_repo.get_full_name(
            internal_comment.create_user
        )
        update_user = internal_comment.update_user
        if not update_user:
            internal_comment.update_full_name = None
        elif update_user == internal_comment.create_user:
            internal_comment.update_full_name = internal_comment.full_name
        else:
            internal_comment.update_full_name = await self.user_repo.get_full_name(
                update_user
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
            EntityTypeEnum.ORGANIZATION: (
                OrganizationInternalComment,
                OrganizationInternalComment.organization_id,
            ),
        }

        entity_model, where_condition = entity_mapping[entity_type]
        query = select(entity_model.internal_comment_id).where(
            where_condition == entity_id
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    @repo_handler
    async def get_all_categories(self) -> List[str]:
        """Return all comment category display names ordered by display_order."""
        result = await self.db.execute(
            select(CommentCategory.display_name).order_by(CommentCategory.display_order)
        )
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
    async def is_organization_comment(self, internal_comment_id: int) -> bool:
        """
        True when the comment is an ORGANIZATION-entity comment (a Company
        Overview note), identified by its association row.
        """
        result = await self.db.execute(
            select(OrganizationInternalComment.internal_comment_id).where(
                OrganizationInternalComment.internal_comment_id == internal_comment_id
            )
        )
        return result.scalar_one_or_none() is not None

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

        # Organization-scoped comments carry the organization id directly as the
        # entity id (e.g. Company Overview notes).
        if entity_type == EntityTypeEnum.ORGANIZATION:
            return (entity_id, None)

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

    def _entity_meta_subquery(self, organization_id: Optional[int] = None):
        """
        Per ``internal_comment_id``, choose one (entity_type, entity_id,
        live_org_id, live_year) tuple via ``DISTINCT ON``.

        Pass *organization_id* to pre-filter rows to that org only.
        """
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
                    (
                        OrganizationInternalComment.organization_id.isnot(None),
                        EntityTypeEnum.ORGANIZATION.value,
                    ),
                    else_=None,
                ).label("entity_type"),
                func.coalesce(
                    TransferInternalComment.transfer_id,
                    InitiativeAgreementInternalComment.initiative_agreement_id,
                    AdminAdjustmentInternalComment.admin_adjustment_id,
                    ComplianceReportInternalComment.compliance_report_id,
                    CIApplicationInternalComment.ci_application_id,
                    OrganizationInternalComment.organization_id,
                ).label("entity_id"),
                func.coalesce(
                    Transfer.to_organization_id,
                    InitiativeAgreement.to_organization_id,
                    AdminAdjustment.to_organization_id,
                    ComplianceReport.organization_id,
                    CIApplication.organization_id,
                    OrganizationInternalComment.organization_id,
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
            .outerjoin(
                OrganizationInternalComment,
                OrganizationInternalComment.internal_comment_id
                == InternalComment.internal_comment_id,
            )
            .where(
                *(
                    [
                        or_(
                            Transfer.to_organization_id == organization_id,
                            InitiativeAgreement.to_organization_id == organization_id,
                            AdminAdjustment.to_organization_id == organization_id,
                            ComplianceReport.organization_id == organization_id,
                            CIApplication.organization_id == organization_id,
                            OrganizationInternalComment.organization_id
                            == organization_id,
                        )
                    ]
                    if organization_id is not None
                    else []
                )
            )
            .distinct(InternalComment.internal_comment_id)
            .order_by(
                InternalComment.internal_comment_id,
                # Tiebreaker: deterministic entity-type priority for comments
                # linked to multiple entities (e.g. via copy_internal_comments).
                case(
                    (TransferInternalComment.transfer_id.isnot(None), 1),
                    (
                        InitiativeAgreementInternalComment.initiative_agreement_id.isnot(
                            None
                        ),
                        2,
                    ),
                    (AdminAdjustmentInternalComment.admin_adjustment_id.isnot(None), 3),
                    (
                        ComplianceReportInternalComment.compliance_report_id.isnot(
                            None
                        ),
                        4,
                    ),
                    (CIApplicationInternalComment.ci_application_id.isnot(None), 5),
                    (OrganizationInternalComment.organization_id.isnot(None), 6),
                    else_=7,
                ),
                func.coalesce(
                    TransferInternalComment.transfer_id,
                    InitiativeAgreementInternalComment.initiative_agreement_id,
                    AdminAdjustmentInternalComment.admin_adjustment_id,
                    ComplianceReportInternalComment.compliance_report_id,
                    CIApplicationInternalComment.ci_application_id,
                    OrganizationInternalComment.organization_id,
                ),
            )
            .subquery()
        )

    @repo_handler
    async def get_comments_for_organization(
        self,
        organization_id: int,
        page: int,
        size: int,
        visibility_filter: Optional[str] = None,
        category: Optional[str] = None,
        compliance_year: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        sort_by: str = "create_date",
        sort_order: str = "desc",
    ) -> Tuple[List[dict], int]:
        """
        Paginated organization comments with live-derived org/year, server-side
        filters (category, compliance_year, date range, visibility, search) and
        sorting. Search matches the comment body: a full-text
        ``websearch_to_tsquery('english', ...)`` predicate plus case-insensitive
        substring / punctuation-insensitive matching against the HTML-stripped
        ``comment`` column (the source of truth). With
        ``category='Organization details'`` it also matches
        ``organization.name``/``operating_name``, and with ``category='Person'``
        it also matches the author's name / email.
        """
        entity_meta = self._entity_meta_subquery(organization_id)

        where_clauses = []
        if visibility_filter:
            where_clauses.append(InternalComment.visibility == visibility_filter)
        if compliance_year is not None:
            where_clauses.append(
                func.coalesce(entity_meta.c.live_year, InternalComment.compliance_year)
                == compliance_year
            )
        if date_from is not None:
            lower = (
                datetime.combine(date_from, time.min)
                if isinstance(date_from, date) and not isinstance(date_from, datetime)
                else date_from
            )
            where_clauses.append(InternalComment.create_date >= lower)
        if date_to is not None:
            upper = (
                datetime.combine(date_to, time.max)
                if isinstance(date_to, date) and not isinstance(date_to, datetime)
                else date_to
            )
            where_clauses.append(InternalComment.create_date <= upper)
        if category:
            where_clauses.append(CommentCategory.display_name == category)

        search_term = (search or "").strip()
        if search_term:
            tsquery = func.websearch_to_tsquery("english", search_term)
            fts_predicate = InternalComment.comment_search_vector.op("@@")(tsquery)

            ilike_term = f"%{search_term}%"
            normalized_search = _SEARCH_NORMALIZE_RE.sub("", search_term).lower()
            
            stripped_comment = func.regexp_replace(
                func.coalesce(InternalComment.comment, ""),
                r"<[^>]*>",
                " ",
                "g",
            )
            normalized_comment_text = func.regexp_replace(
                func.lower(stripped_comment),
                r"[^[:alnum:]]+",
                "",
                "g",
            )
            search_predicates = [
                fts_predicate,
                stripped_comment.ilike(ilike_term),
            ]
            if normalized_search:
                search_predicates.append(
                    normalized_comment_text.like(f"%{normalized_search}%")
                )

            if category == "Organization details":
                search_predicates.append(Organization.name.ilike(ilike_term))
                search_predicates.append(Organization.operating_name.ilike(ilike_term))
            elif category == "Person":
                search_predicates.append(UserProfile.first_name.ilike(ilike_term))
                search_predicates.append(UserProfile.last_name.ilike(ilike_term))
                search_predicates.append(
                    func.concat(
                        func.coalesce(UserProfile.first_name, ""),
                        " ",
                        func.coalesce(UserProfile.last_name, ""),
                    ).ilike(ilike_term)
                )
                search_predicates.append(UserProfile.email.ilike(ilike_term))

            where_clauses.append(or_(*search_predicates))

        full_name_col = (UserProfile.first_name + " " + UserProfile.last_name).label(
            "full_name"
        )

        sort_col = (
            InternalComment.update_date
            if sort_by == "update_date"
            else InternalComment.create_date
        )
        sort_dir = asc if str(sort_order).lower() == "asc" else desc

        offset = max(page - 1, 0) * max(size, 1)

        group_type_expr = func.coalesce(
            entity_meta.c.entity_type, sa.literal("_comment")
        )
        group_id_expr = func.coalesce(
            entity_meta.c.entity_id, InternalComment.internal_comment_id
        )
        group_type = group_type_expr.label("_group_type")
        group_id = group_id_expr.label("_group_id")

        # Window function: most recent (or oldest) comment date within each
        # entity group.  This is the conversation sort key.  Pagination happens
        # against distinct groups below, then expands all comments for those
        # selected groups so a conversation does not get split at page edges.
        group_latest = (
            func.max(sort_col)
            .over(partition_by=[group_type_expr, group_id_expr])
            .label("_group_latest")
        )

        inner_q = (
            select(
                InternalComment.internal_comment_id,
                InternalComment.comment,
                InternalComment.comment_search_text.label("plain_text_comment"),
                entity_meta.c.live_org_id.label("organization_id"),
                func.coalesce(
                    entity_meta.c.live_year, InternalComment.compliance_year
                ).label("compliance_year"),
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
                group_type,
                group_id,
                group_latest,
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
        ).subquery("inner_q")

        # Pagination is by comment so the count shown matches the rendered
        # rows.  The ordering still clusters a conversation's comments together
        # (by entity) with the most active conversations first, so threads stay
        # visually grouped within a page; a long thread may straddle a page
        # boundary, which the frontend renders as adjacent partial groups.
        total = (
            await self.db.execute(select(func.count()).select_from(inner_q))
        ).scalar_one()

        if total == 0:
            return ([], 0)

        query = (
            select(
                inner_q.c.internal_comment_id,
                inner_q.c.comment,
                inner_q.c.plain_text_comment,
                inner_q.c.organization_id,
                inner_q.c.compliance_year,
                inner_q.c.visibility,
                inner_q.c.audience_scope,
                inner_q.c.create_user,
                inner_q.c.create_date,
                inner_q.c.update_date,
                inner_q.c.organization_name,
                inner_q.c.category,
                inner_q.c.full_name,
                inner_q.c.entity_type,
                inner_q.c.entity_id,
            )
            # 1. Sort conversations by activity (group_latest).
            # 2. Keep rows in the same conversation together.
            # 3. Within each conversation, show comments oldest-first.
            .order_by(
                sort_dir(inner_q.c._group_latest),
                asc(inner_q.c.entity_type).nulls_last(),
                asc(inner_q.c.entity_id).nulls_last(),
                asc(inner_q.c.create_date),
                asc(inner_q.c.internal_comment_id),
            )
            .limit(size)
            .offset(offset)
        )

        rows = (await self.db.execute(query)).mappings().all()
        return ([dict(r) for r in rows], int(total))
