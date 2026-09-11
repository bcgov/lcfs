from __future__ import annotations

from typing import Sequence

from sqlalchemy import and_, case, func, select

from lcfs.db.base import ActionTypeEnum


class VersioningQueryHelper:
    """Shared helpers for selecting the newest row in a versioned group."""

    @staticmethod
    def latest_version_subquery(
        model,
        *,
        group_uuid_column=None,
        version_column=None,
        version_label: str = "selected_version",
        where_clauses=(),
    ):
        """Return the max version for each `group_uuid` in the model."""
        group_uuid_column = group_uuid_column or model.group_uuid
        version_column = version_column or model.version

        stmt = select(
            group_uuid_column.label("group_uuid"),
            func.max(version_column).label(version_label),
        ).group_by(group_uuid_column)

        if where_clauses:
            stmt = stmt.where(*where_clauses)

        return stmt.subquery()

    @staticmethod
    def deleted_groups_subquery(
        model,
        *,
        group_uuid_column=None,
        version_column=None,
        action_type_column=None,
        where_clauses=(),
        version_label: str = "max_version",
    ):
        """
        Return the `group_uuid`s whose latest version (within `where_clauses`,
        typically scoped to a compliance report chain) is a DELETE record.

        We check the latest version rather than any version because
        ETL-migrated TFRS supplemental chains can have DELETE followed
        by UPDATE on the same group_uuid (not possible in modern LCFS).
        """
        group_uuid_column = group_uuid_column or model.group_uuid
        version_column = version_column or model.version
        action_type_column = (
            action_type_column if action_type_column is not None else model.action_type
        )

        latest_version_per_group = VersioningQueryHelper.latest_version_subquery(
            model,
            group_uuid_column=group_uuid_column,
            version_column=version_column,
            version_label=version_label,
            where_clauses=where_clauses,
        )

        return (
            select(group_uuid_column)
            .join(
                latest_version_per_group,
                and_(
                    group_uuid_column == latest_version_per_group.c.group_uuid,
                    version_column == latest_version_per_group.c[version_label],
                ),
            )
            .where(action_type_column == ActionTypeEnum.DELETE)
            .distinct()
        )

    @staticmethod
    def latest_version_ranking_subquery(
        model,
        *,
        group_uuid_column=None,
        version_column=None,
        id_column=None,
        id_label: str = "id",
        include_version: bool = True,
        version_label: str = "selected_version",
        row_number_label: str = "row_number",
        status_alias=None,
        status_join_condition=None,
        status_field=None,
        prefer_validated: bool = False,
        status_priority_values: Sequence[str] = ("Draft", "Updated"),
        extra_order_by=None,
        additional_joins=(),
        where_clauses=(),
    ):
        """Return the latest row per `group_uuid` using row-number ranking."""
        group_uuid_column = group_uuid_column or model.group_uuid
        version_column = version_column or model.version
        order_by = list(extra_order_by or [])

        if status_alias is not None and status_field is not None:
            if prefer_validated:
                status_priority = case(
                    (status_field.in_(status_priority_values), 1),
                    else_=0,
                )
                order_by.extend([status_priority.asc(), version_column.desc()])
            else:
                order_by.append(version_column.desc())
        else:
            order_by.append(version_column.desc())

        stmt = select(group_uuid_column.label("group_uuid"))

        if id_column is not None:
            stmt = stmt.add_columns(id_column.label(id_label))

        if include_version:
            stmt = stmt.add_columns(version_column.label(version_label))

        stmt = stmt.add_columns(
            func.row_number()
            .over(
                partition_by=group_uuid_column,
                order_by=order_by,
            )
            .label(row_number_label)
        )

        if status_alias is not None and status_join_condition is not None:
            stmt = stmt.join(status_alias, status_join_condition)

        for join_target, join_condition in additional_joins:
            stmt = stmt.join(join_target, join_condition)

        if where_clauses:
            stmt = stmt.where(*where_clauses)

        return stmt.subquery()
