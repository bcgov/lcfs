import structlog
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from lcfs.web.exception.exceptions import ValidationErrorException
from starlette.requests import Request
from starlette.responses import JSONResponse
from lcfs.logging_config import correlation_id_var


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    standard_errors = [
        {"fields": [error["loc"][-1]], "message": error["msg"]}
        for error in exc.errors()
    ]

    return JSONResponse(
        status_code=422,
        content={
            "message": "Validation failed",
            "details": exc.errors(),  # This provides the detailed validation error
            "errors": standard_errors,  # The body of the request, if needed
        },
    )


async def validation_error_exception_handler_no_details(
    request: Request, exc: ValidationErrorException
):
    """Handler for ValidationErrorException that returns content without 'detail' wrapping"""
    return JSONResponse(status_code=422, content=exc.errors)


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
