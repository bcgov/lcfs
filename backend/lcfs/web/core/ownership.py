"""Authorize writes against the stored record.

A write is authorized by what the database says a record is: whose it is,
and which report or parent it hangs off. Identifiers, organizations and
statuses sent in the request body are claims, not facts. These helpers are
that one rule, so each route states it the same way.

A record the caller may not touch reads as missing (404), not forbidden, so
a guessed identifier does not confirm that something exists.
"""

from fastapi import HTTPException
from sqlalchemy import delete
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.role.schema import user_has_roles


def is_government_user(user) -> bool:
    return user is not None and user_has_roles(user, [RoleEnum.GOVERNMENT])


def ensure_owned_by(user, organization_id, *, allow_government=True) -> None:
    """404 unless the record belongs to the caller's organization.

    Government users pass when *allow_government* is set, which is right for
    records IDIR staff administer and wrong for records only the owner edits.
    """
    if allow_government and is_government_user(user):
        return
    user_organization_id = getattr(user, "organization_id", None)
    if organization_id is None or user_organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


def ensure_matches(stored, sent, *, field: str) -> None:
    """400 when the body names a different record than the one authorized.

    An absent value (None) is fine: the stored one is used.
    """
    if sent is not None and sent != stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} does not match the record being updated.",
        )


async def delete_one(db, model, **scope) -> None:
    """Delete the single row matching every column in *scope*; 404 otherwise.

    Scope by the primary key and by what the caller was authorized for (the
    validated report, the row's group), so a row ID from somewhere else
    deletes nothing.
    """
    if not scope:
        raise ValueError("delete_one needs at least one column to scope by")
    result = await db.execute(
        delete(model).where(
            *(getattr(model, column) == value for column, value in scope.items())
        )
    )
    if result.rowcount != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found."
        )
