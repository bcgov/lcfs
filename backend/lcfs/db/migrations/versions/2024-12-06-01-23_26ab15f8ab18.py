"""update end use table with new values

Revision ID: 26ab15f8ab18
Revises: d4104af84f2b
Create Date: 2024-12-06 01:23:21.598991

"""

import sqlalchemy as sa
from alembic import op
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "26ab15f8ab18"
down_revision = "d4104af84f2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    current_time = datetime.now()

    # Update existing end use types 14-21 to new values
    updates = [
        (14, 'Aircraft'),
        (15, 'Compression-ignition engine- Marine, general'),
        (16, 'Compression-ignition engine- Marine, operated within 51 to 75% of load range'),
        (17, 'Compression-ignition engine- Marine, operated within 76 to 100% of load range'),
        (18, 'Compression-ignition engine- Marine, with methane slip reduction kit- General'),
        (19, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 51 to 75% of load range'),
        (20, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 76 to 100% of load range'),
        (21, 'Compression-ignition engine- Marine, unknown whether kit is installed or average operating load range')
    ]

    for end_use_id, type_name in updates:
        op.execute(
            """
            UPDATE end_use_type 
            SET type = '{}',
                sub_type = NULL,
                intended_use = true,
                update_date = '{}',
                update_user = 'no_user'
            WHERE end_use_type_id = {}
            """.format(type_name, current_time, end_use_id)
        )

    # Update existing UCI values for IDs 1-9
    uci_updates = [
        (1, 7, 5, None, 0),  # Remove end_use_type_id 14
        (2, None, 5, None, 0),  # Remove fuel_type_id and end_use_type_id
        (3, 7, 5, 15, 27.3),  # Update with new end_use_type_id and intensity
        (4, 7, 5, 16, 17.8),
        (5, 7, 5, 17, 12.2),
        (6, 7, 5, 18, 10.6),
        (7, 7, 5, 19, 8.4),
        (8, 7, 5, 20, 8.0),
        (9, 7, 5, 21, 27.3)
    ]

    for uci_id, fuel_type_id, uom_id, end_use_type_id, intensity in uci_updates:
        if fuel_type_id and end_use_type_id:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = {},
                    uom_id = {},
                    end_use_type_id = {},
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(fuel_type_id, uom_id, end_use_type_id, intensity, current_time, uci_id)
            )
        elif fuel_type_id:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = {},
                    uom_id = {},
                    end_use_type_id = NULL,
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(fuel_type_id, uom_id, intensity, current_time, uci_id)
            )
        else:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = NULL,
                    uom_id = {},
                    end_use_type_id = NULL,
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(uom_id, intensity, current_time, uci_id)
            )

    # Update existing EER values for IDs 14-24
    eer_updates = [
        (14, 2, 3, 10, 2.8),  # Changed to Shore power
        (15, 2, 3, 11, 2.4),  # Changed to Trolley bus
        (16, 2, 3, 2, 1.0),   # Changed to Other or unknown
        (17, 2, 6, 3, 1.8),   # Changed to Fuel cell vehicle
        (18, 2, 6, 2, 0.9),   # Changed to Other or unknown
        (19, 2, 13, None, 0.9),  # Changed to default ratio
        (20, 3, 3, None, 2.5),  # Changed to default ratio
        (21, 3, 11, None, 1.0),  # Changed to default ratio
        (22, 2, 7, 15, 1.0),    # Changed to new marine type
        (23, 2, 7, 16, 1.0),    # Changed to new marine type
        (24, 2, 7, 17, 1.0)     # Changed to new marine type
    ]

    for eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio in eer_updates:
        if end_use_type_id:
            op.execute(
                """
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {},
                    fuel_type_id = {},
                    end_use_type_id = {},
                    ratio = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE eer_id = {}
                """.format(fuel_category_id, fuel_type_id, end_use_type_id, ratio, current_time, eer_id)
            )
        else:
            op.execute(
                """
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {},
                    fuel_type_id = {},
                    end_use_type_id = NULL,
                    ratio = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE eer_id = {}
                """.format(fuel_category_id, fuel_type_id, ratio, current_time, eer_id)
            )


def downgrade() -> None:
    current_time = datetime.now()

    # Restore original end use types 14-21
    original_values = [
        (14, 'Marine', 'General'),
        (15, 'Marine', 'Operated within 51 to 75% of load range'),
        (16, 'Marine', 'Operated within 76 to 100% of load range'),
        (17, 'Marine, w/ methane slip reduction kit', 'General'),
        (18, 'Marine, w/ methane slip reduction kit',
         'Operated within 51 to 75% of load range'),
        (19, 'Marine, w/ methane slip reduction kit',
         'Operated within 76 to 100% of load range'),
        (20, 'Unknown', None),
        (21, 'Aircraft', None)
    ]

    for end_use_id, type_name, sub_type in original_values:
        if sub_type:
            op.execute(
                """
                UPDATE end_use_type 
                SET type = '{}',
                    sub_type = '{}',
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE end_use_type_id = {}
                """.format(type_name, sub_type, current_time, end_use_id)
            )
        else:
            op.execute(
                """
                UPDATE end_use_type 
                SET type = '{}',
                    sub_type = NULL,
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE end_use_type_id = {}
                """.format(type_name, current_time, end_use_id)
            )

    # Restore original UCI values
    uci_originals = [
        (1, 7, 5, 14, 27.3),
        (2, 7, 5, 15, 17.8),
        (3, 7, 5, 16, 12.2),
        (4, 7, 5, 17, 10.6),
        (5, 7, 5, 18, 8.4),
        (6, 7, 5, 19, 8.0),
        (7, 7, 5, 20, 27.3),
        (8, 7, 5, None, 0),
        (9, None, 5, None, 0)
    ]

    for uci_id, fuel_type_id, uom_id, end_use_type_id, intensity in uci_originals:
        if fuel_type_id and end_use_type_id:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = {},
                    uom_id = {},
                    end_use_type_id = {},
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(fuel_type_id, uom_id, end_use_type_id, intensity, current_time, uci_id)
            )
        elif fuel_type_id:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = {},
                    uom_id = {},
                    end_use_type_id = NULL,
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(fuel_type_id, uom_id, intensity, current_time, uci_id)
            )
        else:
            op.execute(
                """
                UPDATE additional_carbon_intensity 
                SET fuel_type_id = NULL,
                    uom_id = {},
                    end_use_type_id = NULL,
                    intensity = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {}
                """.format(uom_id, intensity, current_time, uci_id)
            )

    # Restore original EER values
    eer_originals = [
        (14, 2, 3, 14, 2.5),  # Restore to Marine
        (15, 2, 3, 10, 2.8),  # Restore to Shore power
        (16, 2, 3, 11, 2.4),  # Restore to Trolley bus
        (17, 2, 3, 2, 1.0),   # Restore to Other or unknown
        (18, 2, 6, 3, 1.8),   # Restore to Fuel cell vehicle
        (19, 2, 6, 2, 0.9),   # Restore to Other or unknown
        (20, 2, 7, 12, 1.0),  # Restore to Compression-ignition engine
        (21, 2, 7, 2, 0.9),   # Restore to Other or unknown
        (22, 2, 13, None, 0.9),  # Restore to default ratio
        (23, 3, 3, None, 2.5),  # Restore to default ratio
        (24, 3, 11, None, 1.0)  # Restore to default ratio
    ]

    for eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio in eer_originals:
        if end_use_type_id:
            op.execute(
                """
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {},
                    fuel_type_id = {},
                    end_use_type_id = {},
                    ratio = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE eer_id = {}
                """.format(fuel_category_id, fuel_type_id, end_use_type_id, ratio, current_time, eer_id)
            )
        else:
            op.execute(
                """
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {},
                    fuel_type_id = {},
                    end_use_type_id = NULL,
                    ratio = {},
                    update_date = '{}',
                    update_user = 'no_user'
                WHERE eer_id = {}
                """.format(fuel_category_id, fuel_type_id, ratio, current_time, eer_id)
            )
