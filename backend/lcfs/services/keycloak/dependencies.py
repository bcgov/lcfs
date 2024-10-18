from fastapi import HTTPException


def _parse_external_username(user_token):
    identity_provider = user_token.get("identity_provider")
    if identity_provider == "idir":
        return user_token.get("idir_username", "").lower()
    elif identity_provider == "bceidbusiness":
        return user_token.get("bceid_username", "").lower()
    raise HTTPException(status_code=401, detail="Unknown or missing identity provider.")
