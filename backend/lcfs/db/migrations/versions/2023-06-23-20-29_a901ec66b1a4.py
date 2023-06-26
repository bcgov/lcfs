"""empty message

Revision ID: a901ec66b1a4
Revises:
Create Date: 2023-06-23 20:29:16.930820

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a901ec66b1a4"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "organization_type",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "type",
            sa.String(length=25),
            nullable=True,
            comment="Enumerated value to describe the organization type.",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="Description of the organization type. This is the displayed name.",
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("type"),
    )
    op.create_table(
        "organization_actions_type",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "the_type",
            sa.String(length=25),
            nullable=False,
            comment="Enumerated value to describe the organization actions type.",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="Description of the organization actions type. This is the displayed name.",
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("the_type"),
    )
    op.create_table(
        "organization_status",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=25),
            nullable=True,
            comment="Enumerated value to describe the organization status.",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="Description of the organization status. This is the displayed name.",
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("status"),
        sa.UniqueConstraint("status"),
    )
    op.create_table(
        "permission",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "code", sa.String(length=100), nullable=True, comment="Permission Code"
        ),
        sa.Column(
            "name", sa.String(length=100), nullable=True, comment="descriptive name"
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="description of each permission",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("code", name="_code_uc"),
        comment="Contains the list of permissions to grant access to certain actions of areas for the system.",
    )
    op.create_table(
        "role",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "name",
            sa.String(length=200),
            nullable=False,
            comment="Role code. Natural key. Used internally. eg Admin, GovUser, GovDirector, etc",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="Descriptive text explaining this role. This is what's shown to the user.",
        ),
        sa.Column(
            "is_government_role",
            sa.Boolean(),
            nullable=True,
            comment="Flag. True if this is a government role (eg. Analyst, Administrator)",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("name"),
        comment="To hold all the available roles and  their descriptions.",
    )
    op.create_table(
        "user_login_history",
        sa.Column(
            "keycloak_email",
            sa.String(),
            nullable=False,
            comment="Keycloak email address to associate on first login.",
        ),
        sa.Column(
            "external_username",
            sa.String(length=150),
            nullable=True,
            comment="BCeID or IDIR username",
        ),
        sa.Column(
            "keycloak_user_id",
            sa.String(length=150),
            nullable=True,
            comment="This is the unique id returned from Keycloak and is the main mapping key between the TFRS user and the Keycloak user. The identity provider type will be appended as a suffix after an @ symbol. For ex. asdf1234@bceidbasic or asdf1234@idir",
        ),
        sa.Column(
            "is_login_successful",
            sa.Boolean(),
            nullable=True,
            comment="True if this login attempt was successful, false on failure.",
        ),
        sa.Column(
            "login_error_message",
            sa.String(length=500),
            nullable=True,
            comment="Error text on unsuccessful login attempt.",
        ),
        sa.Column("id", sa.Integer(), nullable=False),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Keeps track of all user login attempts",
    )
    op.create_table(
        "organization",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization",
        ),
        sa.Column(
            "name",
            sa.String(length=500),
            nullable=True,
            comment="Organization's legal name",
        ),
        sa.Column("status_id", sa.Integer(), nullable=True),
        sa.Column("actions_type_id", sa.Integer(), nullable=True),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.ForeignKeyConstraint(
            ["actions_type_id"],
            ["organization_actions_type.id"],
        ),
        sa.ForeignKeyConstraint(
            ["status_id"],
            ["organization_status.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Contains a list of all of the recognized Part 3 fuel suppliers, both past and present, as well as an entry for the government which is also considered an organization.",
    )
    op.create_table(
        "role_permission",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permission.id"],
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["role.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "permission_id", name="_role_permission_uc"),
        comment="Relationship between roles and permissions",
    )
    op.create_table(
        "organization_history",
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column(
            "history_text",
            sa.String(length=1000),
            nullable=True,
            comment="Details for this history entry",
        ),
        sa.Column("id", sa.Integer(), nullable=False),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "organization_address",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("address_line_1", sa.String(length=500), nullable=True),
        sa.Column("address_line_2", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=10), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("other", sa.String(length=100), nullable=True),
        sa.Column("attorney_city", sa.String(length=100), nullable=True),
        sa.Column("attorney_postal_code", sa.String(length=10), nullable=True),
        sa.Column("attorney_province", sa.String(length=50), nullable=True),
        sa.Column("attorney_country", sa.String(length=100), nullable=True),
        sa.Column("attorney_address_other", sa.String(length=100), nullable=True),
        sa.Column("attorney_street_address", sa.String(length=500), nullable=True),
        sa.Column("attorney_representativename", sa.String(length=500), nullable=True),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Represents an organization's address.",
    )
    op.create_table(
        "organization_balance",
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column(
            "validated_credits",
            sa.BigInteger(),
            nullable=True,
            comment="The actual balance of validated Low Carbon Fuel credits held by a fuel supplier between the effective_date and the expiration_date. If expiration_date is NULL then we assume that it is the current balance.",
        ),
        sa.Column("id", sa.Integer(), nullable=False),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        comment="Represents a fuel supplier organization's credit balance at a given point in time. The government organization does not have an actual credit balance, but rather one was set artificially high to enable the awarding or validating of credits to fuel suppliers within TFRS.",
    )
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "username", sa.String(length=150), nullable=False, comment="Login Username"
        ),
        sa.Column(
            "keycloak_user_id",
            sa.String(length=150),
            nullable=True,
            comment="Unique id returned from Keycloak",
        ),
        sa.Column(
            "password", sa.String(length=128), nullable=True, comment="Password hash"
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
            comment="Primary email address",
        ),
        sa.Column(
            "title", sa.String(length=100), nullable=True, comment="Professional Title"
        ),
        sa.Column(
            "phone", sa.String(length=50), nullable=True, comment="Primary phone number"
        ),
        sa.Column(
            "cell_phone",
            sa.String(length=50),
            nullable=True,
            comment="Mobile phone number",
        ),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column(
            "display_name",
            sa.String(length=500),
            nullable=True,
            comment="Displayed name for user",
        ),
        sa.Column(
            "is_mapped",
            sa.Boolean(),
            nullable=False,
            comment="whether or not the user has been mapped to the system",
        ),
        sa.Column(
            "first_name",
            sa.String(length=150),
            nullable=True,
            comment="First name (retrieved from Siteminder",
        ),
        sa.Column(
            "last_name",
            sa.String(length=150),
            nullable=True,
            comment="Last name (retrieved from Siteminder)",
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, comment="True if can login"
        ),
        sa.Column(
            "last_login", sa.DateTime(), nullable=True, comment="Last login time"
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("username"),
        comment="Users who may access the application",
    )
    op.create_table(
        "user_role",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique ID for the user role",
        ),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=True),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time that the code became valid and could be used.",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="The date and time after which the code is no longer valid and should not be used.",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["role.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role_id", name="user_role_unique_constraint"),
        comment="Contains  the user and role relationships",
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("user_role")
    op.drop_table("user")
    op.drop_table("organization_balance")
    op.drop_table("organization_address")
    op.drop_table("organization_history")
    op.drop_table("role_permission")
    op.drop_table("organization")
    op.drop_table("user_login_history")
    op.drop_table("role")
    op.drop_table("permission")
    op.drop_table("organization_status")
    op.drop_table("organization_actions_type")
    op.drop_table("organization_type")
    # ### end Alembic commands ###
