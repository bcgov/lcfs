# Welcome to the LCFS Wiki!

This wiki serves as the central knowledge base for the Low Carbon Fuel Standard (LCFS) application. It provides comprehensive documentation on the system architecture, development workflows, coding standards, and operational procedures.

## Project Purpose

The Low Carbon Fuel Standard (LCFS) in British Columbia is a regulatory initiative designed to reduce the carbon intensity of transportation fuels used in the province. It aims to decrease greenhouse gas emissions by encouraging the use of renewable and low-carbon fuels, offering incentives for their supply, and setting progressively stricter carbon intensity targets for conventional fuels. This program plays a key role in B.C.'s strategy to transition towards cleaner energy options in the transportation sector and support the growth of the clean fuels industry.

*(This section can be expanded with a more detailed description of the LCFS project's goals and objectives, if available.)*

To provide up-to-date technical documentation that reflects the current state of the system, making it easier for team members to understand and work with the codebase, and to ensure all team members have access to current and accurate information about development processes, reducing onboarding time and maintaining consistency.

## High-Level Architecture & Project Components

The LCFS system is a modern web application composed of several key services and technologies working in concert:

*   **Frontend**: Developed with **React.js** and utilizing **Material-UI** for base components, providing a modern and intuitive user interface. **Vite** is used for optimizing frontend assets.
*   **Backend**: Built on **FastAPI** (Python), the backend handles API requests, business logic, and data management.
*   **Database**: Utilizes **PostgreSQL** for secure and reliable data storage.
*   **Authentication**: Implements **Keycloak** for robust identity and access management.
*   **ETL (Extract, Transform, Load)**: Employs **Apache NiFi** for data migration and synchronization, particularly for integrating data from the TFRS (Transportation Fuel Reporting System) database.
*   **Caching**: **Redis** is used as a caching layer to improve performance.
*   **Message Queuing**: **RabbitMQ** is used for asynchronous task processing.
*   **Object Storage**: **MinIO** (S3-compatible) is used for file storage.
*   **ORM (Object Relational Mapper)**: Employs **SQLAlchemy** for database entity mapping in the backend.
*   **Database Migrations**: Manages database schema changes over time with **Alembic**.
*   **Data Validation**: Utilizes **Pydantic** for data validation within FastAPI.
*   **Containerization**: **Docker** is used for containerizing services, with **Docker Compose** for local development orchestration.
*   **Deployment**: The application is deployed on **OpenShift Container Platform**.

*(A more detailed component interaction diagram will be available in [Component Diagrams](Component-Diagrams.md).)*

## Documentation Sections

This wiki is organized into the following main sections, broadly covering System Architecture (#2409) and Development Workflows (#2410):

### System Architecture & Components
*   **[High-Level Architecture & Project Components](Home.md)** (This page)
*   **[Component Interaction Diagrams](Component-Diagrams.md)**: Visual representations of system components and their interactions.
*   **[Subsystems and Responsibilities](Subsystems-and-Responsibilities.md)**: Detailed descriptions of each major subsystem.
*   **[Data Flows](Data-Flows.md)**: How data moves through the LCFS system, including user interactions and ETL processes.
*   **[Integration Points and APIs](Integration-Points-and-APIs.md)**: Information on internal and external APIs, including Keycloak and TFRS integration.
*   **[Deployment Architecture](Deployment-Architecture.md)**: Details on local Docker setup and OpenShift deployment.
*   **[Database Schema Overview](Database-Schema-Overview.md)**: Description of the PostgreSQL database structure and Alembic migrations.
*   **[Caching Strategy](Caching-Strategy.md)**: How Redis caching is implemented and used.
*   **[Security Architecture](Security-Architecture.md)**: Overview of security measures, protocols, and Keycloak integration.
*   **[Performance Considerations](Performance-Considerations.md)**: Notes on system performance and load testing with Locust.
*   **[System Requirements and Dependencies](System-Requirements-and-Dependencies.md)**: Software, hardware, and service dependencies.

### Development Workflows & Processes
*   **[Development Environment Setup](Development-Environment-Setup.md)**: Guide to setting up the local development environment (Docker, Poetry, Node.js).
*   **[Git Workflow and Branching](Git-Workflow-and-Branching.md)**: Details on the Git strategy (GitHub Flow) and contribution process.
*   **[Coding Standards and Conventions](Coding-Standards-and-Conventions.md)**: Best practices for frontend (React, Vite) and backend (Python, FastAPI) development.
*   **[Testing Procedures](Testing-Procedures.md)**: Comprehensive guide to frontend (Vitest, React Testing Library, Cypress, Cucumber) and backend (Pytest) testing.
*   **[CI/CD Pipeline](CI-CD-Pipeline.md)**: Documentation for the Continuous Integration/Continuous Deployment pipeline.
*   **[Deployment Procedures](Deployment-Procedures.md)**: Step-by-step guide for deploying the application.
*   **[Code Review Process](Code-Review-Process.md)**: Guidelines for conducting and participating in code reviews.
*   **[Development Tools and Utilities](Development-Tools-and-Utilities.md)**: Overview of tools like Poetry, pre-commit, `migrate.sh`, etc.
*   **[Backend Logging Guide](Backend-Logging-Guide.md)**: How to use the standardized logging system (Structlog).
*   **[Security Guidelines for Developers](Security-Guidelines-for-Developers.md)**: Security best practices for developers.
*   **[Data Migration (TFRS to LCFS)](Data-Migration-TFRS-to-LCFS.md)**: Details on the ETL process for migrating data using Apache NiFi and scripts.
*   **[Custom React Hooks](Custom-React-Hooks.md)**: Documentation for shared custom React hooks.
*   **[Libraries and Their Common Uses](Libraries-and-Their-Common-Uses.md)**: Examples and guidelines for using key libraries.

### General
*   **[Troubleshooting Guides](Troubleshooting-Guides.md)**: Solutions for common issues.
*   **[Contribution Guidelines](Contribution-Guidelines.md)**: How to contribute to the project (adapted from existing "06. Contributions").
*   **[Version Information](Version-Information.md)**: How system versions are managed and identified.
*   **[Code Repositories](Code-Repositories.md)**: Links to relevant code repositories.

Please use the navigation or the links above to explore the different aspects of the LCFS project.

---
*This documentation is actively maintained. If you find any discrepancies or outdated information, please contribute by updating it.* 