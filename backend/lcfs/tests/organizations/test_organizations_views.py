import pytest
from httpx import AsyncClient
from fastapi import status, FastAPI
from unittest.mock import AsyncMock, patch, MagicMock
from lcfs.web.api.organizations.services import (
    OrganizationsService as ServiceDependency,
)
from lcfs.db.models.user.Role import RoleEnum


class TestOrganizationLinkKeyViews:
    """Test organization link key API endpoints"""

    @pytest.fixture
    def sample_available_forms(self):
        return {
            "forms": {
                "1": {
                    "id": 1,
                    "name": "Test Form A",
                    "slug": "test-form-a",
                    "description": "Description A",
                },
                "2": {
                    "id": 2,
                    "name": "Test Form B",
                    "slug": "test-form-b",
                    "description": "Description B",
                },
            }
        }

    @pytest.fixture
    def sample_link_keys_list(self):
        return {
            "organization_id": 1,
            "organization_name": "Test Organization",
            "link_keys": [
                {
                    "link_key_id": 1,
                    "organization_id": 1,
                    "form_id": 1,
                    "form_name": "Test Form",
                    "form_slug": "test-form",
                    "link_key": "test-key-123",
                    "create_date": "2024-01-01",
                    "update_date": "2024-01-01",
                }
            ],
        }

    @pytest.fixture
    def sample_link_key_operation_response(self):
        return {
            "link_key": "generated-key-456",
            "form_id": 1,
            "form_name": "Test Form",
            "form_slug": "test-form",
        }

    @pytest.mark.anyio
    async def test_get_available_forms_success(
        self,
        mock_user_profile,
        sample_available_forms,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test successful retrieval of available forms"""

        # Grant ANALYST role for this test
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_available_forms.return_value = (
                sample_available_forms
            )

            # Ensure FastAPI uses the mocked service
            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get("/api/organizations/1/forms")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "forms" in data
            assert len(data["forms"]) == 2
            assert "1" in data["forms"]
            assert "2" in data["forms"]
            assert data["forms"]["1"]["name"] == "Test Form A"
            assert data["forms"]["2"]["name"] == "Test Form B"

            mock_service_instance.get_available_forms.assert_called_once()

    @pytest.mark.anyio
    async def test_get_organization_link_keys_success(
        self,
        mock_user_profile,
        sample_link_keys_list,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test successful retrieval of organization link keys"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_organization_link_keys.return_value = (
                sample_link_keys_list
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get("/api/organizations/1/link-keys")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["organizationId"] == 1
            assert data["organizationName"] == "Test Organization"
            assert len(data["linkKeys"]) == 1
            assert data["linkKeys"][0]["linkKey"] == "test-key-123"

            mock_service_instance.get_organization_link_keys.assert_called_once_with(1)

    @pytest.mark.anyio
    async def test_generate_organization_link_key_success(
        self,
        mock_user_profile,
        sample_link_key_operation_response,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test successful generation of organization link key"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.generate_link_key.return_value = (
                sample_link_key_operation_response
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            payload = {"form_id": 1}
            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.post(
                    "/api/organizations/1/link-keys", json=payload
                )

            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["linkKey"] == "generated-key-456"
            assert data["formId"] == 1
            assert data["formName"] == "Test Form"
            assert data["formSlug"] == "test-form"

            mock_service_instance.generate_link_key.assert_called_once()

    @pytest.mark.anyio
    async def test_regenerate_organization_link_key_success(
        self,
        mock_user_profile,
        sample_link_key_operation_response,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test successful regeneration of organization link key"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.regenerate_link_key.return_value = (
                sample_link_key_operation_response
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.put("/api/organizations/1/link-keys/1")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["linkKey"] == "generated-key-456"
            assert data["formId"] == 1
            assert data["formName"] == "Test Form"
            assert data["formSlug"] == "test-form"

            mock_service_instance.regenerate_link_key.assert_called_once()

    @pytest.mark.anyio
    async def test_validate_link_key_success(self, fastapi_app: FastAPI, set_mock_user):
        """Test successful link key validation"""

        from lcfs.web.api.organizations.schema import LinkKeyValidationSchema

        valid_response = LinkKeyValidationSchema(
            organization_id=1,
            form_id=1,
            form_name="Test Form",
            form_slug="test-form",
            organization_name="Test Organization",
            is_valid=True,
        )

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.validate_link_key.return_value = valid_response

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get(
                    "/api/organizations/validate-link-key/valid-key-123"
                )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["organizationId"] == 1
            assert data["formId"] == 1
            assert data["formName"] == "Test Form"
            assert data["formSlug"] == "test-form"
            assert data["organizationName"] == "Test Organization"
            assert data["isValid"] is True

            mock_service_instance.validate_link_key.assert_called_once_with(
                "valid-key-123"
            )

    @pytest.mark.anyio
    async def test_validate_link_key_invalid(self, fastapi_app: FastAPI, set_mock_user):
        """Test link key validation with invalid key"""

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance

            # Mock the service to return invalid validation
            invalid_response = MagicMock()
            invalid_response.is_valid = False
            mock_service_instance.validate_link_key.return_value = invalid_response

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get(
                    "/api/organizations/validate-link-key/invalid-key-123"
                )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            data = response.json()
            assert "Invalid or expired link key" in data["detail"]

            mock_service_instance.validate_link_key.assert_called_once_with(
                "invalid-key-123"
            )

    @pytest.mark.anyio
    async def test_get_available_forms_unauthorized(self, client: AsyncClient):
        """Test get_available_forms with unauthorized user"""
        response = await client.get("/api/organizations/1/forms")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.anyio
    async def test_get_available_forms_empty_response(
        self,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test get_available_forms when no forms are available"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        empty_forms = {"forms": {}}

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_available_forms.return_value = empty_forms

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get("/api/organizations/1/forms")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["forms"] == {}

    @pytest.mark.anyio
    async def test_get_organization_link_keys_not_found(
        self,
        client: AsyncClient,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test get_organization_link_keys when organization not found"""
        from lcfs.web.exception.exceptions import DataNotFoundException

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_organization_link_keys.side_effect = (
                DataNotFoundException("Organization not found")
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            response = await client.get("/api/organizations/999/link-keys")

            assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.anyio
    async def test_get_organization_link_keys_unauthorized(self, client: AsyncClient):
        """Test get_organization_link_keys with unauthorized user"""
        response = await client.get("/api/organizations/1/link-keys")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.anyio
    async def test_get_organization_link_keys_empty_response(
        self,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test get_organization_link_keys when no link keys exist"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        empty_link_keys = {
            "organization_id": 1,
            "organization_name": "Test Organization",
            "link_keys": [],
        }

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_organization_link_keys.return_value = (
                empty_link_keys
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.get("/api/organizations/1/link-keys")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data["linkKeys"]) == 0

    @pytest.mark.anyio
    async def test_generate_organization_link_key_invalid_payload(
        self, client: AsyncClient, mock_user_profile
    ):
        """Test generate_organization_link_key with invalid payload"""

        payload = {}  # Missing form_id
        response = await client.post("/api/organizations/1/link-keys", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.anyio
    async def test_generate_organization_link_key_not_found(
        self,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test generate_organization_link_key when organization not found"""
        from lcfs.web.exception.exceptions import DataNotFoundException

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.generate_link_key.side_effect = DataNotFoundException(
                "Organization not found"
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            payload = {"form_id": 1}
            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.post(
                    "/api/organizations/999/link-keys", json=payload
                )

            assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.anyio
    async def test_generate_organization_link_key_already_exists(
        self,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test generate_organization_link_key when link key already exists"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.generate_link_key.side_effect = ValueError(
                "Link key already exists"
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            payload = {"form_id": 1}
            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.post(
                    "/api/organizations/1/link-keys", json=payload
                )

            assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.anyio
    async def test_regenerate_organization_link_key_not_found(
        self,
        client: AsyncClient,
        mock_user_profile,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test regenerate_organization_link_key when link key not found"""
        from lcfs.web.exception.exceptions import DataNotFoundException

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.regenerate_link_key.side_effect = (
                DataNotFoundException("No link key found")
            )

            fastapi_app.dependency_overrides[
                __import__(
                    "lcfs.web.api.organizations.views",
                    fromlist=["OrganizationsService"],
                ).OrganizationsService
            ] = lambda: mock_service_instance

            response = await client.put("/api/organizations/1/link-keys/1")

            assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.anyio
    async def test_regenerate_organization_link_key_unauthorized(
        self, client: AsyncClient
    ):
        """Test regenerate_organization_link_key with unauthorized user"""
        response = await client.put("/api/organizations/1/link-keys/1")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.anyio
    async def test_validate_link_key_empty_key(self, client: AsyncClient):
        """Test validate_link_key with empty key"""

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance

            invalid_response = MagicMock()
            invalid_response.is_valid = False
            mock_service_instance.validate_link_key.return_value = invalid_response

            # Accept either redirect or direct 404
            response = await client.get(
                "/api/organizations/validate-link-key/", follow_redirects=False
            )

            assert response.status_code in (
                status.HTTP_404_NOT_FOUND,
                status.HTTP_307_TEMPORARY_REDIRECT,
            )

    @pytest.mark.anyio
    async def test_generate_organization_link_key_user_context(
        self,
        mock_user_profile,
        sample_link_key_operation_response,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test generate_organization_link_key passes user context correctly"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        user_mock = MagicMock()
        mock_user_profile.return_value = user_mock

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.generate_link_key.return_value = (
                sample_link_key_operation_response
            )

            # Ensure the route uses our mocked service
            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            payload = {"form_id": 1}
            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.post(
                    "/api/organizations/1/link-keys", json=payload
                )

            assert response.status_code == status.HTTP_201_CREATED

            # Verify that the service method was called with the user context
            args, kwargs = mock_service_instance.generate_link_key.call_args
            assert len(args) >= 3
            assert args[0] == 1
            assert args[1] == 1

    @pytest.mark.anyio
    async def test_regenerate_organization_link_key_user_context(
        self,
        mock_user_profile,
        sample_link_key_operation_response,
        fastapi_app: FastAPI,
        set_mock_user,
    ):
        """Test regenerate_organization_link_key passes user context correctly"""

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])

        user_mock = MagicMock()
        mock_user_profile.return_value = user_mock

        with patch(
            "lcfs.web.api.organizations.views.OrganizationsService"
        ) as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.regenerate_link_key.return_value = (
                sample_link_key_operation_response
            )

            fastapi_app.dependency_overrides[ServiceDependency] = (
                lambda: mock_service_instance
            )

            async with AsyncClient(app=fastapi_app, base_url="http://test") as client:
                response = await client.put("/api/organizations/1/link-keys/1")

            assert response.status_code == status.HTTP_200_OK

            # Verify that the service method was called with the user context
            args, kwargs = mock_service_instance.regenerate_link_key.call_args
            assert len(args) >= 3
            assert args[0] == 1
            assert args[1] == 1
