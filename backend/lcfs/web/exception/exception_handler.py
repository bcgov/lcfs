import structlog
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from lcfs.web.exception.exceptions import ValidationErrorException
from starlette.requests import Request
from starlette.responses import JSONResponse
from lcfs.logging_config import correlation_id_var


def _make_json_serializable(errors: list) -> list:
    """Convert validation errors to JSON-serializable format."""
    serializable_errors = []
    for error in errors:
        serializable_error = dict(error)
        # Convert ctx values to strings if they contain non-serializable objects
        if "ctx" in serializable_error:
            ctx = serializable_error["ctx"]
            if isinstance(ctx, dict):
                serializable_error["ctx"] = {
                    k: (
                        str(v)
                        if not isinstance(
                            v, (str, int, float, bool, type(None), list, dict)
                        )
                        else v
                    )
                    for k, v in ctx.items()
                }
        serializable_errors.append(serializable_error)
    return serializable_errors


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    standard_errors = [
        {"fields": [error["loc"][-1]], "message": error["msg"]} for error in errors
    ]

    return JSONResponse(
        status_code=422,
        content={
            "message": "Validation failed",
            "details": _make_json_serializable(
                errors
            ),  # This provides the detailed validation error
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
