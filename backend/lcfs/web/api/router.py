from fastapi.routing import APIRouter

from lcfs.web.api import echo, monitoring, redis, user

api_router = APIRouter()
api_router.include_router(monitoring.router)
api_router.include_router(echo.router, prefix="/echo", tags=["echo"])
api_router.include_router(redis.router, prefix="/redis", tags=["redis"])
api_router.include_router(user.router, prefix="/user", tags=["user"])
