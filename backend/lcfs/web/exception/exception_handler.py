from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from lcfs.web.exception.exceptions import ValidationErrorException
from starlette.requests import Request
from starlette.responses import JSONResponse


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

async def validation_error_exception_handler_no_details(request: Request, exc: ValidationErrorException):
    """Handler for ValidationErrorException that returns content without 'detail' wrapping"""
    return JSONResponse(
        status_code=422,
        content=exc.errors
    )
