# Code Repositories

This page lists the primary code repositories relevant to the LCFS project. This is part of the requirements for ticket #2409.

## 1. Main Application Repository

*   **LCFS Application (Frontend, Backend, ETL, Documentation)**:
    *   **URL**: [https://github.com/bcgov/lcfs](https://github.com/bcgov/lcfs)
    *   **Description**: This is the main monorepo containing the source code for the LCFS frontend (React), backend (Python/FastAPI), ETL processes (Apache NiFi configurations and scripts), Docker configurations, OpenShift templates, and this wiki documentation (in the `/wiki` directory).

## 2. GitHub Wiki Repository

While the wiki content is managed within the main `bcgov/lcfs` repository under the `/wiki` directory, the actual GitHub Wiki is a separate Git repository.

*   **LCFS GitHub Wiki (for viewing on GitHub UI)**:
    *   **URL**: [https://github.com/bcgov/lcfs.wiki.git](https://github.com/bcgov/lcfs.wiki.git)
    *   **Description**: This repository hosts the content that is displayed on the GitHub Wiki interface. Changes pushed to the `/wiki` directory in the main `bcgov/lcfs` repository are automatically synchronized to this wiki repository by a [GitHub Action workflow](GitHub-Workflow-for-Wiki-Sync.md).

## 3. Other Relevant Repositories (If Any)

*(This section can be used to list any other related repositories, such as:)*

*   *Shared libraries or components developed specifically for LCFS but hosted separately.*
*   *Forks of upstream dependencies if custom modifications are maintained.*
*   *Repositories for related systems or services that LCFS integrates with closely.*

*Currently, no other specific repositories are identified as core to the LCFS development documented here. Please update if other key repositories are involved.*

---
*Ensure links are kept up-to-date.* 