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

    async def create_organization_snapshot(
        self, compliance_report_id: int, organization_id: int, prev_report_id=None
    ):
        """
        Create a snapshot for a compliance report.

        If prev_report_id is provided and a snapshot exists, reuse it.
        Otherwise, create a new snapshot using the organization data.
        Note: If prev_report_id is provided but no snapshot is found,
        the function gracefully continues to create a new snapshot.

        Args:
            compliance_report_id: Current report ID.
            organization_id: Organization ID.
            prev_report_id (optional): ID of the previous report to reuse snapshot.

        Returns:
            A ComplianceReportOrganizationSnapshot instance.

        Raises:
            NoResultFound: If the organization is not found.
        """
        # If prev_report_id is provided, try to reuse the snapshot
        if prev_report_id:
            try:
                prev_snapshot = await self.repo.get_by_compliance_report_id(
                    prev_report_id
                )
                if prev_snapshot:
                    org_snapshot = ComplianceReportOrganizationSnapshot(
                        name=prev_snapshot.name,
                        operating_name=prev_snapshot.operating_name,
                        email=prev_snapshot.email,
                        phone=prev_snapshot.phone,
                        head_office_address=prev_snapshot.head_office_address,
                        records_address=prev_snapshot.records_address,
                        service_address=prev_snapshot.service_address,
                        compliance_report_id=compliance_report_id,
                    )
                    return await self.repo.save_snapshot(org_snapshot)
            except NoResultFound:
                pass

        # Otherwise, get the organization data to create a new snapshot
        organization = await self.repo.get_organization(organization_id)

        if not organization:
            raise NoResultFound(f"Organization with ID {organization_id} not found.")

        bc_address = None
        head_office_address = None
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
            head_office_address = ", ".join(filter(None, service_addr_parts))

        org_snapshot = ComplianceReportOrganizationSnapshot(
            name=organization.name,
            operating_name=organization.operating_name or organization.name,
            email=organization.email,
            phone=organization.phone,
            head_office_address=head_office_address,
            records_address=organization.records_address,
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
        snapshot.head_office_address = request_data.head_office_address
        snapshot.records_address = request_data.records_address
        snapshot.service_address = request_data.service_address
        snapshot.is_edited = True

        updated_snapshot = await self.repo.save_snapshot(snapshot)
        return updated_snapshot
