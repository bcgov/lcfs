from fastapi.routing import APIRouter

from lcfs.web.api import (
    echo,
    monitoring,
    redis,
    user,
    role,
    notification,
    organization,
    organizations,
    transfer,
    transaction,
)

api_router = APIRouter()
api_router.include_router(monitoring.router)
api_router.include_router(
    transaction.router, prefix="/transactions", tags=["transactions"]
)
api_router.include_router(transfer.router, prefix="/transfers", tags=["transfers"])
api_router.include_router(echo.router, prefix="/echo", tags=["echo"])
api_router.include_router(redis.router, prefix="/redis", tags=["redis"])
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(role.router, prefix="/roles", tags=["roles"])
api_router.include_router(
    notification.router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(
    organizations.router, prefix="/organizations", tags=["organizations"]
)
api_router.include_router(
    organization.router, prefix="/organization", tags=["organization"]
)
