import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.role_domains import validate_seed_user_roles


ROLE_ID_TO_ENUM = {
    1: RoleEnum.GOVERNMENT,
    2: RoleEnum.SUPPLIER,
    3: RoleEnum.ADMINISTRATOR,
    4: RoleEnum.ANALYST,
    5: RoleEnum.COMPLIANCE_MANAGER,
    6: RoleEnum.DIRECTOR,
    7: RoleEnum.MANAGE_USERS,
    8: RoleEnum.TRANSFER,
    9: RoleEnum.COMPLIANCE_REPORTING,
    10: RoleEnum.SIGNING_AUTHORITY,
    11: RoleEnum.READ_ONLY,
    12: RoleEnum.CI_APPLICANT,
    13: RoleEnum.IA_PROPONENT,
    14: RoleEnum.SYSTEM_ADMIN,
    15: RoleEnum.IA_ANALYST,
    16: RoleEnum.IA_MANAGER,
}


def test_validate_seed_user_roles_accepts_valid_mixed_population():
    profiles = [
        {"user_profile_id": 100, "organization_id": None},
        {"user_profile_id": 200, "organization_id": 999},
    ]
    roles = [
        {"user_profile_id": 100, "role_id": 1},
        {"user_profile_id": 100, "role_id": 4},
        {"user_profile_id": 200, "role_id": 2},
        {"user_profile_id": 200, "role_id": 8},
    ]
    validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)


def test_validate_seed_user_roles_rejects_gov_user_with_org_role():
    profiles = [{"user_profile_id": 100, "organization_id": None}]
    roles = [
        {"user_profile_id": 100, "role_id": 1},
        {"user_profile_id": 100, "role_id": 8},
    ]
    with pytest.raises(ValueError, match="not allowed for government user"):
        validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)


def test_validate_seed_user_roles_rejects_org_user_with_gov_role():
    profiles = [{"user_profile_id": 200, "organization_id": 55}]
    roles = [
        {"user_profile_id": 200, "role_id": 2},
        {"user_profile_id": 200, "role_id": 4},
    ]
    with pytest.raises(ValueError, match="not allowed for org user"):
        validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)


def test_validate_seed_user_roles_rejects_missing_base_role():
    gov_profiles = [{"user_profile_id": 100, "organization_id": None}]
    gov_roles = [{"user_profile_id": 100, "role_id": 4}]
    with pytest.raises(ValueError, match="missing base role GOVERNMENT"):
        validate_seed_user_roles(gov_profiles, gov_roles, ROLE_ID_TO_ENUM)

    org_profiles = [{"user_profile_id": 200, "organization_id": 1}]
    org_roles = [{"user_profile_id": 200, "role_id": 8}]
    with pytest.raises(ValueError, match="missing base role SUPPLIER"):
        validate_seed_user_roles(org_profiles, org_roles, ROLE_ID_TO_ENUM)


def test_validate_seed_user_roles_rejects_unknown_role_id_and_user_id():
    profiles = [{"user_profile_id": 100, "organization_id": None}]
    roles = [
        {"user_profile_id": 9999, "role_id": 1},
        {"user_profile_id": 100, "role_id": 12345},
    ]
    with pytest.raises(ValueError, match="unknown user_profile_id"):
        validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)
