import json
import httpx
import jwt
from redis.asyncio import Redis
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_
from sqlalchemy.future import select
from sqlalchemy.exc import NoResultFound
from starlette.requests import Request
from starlette.authentication import (
    AuthenticationBackend, AuthCredentials
)
from lcfs.settings import Settings
from lcfs.db.models.User import User
from lcfs.db.models.UserLoginHistory import UserLoginHistory
from lcfs.services.keycloak.dependencies import _parse_external_username


class UserAuthentication(AuthenticationBackend):
    """
    Class to handle authentication when calling the lcfs api
    """
    def __init__(self, redis_pool: Redis, session: AsyncSession, settings: Settings):
        self.async_session = session
        self.settings = settings
        self.redis_pool = redis_pool
        self.jwks = None
        self.jwks_uri = None

    async def refresh_jwk(self):
        # Try to get the JWKS data from Redis cache
        async with Redis(connection_pool=self.redis_pool) as redis:
            jwks_data = await redis.get('jwks_data')

        if jwks_data:
            jwks_data = json.loads(jwks_data)
            self.jwks = jwks_data.get('jwks')
            self.jwks_uri = jwks_data.get('jwks_uri')
            return
        
        # If not in cache, retrieve from the well-known endpoint
        async with httpx.AsyncClient() as client:
            oidc_response = await client.get(self.settings.well_known_endpoint)
            jwks_uri = oidc_response.json().get('jwks_uri')
            certs_response = await client.get(jwks_uri)
            jwks = certs_response.json()
        
        # Composite object containing both JWKS and JWKS URI
        jwks_data = {
            'jwks': jwks,
            'jwks_uri': jwks_uri
        }

        # Cache the composite JWKS data with a TTL of 1 day (86400 seconds)
        async with Redis(connection_pool=self.redis_pool) as redis:
            await redis.set('jwks_data', json.dumps(jwks_data), ex=86400)

        self.jwks = jwks
        self.jwks_uri = jwks_uri

    async def authenticate(self, request):
        # Extract the authorization header from the request
        auth = request.headers.get('Authorization')
        if not auth:
            raise HTTPException(status_code=401, detail='Authorization header is required')

        # Split the authorization header into scheme and token
        parts = auth.split()
        if parts[0].lower() != 'bearer':
            raise HTTPException(status_code=401, detail='Authorization header must start with Bearer')
        elif len(parts) == 1:
            raise HTTPException(status_code=401, detail='Token not found')
        elif len(parts) > 2:
            raise HTTPException(status_code=401, detail='Authorization header must be Bearer token')

        token = parts[1]
        # Call the method to refresh the JWKs from the cache or the endpoint
        await self.refresh_jwk()

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
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail='Token has expired')
        except (jwt.InvalidTokenError, jwt.DecodeError) as exc:
            raise HTTPException(status_code=401, detail=str(exc))

        if 'preferred_username' in user_token:
            try:
                async with self.async_session() as session:
                    result = await session.execute(
                        select(User).where(User.keycloak_user_id == user_token['preferred_username'])
                    )
                    user = result.scalar_one()
                    await self.create_login_history(user_token, True, None, request.url.path)
                    return user
            except NoResultFound:
                pass

        external_username = _parse_external_username(user_token)

        if 'email' in user_token:
            # Construct the query to find the user
            user_query = select(User).where(
                and_(
                    User.keycloak_email == user_token['email'],
                    User.keycloak_username == external_username
                )
            )

            # TODO may need to not use org id == 1 if gov no longer is organization in lcfs
            if user_token['identity_provider'] == 'idir':
                user_query = user_query.where(User.organization_id == 1)
            elif user_token['identity_provider'] == 'bceidbusiness':
                user_query = user_query.where(User.organization_id != 1)
            else:
                error_text = 'Unknown identity provider.'
                await self.create_login_history(user_token, False, error_text, request.url.path)
                raise HTTPException(status_code=401, detail=error_text)

            async with self.async_session() as session:
                user_result = await session.execute(user_query)
                user = user_result.scalars().first()
                if user is None:
                    error_text = 'No User with that configuration exists.'
                    await self.create_login_history(user_token, False, error_text, request.url.path)
                    raise HTTPException(status_code=401, detail=error_text)
        else:
            error_text = 'preferred_username or email is required in JWT payload.'
            await self.create_login_history(user_token, False, error_text, request.url.path)
            raise HTTPException(status_code=401, detail=error_text)

        await self.map_user_keycloak_id(user, user_token)

        return AuthCredentials(["authenticated"]), user

    async def map_user_keycloak_id(self, user, user_token):
        """
        Updates the user's keycloak_user_id and commits the changes to the database.
        """
        # Map the keycloak user id to the user for future login caching
        user.keycloak_user_id = user_token['preferred_username']
        # TODO may want to map keycloak display name to user as well
        # user.display_name = user_token['display_name']

        # The merge method is used to merge the state of the given object into the current session
        # If the instance does not exist in the session, insert it.
        # If the instance already exists in the session, update it.
        async with self.async_session() as session:
            await session.merge(user)
            await session.commit()

        return user

    async def create_login_history(self, user_token, success=False, error=None, path=''):
        """
        Creates a user login history entry asynchronously.
        """
        # We only want to create a user_login_history when the current user is fetched
        if path == '/api/users/current':
            email = user_token.get('email', '')
            username = _parse_external_username(user_token)
            user_id = user_token.get('preferred_username', '')
            login_history = UserLoginHistory(
                keycloak_email=email,
                external_username=username,
                keycloak_user_id=user_id,
                is_login_successful=success,
                login_error_message=error
            )
            async with self.async_session() as session:
                session.add(login_history)
                await session.commit()

