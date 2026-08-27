import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.role_domains import (
    GOVERNMENT_ROLE_SET,
    ORG_ROLE_SET,
    validate_seed_user_roles,
)


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
    17: RoleEnum.IA_SIGNER,
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


def test_ia_roles_belong_to_exactly_one_domain():
    """
    Every IA role must sit in a domain set. IA_SIGNER sat in neither, so
    seeding one raised "role not allowed for org user".
    """
    ia_roles = {
        RoleEnum.IA_PROPONENT,
        RoleEnum.IA_ANALYST,
        RoleEnum.IA_MANAGER,
        RoleEnum.IA_SIGNER,
    }
    for role in ia_roles:
        in_government = role in GOVERNMENT_ROLE_SET
        in_org = role in ORG_ROLE_SET
        assert in_government != in_org, (
            f"{role.name} must belong to exactly one domain "
            f"(government={in_government}, org={in_org})"
        )

    assert {RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER} <= GOVERNMENT_ROLE_SET
    assert {RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER} <= ORG_ROLE_SET


def test_validate_seed_user_roles_accepts_an_ia_signer():
    profiles = [{"user_profile_id": 300, "organization_id": 42}]
    roles = [
        {"user_profile_id": 300, "role_id": 2},
        {"user_profile_id": 300, "role_id": 17},
    ]
    validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)


def test_validate_seed_user_roles_accepts_an_ia_analyst():
    profiles = [{"user_profile_id": 400, "organization_id": None}]
    roles = [
        {"user_profile_id": 400, "role_id": 1},
        {"user_profile_id": 400, "role_id": 15},
    ]
    validate_seed_user_roles(profiles, roles, ROLE_ID_TO_ENUM)
