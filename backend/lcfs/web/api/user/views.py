"""
User management endpoints
"""
from logging import getLogger
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from lcfs.db.dependencies import get_db_session
from lcfs.db.models import User
from lcfs.services.keycloak.dependencies import get_current_user
from starlette.authentication import requires

logger = getLogger("user")

router = APIRouter()


@router.get("/profile")
@requires("authenticated")
def get_user_profile(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db_session)
):
    """
    returns the user
    """
    result = {
        **user.__dict__,
    }
    return result
