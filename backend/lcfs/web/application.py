from importlib import metadata
import logging

import colorlog
from fastapi import FastAPI
from fastapi.responses import UJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from lcfs.web.api.router import api_router
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
