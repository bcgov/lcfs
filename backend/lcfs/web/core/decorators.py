import inspect
from functools import wraps
from logging import getLogger
from typing import List, Union, Literal
import warnings

from fastapi import HTTPException, Request

from lcfs.services.clamav.client import VirusScanException
from lcfs.web.exception.exceptions import (
    ServiceException,
    DatabaseException,
    DataNotFoundException,
)
from lcfs.db.models.user.Role import RoleEnum


def custom_formatwarning(message, category, filename, lineno, line=None):
    # Yellow text for the warning
    return f"\033[93m{filename}:{lineno}: {category.__name__}: {message}\033[0m\n"


warnings.formatwarning = custom_formatwarning


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
            logger = getLogger(func.__module__)
            user = getattr(request, "user", None)

            # check if user is authenticated
            if not user:
                raise HTTPException(status_code=401, detail="User not authenticated")

            # check if the endpoint can be accessed
            if "*" in required_roles:
                warnings.warn("This endpoint is accessible by all roles")
            else:
                user_roles = user.role_names

                # Check if user has all the required roles
                if not any(role in user_roles for role in required_roles):
                    raise HTTPException(
                        status_code=403, detail="Insufficient permissions"
                    )

                orgId = kwargs.get("organization_id", None)
                if (
                    RoleEnum.SUPPLIER in user_roles
                    and orgId
                    and int(orgId) != user.organization_id
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions for this organization",
                    )

            # run through the view function
            try:
                return await func(request, *args, **kwargs)
            except ValueError as e:
                logger.error(str(e))
                raise HTTPException(status_code=400, detail=str(e))
            except (DatabaseException, ServiceException) as e:
                logger.error(str(e))
                raise HTTPException(status_code=500, detail="Internal Server Error")
            except HTTPException as e:
                logger.error(str(e))
                if e.status_code == 403:
                    raise HTTPException(status_code=404, detail="Not Found")
                raise
            except DataNotFoundException:
                raise HTTPException(status_code=404, detail="Not Found")
            except VirusScanException:
                raise HTTPException(
                    status_code=422,
                    detail="Viruses detected in file, please upload another",
                )
            except Exception as e:
                file_path = inspect.getfile(func)
                func_name = func.__name__
                logger.error(
                    f"""View error in {func_name} (file: {
                             file_path}) - {e}""",
                    exc_info=True,
                )
                raise HTTPException(status_code=500, detail="Internal Server Error")

        return wrapper

    return decorator


def service_handler(func):
    """Handles try except in the service layer"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = getLogger(func.__module__)
        try:
            return await func(*args, **kwargs)

        # raise the error to the view layer
        except (DatabaseException, HTTPException, DataNotFoundException):
            raise
        # all other errors that occur in the service layer will log an error
        except Exception as e:
            file_path = inspect.getfile(func)
            func_name = func.__name__
            logger.error(
                f"""Service error in {func_name} (file: {
                         file_path}) - {e}""",
                exc_info=True,
            )
            raise ServiceException

    return wrapper


def repo_handler(func):
    """Handles try except in the repo layer"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = getLogger(func.__module__)
        try:
            return await func(*args, **kwargs)
        # raise the error to the service layer
        except (HTTPException, DataNotFoundException, VirusScanException):
            raise
        # all exceptions will trigger a DatabaseError and cause a 500 response in the view layer
        except Exception as e:
            file_path = inspect.getfile(func)
            func_name = func.__name__
            logger.error(
                f"""Repo error in {func_name} (file: {
                         file_path}) - {e}""",
                exc_info=True,
            )
            raise DatabaseException from e  # Preserve the original exception

    return wrapper
