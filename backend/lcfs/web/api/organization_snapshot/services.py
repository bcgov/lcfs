import structlog
from fastapi import Depends, Request
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import ComplianceReportOrganizationSnapshot
from lcfs.web.api.organization_snapshot.repo import OrganizationSnapshotRepository

logger = structlog.get_logger(__name__)


class OrganizationSnapshotService:
    def __init__(
        self,
        request: Request = None,
        repo: OrganizationSnapshotRepository = Depends(OrganizationSnapshotRepository),
        session: AsyncSession = Depends(get_async_db_session),
    ) -> None:
        self.repo = repo
        self.request = request
        self.session = session

    async def get_by_compliance_report_id(self, compliance_report_id):
        snapshot = await self.repo.get_by_compliance_report_id(compliance_report_id)
        return snapshot

    async def create_organization_snapshot(self, compliance_report_id, organization_id):
        """
        Creates a snapshot of the given organization, linking it to the specified report.
        """
        # 1. Fetch the Organization object
        organization = await self.repo.get_organization(organization_id)

        if not organization:
            raise NoResultFound(f"Organization with ID {organization_id} not found.")

        # 2. Derive BC address and service address from OrganizationAddress
        bc_address = None
        org_address = organization.org_address
        if organization.org_address:
            bc_address_parts = [
                org_address.street_address,
                org_address.address_other,
                org_address.city,
                org_address.province_state,
                org_address.country,
                org_address.postalCode_zipCode,
            ]
            bc_address = ", ".join(filter(None, bc_address_parts))

        service_address = bc_address
        org_attorney_address = organization.org_attorney_address
        if org_attorney_address:
            service_addr_parts = [
                org_attorney_address.street_address,
                org_attorney_address.address_other,
                org_attorney_address.city,
                org_attorney_address.province_state,
                org_attorney_address.country,
                org_attorney_address.postalCode_zipCode,
            ]
            service_address = ", ".join(filter(None, service_addr_parts))

        # 3. Create the Snapshot
        org_snapshot = ComplianceReportOrganizationSnapshot(
            name=organization.name,
            operating_name=organization.operating_name or organization.name,
            email=organization.email,
            phone=organization.phone,
            bc_address=bc_address,
            service_address=service_address,
            compliance_report_id=compliance_report_id,
        )

        org_snapshot = await self.repo.save_snapshot(org_snapshot)
        return org_snapshot

    async def update(self, request_data, compliance_report_id):
        """
        Updates the snapshot fields for the specified compliance report using `request_data`.
        """

        snapshot = await self.repo.get_by_compliance_report_id(compliance_report_id)
        if not snapshot:
            raise NoResultFound(
                f"No Organization Snapshot found for compliance_report_id={compliance_report_id}"
            )

        snapshot.compliance_report_id = request_data.compliance_report_id
        snapshot.name = request_data.name
        snapshot.operating_name = request_data.operating_name
        snapshot.email = request_data.email
        snapshot.phone = request_data.phone
        snapshot.bc_address = request_data.bc_address
        snapshot.service_address = request_data.service_address
        snapshot.is_edited = True

        updated_snapshot = await self.repo.save_snapshot(snapshot)
        return updated_snapshot
