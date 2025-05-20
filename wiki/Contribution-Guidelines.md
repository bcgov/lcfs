# Contribution Guidelines

Welcome to the LCFS (Low Carbon Fuel Standard) project! We appreciate your interest in contributing. This document provides guidelines for contributing to the project, ensuring a smooth and effective collaboration process. It is adapted from the original "06. Contributions" wiki page.

By participating in this project, you agree to abide by its terms and the [Code of Conduct](CODE_OF_CONDUCT.md) (link to the existing `CODE_OF_CONDUCT.md` in the root of your repository).

## How to Contribute

### 1. Reporting Bugs

*   **Check Existing Issues**: Before submitting a bug report, please search the issue tracker on GitHub to see if the bug has already been reported.
*   **Provide Details**: If the bug hasn't been reported, create a new issue. Fill out the bug report template (if available) with as much detail as possible, including:
    *   Steps to reproduce the bug.
    *   Expected behavior.
    *   Actual behavior.
    *   Screenshots or error messages (if applicable).
    *   Your environment (OS, browser, versions of relevant tools).

### 2. Suggesting Enhancements or Features

*   **Check Existing Issues/Discussions**: Search the issue tracker and discussions to see if your enhancement or feature has already been suggested or discussed.
*   **Create a New Issue/Discussion**: If not, create a new issue or start a discussion, clearly outlining your suggestion. Provide:
    *   A clear and concise description of the enhancement.
    *   The problem it solves or the value it adds.
    *   Potential implementation ideas (if any).
    *   Use cases or examples.

### 3. Pull Requests (PRs)

We follow the GitHub Flow for contributions. The general process is:

1.  **Fork the Repository** (if you are an external contributor) or **Create a Branch** (if you are a team member with write access).
    *   Branch names should be descriptive, e.g., `feature/user-authentication`, `bugfix/login-issue-123`, `docs/update-readme`.
2.  **Setup Development Environment**: Follow the [Development Environment Setup](Development-Environment-Setup.md) guide.
3.  **Make Your Changes**: Implement your feature or bug fix.
    *   Adhere to the [Coding Standards and Conventions](Coding-Standards-and-Conventions.md).
    *   Write tests for your changes as per the [Testing Procedures](Testing-Procedures.md).
    *   Ensure all existing tests pass.
    *   Run pre-commit hooks (see below) to format and lint your code.
4.  **Commit Your Changes**: Write clear and concise commit messages.
    *   Follow the [Git Commit Message Styleguide](#git-commit-message-styleguide).
5.  **Push Your Branch**: Push your changes to your fork or the main repository.
6.  **Submit a Pull Request**: Open a PR against the `main` (or relevant integration) branch of the `bcgov/lcfs` repository.
    *   Fill out the PR template with details about your changes, linking to any relevant issues.
    *   Ensure all automated checks (CI/CD pipeline, linters, tests) pass.
7.  **Code Review**: Your PR will be reviewed by maintainers. Address any feedback or requested changes.
8.  **Merge**: Once approved and all checks pass, your PR will be merged.

#### Pre-commit Hooks

*   **Backend**: The backend uses `pre-commit` to run linters (Flake8, MyPy) and formatters (Black, Isort). Install with `poetry run pre-commit install` in the `backend` directory. These hooks run automatically before each commit.
*   **Frontend**: The frontend uses Husky for pre-commit hooks (ESLint, Prettier). These are typically installed with `npm install`.
*   Ensure these hooks pass before pushing your changes.

## Styleguides

### Git Commit Message Styleguide

*   Use the present tense (e.g., "Add feature" not "Added feature").
*   Use the imperative mood (e.g., "Fix bug in login" not "Fixes bug in login").
*   Limit the first line (subject line) to 72 characters or less.
*   Provide a more detailed explanation in the commit body if necessary, after a blank line.
*   Reference relevant issue numbers (e.g., "Fixes #123").

### Code Styleguides

*   **Python (Backend)**: Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/). Formatting is enforced by Black. Linting by Flake8 and MyPy.
*   **JavaScript/React (Frontend)**: Adhere to ESLint and Prettier configurations in the `frontend` directory.
*   For more details, see [Coding Standards and Conventions](Coding-Standards-and-Conventions.md).

### Documentation Styleguide

*   Use Markdown for all wiki documentation.
*   Keep documentation clear, concise, and up-to-date.

## Development Setup

For detailed instructions on setting up your development environment, please refer to the [Development Environment Setup](Development-Environment-Setup.md) guide.

## Community and Behavioral Expectations

All participation in the LCFS community is governed by the LCFS [Code of Conduct](CODE_OF_CONDUCT.md) (link to the `CODE_OF_CONDUCT.md` file in your repository root).

## License

By contributing to LCFS, you agree that your contributions will be licensed under its Apache License 2.0 (see [LICENSE](../LICENSE) file in the repository root).

## Acknowledgements

Thank you for contributing to LCFS! Your efforts help us improve the management and compliance of the Low Carbon Fuel Standard.

---
*If you have questions or need clarification on any part of the contribution process, please don't hesitate to ask in the project's communication channels or by opening an issue.* 