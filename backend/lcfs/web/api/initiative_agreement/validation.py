from typing import Optional

from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.db.models.document.Document import Document
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_AGREEMENT,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementSchema,
    InitiativeAgreementCreateSchema,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.workflow import (
    ensure_package_document_writable,
    is_hidden_from,
)
from lcfs.web.api.role.schema import user_has_roles


class InitiativeAgreementValidation:
    def __init__(
        self,
        request: Request = None,
        service: InitiativeAgreementServices = Depends(InitiativeAgreementServices),
        repo: InitiativeAgreementRepository = Depends(InitiativeAgreementRepository),
    ) -> None:
        self.request = request
        self.service = service
        self.repo = repo

    async def validate_initiative_agreement_create(
        self, request, initiative_agreement: InitiativeAgreementCreateSchema
    ):
        pass

    async def validate_initiative_agreement_update(
        self, request, updated_data: InitiativeAgreementSchema
    ):
        # Retrieve the current initiative agreement from the database
        initiative_agreement = await self.service.get_initiative_agreement(
            updated_data.initiative_agreement_id
        )

        # Check if the current status is "Approved"
        if (
            initiative_agreement.current_status.status
            == InitiativeAgreementStatusEnum.Approved
        ):
            raise HTTPException(
                status_code=403,
                detail="Editing an approved initiative agreement is not allowed.",
            )

    async def validate_organization_access(self, initiative_agreement_id: int):
        # Fetch via the repository (not the legacy response schema): agreement
        # management records may have no award-era compliance_units, which the
        # legacy schema rejects.
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        # Outside government, a draft that government is still preparing
        # (#5553) reads as no agreement at all.
        if not initiative_agreement or is_hidden_from(
            initiative_agreement, self.request.user
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Initiative agreement not found.",
            )

        if user_has_roles(self.request.user, [RoleEnum.GOVERNMENT]):
            return

        # Anyone else must belong to the agreement's organization. An
        # agreement saved before its organization was known (#5186) belongs
        # to no one outside government.
        organization_id = initiative_agreement.to_organization_id
        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )
        if organization_id is None or organization_id != user_organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this initiative agreement.",
            )

    async def validate_package_document_write(
        self,
        parent_type: str,
        parent_id: int,
        document_id: Optional[int] = None,
        folder_change: bool = False,
    ):
        """Refuse a file write on an agreement's package that is not open to
        edits (#5554): an upload, replacement, rename, move, bin, restore or
        delete, and any folder change, on the agreement or one of its
        designated actions.

        *document_id* names the file a write acts on; without one, and
        without *folder_change*, the write is a new upload. That decides
        whether a BCeID write is the caller's own evidence, which the lock
        leaves to the evidence submission (see is_eoc_evidence_write).

        The agreement's row is held until the write is saved and its status
        read under that lock, so a concurrent Set to Underway cannot slip in
        between (see the repository's lock_agreement_for_package_edit).

        Call it after the parent's access check, which reports a missing or
        hidden parent. Legacy credit awards share the initiativeAgreement
        parent type but are no package: their files are managed on the
        transaction pages, so they pass.
        """
        if parent_type == "initiativeAgreement":
            agreement_id = parent_id
        elif parent_type == "designatedAction":
            action = await self.repo.get_designated_action_by_id(parent_id)
            agreement_id = action.initiative_agreement_id if action else None
        else:
            return
        agreement = (
            await self.repo.lock_agreement_for_package_edit(agreement_id)
            if agreement_id is not None
            else None
        )
        if agreement is None or agreement.record_kind != RECORD_KIND_AGREEMENT:
            return
        file_owner = None
        if document_id is not None:
            document = await self.repo.db.get(Document, document_id)
            file_owner = document.create_user if document else None
        ensure_package_document_writable(
            agreement,
            parent_type,
            self.request.user,
            new_file=document_id is None and not folder_change,
            file_owner=file_owner,
        )
