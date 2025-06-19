from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
import structlog
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.web.api.user.repo import UserRepository
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.comment.InternalComment import InternalComment
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
        self, entity_type: EntityTypeEnum, entity_id: int
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
            .order_by(desc(InternalComment.update_date))
        )

        # Execute the query
        results = await self.db.execute(base_query)

        # Compile and return the list of internal comments with user info
        comments_with_user_info = [
            {
                "internal_comment_id": internal_comment.internal_comment_id,
                "comment": internal_comment.comment,
                "audience_scope": internal_comment.audience_scope,
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
        self, internal_comment_id: int, new_comment_text: str
    ) -> InternalComment:
        """
        Updates the text of an existing internal comment.

        Args:
            internal_comment_id (int): The ID of the internal comment to update.
            new_comment_text (str): The new text for the comment.

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

        internal_comment.comment = new_comment_text
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
        }

        entity_model, where_condition = entity_mapping[entity_type]
        query = select(entity_model.internal_comment_id).where(
            where_condition == entity_id
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]
