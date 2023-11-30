from importlib import metadata
import logging

import colorlog
from fastapi import FastAPI
from fastapi.responses import UJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.authentication import AuthenticationBackend, AuthCredentials, UnauthenticatedUser

from lcfs.web.api.router import api_router
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.web.lifetime import register_shutdown_event, register_startup_event

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
root_logger.setLevel(logging.INFO)


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
    app = FastAPI(
        title="LCFS Backend API Development",
        version=metadata.version("lcfs"),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        default_response_class=UJSONResponse,
    )

    origins = [
        "http://localhost",
        "http://localhost:3000",
    ]

    # Set up CORS middleware options
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,  # Allows all origins from localhost:3000
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )

    # Apply custom authentication handler for user injection purposes
    app.add_middleware(AuthenticationMiddleware, backend=LazyAuthenticationBackend(app))

    # Adds prometheus metrics instrumentation.
    Instrumentator().instrument(app).expose(app)

    # Adds startup and shutdown events.
    register_startup_event(app)
    register_shutdown_event(app)

    # Main router for the API.
    app.include_router(router=api_router, prefix="/api")

    return app
