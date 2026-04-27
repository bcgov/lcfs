import re
from typing import Any, List, Optional

from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.utils.constants import POSTAL_REGEX
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.final_supply_equipment.schema import FinalSupplyEquipmentCreateSchema

_POSTAL_CODE_PATTERN = re.compile(POSTAL_REGEX)

# Latitude / longitude bounds mirror the UI editors in
# frontend/src/views/FinalSupplyEquipments/_schema.jsx.
_LAT_MIN, _LAT_MAX = -90.0, 90.0
_LON_MIN, _LON_MAX = -180.0, 180.0


class FinalSupplyEquipmentValidation:
    def __init__(
        self,
        request: Request = None,
        fse_repo: FinalSupplyEquipmentRepository = Depends(
            FinalSupplyEquipmentRepository
        ),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.fse_repo = fse_repo
        self.request = request
        self.report_repo = report_repo

    async def validate_fse_record(
        self,
        compliance_report_id: int,
        final_supply_equipments: List[FinalSupplyEquipmentCreateSchema],
    ):
        all_errors: List[dict] = []

        for index, entry in enumerate(final_supply_equipments):
            if entry.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Mismatch compliance_report_id in final supply "
                        f"equipment at index {index}: "
                        f"expected {compliance_report_id}, "
                        f"got {entry.compliance_report_id}"
                    ),
                )

            if entry.deleted:
                continue

            all_errors.extend(self._validate_entry(entry, index))

        if all_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Invalid final supply equipment data",
                    "errors": all_errors,
                },
            )

    def _validate_entry(
        self, entry: FinalSupplyEquipmentCreateSchema, index: int
    ) -> List[dict]:
        errors: List[dict] = []

        required_text_fields = (
            ("organization_name", entry.organization_name),
            ("serial_nbr", entry.serial_nbr),
            ("manufacturer", entry.manufacturer),
            ("level_of_equipment", entry.level_of_equipment),
            ("street_address", entry.street_address),
            ("city", entry.city),
            ("postal_code", entry.postal_code),
        )
        for field_name, value in required_text_fields:
            if not _is_non_blank_string(value):
                errors.append(
                    _field_error(index, field_name, f"{field_name} is required")
                )

        if entry.supply_from_date is None:
            errors.append(
                _field_error(index, "supply_from_date", "supply_from_date is required")
            )
        if entry.supply_to_date is None:
            errors.append(
                _field_error(index, "supply_to_date", "supply_to_date is required")
            )
        if (
            entry.supply_from_date is not None
            and entry.supply_to_date is not None
            and entry.supply_to_date < entry.supply_from_date
        ):
            errors.append(
                _field_error(
                    index,
                    "supply_to_date",
                    "supply_to_date must be on or after supply_from_date",
                )
            )

        if not entry.intended_use_types:
            errors.append(
                _field_error(
                    index,
                    "intended_use_types",
                    "At least one intended use type is required",
                )
            )
        if not entry.intended_user_types:
            errors.append(
                _field_error(
                    index,
                    "intended_user_types",
                    "At least one intended user type is required",
                )
            )

        if _is_non_blank_string(entry.postal_code) and not _POSTAL_CODE_PATTERN.match(
            entry.postal_code
        ):
            errors.append(
                _field_error(
                    index,
                    "postal_code",
                    "postal_code must match the Canadian format 'A1A 1A1'",
                )
            )

        errors.extend(
            _validate_coordinate(
                index, "latitude", entry.latitude, _LAT_MIN, _LAT_MAX
            )
        )
        errors.extend(
            _validate_coordinate(
                index, "longitude", entry.longitude, _LON_MIN, _LON_MAX
            )
        )

        if entry.kwh_usage is not None and entry.kwh_usage < 0:
            errors.append(
                _field_error(
                    index, "kwh_usage", "kwh_usage must be zero or greater"
                )
            )

        return errors

    async def check_equipment_uniqueness_and_overlap(
        self, data: FinalSupplyEquipmentCreateSchema
    ):
        # Check for exact duplicates
        is_duplicate = await self.fse_repo.check_uniques_of_fse_row(data)
        if is_duplicate:
            raise ValueError(
                "Duplicate equipment found. Each equipment must be unique based on serial number, supply date range and location."
            )

        # Check for date range overlap
        is_overlapping = await self.fse_repo.check_overlap_of_fse_row(data)
        if is_overlapping:
            raise ValueError(
                f"Date range overlap found for equipment with serial number {data.serial_nbr} at the same Charging site."
            )

        return True  # If no duplicates or overlaps found


def _is_non_blank_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _field_error(index: int, field: str, message: str) -> dict:
    return {"index": index, "field": field, "message": message}


def _validate_coordinate(
    index: int,
    field_name: str,
    value: Optional[float],
    minimum: float,
    maximum: float,
) -> List[dict]:
    if value is None:
        return [_field_error(index, field_name, f"{field_name} is required")]
    if value < minimum or value > maximum:
        return [
            _field_error(
                index,
                field_name,
                f"{field_name} must be between {minimum} and {maximum}",
            )
        ]
    return []
