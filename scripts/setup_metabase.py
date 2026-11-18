#!/usr/bin/env python3
"""Complete first-run Metabase setup and add the local LCFS database."""

import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = os.getenv("METABASE_URL", "http://localhost:3001").rstrip("/")


def request(path, method="GET", body=None, session_id=None):
    headers = {"Content-Type": "application/json"}
    if session_id:
        headers["X-Metabase-Session"] = session_id
    payload = json.dumps(body).encode() if body is not None else None
    req = Request(f"{BASE_URL}{path}", data=payload, headers=headers, method=method)
    try:
        with urlopen(req, timeout=15) as response:
            data = response.read()
            return json.loads(data) if data else {}
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise RuntimeError(f"Metabase {method} {path} failed ({error.code}): {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach Metabase at {BASE_URL}: {error.reason}") from error


def wait_until_ready():
    for _ in range(120):
        try:
            if request("/api/health").get("status") == "ok":
                return
        except (RuntimeError, TimeoutError):
            pass
        time.sleep(2)
    raise RuntimeError(f"Metabase did not become ready at {BASE_URL}")


def main():
    email = os.getenv("METABASE_ADMIN_EMAIL")
    password = os.getenv("METABASE_ADMIN_PASSWORD")
    if not email or not password or password == "replace-with-a-private-password":
        raise RuntimeError(
            "Set METABASE_ADMIN_EMAIL and METABASE_ADMIN_PASSWORD in .env "
            "(copy .env.example to .env and replace the sample password)."
        )

    wait_until_ready()
    properties = request("/api/session/properties")
    if not properties.get("has-user-setup"):
        token = properties.get("setup-token")
        if not token:
            raise RuntimeError("Metabase is not set up, but no setup token was returned.")
        request(
            "/api/setup",
            "POST",
            {
                "token": token,
                "user": {
                    "first_name": os.getenv("METABASE_ADMIN_FIRST_NAME", "Local"),
                    "last_name": os.getenv("METABASE_ADMIN_LAST_NAME", "Administrator"),
                    "email": email,
                    "password": password,
                },
                "prefs": {
                    "site_name": "LCFS Local",
                    "site_locale": "en",
                },
            },
        )
        print(f"Created Metabase administrator {email}.")
    else:
        print("Metabase onboarding is already complete; using the configured admin account.")

    login = request("/api/session", "POST", {"username": email, "password": password})
    session_id = login.get("id")
    if not session_id:
        raise RuntimeError("Metabase login succeeded without returning a session id.")

    databases = request("/api/database", session_id=session_id).get("data", [])
    if any(database.get("name") == "LCFS Local" for database in databases):
        print("LCFS Local database is already registered.")
        return

    request(
        "/api/database",
        "POST",
        {
            "name": "LCFS Local",
            "engine": "postgres",
            "details": {
                "host": "db",
                "port": 5432,
                "dbname": "lcfs",
                "user": "lcfs",
                "password": "development_only",
            },
        },
        session_id=session_id,
    )
    print("Added the LCFS Local PostgreSQL database to Metabase.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
