from copy import deepcopy
from typing import Any

from lcfs.db.seeders.nonprod_user_seed_data import NONPROD_USER_SEED_DATA


def get_seed_user_data(env: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    normalized = env.lower()
    if normalized not in {"local", "test"}:
        raise ValueError(f"Unsupported env '{env}'. Expected local or test.")

    dataset = NONPROD_USER_SEED_DATA[normalized]
    # Return copies so callers can safely mutate rows while processing.
    return deepcopy(dataset["profiles"]), deepcopy(dataset["roles"])


def get_seed_usernames(env: str) -> list[str]:
    profiles, _ = get_seed_user_data(env)
    return [
        profile["keycloak_username"]
        for profile in profiles
        if profile.get("keycloak_username")
    ]
