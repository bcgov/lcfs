# Data Migration (TFRS to LCFS)

This document describes the process and tools used for migrating data from the TFRS (Transportation Fuel Reporting System) database to the LCFS (Low Carbon Fuel Standard) application database. This process primarily involves Apache NiFi for data flow orchestration and supporting shell scripts. This is based on the original "12. Data migration from TFRS to LCFS" wiki page.

## 1. Overview

The ETL (Extract, Transform, Load) subsystem, located in the `etl/` directory, is responsible for this data migration. Key components involved:

*   **Apache NiFi**: The core data flow automation tool. NiFi flows are designed to extract data from the TFRS database, perform necessary transformations, and load it into the LCFS database.
*   **`etl/data-migration.sh` script**: A shell script that automates several aspects of the NiFi-based data migration process, including managing NiFi processor states and ensuring database connectivity.
*   **`etl/data-transfer.sh` script**: A utility script for transferring database dumps between OpenShift environments and local PostgreSQL containers (useful for setting up test data or diagnosing issues with production-like data).
*   **Source Database**: TFRS PostgreSQL database.
*   **Target Database**: LCFS application PostgreSQL database.

## 2. The `etl/data-migration.sh` Script

This script is a key tool for managing the NiFi data migration flows.

### 2.1. Purpose & Main Features

*   **Automated NiFi Processor Execution**: Triggers specific NiFi processors in a defined sequence to run the data migration tasks.
*   **Environment Targeting**: Can be targeted at different environments (dev, test, prod) to manage connections and configurations accordingly.
*   **Database Connection Management**: Potentially updates NiFi controller services for database connections (though the old wiki mentions this, the script itself would need to be reviewed for current implementation details).
*   **Port Forwarding**: Can establish `oc port-forward` connections to ensure NiFi can reach OpenShift-hosted TFRS and LCFS databases if NiFi is running locally.
*   **Logging & Error Handling**: Provides verbose and debug logging options for troubleshooting.

### 2.2. Prerequisites

*   **Apache NiFi Instance**: A running and accessible NiFi instance (local via `etl/docker-compose.yml` or a deployed instance).
*   **OpenShift CLI (`oc`)**: Must be installed and logged into the target OpenShift cluster if interacting with OpenShift-hosted databases.
*   **`jq`**: Command-line JSON processor, used by the script.
*   **`lsof`**: Utility to list open files (used by the script to check port usage).

### 2.3. Usage

```bash
cd etl
./data-migration.sh [environment] [--debug | --verbose]
```

*   **`[environment]`**: Specify `dev`, `test`, or `prod`. This determines the OpenShift namespace and potentially other environment-specific configurations used by the script.
*   **`--debug`**: Enables the most detailed logging output.
*   **`--verbose`**: Enables verbose logging for troubleshooting.

### 2.4. Script Workflow (Conceptual)

1.  **Environment Setup**: Sets variables based on the specified environment.
2.  **Port Forwarding (if needed)**: Checks and establishes `oc port-forward` for TFRS and LCFS databases to make them accessible to NiFi (e.g., if NiFi is local and databases are on OpenShift).
3.  **Update NiFi Controller Services (if applicable)**: May update database connection details in NiFi controller services based on the target environment.
4.  **Execute NiFi Processors**: Iterates through a predefined list of NiFi processor IDs, starting them and monitoring their status.
    *   The script contains a list of processor IDs (e.g., `ORGANIZATION_PROCESSOR`, `USER_PROCESSOR`, `TRANSFER_PROCESSOR`). These IDs must match the actual processor IDs in your NiFi flow template.

### 2.5. Updating Processor IDs in the Script

If the NiFi flow template changes and processor IDs are updated, you **must** update them in `etl/data-migration.sh`:

1.  **Get Processor IDs from NiFi UI**:
    *   Access your NiFi UI (e.g., `http://localhost:8091/nifi/`).
    *   Right-click on the relevant processor, select "Configure".
    *   In the "Settings" tab of the configuration dialog, find and copy the "Processor ID".
    ![NiFi Processor ID Example](images/nifi_processor_id_example.png) *(Self-referential: an image would go here if this were a real wiki; for now, this is a placeholder. The original wiki mentioned an image.)*

2.  **Update `data-migration.sh`**:
    Edit the script and update the readonly variables at the top with the new IDs:
    ```bash
    # Example from original wiki
    readonly ORGANIZATION_PROCESSOR="new_org_processor_id_here"
    readonly USER_PROCESSOR="new_user_processor_id_here"
    readonly TRANSFER_PROCESSOR="new_transfer_processor_id_here"
    ```
    Also, ensure the `execute_processor` calls at the end of the script use these variables correctly and are in the desired order.

### 2.6. Troubleshooting (from original wiki)

*   **Port Already in Use**: If port forwarding fails, use `lsof -ti :<port_number> | xargs kill -9` to kill the process using the port.
*   **Processor ID Not Found**: Verify IDs in NiFi UI and in the script.
*   **NiFi API Errors (HTTP 400/500)**: Ensure NiFi is running, accessible, and API credentials/URLs used by the script (if any) are correct.

## 3. The `etl/data-transfer.sh` Script

This script is a general utility for moving data between OpenShift PostgreSQL instances and local PostgreSQL containers using `pg_dump`.

### 3.1. Usage

```bash
cd etl
./data-transfer.sh <tfrs|lcfs> <dev|test|prod> <import|export> <local_container_name_or_id>
```

*   **Argument 1**: `tfrs` or `lcfs` (target/source application database type).
*   **Argument 2**: `dev`, `test`, or `prod` (OpenShift environment).
*   **Argument 3**: `import` (OpenShift to Local) or `export` (Local to OpenShift).
*   **Argument 4**: Name or ID of the local PostgreSQL Docker container.

**Example Commands (from original wiki):**
```bash
./data-transfer.sh lcfs dev export your_local_lcfs_db_container
./data-transfer.sh tfrs prod import your_local_tfrs_db_container
```

### 3.2. Prerequisites

*   `oc` CLI installed and logged into the target OpenShift cluster.
*   Local target/source PostgreSQL Docker container running.

## 4. NiFi Flow Details

*   The actual ETL logic (transformations, specific source/target mappings) is defined within the Apache NiFi flow templates found in `etl/templates/`.
*   Understanding these flows requires accessing the NiFi UI, uploading the template, and inspecting the processors and their configurations.
*   Failed records during NiFi processing are typically logged to `etl/nifi_output/` for inspection.

---
*This guide provides an overview of the data migration scripts and processes. For detailed ETL logic, refer to the NiFi flow templates. Always test migration scripts thoroughly in non-production environments before running against production data.* 