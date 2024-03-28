import pytest
from unittest.mock import AsyncMock
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker

from lcfs.web.api.internal_comment.repo import InternalCommentRepository
from lcfs.web.api.user.repo import UserRepository

from lcfs.web.api.internal_comment.services import InternalCommentService

from lcfs.tests.internal_comment.internal_comment_payloads import (
    intenal_comment_create_payload
)

@pytest.fixture
def internal_comment_repo(dbsession):
    return InternalCommentRepository(db=dbsession)

@pytest.fixture
def internal_comment_service(internal_comment_repo):
    return InternalCommentService(repo=internal_comment_repo)

# Tests for create_internal_comment
@pytest.mark.anyio
async def test_create_internal_comment_success(internal_comment_service, internal_comment_repo):
    created_internal_comment = await internal_comment_service.create_internal_comment(intenal_comment_create_payload)
    assert created_internal_comment.comment == intenal_comment_create_payload.comment

# Tests for get_internal_comments
@pytest.mark.anyio
async def test_get_internal_comments_success(internal_comment_service, internal_comment_repo):
    pass

# Tests for get_internal_comment_by_id
@pytest.mark.anyio
async def test_get_internal_comment_by_id_success(internal_comment_service, internal_comment_repo):
    pass

# Tests for update_internal_comment
@pytest.mark.anyio
async def test_update_internal_comment_success(internal_comment_service, internal_comment_repo):
    pass
