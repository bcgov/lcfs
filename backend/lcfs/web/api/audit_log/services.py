from typing import List
from math import ceil

from fastapi import Depends

from .repo import AuditLogRepository
from lcfs.web.api.audit_log.schema import (
    AuditLogSchema,
    AuditLogListItemSchema,
    AuditLogListSchema,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.audit.AuditLog import AuditLog


class AuditLogService:
    def __init__(self, repo: AuditLogRepository = Depends(AuditLogRepository)):
        self.repo = repo

    def apply_audit_log_filters(
        self, pagination: PaginationRequestSchema, conditions: List
    ):
        """
        Apply filters to the audit logs query.
        """
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filter_type

            # Handle date filters
            if filter.filter_type == "date":
                filter_value = []
                if filter.date_from:
                    filter_value.append(filter.date_from)
                if filter.date_to:
                    filter_value.append(filter.date_to)
                if not filter_value:
                    continue  # Skip if no valid date is provided

            # Retrieve the correct field based on the filter field name
            field = get_field_for_filter(AuditLog, filter.field)

            if field is not None:
                condition = apply_filter_conditions(
                    field, filter_value, filter_option, filter_type
                )
                if condition is not None:
                    conditions.append(condition)

    @service_handler
    async def get_audit_logs_paginated(
        self, pagination: PaginationRequestSchema
    ) -> AuditLogListSchema:
        """
        Fetch audit logs with filters, sorting, and pagination.
        """
        conditions = []
        pagination = validate_pagination(pagination)

        if pagination.filters:
            self.apply_audit_log_filters(pagination, conditions)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size

        audit_logs, total_count = await self.repo.get_audit_logs_paginated(
            offset, limit, conditions, pagination.sort_orders
        )

        processed_audit_logs = []
        for audit_log in audit_logs:
            # Extract the changed_fields as a comma-separated string
            if audit_log.delta:
                changed_fields = ", ".join(audit_log.delta.keys())
            else:
                changed_fields = None

            processed_log = AuditLogListItemSchema(
                audit_log_id=audit_log.audit_log_id,
                table_name=audit_log.table_name,
                operation=audit_log.operation,
                row_id=audit_log.row_id,
                changed_fields=changed_fields,
                create_date=audit_log.create_date,
                create_user=audit_log.create_user,
            )
            processed_audit_logs.append(processed_log)

        return AuditLogListSchema(
            audit_logs=processed_audit_logs,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=ceil(total_count / pagination.size),
            ),
        )

    @service_handler
    async def get_audit_log_by_id(self, audit_log_id: int) -> AuditLogSchema:
        """Fetch a single audit log by ID."""
        audit_log = await self.repo.get_audit_log_by_id(audit_log_id)
        if not audit_log:
            raise DataNotFoundException("Audit log not found")
        return AuditLogSchema.model_validate(audit_log)
