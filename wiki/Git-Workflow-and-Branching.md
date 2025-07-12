# Git Workflow and Branching Strategy

This document outlines the Git workflow and branching strategy used for the LCFS project. Adherence to this strategy ensures a clean commit history, facilitates collaboration, and supports an organized release process. This is part of the requirements for ticket #2410.

## 1. Core Principles

*   **Main Branch is Production-Ready**: The `main` branch should always reflect a stable, production-ready state of the application.
*   **Feature Branches**: All new development (features, bug fixes, enhancements) must happen in separate feature branches.
*   **Pull Requests (PRs)**: Changes are integrated into the `main` branch (or a release/develop branch if used) via Pull Requests, which require review and passing automated checks.
*   **Regular Integration**: Integrate feature branches frequently to avoid large, complex merges.

## 2. Branching Strategy

The project generally follows **GitHub Flow** or a similar simple feature-branch workflow.

### 2.1. `main` Branch

*   Represents the latest stable, released version of the application.
*   Direct commits to `main` are strictly prohibited. Changes are merged via PRs only.
*   Tags are created from `main` to mark release points (e.g., `v1.0.0`, `v1.1.0`).

### 2.2. Feature Branches

*   **Creation**: When starting work on a new feature, bug fix, or enhancement, create a new branch from the latest `main` branch.
    ```bash
    git checkout main
    git pull origin main
    git checkout -b feature/your-descriptive-name # e.g., feature/add-user-profile, bugfix/login-error-123
    ```
*   **Naming Convention**: Use a prefix like `feature/`, `bugfix/`, `hotfix/`, `docs/`, `chore/` followed by a short, descriptive name. Reference issue numbers if applicable (e.g., `feature/123-new-reporting-module`).
*   **Scope**: Keep feature branches focused on a single, distinct piece of work.
*   **Push Regularly**: Push your feature branch to the remote repository frequently to back up your work and allow for visibility.

### 2.3. Development/Integration Branch (Optional)

*   For more complex projects or larger teams, a `develop` or `integration` branch might be used. Feature branches would be merged into `develop` first, and then `develop` would be merged into `main` for releases.
*   **Action**: Clarify if a persistent `develop` branch is currently in use for LCFS. If not, the default is feature branches directly to `main` via PRs.

### 2.4. Release Branches (Optional)

*   For managing releases, `release/` branches (e.g., `release/v1.1.0`) can be created from `main` (or `develop`). Only bug fixes related to the release are merged into a release branch.
*   **Action**: Clarify if formal release branches are used.

### 2.5. Hotfix Branches

*   If a critical bug is found in production (`main`), a `hotfix/` branch should be created directly from `main`.
    ```bash
    git checkout main
    git pull origin main
    git checkout -b hotfix/critical-issue-description
    ```
*   Once the hotfix is complete and tested, it is merged back into `main` via a PR and also merged into any active `develop` or release branches.
*   A new tag should be created on `main` for the hotfix release.

## 3. Pull Request (PR) Process

1.  **Create PR**: Once a feature branch is ready, create a Pull Request targeting the `main` branch (or `develop` if applicable).
2.  **Description**: Provide a clear description of the changes, the problem it solves, and link to any relevant issues.
3.  **Automated Checks**: Ensure all CI/CD checks (linters, tests, builds) pass.
4.  **Code Review**: At least one (or as per team policy) team member must review and approve the PR. See [Code Review Process](Code-Review-Process.md).
5.  **Address Feedback**: Make any necessary changes based on review feedback.
6.  **Merge**: Once approved and all checks pass, the PR can be merged.
    *   **Merge Strategy**: Prefer **squash and merge** or **rebase and merge** to keep the `main` branch history clean and linear. Avoid direct merge commits if possible, unless the feature branch history is intentionally preserved.
    *   **Action**: Confirm the preferred merge strategy for the team.
7.  **Delete Feature Branch**: After merging, delete the feature branch from both local and remote repositories.

## 4. Commit Guidelines

Refer to the [Contribution Guidelines](Contribution-Guidelines.md#git-commit-message-styleguide) for commit message standards.

## 5. Tools

*   **Git**: Distributed version control system.
*   **GitHub**: Platform for hosting the repository, managing issues, and conducting Pull Requests/code reviews.

---
*This workflow aims to maintain a high-quality, stable codebase. Team members should familiarize themselves with these practices.* 