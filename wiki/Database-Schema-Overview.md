# Database Schema Overview

This document provides an overview of the LCFS application's database schema, how it's managed, and where to find more detailed information.

The primary database for the LCFS application is **PostgreSQL**.

## 1. Schema Management - Alembic

Database schema migrations (changes over time) are managed using **Alembic**, a database migration tool for SQLAlchemy.

*   **Alembic Configuration**: `backend/alembic.ini`.
*   **Migration Scripts**: Individual migration scripts are located in `backend/lcfs/db/migrations/versions/`.
    *   These scripts define the changes to be applied to the database schema (e.g., creating tables, adding columns, modifying constraints).
*   **Seeder Scripts**: Data seeding operations (populating initial or test data) can also be managed via Alembic migrations, typically found in `backend/lcfs/db/seeders/` if this convention is followed, or as part of regular migration scripts.

### Managing Migrations (`backend/migrate.sh`)

The `backend/migrate.sh` script is a utility to simplify common Alembic operations:

1.  **Make the script executable** (if not already):
    ```bash
    cd backend
    chmod +x migrate.sh
    ```

2.  **Generating a New Migration**:
    When you make changes to SQLAlchemy models in `backend/lcfs/db/models/`, you need to generate a new migration script.
    ```bash
    ./migrate.sh -g "Your descriptive message about the changes"
    ```
    This will create a new file in `backend/lcfs/db/migrations/versions/`. You should then review and edit this script to ensure it accurately reflects the intended changes.

3.  **Upgrading the Database (Applying Migrations)**:
    To apply pending migrations to your database (e.g., to upgrade to the latest version or a specific revision):
    ```bash
    ./migrate.sh -u [revision_id]
    ```
    *   Omit `[revision_id]` to upgrade to the `head` (latest version).
    *   The `docker-compose up` command for the main application may also automatically apply migrations on startup if its entrypoint script is configured to do so.

4.  **Downgrading the Database (Reverting Migrations)**:
    To revert migrations:
    ```bash
    ./migrate.sh -d [revision_id]
    ```
    *   Omit `[revision_id]` to revert all migrations back to the base state (an empty database from Alembic's perspective).
    *   Use with caution, especially in environments with data.

5.  **Displaying Help**:
    For more options and help with the script:
    ```bash
    ./migrate.sh -h
    ```

## 2. ORM Models (SQLAlchemy)

The database schema is defined programmatically using SQLAlchemy ORM models.

*   **Model Location**: `backend/lcfs/db/models/` (e.g., `user_model.py`, `report_model.py`, etc.).
*   These Python classes define the tables, columns, relationships, and constraints of the database.
*   Alembic uses these model definitions (often by comparing them to the current database state) to auto-generate migration scripts.

## 3. Entity Relationship Diagram (ERD)

*   An existing Entity Relationship Diagram is available: `LCFS_ERD_v0.2.0.drawio` (located in the project root).
*   This diagram provides a visual representation of the database schema, including tables, columns, primary keys, foreign keys, and relationships.
*   It is recommended to keep this diagram updated as the schema evolves. You can use [draw.io](https://app.diagrams.net/) (or a compatible desktop version) to view and edit this file.

## 4. Key Tables and Relationships (High-Level - To Be Expanded)

*(This section should be populated based on the `LCFS_ERD_v0.2.0.drawio` file and a review of the SQLAlchemy models. It should list major entities and how they relate to each other.)*

Examples of potential key entities (based on typical LCFS requirements):

*   **Users & Organizations**: User accounts, roles, permissions, and their association with organizations/companies.
*   **Fuel Suppliers/Producers**: Information about entities involved in fuel production and supply.
*   **Fuel Types**: Different types of low carbon fuels.
*   **Compliance Reports**: Reports submitted for compliance periods, detailing fuel transactions, carbon intensities, credits/deficits.
*   **Transactions**: Records of fuel transfers, sales, or consumption.
*   **Credit/Deficit Tracking**: Ledger for LCFS credits and deficits.
*   **Notifications**: System notifications to users.
*   **Audit Logs**: Tracking significant actions within the system.

## 5. Data Integrity

*   **Primary Keys**: Each table should have a primary key to uniquely identify records.
*   **Foreign Keys**: Relationships between tables are enforced using foreign key constraints.
*   **NOT NULL Constraints**: Applied to columns that must have a value.
*   **UNIQUE Constraints**: Ensure values in a column or set of columns are unique.
*   **CHECK Constraints**: Enforce specific conditions on data values.
*   **Enum Types**: PostgreSQL ENUM types (managed via `alembic-postgresql-enum`) are used for columns with a fixed set of possible values.

---
*For the most accurate and detailed schema information, always refer to the SQLAlchemy models in `backend/lcfs/db/models/` and the Alembic migration scripts. The ERD should be used as a visual guide and kept synchronized with the codebase.* 