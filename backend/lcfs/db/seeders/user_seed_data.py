import ast
from pathlib import Path
from typing import Any


SEEDERS_DIR = Path(__file__).resolve().parent


def _extract_list_variable(file_path: Path, variable_name: str) -> list[dict[str, Any]]:
    source = file_path.read_text(encoding="utf-8")
    module = ast.parse(source)

    for node in ast.walk(module):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == variable_name:
                    value = ast.literal_eval(node.value)
                    if not isinstance(value, list):
                        raise ValueError(
                            f"Expected list in {file_path} for {variable_name}"
                        )
                    return value

    raise ValueError(f"Variable '{variable_name}' not found in {file_path}")


def get_seed_user_data(env: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    normalized = env.lower()

    if normalized == "local":
        profile_file = SEEDERS_DIR / "dev/user_profile_seeder.py"
        role_file = SEEDERS_DIR / "dev/user_role_seeder.py"
        profile_var = "user_profiles_to_seed"
        role_var = "user_roles_to_seed"
    elif normalized == "test":
        profile_file = SEEDERS_DIR / "staging/test_user_profile_seeder.py"
        role_file = SEEDERS_DIR / "staging/test_user_role_seeder.py"
        profile_var = "user_profiles_to_seed"
        role_var = "user_roles_to_seed"
    else:
        raise ValueError(f"Unsupported env '{env}'. Expected local or test.")

    profiles = _extract_list_variable(profile_file, profile_var)
    roles = _extract_list_variable(role_file, role_var)
    return profiles, roles


def get_seed_usernames(env: str) -> list[str]:
    profiles, _ = get_seed_user_data(env)
    return [
        profile["keycloak_username"]
        for profile in profiles
        if profile.get("keycloak_username")
    ]
