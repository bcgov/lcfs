from importlib import metadata
import logging

import os
import debugpy
import colorlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import UJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.authentication import AuthenticationBackend, AuthCredentials, UnauthenticatedUser
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from lcfs.web.api.router import api_router
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.web.lifetime import register_shutdown_event, register_startup_event

write some junk
# Create a colorized log formatter
log_formatter = colorlog.ColoredFormatter(
    "%(log_color)s[%(levelname)s] [%(asctime)s]  %(name)s.%(funcName)s - %(message)s",
    log_colors={
        'DEBUG': 'cyan',
        'INFO': 'green',
        'WARNING': 'yellow',
        'ERROR': 'red',
        'CRITICAL': 'bold_red'
    }
)

# Create a colorized console handler with the formatter
console_handler = colorlog.StreamHandler()
console_handler.setFormatter(log_formatter)

# Configure the root logger with the console handler
root_logger = logging.getLogger()
root_logger.addHandler(console_handler)
root_logger.setLevel(logging.DEBUG)

origins = [
    "http://localhost",
    "http://localhost:3000",
    "https://lcfs-dev.apps.silver.devops.gov.bc.ca",
    "https://lcfs-test.apps.silver.devops.gov.bc.ca",
    "https://lcfs.apps.silver.devops.gov.bc.ca",
]

class MiddlewareExceptionWrapper(BaseHTTPMiddleware):
    """
    Catches HTTP exceptions from other middlewares, returns JSON responses, and adds CORS headers.
    """
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except HTTPException as exc:
            response = JSONResponse(
                status_code=exc.status_code,
                content={
                    "status" : exc.status_code,
                    "detail": exc.detail
                }
            )

            # Check if the request origin is in the allowed origins
            request_origin = request.headers.get("origin")
            if request_origin in origins:
                response.headers["Access-Control-Allow-Origin"] = request_origin

            return response

class LazyAuthenticationBackend(AuthenticationBackend):
    def __init__(self, app):
        self.app = app

    async def authenticate(self, request):
        if request.scope['method'] == "OPTIONS":
            return AuthCredentials([]), UnauthenticatedUser()
        
        # Lazily retrieve Redis, session, and settings from app state
        redis_pool = self.app.state.redis_pool
        session = self.app.state.db_session_factory
        settings = self.app.state.settings

        # Now that we have the dependencies, we can instantiate the real backend
        real_backend = UserAuthentication(redis_pool=redis_pool, session=session, settings=settings)
        
        # Call the authenticate method of the real backend
        return await real_backend.authenticate(request)


def get_app() -> FastAPI:
    """
    Get FastAPI application.

    This is the main constructor of an application.

    :return: application.
    """
    # Check if the application is running in development environment
    # This allows for debug attachment from outside our docker container
    # if os.getenv('APP_ENVIRONMENT') == 'dev':
    #     debugpy.listen(('0.0.0.0', 5678))
    #     print("⏳ Waiting for debugger attach on port 5678...")
    #     debugpy.wait_for_client()

    # Create the fastapi instance
    app = FastAPI(
        title="LCFS Backend API Development",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        default_response_class=UJSONResponse,
    )

    # Set up CORS middleware options
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,  # Allows all origins from localhost:3000
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
        expose_headers=["Content-Disposition"],  # Expose Content-Disposition header to the frontend
    )

    # Apply custom authentication handler for user injection purposes
    app.add_middleware(AuthenticationMiddleware, backend=LazyAuthenticationBackend(app))
    app.add_middleware(MiddlewareExceptionWrapper)

    # Adds prometheus metrics instrumentation.
    Instrumentator().instrument(app).expose(app)

    # Adds startup and shutdown events.
    register_startup_event(app)
    register_shutdown_event(app)

    # Main router for the API.
    app.include_router(router=api_router, prefix="/api")

    return app
