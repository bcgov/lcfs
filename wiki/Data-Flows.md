# Data Flows

This document describes key data flows within the LCFS system, covering user interactions, API communication, asynchronous processing, and ETL processes. This addresses requirements for ticket #2409.

## 1. User Authentication and Authorization Flow (Keycloak)

1.  **User Accesses Frontend**: User navigates to the LCFS React frontend application.
2.  **Redirection to Keycloak**: The frontend (using `@react-keycloak/web`) detects the user is not authenticated and redirects the browser to the Keycloak login page.
3.  **User Authenticates**: User enters credentials (e.g., IDIR, BCEID) on the Keycloak page.
4.  **Token Issuance**: Keycloak authenticates the user and issues OIDC tokens (ID Token, Access Token, Refresh Token) back to the frontend via browser redirects.
5.  **Token Storage**: The frontend stores these tokens securely (e.g., in memory, `keycloak-js` handles this).
6.  **API Requests with Access Token**: For subsequent requests to the LCFS Backend API, the frontend includes the Access Token (JWT) in the `Authorization: Bearer <token>` header.
7.  **Backend Token Validation**: The LCFS Backend (FastAPI) receives the request, extracts the JWT, and validates it (signature, expiry, issuer, audience) against Keycloak's public keys.
8.  **Authorization Check**: Based on valid token claims (e.g., roles, user ID), the backend performs authorization checks for the requested resource/action.
9.  **Response**: Backend processes the request and sends a response to the frontend.

## 2. Typical User Interaction Data Flow (e.g., Submitting a Report)

1.  **User Fills Form**: User interacts with a form in the React frontend (e.g., creating a compliance report).
2.  **Client-Side Validation**: Frontend performs initial validation using libraries like React Hook Form and Yup.
3.  **API Request**: On submission, the frontend (using `axios` and possibly managed by React Query `useMutation`) sends a POST or PUT request to the appropriate LCFS Backend API endpoint (e.g., `/api/reports`). The request payload contains the form data, and the `Authorization` header includes the JWT.
4.  **Backend Processing**:
    *   Receives the request.
    *   Validates the JWT (as above).
    *   Performs authorization.
    *   Validates the incoming data using Pydantic models.
    *   Executes business logic (e.g., calculating values, checking rules).
    *   Interacts with the PostgreSQL database (SQLAlchemy) to create or update records.
    *   May interact with MinIO for file storage (if attachments are involved).
    *   May publish a message to RabbitMQ if an asynchronous task needs to be triggered (e.g., generating a PDF version of the report).
5.  **API Response**: Backend sends a response (e.g., success message with the new report ID, or error details).
6.  **Frontend Update**: Frontend updates the UI based on the API response (e.g., navigates to a success page, displays an error message, React Query updates cache).

## 3. Asynchronous Task Processing (RabbitMQ)

1.  **Task Trigger**: An LCFS Backend API endpoint, upon a certain action (e.g., report submission, scheduled job), publishes a message to a specific RabbitMQ queue. The message contains necessary data for the task.
2.  **Message Queued**: RabbitMQ receives and queues the message.
3.  **Worker Consumption**: A dedicated worker process (part of the backend or a separate worker service, TBD by inspecting backend code) consumes messages from the queue.
4.  **Task Execution**: The worker performs the long-running or deferrable task (e.g., generating a complex report, sending an email notification, processing a large dataset).
    *   This worker may interact with the database, MinIO, or other services.
5.  **Status Update (Optional)**: The worker might update the status of the task in the database or send a notification (e.g., via WebSocket, email, or another RabbitMQ message) upon completion or failure.

## 4. ETL Data Flow (TFRS to LCFS via Apache NiFi)

Refer to [Data Migration (TFRS to LCFS)](Data-Migration-TFRS-to-LCFS.md) and [Subsystems and Responsibilities](Subsystems-and-Responsibilities.md#7-etl-subsystem-extract-transform-load---in-etl-directory) for a detailed overview.

1.  **NiFi Flow Trigger**: The migration process is typically initiated by starting a NiFi data flow (manually via UI or programmatically, potentially using `etl/data-migration.sh`).
2.  **Data Extraction**: NiFi processors connect to the TFRS PostgreSQL database (source) via JDBC.
3.  **Data Transformation**: Data passes through a series of NiFi processors that perform transformations:
    *   Data type mapping.
    *   Schema alignment.
    *   Value lookups or conversions.
    *   Data cleansing.
    *   (Specific transformations are defined in the NiFi flow templates in `etl/templates/`.)
4.  **Data Loading**: Transformed data is loaded into the LCFS PostgreSQL database (target) by NiFi processors using JDBC.
5.  **Error Handling**: Records that fail during transformation or loading are routed to an error flow within NiFi and typically logged to files in `etl/nifi_output/`.
6.  **Monitoring**: NiFi UI provides monitoring of data flow progress, queues, and processor status.

## 5. Caching Data Flow

Refer to [Caching Strategy](Caching-Strategy.md).

1.  **API Request**: Frontend or another service requests data from a cacheable LCFS Backend API endpoint.
2.  **Cache Check**: The `fastapi-cache2` integration in the backend checks Redis for an existing cached response for this request (based on URL and parameters).
3.  **Cache Hit**: If a valid (non-expired) cached response exists, it is returned directly to the client, bypassing further processing.
4.  **Cache Miss**: If no valid cached response exists:
    *   The API endpoint logic is executed.
    *   Data is fetched from the PostgreSQL database or computed.
    *   The response is generated.
    *   The response is stored in Redis with a defined Time-To-Live (TTL).
    *   The response is sent to the client.

---
*This document provides a high-level overview of key data flows. More detailed sequence diagrams or flowcharts can be added to [Component Interaction Diagrams](Component-Diagrams.md) or this page to illustrate specific complex scenarios.* 