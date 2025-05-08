import logging
import os
import debugpy
import uuid

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import UJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.authentication import (
    AuthenticationBackend,
    AuthCredentials,
    UnauthenticatedUser,
)
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from lcfs.logging_config import setup_logging, correlation_id_var
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.settings import settings
from lcfs.web.api.router import api_router
from lcfs.web.exception.exceptions import ValidationErrorException
from lcfs.web.exception.exception_handler import (
    validation_error_exception_handler_no_details,
    validation_exception_handler,
)
from lcfs.web.lifetime import register_shutdown_event, register_startup_event

origins = [
    "http://localhost",
    "http://localhost:3000",
    "https://lcfs-dev.apps.silver.devops.gov.bc.ca",
    "https://lcfs-dev-2498.apps.silver.devops.gov.bc.ca",
    "https://lcfs-test.apps.silver.devops.gov.bc.ca",
    "https://lcfs-prod.apps.silver.devops.gov.bc.ca",
    "https://lcfs.apps.silver.devops.gov.bc.ca",
    "https://lowcarbonfuels.gov.bc.ca",
]


class MiddlewareExceptionWrapper(BaseHTTPMiddleware):
    """
    Catches HTTP exception from other middlewares, returns JSON responses, and adds CORS headers.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except HTTPException as exc:
            response = JSONResponse(
                status_code=exc.status_code,
                content={"status": exc.status_code, "detail": exc.detail},
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
        if request.scope["method"] == "OPTIONS":
            return AuthCredentials([]), UnauthenticatedUser()

        if (
            request.url.path.startswith("/api/calculator")
            or request.url.path == "/api/health"
        ):  # Skip authentication check
            return AuthCredentials([]), UnauthenticatedUser()

        # Lazily retrieve Redis, session, and settings from app state
        redis_client = self.app.state.redis_client
        session_factory = self.app.state.db_session_factory
        settings = self.app.state.settings

        # Now that we have the dependencies, we can instantiate the real backend
        real_backend = UserAuthentication(
            redis_client=redis_client,
            session_factory=session_factory,
            settings=settings,
        )

        # Call the authenticate method of the real backend
        return await real_backend.authenticate(request)


# Middleware to handle correlation IDs
class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        correlation_id_var.set(correlation_id)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response


# Middleware to set context variables
class ContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.correlation_id = correlation_id_var.get()
        response = await call_next(request)
        return response


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

    # Map the string log level to the logging module's integer constants
    log_level = getattr(logging, settings.log_level.value.upper(), logging.DEBUG)
    setup_logging(level=log_level)

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
        expose_headers=[
            "Content-Disposition"
        ],  # Expose Content-Disposition header to the frontend
    )

    # Apply middlewares
    app.add_middleware(AuthenticationMiddleware, backend=LazyAuthenticationBackend(app))
    app.add_middleware(MiddlewareExceptionWrapper)
    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(ContextMiddleware)

    # Register exception handlers
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(
        ValidationErrorException, validation_error_exception_handler_no_details
    )
    app.add_exception_handler(Exception, global_exception_handler)

    # Adds prometheus metrics instrumentation.
    Instrumentator().instrument(app).expose(app)

    # Adds startup and shutdown events.
    register_startup_event(app)
    register_shutdown_event(app)

    # Main router for the API.
    app.include_router(router=api_router, prefix="/api")

    return app


async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger = structlog.get_logger(__name__)
    logger.error(
        "Unhandled exception",
        error=str(exc),
        exc_info=True,
        request_url=str(request.url),
        method=request.method,
        headers=dict(request.headers),
        correlation_id=correlation_id_var.get(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )
