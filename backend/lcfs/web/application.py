from importlib import metadata

from fastapi import FastAPI
from fastapi.responses import UJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from lcfs.web.api.router import api_router
from lcfs.web.lifetime import register_shutdown_event, register_startup_event


def get_app() -> FastAPI:
    """
    Get FastAPI application.

    This is the main constructor of an application.

    :return: application.
    """
    app = FastAPI(
        title="lcfs",
        version=metadata.version("lcfs"),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        default_response_class=UJSONResponse,
    )

    # Adds prometheus metrics instrumentation.
    Instrumentator().instrument(app).expose(app)

    # Adds startup and shutdown events.
    register_startup_event(app)
    register_shutdown_event(app)

    # Main router for the API.
    app.include_router(router=api_router, prefix="/api")

    return app
