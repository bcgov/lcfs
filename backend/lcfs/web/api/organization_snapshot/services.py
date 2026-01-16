import structlog
from fastapi import Depends, Request
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Tuple

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import ComplianceReportOrganizationSnapshot
from lcfs.services.geocoder.client import BCGeocoderService
from lcfs.services.geocoder.dependency import get_geocoder_service_async
from lcfs.web.api.organization_snapshot.repo import OrganizationSnapshotRepository

logger = structlog.get_logger(__name__)


class OrganizationSnapshotService:
    def __init__(
        self,
        request: Request = None,
        repo: OrganizationSnapshotRepository = Depends(OrganizationSnapshotRepository),
        session: AsyncSession = Depends(get_async_db_session),
        geocoder: BCGeocoderService = Depends(get_geocoder_service_async),
    ) -> None:
        self.repo = repo
        self.request = request
        self.session = session
        self.geocoder = geocoder

    async def _geocode_snapshot_address(
        self,
        records_address: Optional[str],
        service_address: Optional[str],
        head_office_address: Optional[str],
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Geocode organization address using priority order:
        1. records_address - Required to be in BC where records are maintained
        2. service_address - BC postal address for service
        3. head_office_address - Can be international, last resort

        Returns:
            Tuple of (latitude, longitude) or (None, None) if geocoding fails
        """
        addresses_to_try = [
            (records_address, "records_address"),
            (service_address, "service_address"),
            (head_office_address, "head_office_address"),
        ]

        for address, address_type in addresses_to_try:
            if address:
                try:
                    result = await self.geocoder.forward_geocode(address, use_fallback=True)
                    if result.success and result.address:
                        logger.info(
                            f"Geocoded {address_type} successfully",
                            latitude=result.address.latitude,
                            longitude=result.address.longitude,
                            source=result.source,
                        )
                        return result.address.latitude, result.address.longitude
                    else:
                        logger.debug(
                            f"Geocoding failed for {address_type}",
                            address=address[:50],
                            error=result.error,
                        )
                except Exception as e:
                    logger.warning(
                        f"Geocoding error for {address_type}",
                        address=address[:50],
                        error=str(e),
                    )

        logger.info("All geocoding attempts failed for organization snapshot")
        return None, None

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
                    # Reuse existing coordinates if available, otherwise geocode
                    latitude = prev_snapshot.latitude
                    longitude = prev_snapshot.longitude

                    if latitude is None or longitude is None:
                        latitude, longitude = await self._geocode_snapshot_address(
                            prev_snapshot.records_address,
                            prev_snapshot.service_address,
                            prev_snapshot.head_office_address,
                        )

                    org_snapshot = ComplianceReportOrganizationSnapshot(
                        name=prev_snapshot.name,
                        operating_name=prev_snapshot.operating_name,
                        email=prev_snapshot.email,
                        phone=prev_snapshot.phone,
                        head_office_address=prev_snapshot.head_office_address,
                        records_address=prev_snapshot.records_address,
                        service_address=prev_snapshot.service_address,
                        latitude=latitude,
                        longitude=longitude,
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

        records_address = organization.records_address

        # Geocode the address
        latitude, longitude = await self._geocode_snapshot_address(
            records_address,
            service_address,
            head_office_address,
        )

        org_snapshot = ComplianceReportOrganizationSnapshot(
            name=organization.name,
            operating_name=organization.operating_name or organization.name,
            email=organization.email,
            phone=organization.phone,
            head_office_address=head_office_address,
            records_address=records_address,
            service_address=service_address,
            latitude=latitude,
            longitude=longitude,
            compliance_report_id=compliance_report_id,
        )

        org_snapshot = await self.repo.save_snapshot(org_snapshot)
        return org_snapshot

    async def update(self, request_data, compliance_report_id):
        """
        Updates the snapshot fields for the specified compliance report using `request_data`.
        Re-geocodes the address if any address field has changed.
        """

        snapshot = await self.repo.get_by_compliance_report_id(compliance_report_id)
        if not snapshot:
            raise NoResultFound(
                f"No Organization Snapshot found for compliance_report_id={compliance_report_id}"
            )

        # Check if any address field has changed
        address_changed = (
            snapshot.records_address != request_data.records_address
            or snapshot.service_address != request_data.service_address
            or snapshot.head_office_address != request_data.head_office_address
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

        # Re-geocode if address changed or coordinates are missing
        if address_changed or snapshot.latitude is None or snapshot.longitude is None:
            snapshot.latitude, snapshot.longitude = await self._geocode_snapshot_address(
                request_data.records_address,
                request_data.service_address,
                request_data.head_office_address,
            )

        updated_snapshot = await self.repo.save_snapshot(snapshot)
        return updated_snapshot
