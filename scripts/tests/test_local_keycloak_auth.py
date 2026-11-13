"""Optional live OIDC and role-seeding check for running local stacks."""

import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import tempfile
import unittest
from http.cookiejar import CookieJar, DefaultCookiePolicy
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import HTTPCookieProcessor, ProxyHandler, Request, build_opener

ROLE_USERS = [
    ("idir-government", "Government"),
    ("idir-administrator", "Administrator"),
    ("idir-system-admin", "System Admin"),
    ("idir-analyst", "Analyst"),
    ("idir-compliance-manager", "Compliance Manager"),
    ("idir-director", "Director"),
    ("idir-ia-analyst", "IA Analyst"),
    ("idir-ia-manager", "IA Manager"),
    ("bceid-supplier", "Supplier"),
    ("bceid-manage-users", "Manage Users"),
    ("bceid-transfer", "Transfer"),
    ("bceid-compliance-reporting", "Compliance Reporting"),
    ("bceid-signing-authority", "Signing Authority"),
    ("bceid-read-only", "Read Only"),
    ("bceid-ci-applicant", "CI Applicant"),
    ("bceid-ia-proponent", "IA Proponent"),
    ("bceid-ia-signer", "IA Signer"),
]


class LocalhostSecureCookiePolicy(DefaultCookiePolicy):
    """Match browsers' localhost handling for Keycloak's Secure cookies."""

    def return_ok(self, cookie, request):
        hostname = urlparse(request.get_full_url()).hostname or ""
        if cookie.secure and (
            hostname == "localhost" or hostname.endswith(".localhost")
        ):
            return True
        return super().return_ok(cookie, request)


class LoginFormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.action = None
        self.fields = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form" and self.action is None:
            self.action = attrs.get("action")
        if tag == "input" and attrs.get("name"):
            self.fields[attrs["name"]] = attrs.get("value", "")


@unittest.skipUnless(
    os.environ.get("LCFS_LOCAL_KEYCLOAK_INTEGRATION") == "1",
    "set LCFS_LOCAL_KEYCLOAK_INTEGRATION=1 to run against live local stacks",
)
class LocalKeycloakAuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repository_root = Path(__file__).resolve().parents[2]
        worktree_id = hashlib.sha256(str(repository_root).encode()).hexdigest()[:10]
        state_dir = Path(
            os.environ.get(
                "LCFS_LOCAL_KEYCLOAK_STATE_DIR",
                Path(os.environ.get("XDG_STATE_HOME", tempfile.gettempdir()))
                / "lcfs-local-keycloak",
            )
        )
        stack_envs = sorted(state_dir.glob(f"lcfs-local-{worktree_id}-*.env"))
        if len(stack_envs) < 2:
            raise unittest.SkipTest("start at least two local Keycloak stacks first")
        cls.stacks = [
            dict(line.split("=", 1) for line in env_file.read_text().splitlines())
            for env_file in stack_envs
        ]
        cls.cookie_jar = CookieJar(policy=LocalhostSecureCookiePolicy())
        cls.opener = build_opener(ProxyHandler({}), HTTPCookieProcessor(cls.cookie_jar))

    def test_role_accounts_authenticate_on_all_stacks_with_separate_sessions(self):
        password = os.environ.get(
            "LCFS_LOCAL_KEYCLOAK_TEST_PASSWORD", "development_only"
        )
        keycloak_hosts = set()

        for stack in self.stacks:
            hostname = stack["LCFS_LOCAL_KEYCLOAK_HOSTNAME"]
            keycloak_hosts.add(hostname)
            keycloak_port = stack["LCFS_KEYCLOAK_PUBLISHED_PORT"]
            issuer = f"http://{hostname}:{keycloak_port}/realms/lcfs-local"
            frontend = f"http://localhost:{stack['LCFS_FRONTEND_PUBLISHED_PORT']}"
            backend = f"http://localhost:{stack['LCFS_BACKEND_PUBLISHED_PORT']}"

            for username, assigned_role in ROLE_USERS:
                for cookie in list(self.cookie_jar):
                    if cookie.domain.lstrip(".") == hostname:
                        self.cookie_jar.clear(cookie.domain, cookie.path, cookie.name)
                self._assert_user_login(
                    username,
                    assigned_role,
                    password,
                    issuer,
                    frontend,
                    backend,
                )

        self.assertEqual(len(keycloak_hosts), len(self.stacks))
        cookie_hosts = {
            cookie.domain.lstrip(".")
            for cookie in self.cookie_jar
            if cookie.domain.lstrip(".").endswith(".localhost")
        }
        self.assertTrue(keycloak_hosts.issubset(cookie_hosts))

    def _assert_user_login(
        self, username, assigned_role, password, issuer, frontend, backend
    ):
        verifier = secrets.token_urlsafe(48)
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        state = secrets.token_urlsafe(18)
        auth_params = {
            "client_id": "low-carbon-fuel-standard-5147",
            "redirect_uri": frontend,
            "response_type": "code",
            "scope": "openid",
            "prompt": "login",
            "state": state,
            "nonce": secrets.token_urlsafe(18),
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        auth_url = f"{issuer}/protocol/openid-connect/auth?{urlencode(auth_params)}"
        login_page = self.opener.open(auth_url, timeout=20)
        form = LoginFormParser()
        form.feed(login_page.read().decode())
        self.assertTrue(form.action, f"Keycloak login form missing for {username}")

        login_data = dict(form.fields)
        login_data.update(username=username, password=password)
        login_response = self.opener.open(
            Request(
                urljoin(login_page.geturl(), form.action),
                data=urlencode(login_data).encode(),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ),
            timeout=20,
        )
        callback = parse_qs(urlparse(login_response.geturl()).query)
        self.assertEqual(callback.get("state"), [state])
        authorization_code = callback.get("code", [None])[0]
        self.assertTrue(
            authorization_code, f"Authorization code missing for {username}"
        )

        token_response = self.opener.open(
            Request(
                f"{issuer}/protocol/openid-connect/token",
                data=urlencode(
                    {
                        "grant_type": "authorization_code",
                        "client_id": "low-carbon-fuel-standard-5147",
                        "code": authorization_code,
                        "redirect_uri": frontend,
                        "code_verifier": verifier,
                    }
                ).encode(),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ),
            timeout=20,
        )
        access_token = json.load(token_response)["access_token"]
        user = json.load(
            self.opener.open(
                Request(
                    f"{backend}/api/users/current",
                    headers={"Authorization": f"Bearer {access_token}"},
                ),
                timeout=20,
            )
        )
        self.assertEqual(user["keycloakUsername"], username)
        actual_roles = {role["name"] for role in user["roles"]}
        provider_base_role = (
            "Government" if username.startswith("idir-") else "Supplier"
        )
        expected_roles = {provider_base_role, assigned_role}
        if assigned_role == "IA Signer":
            expected_roles.add("IA Proponent")
        self.assertTrue(
            expected_roles.issubset(actual_roles),
            f"{username} is missing roles {expected_roles - actual_roles}",
        )


if __name__ == "__main__":
    unittest.main()
