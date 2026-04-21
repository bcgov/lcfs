import structlog
from fastapi import Depends

from lcfs.db.models.organization.Organization import generate_secure_link_key
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from .repo import OrganizationsRepository
from .schema import (
    AvailableFormsSchema,
    LinkKeyOperationResponseSchema,
    LinkKeyValidationSchema,
    OrganizationLinkKeyResponseSchema,
    OrganizationLinkKeysListSchema,
)


logger = structlog.get_logger(__name__)


class OrganizationLinkKeyService:
    def __init__(
        self,
        repo: OrganizationsRepository = Depends(OrganizationsRepository),
    ) -> None:
        self.repo = repo

    @service_handler
    async def get_available_forms(self) -> AvailableFormsSchema:
        """
        Get available forms for link key generation.
        """
        forms = await self.repo.get_available_forms_for_link_keys()

        return AvailableFormsSchema(
            forms={
                form.form_id: {
                    "id": form.form_id,
                    "name": form.name,
                    "slug": form.slug,
                    "description": form.description,
                }
                for form in forms
            }
        )

    @service_handler
    async def get_organization_link_keys(
        self, organization_id: int
    ) -> OrganizationLinkKeysListSchema:
        """
        Get all link keys for an organization.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        link_keys = await self.repo.get_organization_link_keys(organization_id)

        link_key_responses = [
            OrganizationLinkKeyResponseSchema(
                link_key_id=lk.link_key_id,
                organization_id=lk.organization_id,
                form_id=lk.form_id,
                form_name=lk.form_name,
                form_slug=lk.form_slug,
                link_key=lk.link_key,
                create_date=lk.create_date,
                update_date=lk.update_date,
            )
            for lk in link_keys
        ]

        return OrganizationLinkKeysListSchema(
            organization_id=organization_id,
            organization_name=organization.name,
            link_keys=link_key_responses,
        )

    @service_handler
    async def generate_link_key(
        self, organization_id: int, form_id: int, user=None
    ) -> LinkKeyOperationResponseSchema:
        """
        Generate a new secure link key for a specific form.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        form = await self.repo.get_form_by_id(form_id)
        if not form:
            raise DataNotFoundException(f"Form with ID {form_id} not found")

        if not form.allows_anonymous:
            raise ValueError("Form does not support anonymous access")

        existing_link_key = await self.repo.get_link_key_by_form_id(
            organization_id, form_id
        )
        if existing_link_key:
            raise ValueError(
                f"Link key already exists for {form.name}. "
                "Please regenerate if you want to replace it."
            )

        new_link_key = generate_secure_link_key()

        link_key_record = OrganizationLinkKey(
            organization_id=organization_id,
            form_id=form_id,
            link_key=new_link_key,
        )

        created_link_key = await self.repo.create_link_key(link_key_record)

        return LinkKeyOperationResponseSchema(
            link_key=created_link_key.link_key,
            form_id=form_id,
            form_name=form.name,
            form_slug=form.slug,
        )

    @service_handler
    async def regenerate_link_key(
        self, organization_id: int, form_id: int, user=None
    ) -> LinkKeyOperationResponseSchema:
        """
        Regenerate the link key for a specific form.
        This invalidates the previous key and creates a new one.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        form = await self.repo.get_form_by_id(form_id)
        if not form:
            raise DataNotFoundException(f"Form with ID {form_id} not found")

        existing_link_key = await self.repo.get_link_key_by_form_id(
            organization_id, form_id
        )
        if not existing_link_key:
            raise DataNotFoundException(f"No link key found for {form.name}")

        new_link_key = generate_secure_link_key()
        existing_link_key.link_key = new_link_key

        updated_link_key = await self.repo.update_link_key(existing_link_key)

        return LinkKeyOperationResponseSchema(
            link_key=updated_link_key.link_key,
            form_id=form_id,
            form_name=form.name,
            form_slug=form.slug,
        )

    @service_handler
    async def validate_link_key(self, link_key: str) -> LinkKeyValidationSchema:
        """
        Validate a link key and return the associated organization and form info.
        Returns detailed validation result including form info and organization info.
        """
        link_key_record = await self.repo.get_link_key_by_key(link_key)

        if not link_key_record:
            return LinkKeyValidationSchema(
                organization_id=0,
                form_id=0,
                form_name="Unknown",
                form_slug="unknown",
                organization_name="",
                is_valid=False,
            )

        return LinkKeyValidationSchema(
            organization_id=link_key_record.organization_id,
            form_id=link_key_record.form_id,
            form_name=link_key_record.form_name,
            form_slug=link_key_record.form_slug,
            organization_name=link_key_record.organization.name,
            is_valid=True,
        )
