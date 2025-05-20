# Component Interaction Diagrams

This page is intended to house component interaction diagrams for the LCFS system, fulfilling part of the requirements for ticket #2409.

## 1. High-Level System Architecture Diagram

*   **Source**: The project root contains an image file: `lcfs-app-architecture.jpg`.
*   **Action**: This image should be embedded or linked here.
    *   If embedding directly in Markdown is not feasible for the GitHub Wiki, the image can be uploaded to the wiki's Git repository and then referenced.
    *   A description of the diagram should accompany it, explaining the main components and their primary interactions.

```mermaid
!-- Placeholder for a textual representation if direct embedding is complex --
! graph TD
!    User Interface (Frontend: React) -->|API Calls (HTTPS)| Backend API (FastAPI)
!    Backend API --> Database (PostgreSQL)
!    Backend API --> Cache (Redis)
!    Backend API --> Message Queue (RabbitMQ)
!    Backend API --> Object Storage (MinIO)
!    
!    ETL Process (Apache NiFi) -->|JDBC| TFRS DB (PostgreSQL - Source)
!    ETL Process (Apache NiFi) -->|JDBC| Database (PostgreSQL - LCFS Target)
!    
!    User Interface -->|OIDC| Keycloak
!    Backend API -->|Token Introspection/Validation| Keycloak
```

## 2. Detailed Component Diagrams (Draw.io)

*   The project may have more detailed diagrams created using `draw.io` or similar tools (e.g., the `LCFS_ERD_v0.2.0.drawio` for database schema).
*   If other `draw.io` diagrams exist for component interactions, they should be:
    *   Exported as SVG or PNG.
    *   Uploaded to this wiki or a shared image repository.
    *   Embedded and described here.
*   **Action**: Create or update detailed diagrams focusing on:
    *   Frontend component interactions.
    *   Backend service interactions (e.g., with Redis, RabbitMQ, MinIO, Database).
    *   Authentication flow with Keycloak in more detail.
    *   Data flow through the ETL NiFi pipeline.

## 3. Data Flow Diagrams

While there is a separate [Data Flows](Data-Flows.md) page, key data flow diagrams can also be presented here as they often overlap with component interactions.

---
*This page requires visual assets. Please upload relevant diagrams or create new ones using a tool like `draw.io` and embed them here with explanations.* 