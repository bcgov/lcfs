"""
LCJFIP application services (#5532).

A Draft saves with any field empty. Submission checks completeness against
what was saved, so the applicant saves the form before submitting it.
"""

import re
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, status

from lcfs.db.models.lcjfip import (
    LCJFIPApplication,
    LCJFIPApplicationStatusEnum,
    LCJFIPCarType,
    LCJFIPCertificateType,
    LCJFIPFeedstockSource,
    LCJFIPIncentiveOption,
    LCJFIPPurchaseDetail,
)
from lcfs.utils.dates import to_pacific_date
from lcfs.web.api.lcjfip import calculations
from lcfs.web.api.lcjfip.repo import LCJFIPRepository
from lcfs.web.api.lcjfip.schema import (
    LCJFIPApplicationListItemSchema,
    LCJFIPApplicationSaveSchema,
    LCJFIPApplicationSchema,
    LCJFIPContactSchema,
    LCJFIPFuelCodeOptionSchema,
    LCJFIPFuelSupplierOrganizationSchema,
    LCJFIPIncentiveOptionSchema,
    LCJFIPIncentiveRateSchema,
    LCJFIPOptionSchema,
    LCJFIPOrganizationInfoSchema,
    LCJFIPPurchaseDetailSchema,
    LCJFIPReferenceDataSchema,
    LCJFIPSubmitSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import ValidationErrorException

if TYPE_CHECKING:
    from lcfs.services.s3.client import DocumentService

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
REQUIRED = "This field is required."

# Stored column scales, so calculations use the values the database keeps.
SCALE_2 = Decimal("0.01")
SCALE_4 = Decimal("0.0001")

FUEL_SUPPLIER_FIELDS = (
    "fuel_supplier_organization_id",
    "fuel_supplier_legal_name",
    "fuel_supplier_contact_first_name",
    "fuel_supplier_contact_last_name",
    "fuel_supplier_contact_email",
)


def _quantize(value: Optional[Decimal], scale: Decimal) -> Optional[Decimal]:
    return None if value is None else value.quantize(scale, ROUND_HALF_UP)


def _float(value) -> Optional[float]:
    return None if value is None else float(value)


def _full_name(user) -> Optional[str]:
    if user is None:
        return None
    return " ".join(filter(None, [user.first_name, user.last_name])) or None


def _fuel_code_label(fuel_code) -> str:
    prefix = fuel_code.fuel_code_prefix.prefix if fuel_code.fuel_code_prefix else ""
    return f"{prefix}{fuel_code.fuel_suffix}"


def _to_fuel_code_option(fuel_code) -> LCJFIPFuelCodeOptionSchema:
    return LCJFIPFuelCodeOptionSchema(
        fuel_code_id=fuel_code.fuel_code_id,
        fuel_code=_fuel_code_label(fuel_code),
        carbon_intensity=float(fuel_code.carbon_intensity),
        company=fuel_code.company,
    )


def _to_org_info(organization) -> Optional[LCJFIPOrganizationInfoSchema]:
    if organization is None:
        return None
    address = organization.org_address
    address_line = None
    if address is not None:
        address_line = ", ".join(
            filter(
                None,
                [
                    address.street_address,
                    address.address_other,
                    address.city,
                    address.province_state,
                    address.country,
                    address.postalCode_zipCode,
                ],
            )
        )
    return LCJFIPOrganizationInfoSchema(
        organization_id=organization.organization_id,
        name=organization.name,
        operating_name=organization.operating_name,
        email=organization.email,
        phone=organization.phone,
        address_line=address_line or None,
    )


def _validation_error(errors: List[dict]) -> ValidationErrorException:
    return ValidationErrorException({"errors": errors})


def _field_error(field: str, message: str) -> dict:
    return {"fields": [field], "message": message}


class LCJFIPServices:
    def __init__(self, repo: LCJFIPRepository = Depends()) -> None:
        self.repo = repo

    # ------------------------------------------------------------------
    # Reference data
    # ------------------------------------------------------------------

    @service_handler
    async def get_reference_data(self) -> LCJFIPReferenceDataSchema:
        today = to_pacific_date(datetime.now(timezone.utc))

        def options(rows, id_attr):
            return [
                LCJFIPOptionSchema(id=getattr(row, id_attr), name=row.name)
                for row in rows
                if row.effective_status
            ]

        incentive_options = [
            LCJFIPIncentiveOptionSchema(
                id=option.lcjfip_incentive_option_id,
                name=option.name,
                incentive_type=option.incentive_type.value,
                requires_fuel_supplier=option.requires_fuel_supplier,
            )
            for option in await self.repo.get_incentive_options()
            if option.effective_status
        ]
        rates = [
            LCJFIPIncentiveRateSchema(
                incentive_type=rate.incentive_type.value,
                ci_lower_bound=_float(rate.ci_lower_bound),
                ci_upper_bound=_float(rate.ci_upper_bound),
                max_rate_per_litre=float(rate.max_rate_per_litre),
                description=rate.description,
            )
            for rate in await self.repo.get_incentive_rates()
            if calculations.rate_applies_on(rate, today)
        ]
        return LCJFIPReferenceDataSchema(
            car_types=options(await self.repo.get_car_types(), "lcjfip_car_type_id"),
            certificate_types=options(
                await self.repo.get_certificate_types(), "lcjfip_certificate_type_id"
            ),
            feedstock_sources=options(
                await self.repo.get_feedstock_sources(), "lcjfip_feedstock_source_id"
            ),
            incentive_options=incentive_options,
            incentive_rates=rates,
            max_price_premium_range=float(calculations.MAX_PRICE_PREMIUM_RANGE),
        )

    @service_handler
    async def get_fuel_codes(self) -> List[LCJFIPFuelCodeOptionSchema]:
        today = to_pacific_date(datetime.now(timezone.utc))
        return [
            _to_fuel_code_option(fuel_code)
            for fuel_code in await self.repo.get_lcjf_fuel_codes(today)
        ]

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    @service_handler
    async def list_applications(
        self, organization_id: int
    ) -> List[LCJFIPApplicationListItemSchema]:
        return [
            LCJFIPApplicationListItemSchema(
                lcjfip_application_id=application.lcjfip_application_id,
                application_number=f"LCJFIP-{application.lcjfip_application_id}",
                status=application.status.status,
                signed_date=application.signed_date,
                create_date=application.create_date,
                update_date=application.update_date,
            )
            for application in await self.repo.list_for_organization(organization_id)
        ]

    @service_handler
    async def get_application(
        self, application: LCJFIPApplication
    ) -> LCJFIPApplicationSchema:
        return await self._to_schema(application)

    async def _to_schema(
        self, application: LCJFIPApplication
    ) -> LCJFIPApplicationSchema:
        option = application.incentive_option
        rate_date = to_pacific_date(
            application.signed_date or datetime.now(timezone.utc)
        )
        max_rate = calculations.select_max_rate(
            await self.repo.get_incentive_rates(),
            option.incentive_type if option else None,
            application.estimated_carbon_intensity,
            rate_date,
        )
        purchase_details = sorted(
            application.purchase_details,
            key=lambda row: row.lcjfip_purchase_detail_id,
        )
        contact = application.contact_user
        supplier = application.fuel_supplier_organization
        return LCJFIPApplicationSchema(
            lcjfip_application_id=application.lcjfip_application_id,
            application_number=f"LCJFIP-{application.lcjfip_application_id}",
            status=application.status.status,
            organization=_to_org_info(application.organization),
            contact=(
                LCJFIPContactSchema(
                    user_profile_id=contact.user_profile_id,
                    first_name=contact.first_name,
                    last_name=contact.last_name,
                    title=contact.title,
                    email=contact.email,
                    phone=contact.phone,
                )
                if contact
                else None
            ),
            car_type_ids=[c.lcjfip_car_type_id for c in application.car_types],
            certificate_type_id=application.certificate_type_id,
            incentive_option_id=application.incentive_option_id,
            incentive_type=option.incentive_type.value if option else None,
            estimated_carbon_intensity=_float(application.estimated_carbon_intensity),
            fuel_code=(
                _to_fuel_code_option(application.fuel_code)
                if application.fuel_code
                else None
            ),
            requested_incentive_volume=application.requested_incentive_volume,
            total_estimated_volume=calculations.total_estimated_volume(
                row.estimated_volume for row in purchase_details
            ),
            max_incentive_rate_per_litre=_float(max_rate),
            estimated_incentive_amount=_float(application.estimated_incentive_amount),
            fuel_supplier_organization=(
                LCJFIPFuelSupplierOrganizationSchema(
                    organization_id=supplier.organization_id, name=supplier.name
                )
                if supplier
                else None
            ),
            fuel_supplier_legal_name=application.fuel_supplier_legal_name,
            fuel_supplier_contact_first_name=application.fuel_supplier_contact_first_name,
            fuel_supplier_contact_last_name=application.fuel_supplier_contact_last_name,
            fuel_supplier_contact_email=application.fuel_supplier_contact_email,
            application_period=(
                application.application_period.description
                if application.application_period
                else None
            ),
            signed_by=_full_name(application.signed_by_user),
            signed_date=application.signed_date,
            purchase_details=[
                LCJFIPPurchaseDetailSchema(
                    lcjfip_purchase_detail_id=row.lcjfip_purchase_detail_id,
                    estimated_volume=row.estimated_volume,
                    anticipated_delivery_date=row.anticipated_delivery_date,
                    feedstock_source_ids=[
                        source.lcjfip_feedstock_source_id
                        for source in row.feedstock_sources
                    ],
                    estimated_blend_percentage=_float(row.estimated_blend_percentage),
                    assumed_jet_a_price=_float(row.assumed_jet_a_price),
                    price_premium_from=_float(row.price_premium_from),
                    price_premium_to=_float(row.price_premium_to),
                )
                for row in purchase_details
            ],
            create_date=application.create_date,
            update_date=application.update_date,
        )

    async def _reload_schema(self, application_id: int) -> LCJFIPApplicationSchema:
        application = await self.repo.get_by_id(application_id, reload=True)
        return await self._to_schema(application)

    # ------------------------------------------------------------------
    # Create / save
    # ------------------------------------------------------------------

    @staticmethod
    def _require_draft(application: LCJFIPApplication, action: str) -> None:
        if application.status.status != LCJFIPApplicationStatusEnum.Draft.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only Draft applications can be {action}.",
            )

    @service_handler
    async def create_application(
        self, organization_id: int, data: LCJFIPApplicationSaveSchema, user
    ) -> LCJFIPApplicationSchema:
        draft = await self.repo.get_status(LCJFIPApplicationStatusEnum.Draft.value)
        application = LCJFIPApplication(
            organization_id=organization_id,
            contact_user_profile_id=user.user_profile_id,
            status_id=draft.lcjfip_application_status_id,
        )
        # Initialised here so later assignments don't lazy-load under asyncio.
        application.car_types = []
        application.purchase_details = []
        await self.repo.add(application)
        await self._apply(application, data)
        await self.repo.add_history(application, draft, user.user_profile_id)
        return await self._reload_schema(application.lcjfip_application_id)

    @service_handler
    async def save_application(
        self, application: LCJFIPApplication, data: LCJFIPApplicationSaveSchema
    ) -> LCJFIPApplicationSchema:
        self._require_draft(application, "edited")
        await self._apply(application, data)
        return await self._reload_schema(application.lcjfip_application_id)

    async def _lookup(self, model, id_column, ids, field: str, errors: list) -> Dict:
        rows = {
            getattr(row, id_column.key): row
            for row in await self.repo.get_by_ids(model, id_column, list(set(ids)))
        }
        if any(identifier not in rows for identifier in ids):
            errors.append(_field_error(field, "Select a valid option."))
        return rows

    async def _apply(
        self, application: LCJFIPApplication, data: LCJFIPApplicationSaveSchema
    ) -> None:
        errors: List[dict] = []

        car_types = await self._lookup(
            LCJFIPCarType,
            LCJFIPCarType.lcjfip_car_type_id,
            data.car_type_ids,
            "carTypeIds",
            errors,
        )
        await self._lookup(
            LCJFIPCertificateType,
            LCJFIPCertificateType.lcjfip_certificate_type_id,
            [data.certificate_type_id] if data.certificate_type_id else [],
            "certificateTypeId",
            errors,
        )
        options = await self._lookup(
            LCJFIPIncentiveOption,
            LCJFIPIncentiveOption.lcjfip_incentive_option_id,
            [data.incentive_option_id] if data.incentive_option_id else [],
            "incentiveOptionId",
            errors,
        )
        feedstocks = await self._lookup(
            LCJFIPFeedstockSource,
            LCJFIPFeedstockSource.lcjfip_feedstock_source_id,
            [i for row in data.purchase_details for i in row.feedstock_source_ids],
            "purchaseDetails",
            errors,
        )
        today = to_pacific_date(datetime.now(timezone.utc))

        # A fuel code already on the application stays valid if it later expires.
        if (
            data.fuel_code_id is not None
            and data.fuel_code_id != application.fuel_code_id
            and not await self.repo.get_lcjf_fuel_codes(today, [data.fuel_code_id])
        ):
            errors.append(
                _field_error(
                    "fuelCodeId",
                    "Select an approved low carbon jet fuel code.",
                )
            )

        option = options.get(data.incentive_option_id)
        requires_supplier = bool(option and option.requires_fuel_supplier)
        supplier_org_id = (
            data.fuel_supplier_organization_id if requires_supplier else None
        )
        if supplier_org_id is not None and supplier_org_id != (
            application.fuel_supplier_organization_id
        ):
            if supplier_org_id == application.organization_id:
                errors.append(
                    _field_error(
                        "fuelSupplierLegalName",
                        "The fuel supplier must be another organization.",
                    )
                )
            elif not await self.repo.is_registered_organization(supplier_org_id):
                errors.append(
                    _field_error(
                        "fuelSupplierLegalName",
                        "Select a fuel supplier registered in the LCFS Portal.",
                    )
                )

        existing_rows = {
            row.lcjfip_purchase_detail_id: row for row in application.purchase_details
        }
        for index, row in enumerate(data.purchase_details):
            if (
                row.lcjfip_purchase_detail_id is not None
                and row.lcjfip_purchase_detail_id not in existing_rows
            ):
                errors.append(
                    _field_error(
                        f"purchaseDetails.{index}",
                        "This purchase detail row is not on the application.",
                    )
                )

        if errors:
            raise _validation_error(errors)

        # Applicant and incentive fields
        application.car_types = [car_types[i] for i in dict.fromkeys(data.car_type_ids)]
        application.certificate_type_id = data.certificate_type_id
        application.incentive_option_id = data.incentive_option_id
        application.estimated_carbon_intensity = _quantize(
            data.estimated_carbon_intensity, SCALE_2
        )
        application.fuel_code_id = data.fuel_code_id
        application.requested_incentive_volume = data.requested_incentive_volume

        # Fuel supplier fields apply only to the fuel supplier transfer option.
        # A linked organization carries the legal name, so it is not copied.
        if requires_supplier:
            application.fuel_supplier_organization_id = supplier_org_id
            application.fuel_supplier_legal_name = (
                None if supplier_org_id is not None else data.fuel_supplier_legal_name
            )
            application.fuel_supplier_contact_first_name = (
                data.fuel_supplier_contact_first_name
            )
            application.fuel_supplier_contact_last_name = (
                data.fuel_supplier_contact_last_name
            )
            application.fuel_supplier_contact_email = data.fuel_supplier_contact_email
        else:
            for field in FUEL_SUPPLIER_FIELDS:
                setattr(application, field, None)

        # Purchase details: update rows by id, add new ones, drop missing ones.
        kept_ids = set()
        for row_data in data.purchase_details:
            if row_data.lcjfip_purchase_detail_id is not None:
                row = existing_rows[row_data.lcjfip_purchase_detail_id]
                kept_ids.add(row.lcjfip_purchase_detail_id)
            else:
                row = LCJFIPPurchaseDetail()
                row.feedstock_sources = []
                application.purchase_details.append(row)
            row.estimated_volume = row_data.estimated_volume
            row.anticipated_delivery_date = row_data.anticipated_delivery_date
            row.estimated_blend_percentage = _quantize(
                row_data.estimated_blend_percentage, SCALE_2
            )
            row.assumed_jet_a_price = _quantize(row_data.assumed_jet_a_price, SCALE_4)
            row.price_premium_from = _quantize(row_data.price_premium_from, SCALE_4)
            row.price_premium_to = _quantize(row_data.price_premium_to, SCALE_4)
            row.feedstock_sources = [
                feedstocks[i] for i in dict.fromkeys(row_data.feedstock_source_ids)
            ]
        for row_id, row in existing_rows.items():
            if row_id not in kept_ids:
                application.purchase_details.remove(row)

        await self._recalculate(application, option, today)
        await self.repo.flush()

    async def _recalculate(
        self, application: LCJFIPApplication, option, on_date: date
    ) -> None:
        """The estimated incentive amount is calculated, never entered."""
        max_rate = calculations.select_max_rate(
            await self.repo.get_incentive_rates(),
            option.incentive_type if option else None,
            application.estimated_carbon_intensity,
            on_date,
        )
        application.estimated_incentive_amount = (
            calculations.estimated_incentive_amount(
                application.requested_incentive_volume, max_rate
            )
        )

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    @service_handler
    async def delete_application(
        self, application: LCJFIPApplication, document_service: "DocumentService"
    ) -> List[str]:
        """
        Delete a Draft with its input data, comments and attachments. Returns
        the S3 keys to delete once the transaction has committed.
        """
        self._require_draft(application, "deleted")
        application_id = application.lcjfip_application_id
        file_keys: List[str] = []

        comments = await self.repo.get_comments(application_id)
        for comment in comments:
            for document in list(comment.documents):
                file_key = await document_service.delete_file(
                    document.document_id,
                    comment.internal_comment_id,
                    "internal_comment",
                    defer_storage_delete=True,
                )
                if file_key:
                    file_keys.append(file_key)

        for document in await self.repo.get_application_documents(application_id):
            file_key = await document_service.delete_file(
                document.document_id,
                application_id,
                "lcjfip_application",
                defer_storage_delete=True,
            )
            if file_key:
                file_keys.append(file_key)

        await self.repo.delete(application)
        await self.repo.delete_comments([c.internal_comment_id for c in comments])
        return file_keys

    # ------------------------------------------------------------------
    # Submit
    # ------------------------------------------------------------------

    def _submission_errors(
        self, application: LCJFIPApplication, declarations: LCJFIPSubmitSchema
    ) -> List[dict]:
        errors: List[dict] = []
        option = application.incentive_option

        if option is None:
            errors.append(
                _field_error(
                    "incentiveOptionId", "Select a preferred incentive option."
                )
            )
        if not application.requested_incentive_volume:
            errors.append(
                _field_error(
                    "requestedIncentiveVolume",
                    "Enter the total volume of LCJF incentive requested.",
                )
            )

        rows = sorted(
            application.purchase_details, key=lambda row: row.lcjfip_purchase_detail_id
        )
        if not rows:
            errors.append(
                _field_error("purchaseDetails", "Add at least one LCJF purchase.")
            )
        for index, row in enumerate(rows):
            prefix = f"purchaseDetails.{index}"
            if not row.estimated_volume:
                errors.append(_field_error(f"{prefix}.estimatedVolume", REQUIRED))
            if row.anticipated_delivery_date is None:
                errors.append(
                    _field_error(f"{prefix}.anticipatedDeliveryDate", REQUIRED)
                )
            if row.assumed_jet_a_price is None:
                errors.append(_field_error(f"{prefix}.assumedJetAPrice", REQUIRED))
            if row.price_premium_from is None:
                errors.append(_field_error(f"{prefix}.pricePremiumFrom", REQUIRED))
            if row.price_premium_to is None:
                errors.append(_field_error(f"{prefix}.pricePremiumTo", REQUIRED))
            premium_error = calculations.price_premium_range_error(
                row.price_premium_from, row.price_premium_to
            )
            if premium_error:
                errors.append(_field_error(f"{prefix}.pricePremiumTo", premium_error))

        total_volume = calculations.total_estimated_volume(
            row.estimated_volume for row in rows
        )
        if (
            application.requested_incentive_volume
            and total_volume is not None
            and application.requested_incentive_volume > total_volume
        ):
            errors.append(
                _field_error(
                    "requestedIncentiveVolume",
                    "The volume requested must not exceed the estimated total "
                    "volume for support.",
                )
            )

        if option is not None and option.requires_fuel_supplier:
            if not (
                application.fuel_supplier_organization_id
                or application.fuel_supplier_legal_name
            ):
                errors.append(_field_error("fuelSupplierLegalName", REQUIRED))
            if not application.fuel_supplier_contact_first_name:
                errors.append(_field_error("fuelSupplierContactFirstName", REQUIRED))
            if not application.fuel_supplier_contact_last_name:
                errors.append(_field_error("fuelSupplierContactLastName", REQUIRED))
            email = application.fuel_supplier_contact_email
            if not email:
                errors.append(_field_error("fuelSupplierContactEmail", REQUIRED))
            elif not EMAIL_RE.match(email):
                errors.append(
                    _field_error(
                        "fuelSupplierContactEmail", "Enter a valid email address."
                    )
                )

        if not (
            declarations.declaration_authority
            and declarations.declaration_documentation
            and declarations.declaration_public_recognition
        ):
            errors.append(
                _field_error("declarations", "Select all of the declarations.")
            )
        return errors

    @service_handler
    async def submit_application(
        self, application: LCJFIPApplication, declarations: LCJFIPSubmitSchema, user
    ) -> LCJFIPApplicationSchema:
        self._require_draft(application, "submitted")
        errors = self._submission_errors(application, declarations)
        if errors:
            raise _validation_error(errors)

        signed_at = datetime.now(timezone.utc)
        submission_date = to_pacific_date(signed_at)
        await self._recalculate(
            application, application.incentive_option, submission_date
        )
        submitted = await self.repo.get_status(
            LCJFIPApplicationStatusEnum.Submitted.value
        )
        # With no intake period open, staff assign one later.
        period = await self.repo.get_open_period(submission_date)
        application.status_id = submitted.lcjfip_application_status_id
        application.application_period_id = (
            period.lcjfip_application_period_id if period else None
        )
        application.signed_by_user_profile_id = user.user_profile_id
        application.signed_date = signed_at
        await self.repo.flush()

        schema = await self._reload_schema(application.lcjfip_application_id)
        await self.repo.add_history(
            application,
            submitted,
            user.user_profile_id,
            snapshot=schema.model_dump(mode="json", by_alias=True),
        )
        return schema
