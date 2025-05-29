import json

import httpx
import jwt
from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import func
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from starlette.authentication import AuthenticationBackend, AuthCredentials

from lcfs.db.models import UserLoginHistory
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.services.keycloak.dependencies import parse_external_username
from lcfs.settings import Settings


class UserAuthentication(AuthenticationBackend):
    """
    Class to handle authentication when calling the lcfs api
    """

    def __init__(
        self,
        redis_client: Redis,
        session_factory: async_sessionmaker,
        settings: Settings,
    ):
        self.session_factory = session_factory
        self.settings = settings
        self.redis_client = redis_client
        self.jwks = None
        self.jwks_uri = None
        self.test_keycloak_user = None

    async def refresh_jwk(self):
        """
        Refreshes the JSON Web Key (JWK) used for token verification.
        This method attempts to retrieve the JWK from Redis cache.
        If not found, it fetches it from the well-known endpoint
        and stores it in Redis for future use.
        """
        try:
            # Try to get the JWKS data from Redis cache
            jwks_data = await self.redis_client.get("jwks_data")

            if jwks_data:
                jwks_data = json.loads(jwks_data)
                self.jwks = jwks_data.get("jwks")
                self.jwks_uri = jwks_data.get("jwks_uri")
                return

            # If not in cache, retrieve from the well-known endpoint
            async with httpx.AsyncClient() as client:
                oidc_response = await client.get(self.settings.well_known_endpoint)
                oidc_response.raise_for_status()
                jwks_uri = oidc_response.json().get("jwks_uri")

                if not jwks_uri:
                    raise ValueError(
                        "JWKS URI not found in the well-known endpoint response."
                    )

                certs_response = await client.get(jwks_uri)
                certs_response.raise_for_status()
                jwks = certs_response.json()

            # Composite object containing both JWKS and JWKS URI
            jwks_data = {"jwks": jwks, "jwks_uri": jwks_uri}

            # Cache the composite JWKS data with a TTL of 1 day (86400 seconds)
            await self.redis_client.set("jwks_data", json.dumps(jwks_data), ex=86400)

            self.jwks = jwks
            self.jwks_uri = jwks_uri

        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error refreshing JWK: {str(e)}"
            )

    async def authenticate(self, request):
        # Extract the authorization header from the request
        auth = request.headers.get("Authorization")
        if not auth:
            raise HTTPException(
                status_code=401, detail="Authorization header is required"
            )

        # Split the authorization header into scheme and token
        parts = auth.split()
        if parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=401, detail="Authorization header must start with Bearer"
            )
        elif len(parts) == 1:
            raise HTTPException(status_code=401, detail="Token not found")
        elif len(parts) > 2:
            raise HTTPException(
                status_code=401, detail="Authorization header must be Bearer token"
            )

        token = parts[1]
        # Call the method to refresh the JWKs from the cache or the endpoint
        await self.refresh_jwk()

        if not self.test_keycloak_user:
            # Use PyJWKClient with the JWKS URI to get the signing key
            jwks_client = jwt.PyJWKClient(self.jwks_uri)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # Decode and validate the JWT token
            try:
                user_token = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    audience=self.settings.keycloak_audience,
                    options={"verify_exp": True},
                    leeway=5,  # Allows for 5 seconds of clock skew
                )
            except jwt.ExpiredSignatureError as exc:
                raise HTTPException(status_code=401, detail="Token has expired")
            except (jwt.InvalidTokenError, jwt.DecodeError) as exc:
                raise HTTPException(status_code=401, detail=str(exc))
        else:
            user_token = self.test_keycloak_user

        # Normalize
        preferred_username = user_token.get("preferred_username", "").lower()
        email = user_token.get(
            "email",
            (
                "lcfstest@gov.bc.ca"
                if user_token.get("idir_username", "").lower() == "lcfstest"
                else ""
            ),
        ).lower()

        # Use a single session for all authentication database operations
        async with self.session_factory() as session:
            async with session.begin():
                user = None

                # Attempt #1: look up by keycloak_user_id
                if preferred_username:
                    try:
                        result = await session.execute(
                            select(UserProfile)
                            .options(
                                joinedload(UserProfile.organization),
                                joinedload(UserProfile.user_roles).joinedload(
                                    UserRole.role
                                ),
                            )
                            .where(
                                func.lower(UserProfile.keycloak_user_id)
                                == preferred_username
                            )
                        )
                        user = result.unique().scalar_one_or_none()
                        if user:
                            # Check if the user is active
                            if not user.is_active:
                                error_text = "The account is currently inactive."
                                await self._create_login_history_in_session(
                                    session, user_token, False, error_text
                                )
                                raise HTTPException(status_code=403, detail=error_text)
                            else:
                                # Already found by keycloak_user_id => return
                                return AuthCredentials(["authenticated"]), user

                    except NoResultFound:
                        pass

                # Attempt #2: if user was not found by keycloak_user_id, look up by email + username
                if email and not user:
                    user_query = (
                        select(UserProfile)
                        .options(
                            joinedload(UserProfile.organization),
                            joinedload(UserProfile.user_roles).joinedload(
                                UserRole.role
                            ),
                        )
                        .where(
                            func.lower(UserProfile.keycloak_email) == email,
                            func.lower(UserProfile.keycloak_username)
                            == parse_external_username(user_token),
                        )
                    )
                    # Check for Government or Supplier affiliation
                    if user_token["identity_provider"] == "idir":
                        user_query = user_query.where(
                            UserProfile.organization_id.is_(None)
                        )
                    elif user_token["identity_provider"] == "bceidbusiness":
                        user_query = user_query.where(
                            UserProfile.organization_id.isnot(None)
                        )
                    else:
                        error_text = "Unknown identity provider."
                        raise HTTPException(status_code=401, detail=error_text)

                    user_result = await session.execute(user_query)
                    user = user_result.unique().scalar_one_or_none()

                    if user is None:
                        error_text = "No User with that configuration exists."
                        await self._create_login_history_in_session(
                            session, user_token, False, error_text
                        )
                        raise HTTPException(status_code=403, detail=error_text)

                    # Check if the user is active
                    if not user.is_active:
                        error_text = "The account is currently inactive."
                        await self._create_login_history_in_session(
                            session, user_token, False, error_text
                        )
                        raise HTTPException(status_code=403, detail=error_text)
                else:
                    if not user:
                        error_text = (
                            "preferred_username or email is required in JWT payload."
                        )
                        raise HTTPException(status_code=401, detail=error_text)

                # Map the keycloak user id to the user for future login caching
                if user and user.keycloak_user_id != user_token["preferred_username"]:
                    user.keycloak_user_id = user_token["preferred_username"]
                    session.add(user)

                # Create successful login history
                await self._create_login_history_in_session(session, user_token, True)

                return AuthCredentials(["authenticated"]), user

    async def _create_login_history_in_session(
        self, session, user_token, is_success, error_msg=None
    ):
        """
        Create login history within an existing session (used during authentication).
        """
        email = user_token.get("email", "").lower()
        username = parse_external_username(user_token)
        preferred_username = user_token.get("preferred_username", "").lower()

        login_history = UserLoginHistory(
            keycloak_email=email,
            keycloak_username=username,
            keycloak_user_id=preferred_username,
            is_login_successful=is_success,
            login_error_message=error_msg,
        )
        session.add(login_history)
