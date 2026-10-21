import re

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.comment.CommentCategory import CommentCategory
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.OrganizationInternalComment import (
    OrganizationInternalComment,
)
from lcfs.db.models.comment.TransferInternalComment import TransferInternalComment
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer

logger = structlog.get_logger(__name__)

COMMENT_AUTHOR = "ALZORKIN"

COMMENT_DATA = (
    {
        "entity_type": "organization",
        "entity_id": 1,
        "association_model": OrganizationInternalComment,
        "association_entity_key": "organization_id",
        "category": "Company Overview",
        "audience_scope": "Analyst",
        "comment": (
            "<p>Development note: review the supporting documents before "
            "confirming the account details.</p>"
            "<p>The current contact information is <strong>ready for review</strong>.</p>"
        ),
    },
    {
        "entity_type": "transfer",
        "entity_id": 1,
        "association_model": TransferInternalComment,
        "association_entity_key": "transfer_id",
        "category": "Transfer notes",
        "audience_scope": "Analyst",
        "comment": (
            "<p>Development note: confirm the delivery date and supporting "
            "records before approval.</p>"
            "<ul><li>Check the effective date.</li>"
            "<li>Confirm the counterparty details.</li></ul>"
        ),
    },
    {
        "entity_type": "transfer",
        "entity_id": 1,
        "association_model": TransferInternalComment,
        "association_entity_key": "transfer_id",
        "category": "Transfer notes",
        "audience_scope": "Director",
        "comment": (
            "<p>Development note: analyst review is complete and the "
            "recommendation is ready for director review.</p>"
        ),
    },
)


def _plain_text(comment: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", comment)).strip()


async def _get_organization_id(session: AsyncSession, data: dict) -> int:
    if data["entity_type"] == "organization":
        organization_id = await session.scalar(
            select(Organization.organization_id).where(
                Organization.organization_id == data["entity_id"]
            )
        )
    else:
        organization_id = await session.scalar(
            select(Transfer.to_organization_id).where(
                Transfer.transfer_id == data["entity_id"]
            )
        )

    if organization_id is None:
        raise ValueError(
            f"Development {data['entity_type']} {data['entity_id']} "
            "must be seeded before comments."
        )
    return organization_id


async def _seed_comment(session: AsyncSession, data: dict) -> int | None:
    category_id = await session.scalar(
        select(CommentCategory.comment_category_id).where(
            CommentCategory.display_name == data["category"]
        )
    )
    if category_id is None:
        raise ValueError(f"Comment category {data['category']!r} is missing.")

    association_model = data["association_model"]
    association_entity_id = getattr(
        association_model, data["association_entity_key"]
    )
    existing_id = await session.scalar(
        select(InternalComment.internal_comment_id)
        .join(
            association_model,
            association_model.internal_comment_id
            == InternalComment.internal_comment_id,
        )
        .where(
            association_entity_id == data["entity_id"],
            InternalComment.comment_category_id == category_id,
            InternalComment.audience_scope == data["audience_scope"],
            InternalComment.create_user == COMMENT_AUTHOR,
        )
    )
    if existing_id is not None:
        return None

    organization_id = await _get_organization_id(session, data)
    search_text = _plain_text(data["comment"])
    comment = InternalComment(
        comment=data["comment"],
        audience_scope=data["audience_scope"],
        visibility="Internal",
        organization_id=organization_id,
        comment_category_id=category_id,
        comment_search_text=search_text,
        comment_search_vector=func.to_tsvector("english", search_text),
        create_user=COMMENT_AUTHOR,
        update_user=COMMENT_AUTHOR,
    )
    session.add(comment)
    await session.flush()

    session.add(
        association_model(
            **{
                data["association_entity_key"]: data["entity_id"],
                "internal_comment_id": comment.internal_comment_id,
            }
        )
    )
    return comment.internal_comment_id


async def seed_comments(session: AsyncSession) -> None:
    """Seed reusable organization and transfer comments for local development."""
    try:
        seeded_ids = []
        for data in COMMENT_DATA:
            comment_id = await _seed_comment(session, data)
            if comment_id is not None:
                seeded_ids.append(comment_id)

        logger.info(
            "Development comments seeded",
            inserted_count=len(seeded_ids),
            internal_comment_ids=seeded_ids,
        )
    except Exception as e:
        logger.error(
            "Error occurred while seeding development comments",
            error=str(e),
            exc_info=e,
            function="seed_comments",
        )
        raise
