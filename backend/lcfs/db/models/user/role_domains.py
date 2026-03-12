from collections import defaultdict
from typing import Any

from lcfs.db.models.user.Role import RoleEnum


GOVERNMENT_ROLE_SET: set[RoleEnum] = {
    RoleEnum.GOVERNMENT,
    RoleEnum.ADMINISTRATOR,
    RoleEnum.ANALYST,
    RoleEnum.COMPLIANCE_MANAGER,
    RoleEnum.DIRECTOR,
    RoleEnum.SYSTEM_ADMIN,
    RoleEnum.IA_ANALYST,
    RoleEnum.IA_MANAGER,
}

ORG_ROLE_SET: set[RoleEnum] = {
    RoleEnum.SUPPLIER,
    RoleEnum.MANAGE_USERS,
    RoleEnum.TRANSFER,
    RoleEnum.COMPLIANCE_REPORTING,
    RoleEnum.SIGNING_AUTHORITY,
    RoleEnum.READ_ONLY,
    RoleEnum.CI_APPLICANT,
    RoleEnum.IA_PROPONENT,
}


def is_government_seed_user(profile_seed_row: dict[str, Any]) -> bool:
    return profile_seed_row.get("organization_id") is None


def validate_seed_user_roles(
    profile_seed_rows: list[dict[str, Any]],
    role_seed_rows: list[dict[str, Any]],
    role_id_to_enum: dict[int, RoleEnum],
) -> None:
    user_type_by_id: dict[int, str] = {}
    assigned_roles: dict[int, set[RoleEnum]] = defaultdict(set)
    errors: list[str] = []

    for profile in profile_seed_rows:
        profile_id = profile.get("user_profile_id")
        if profile_id is None:
            continue
        profile_id_int = int(profile_id)
        user_type_by_id[profile_id_int] = (
            "government" if is_government_seed_user(profile) else "org"
        )

    for role_row in role_seed_rows:
        profile_id = int(role_row.get("user_profile_id"))
        role_id = int(role_row.get("role_id"))

        if profile_id not in user_type_by_id:
            errors.append(
                f"user_profile_id={profile_id} role_id={role_id}: unknown user_profile_id"
            )
            continue

        if role_id not in role_id_to_enum:
            errors.append(
                f"user_profile_id={profile_id} role_id={role_id}: unknown role_id"
            )
            continue

        role_enum = role_id_to_enum[role_id]
        user_type = user_type_by_id[profile_id]
        allowed_roles = (
            GOVERNMENT_ROLE_SET if user_type == "government" else ORG_ROLE_SET
        )
        if role_enum not in allowed_roles:
            errors.append(
                f"user_profile_id={profile_id} role_id={role_id} role={role_enum.name}: "
                f"role not allowed for {user_type} user"
            )
            continue

        assigned_roles[profile_id].add(role_enum)

    for profile_id, user_type in user_type_by_id.items():
        roles_for_user = assigned_roles.get(profile_id, set())
        if user_type == "government" and RoleEnum.GOVERNMENT not in roles_for_user:
            errors.append(
                f"user_profile_id={profile_id}: government user missing base role GOVERNMENT"
            )
        if user_type == "org" and RoleEnum.SUPPLIER not in roles_for_user:
            errors.append(
                f"user_profile_id={profile_id}: org user missing base role SUPPLIER"
            )

    if errors:
        raise ValueError(
            "Invalid seeded role assignments detected:\n- " + "\n- ".join(errors)
        )
