import structlog
import sys
import traceback
import inspect
from functools import wraps
from typing import List, Union, Literal
import warnings
import contextvars
import os

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError

from lcfs.services.clamav.client import VirusScanException
from lcfs.web.exception.exceptions import (
    ServiceException,
    DatabaseException,
    DataNotFoundException,
    ValidationErrorException,
)
from lcfs.db.models.user.Role import RoleEnum

# Context variables
request_var = contextvars.ContextVar("request")
user_var = contextvars.ContextVar("user")
session_var = contextvars.ContextVar("session")


def extract_context():
    """Extract context for logging."""
    frame = sys._getframe(3)
    local_vars = {k: repr(v) for k, v in frame.f_locals.items()}
    request = request_var.get(None)
    user = user_var.get(None)
    session = session_var.get(None)
    return {
        "local_vars": local_vars,
        "request": {
            "url": str(request.url) if request else None,
            "method": request.method if request else None,
            "headers": dict(request.headers) if request else None,
        },
        "user": {
            "id": user.user_profile_id if user else None,
            "roles": user.role_names if user else [],
        },
        "session_state": repr(session) if session else "No session",
    }


async def get_request_payload(request):
    """Helper function to get the request payload."""
    request_payload = None
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            request_payload = await request.json()
        except Exception:
            pass
    return request_payload


def get_source_info(func=None, e=None):
    """Helper function to get source information for logging."""
    if func:
        pathname = inspect.getfile(func)
        linenumber = inspect.getsourcelines(func)[1]
        function_name = func.__name__
    elif e:
        tb = e.__traceback__
        frames = traceback.extract_tb(tb)
        # Reverse frames to start from the deepest call
        frames = frames[::-1]
        # Skip frames from 'decorators.py'
        for frame in frames:
            if "decorators.py" not in frame.filename:
                pathname = frame.filename
                function_name = frame.name
                linenumber = frame.lineno
                break
        else:
            # If all frames are in 'decorators.py', use the last frame
            frame = frames[-1]
            pathname = frame.filename
            function_name = frame.name
            linenumber = frame.lineno
    else:
        return {}
    return {
        "pathname": pathname,
        "func_name": function_name,
        "lineno": linenumber,
    }


def log_unhandled_exception(logger, e, context, layer_name, func=None):
    """Helper function to log unhandled exceptions with correct traceback."""
    source_info = get_source_info(func=func, e=e)
    logger.error(
        f"Unhandled exception in {layer_name}",
        error=str(e),
        exc_info=True,
        source_info=source_info,
        **context,
    )


def view_handler(required_roles: List[Union[RoleEnum, Literal["*"]]]):
    """Handles try except in the view layer"""

    # check if required roles argument was passed
    if not required_roles or not isinstance(required_roles, list):
        raise ValueError("required_roles must be a non-empty list")

    # check if a valid role was passed
    for role in required_roles:
        if role != "*" and not isinstance(role, RoleEnum):
            raise ValueError(f"Invalid role: {role}. Must be RoleEnum or '*'")

    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            logger = structlog.get_logger(func.__module__)
            request_var.set(request)
            user = getattr(request, "user", None)
            user_var.set(user)
            session = (
                request.state.session if hasattr(request.state, "session") else None
            )
            session_var.set(session)

            # check if user is authenticated
            if not user:
                raise HTTPException(status_code=401, detail="User not authenticated")

            # check if the endpoint can be accessed
            if "*" in required_roles:
                logger.warn(
                    f"Endpoint {request.method} {request.url.path} is accessible by all roles"
                )
            else:
                user_roles = user.role_names
                # Check if user has all the required roles
                if not any(
                    required_role in user_roles for required_role in required_roles
                ):
                    raise HTTPException(
                        status_code=403, detail="Insufficient permissions"
                    )

                org_id = kwargs.get("organization_id", None)
                if (
                    RoleEnum.SUPPLIER in user_roles
                    and org_id
                    and int(org_id) != user.organization_id
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions for this organization",
                    )

            # run through the view function
            try:
                return await func(request, *args, **kwargs)
            except ValueError as e:
                source_info = get_source_info(func=func)
                logger.error(
                    str(e),
                    source_info=source_info,
                    exc_info=e,
                )
                raise HTTPException(status_code=400, detail=str(e))
            except (DatabaseException, ServiceException) as e:
                source_info = get_source_info(func=func)
                logger.error(
                    str(e),
                    source_info=source_info,
                    exc_info=e,
                )
                raise HTTPException(status_code=500, detail="Internal Server Error")
            except HTTPException as e:
                source_info = get_source_info(func=func)
                logger.error(
                    str(e),
                    source_info=source_info,
                    exc_info=e,
                )
                if e.status_code == 403:
                    raise HTTPException(status_code=403, detail="Forbidden resource")
                raise
            except DataNotFoundException:
                raise HTTPException(status_code=404, detail="Not Found")
            except VirusScanException:
                raise HTTPException(
                    status_code=422,
                    detail="Viruses detected in file, please upload another",
                )
            except RequestValidationError as e:
                raise e
            except ValidationErrorException as e:
                # Log the error but re-raise it so the registered exception handler handles it
                source_info = get_source_info(func=func)
                logger.error(
                    str(e),
                    source_info=source_info,
                    exc_info=e,
                )
                raise
            except Exception as e:
                context = extract_context()
                log_unhandled_exception(logger, e, context, "view", func=func)
                # Raise HTTPException with original traceback
                new_exception = HTTPException(
                    status_code=500, detail="Internal Server Error"
                )
                raise new_exception.with_traceback(e.__traceback__)

        return wrapper

    return decorator


def service_handler(func):
    """Handles try except in the service layer"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = structlog.get_logger(func.__module__)
        try:
            return await func(*args, **kwargs)

        # raise the error to the view layer
        except (
            DatabaseException,
            HTTPException,
            DataNotFoundException,
            ServiceException,
            ValueError,
            ValidationErrorException,
            RequestValidationError,
        ):
            raise
        # all other errors that occur in the service layer will log an error
        except Exception as e:
            context = extract_context()
            log_unhandled_exception(logger, e, context, "service", func=func)
            # Raise ServiceException with original traceback
            new_exception = ServiceException()
            raise new_exception.with_traceback(e.__traceback__) from e

    return wrapper


def repo_handler(func):
    """Handles try except in the repo layer"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = structlog.get_logger(func.__module__)
        try:
            return await func(*args, **kwargs)
        # raise the error to the service layer
        except (HTTPException, DataNotFoundException, VirusScanException):
            raise
        # all exceptions will trigger a DatabaseError and cause a 500 response in the view layer
        except Exception as e:
            context = extract_context()
            log_unhandled_exception(logger, e, context, "repository", func=func)
            # Raise DatabaseException with original traceback
            new_exception = DatabaseException()
            raise new_exception.with_traceback(e.__traceback__) from e

    return wrapper
