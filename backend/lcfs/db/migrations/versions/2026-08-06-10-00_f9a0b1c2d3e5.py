"""Add per-mode transport distance tables to CI pathways.

Revision ID: f9a0b1c2d3e5
Revises: 9b5d3c7e1f0a
Create Date: 2026-08-06 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f9a0b1c2d3e5"
down_revision = "9b5d3c7e1f0a"
branch_labels = None
depends_on = None


def _raise_on_unmatched_pathway_transport_modes(column_name):
    bind = op.get_bind()
    unmatched_modes = (
        bind.execute(
            sa.text(
                f"""
            SELECT DISTINCT btrim(mode_name) AS mode_name
            FROM pathway p
            CROSS JOIN LATERAL regexp_split_to_table(p.{column_name}, ',') AS mode_name
            LEFT JOIN transport_mode tm ON tm.transport_mode = btrim(mode_name)
            WHERE p.{column_name} IS NOT NULL
              AND btrim(mode_name) <> ''
              AND tm.transport_mode_id IS NULL
            ORDER BY mode_name
            """
            )
        )
        .scalars()
        .all()
    )
    if unmatched_modes:
        raise RuntimeError(
            "Cannot migrate pathway transport modes because these values do not "
            f"match transport_mode lookup rows: {', '.join(unmatched_modes)}"
        )


def upgrade():
    op.add_column(
        "feedstock_fuel_transport_mode",
        sa.Column(
            "distance",
            sa.Integer(),
            nullable=True,
            comment="Distance in kilometres for this feedstock fuel transport mode",
        ),
    )
    op.add_column(
        "finished_fuel_transport_mode",
        sa.Column(
            "distance",
            sa.Integer(),
            nullable=True,
            comment="Distance in kilometres for this finished fuel transport mode",
        ),
    )
    op.create_table(
        "pathway_feedstock_transport_mode",
        sa.Column(
            "pathway_feedstock_transport_mode_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier",
        ),
        sa.Column(
            "pathway_id",
            sa.Integer(),
            nullable=False,
            comment="Pathway identifier",
        ),
        sa.Column(
            "transport_mode_id",
            sa.Integer(),
            nullable=False,
            comment="Transport mode identifier",
        ),
        sa.Column(
            "distance",
            sa.Integer(),
            nullable=False,
            comment="Distance in kilometres for this feedstock transport mode",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment=(
                "Date and time (UTC) when the physical record was updated in the"
                " database. It will be the same as the create_date until the record"
                " is first updated after creation."
            ),
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["pathway_id"],
            ["pathway.pathway_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["transport_mode_id"],
            ["transport_mode.transport_mode_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("pathway_feedstock_transport_mode_id"),
        sa.UniqueConstraint("pathway_id", "transport_mode_id"),
        comment="Transport modes and distances associated with pathway feedstock",
    )
    op.create_table(
        "pathway_finished_fuel_transport_mode",
        sa.Column(
            "pathway_finished_fuel_transport_mode_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier",
        ),
        sa.Column(
            "pathway_id",
            sa.Integer(),
            nullable=False,
            comment="Pathway identifier",
        ),
        sa.Column(
            "transport_mode_id",
            sa.Integer(),
            nullable=False,
            comment="Transport mode identifier",
        ),
        sa.Column(
            "distance",
            sa.Integer(),
            nullable=False,
            comment="Distance in kilometres for this finished fuel transport mode",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment=(
                "Date and time (UTC) when the physical record was updated in the"
                " database. It will be the same as the create_date until the record"
                " is first updated after creation."
            ),
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["pathway_id"],
            ["pathway.pathway_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["transport_mode_id"],
            ["transport_mode.transport_mode_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("pathway_finished_fuel_transport_mode_id"),
        sa.UniqueConstraint("pathway_id", "transport_mode_id"),
        comment="Transport modes and distances associated with pathway finished fuel",
    )
    _raise_on_unmatched_pathway_transport_modes("feedstock_transport_mode")
    _raise_on_unmatched_pathway_transport_modes("finished_fuel_transport_mode")
    op.execute(
        """
        INSERT INTO pathway_feedstock_transport_mode (
            pathway_id,
            transport_mode_id,
            distance,
            create_user,
            update_user
        )
        SELECT
            p.pathway_id,
            tm.transport_mode_id,
            p.feedstock_transport_distance,
            p.create_user,
            p.update_user
        FROM pathway p
        CROSS JOIN LATERAL regexp_split_to_table(p.feedstock_transport_mode, ',') AS mode_name
        JOIN transport_mode tm ON tm.transport_mode = btrim(mode_name)
        WHERE p.feedstock_transport_mode IS NOT NULL
          AND btrim(mode_name) <> ''
        ON CONFLICT (pathway_id, transport_mode_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO pathway_finished_fuel_transport_mode (
            pathway_id,
            transport_mode_id,
            distance,
            create_user,
            update_user
        )
        SELECT
            p.pathway_id,
            tm.transport_mode_id,
            p.finished_fuel_transport_distance,
            p.create_user,
            p.update_user
        FROM pathway p
        CROSS JOIN LATERAL regexp_split_to_table(p.finished_fuel_transport_mode, ',') AS mode_name
        JOIN transport_mode tm ON tm.transport_mode = btrim(mode_name)
        WHERE p.finished_fuel_transport_mode IS NOT NULL
          AND btrim(mode_name) <> ''
        ON CONFLICT (pathway_id, transport_mode_id) DO NOTHING
        """
    )
    op.drop_column("pathway", "finished_fuel_transport_distance")
    op.drop_column("pathway", "finished_fuel_transport_mode")
    op.drop_column("pathway", "feedstock_transport_distance")
    op.drop_column("pathway", "feedstock_transport_mode")


def downgrade():
    # Downgrade restores the old single-distance shape from per-mode rows.
    # If multiple modes have different distances, the legacy column can only
    # hold one value, so use max(distance) below as a deterministic collapse.
    # Columns are restored nullable because rows with no link records cannot
    # be reconstructed after the normalized tables are dropped.
    op.add_column(
        "pathway",
        sa.Column(
            "feedstock_transport_mode",
            sa.String(length=500),
            nullable=True,
            comment="Mode of transport used to move the feedstock to the facility",
        ),
    )
    op.add_column(
        "pathway",
        sa.Column(
            "feedstock_transport_distance",
            sa.Integer(),
            nullable=True,
            comment="Distance (km) the feedstock is transported to the facility",
        ),
    )
    op.add_column(
        "pathway",
        sa.Column(
            "finished_fuel_transport_mode",
            sa.String(length=500),
            nullable=True,
            comment="Mode of transport used to deliver the finished fuel",
        ),
    )
    op.add_column(
        "pathway",
        sa.Column(
            "finished_fuel_transport_distance",
            sa.Integer(),
            nullable=True,
            comment="Distance (km) the finished fuel is transported for delivery",
        ),
    )
    op.execute(
        """
        UPDATE pathway p
        SET
            feedstock_transport_mode = agg.transport_modes,
            feedstock_transport_distance = agg.distance
        FROM (
            SELECT
                pftm.pathway_id,
                string_agg(tm.transport_mode, ',' ORDER BY tm.transport_mode) AS transport_modes,
                max(pftm.distance) AS distance
            FROM pathway_feedstock_transport_mode pftm
            JOIN transport_mode tm ON tm.transport_mode_id = pftm.transport_mode_id
            GROUP BY pftm.pathway_id
        ) agg
        WHERE p.pathway_id = agg.pathway_id
        """
    )
    op.execute(
        """
        UPDATE pathway p
        SET
            finished_fuel_transport_mode = agg.transport_modes,
            finished_fuel_transport_distance = agg.distance
        FROM (
            SELECT
                pfftm.pathway_id,
                string_agg(tm.transport_mode, ',' ORDER BY tm.transport_mode) AS transport_modes,
                max(pfftm.distance) AS distance
            FROM pathway_finished_fuel_transport_mode pfftm
            JOIN transport_mode tm ON tm.transport_mode_id = pfftm.transport_mode_id
            GROUP BY pfftm.pathway_id
        ) agg
        WHERE p.pathway_id = agg.pathway_id
        """
    )
    op.drop_table("pathway_finished_fuel_transport_mode")
    op.drop_table("pathway_feedstock_transport_mode")
    op.drop_column("finished_fuel_transport_mode", "distance")
    op.drop_column("feedstock_fuel_transport_mode", "distance")
