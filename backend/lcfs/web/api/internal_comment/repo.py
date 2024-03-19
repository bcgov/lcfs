from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select, desc

from lcfs.web.api.repo import BaseRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.InternalComment import InternalComment
from lcfs.db.models.TransferInternalComment import TransferInternalComment
from lcfs.db.models.InitiativeAgreementInternalComment import InitiativeAgreementInternalComment


logger = getLogger("internal_comment_repo")


class InternalCommentRepository(BaseRepository):
    """
    Repository class for internal comments
    """
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        """
        Initializes the repository with an asynchronous database session.

        Args:
            db (AsyncSession): Injected database session for executing asynchronous queries.
        """
        self.db = db

    @repo_handler
    async def create_internal_comment(
        self, internal_comment: InternalComment, entity_type: str, entity_id: int
    ):
        """
        Creates a new internal comment and associates it with a transfer or initiative agreement entity.

        Args:
            internal_comment (InternalComment): The internal comment object to be added to the database.
            entity_type (str): The type of entity (e.g., 'transfer' or 'initiative_agreement') the comment is associated with.
            entity_id (int): The ID of the entity the comment is associated with.

        Returns:
            InternalComment: The newly created internal comment with additional information such as 'full_name'.
        """
        self.db.add(internal_comment)
        await self.commit_to_db()
        await self.db.refresh(internal_comment)

        # Determine and create the appropriate entity association based on the provided entity type
        if entity_type == "transfer":
            association = TransferInternalComment(
                transfer_id=entity_id, internal_comment_id=internal_comment.internal_comment_id
            )
        else:
            association = InitiativeAgreementInternalComment(
                initiative_agreement_id=entity_id, internal_comment_id=internal_comment.internal_comment_id
            )

        # Add the association to the session and commit
        self.db.add(association)
        await self.commit_to_db()
        await self.db.refresh(internal_comment)

        # Update the internal comment with the creator's full name.
        internal_comment.full_name = await self._fetch_full_name(internal_comment.create_user)
        return internal_comment

    @repo_handler
    async def get_internal_comments(
        self, entity_type: str, entity_id: int
    ) -> List[InternalComment]:
        """
        Retrieves a list of internal comments associated with a specific entity, along with the full name of the user who created each comment.

        Args:
            entity_type (str): The type of entity (e.g., 'transfer' or 'initiative_agreement') to retrieve comments for.
            entity_id (int): The ID of the entity to retrieve comments for.

        Returns:
            List[dict]: A list of dictionaries containing internal comment information and the full name of the comment creator.
        """
         # Select the appropriate association model based on the entity type
        if entity_type == "transfer":
            results = await self.db.execute(
                select(
                    InternalComment,
                    (UserProfile.first_name + " " + UserProfile.last_name).label("full_name")
                )
                .join(
                    TransferInternalComment,
                    TransferInternalComment.internal_comment_id == InternalComment.internal_comment_id
                ).join(
                    UserProfile,
                    UserProfile.keycloak_username == InternalComment.create_user
                )
                .where(TransferInternalComment.transfer_id == entity_id)
                .order_by(desc(InternalComment.internal_comment_id))
            )
        else:
            results = await self.db.execute(
                select(
                    InternalComment,
                    (UserProfile.first_name + " " + UserProfile.last_name).label("full_name")
                )
                .join(
                    InitiativeAgreementInternalComment,
                    InitiativeAgreementInternalComment.internal_comment_id == InternalComment.internal_comment_id
                ).join(
                    UserProfile,
                    UserProfile.keycloak_username == InternalComment.create_user
                )
                .where(InitiativeAgreementInternalComment.initiative_agreement_id == entity_id)
                .order_by(desc(InternalComment.internal_comment_id))
            )

        # Compile and return the list of internal comments with user info
        comments_with_user_info = []
        for internal_comment, full_name in results:
            comment_data = {
                "internal_comment_id": internal_comment.internal_comment_id,
                "comment": internal_comment.comment,
                "audience_scope": internal_comment.audience_scope,
                "create_user": internal_comment.create_user,
                "create_date": internal_comment.create_date,
                "update_date": internal_comment.update_date,
                "full_name": full_name
            }
            comments_with_user_info.append(comment_data)

        return comments_with_user_info

    @repo_handler
    async def update_internal_comment(self, username: str, internal_comment_id: int, new_comment_text: str) -> InternalComment:
        """
        Updates the text of an existing internal comment.

        Args:
            username (str): The username of the user attempting to update the comment.
            internal_comment_id (int): The ID of the internal comment to update.
            new_comment_text (str): The new text for the comment.

        Returns:
            InternalComment: The updated internal comment object.

        Raises:
            DataNotFoundException: If no internal comment matching the criteria is found.
        """
        statement = select(InternalComment).where(
            and_(
                InternalComment.internal_comment_id == internal_comment_id,
                InternalComment.create_user == username
            )
        )
        result = await self.db.execute(statement)
        internal_comment = result.scalars().first()
        
        if not internal_comment:
            raise DataNotFoundException(f"Internal comment with ID {internal_comment_id} not found.")

        internal_comment.comment = new_comment_text
        await self.commit_to_db()
        await self.db.refresh(internal_comment)

        # Update the internal comment with the creator's full name.
        internal_comment.full_name = await self._fetch_full_name(internal_comment.create_user)
        return internal_comment

    async def _fetch_full_name(self, username: str) -> str:
        """
        Fetches the full name of a user based on their username.

        Args:
            username (str): Username of the user whose full name is to be fetched.

        Returns:
            str: The full name of the user.
        """
        full_name_result = await self.db.execute(
            select(
                (UserProfile.first_name + " " + UserProfile.last_name).label("full_name")
            ).where(UserProfile.keycloak_username == username)
        )
        return full_name_result.scalars().first()
