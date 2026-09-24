"""Portal-user search definition."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.Role import Role
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.web.api.search.entities.base import (
    RESULT_LIMIT,
    EntitySearch,
    SearchContext,
    where_present,
)
from lcfs.web.api.search.matching import (
    SearchField,
    applies,
    equals_any,
    match_context_expression,
    relevance_rank,
    search_clause,
    text_expression,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "user"
SUPPORTED_FILTERS = {"status", "user_type"}
KNOWN_AUDIENCES = {"idir", "bceid"}


async def search_users(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search portal users while preserving IDIR and supplier boundaries."""
    query = context.query
    if not applies(query, SUPPORTED_FILTERS, ENTITY_TYPE):
        return []

    requested_audiences = {value.casefold() for value in query.values("user_type")}
    audiences = requested_audiences & KNOWN_AUDIENCES
    if requested_audiences and not audiences:
        return []
    if not context.is_government and (
        context.organization_id is None or audiences == {"idir"}
    ):
        return []

    user_organization = aliased(Organization)
    full_name = UserProfile.first_name + " " + UserProfile.last_name
    user_status = case((UserProfile.is_active.is_(True), "Active"), else_="Inactive")
    roles = (
        select(func.string_agg(text_expression(Role.name), " "))
        .select_from(UserRole)
        .join(Role, UserRole.role_id == Role.role_id)
        .where(UserRole.user_profile_id == UserProfile.user_profile_id)
        .correlate(UserProfile)
        .scalar_subquery()
    )
    fields = [
        SearchField("Full name", full_name, primary=True, fuzzy=True),
        SearchField("User ID", UserProfile.user_profile_id, primary=True),
        SearchField("First name", UserProfile.first_name, primary=True),
        SearchField("Last name", UserProfile.last_name, primary=True),
        SearchField("Email", UserProfile.email, primary=True),
        SearchField("Username", UserProfile.keycloak_username, primary=True),
        SearchField("Organization", user_organization.name, primary=True),
        SearchField("Identity email", UserProfile.keycloak_email),
        SearchField("Title", UserProfile.title),
        SearchField("Phone", UserProfile.phone),
        SearchField("Mobile phone", UserProfile.mobile_phone),
        SearchField("Roles", func.coalesce(roles, "")),
        SearchField("Status", user_status, primary=True),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = UserProfile.user_profile_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = select(
        UserProfile,
        user_organization.name.label("org_name"),
        match_context,
    ).outerjoin(
        user_organization,
        UserProfile.organization_id == user_organization.organization_id,
    )
    audience_scope = None
    if context.is_government and audiences == {"idir"}:
        audience_scope = UserProfile.organization_id.is_(None)
    elif context.is_government and audiences == {"bceid"}:
        audience_scope = UserProfile.organization_id.is_not(None)
    organization_scope = (
        UserProfile.organization_id == context.organization_id
        if not context.is_government
        else None
    )
    statement = where_present(
        statement,
        clause,
        equals_any(user_status, query.values("status")),
        audience_scope,
        organization_scope,
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(
        UserProfile.is_active.desc(),
        relevance_rank(full_name, query).desc(),
        UserProfile.last_name,
    ).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for user, organization_name, matched_value in rows:
        if not context.is_government:
            route = f"/organization/users/{user.user_profile_id}"
        elif user.organization_id:
            route = (
                f"/organizations/{user.organization_id}/users/"
                f"{user.user_profile_id}"
            )
        else:
            route = f"/admin/users/{user.user_profile_id}"

        organization = organization_name
        if context.is_government and not organization:
            organization = "Government of B.C."
        details: list[SearchResultDetail] = []
        if user.email:
            details.append(SearchResultDetail(label="Email", value=user.email))
        if user.title:
            details.append(SearchResultDetail(label="Title", value=user.title))
        if organization:
            details.append(SearchResultDetail(label="Organization", value=organization))
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=user.user_profile_id,
                title=(
                    f"{user.first_name or ''} {user.last_name or ''}".strip()
                    or user.keycloak_username
                ),
                subtitle=user.email or "",
                route=route,
                status="Active" if user.is_active else "Inactive",
                meta=" · ".join(value for value in (user.title, organization) if value)
                or None,
                match_context=matched_value or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Users",
    handler=search_users,
)
