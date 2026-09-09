# Testing Procedures

This document outlines the testing strategies, tools, and procedures for the LCFS project, ensuring code quality and correctness. It is adapted from the original "07. Testing" wiki page and updated with current project configurations.

## Guiding Principle: Test-Driven Development (TDD)

When feasible, a TDD approach is encouraged. Tests should be written to define the expected behavior *before* the code is implemented. Code should then be written to make these tests pass. This helps ensure testability and clear requirements.

## 1. Frontend Testing

The frontend utilizes a combination of Vitest for unit/integration testing and Cypress with Cucumber for end-to-end (E2E) testing.

### 1.1. Unit & Integration Testing (Vitest, React Testing Library, MSW)

*   **Vitest**: A fast Jest-compatible testing framework, primarily used for unit and integration tests.
*   **React Testing Library (RTL)**: Used for interacting with React components in a way that resembles how users interact with them. Focuses on testing component behavior rather than implementation details.
*   **Mock Service Worker (MSW)**: Used to mock API (network) calls, allowing components that fetch data to be tested in isolation without relying on a live backend.

#### 1.1.1. Running Vitest Tests

Navigate to the `frontend/` directory and use the following `npm` scripts:

*   **Run tests with UI (interactive watch mode)**:
    ```bash
    npm run test:ui
    ```
*   **Run tests once**: 
    ```bash
    npm run test:run
    ```
*   **Run tests and generate coverage report**:
    ```bash
    npm run test.coverage
    ```
    (Runs the whole suite once with coverage thresholds enforced; the HTML report is written to `frontend/coverage/`. See section 3.1.)

#### 1.1.2. Vitest Methodology (from original wiki)

*   **Unit Definition**: A unit is an isolated group of smaller items that interact (e.g., a React component with its internal logic and hooks).
*   **Black Box Approach**: Test for expected output given specific input. Mock external dependencies (hooks, API calls via MSW) to isolate the component.
*   **Coverage Goal**: Aim for high code coverage (statements, branches, functions, lines), ideally 100% for new code, as a general guideline.

#### 1.1.3. What to Test (Vitest)

*   **React Components**:
    *   Ensure the component renders correctly (`toBeInTheDocument()`).
    *   Test all hooks used within the component, mocking their return values if they are external or complex.
    *   Test all user interactions and events (clicks, form submissions, etc.) and verify the expected outcomes (state changes, function calls).
    *   Test all conditional rendering paths (branches) by providing appropriate props or mocked states.
*   **Custom Hooks**: Test their return values and any methods they expose, especially for hooks with complex logic or side effects.
*   **Utility Functions**: Test pure functions for expected output given various inputs.
*   **API/Network Calls (Mocking with MSW)**:
    *   Define MSW handlers (e.g., in `frontend/src/tests/utils/handlers.js` or similar) to intercept API calls and return mocked responses.
    *   Use helper functions like `httpOverwrite` (if defined in your test setup) to modify mock responses for specific tests.

#### 1.1.4. Vitest Best Practices & Gotchas (from original wiki)

*   **Mocking**: `vi.mock()` is hoisted. Use `vi.hoisted()` for mocks that need to change per test.
*   **Setup/Teardown**: Use `afterEach()`, `beforeEach()`, etc., to set up common conditions or clean up (e.g., `vi.clearAllMocks()` after each test).
*   **Wrapper**: Use a common wrapper for `render` (from RTL) if your components rely on context providers (e.g., ThemeProvider, QueryClientProvider, KeycloakProvider).

### 1.2. End-to-End (E2E) Testing (Cypress & Cucumber)

*   **Cypress**: Used for E2E testing, simulating real user interactions and flows through the application.
*   **Cucumber**: Complements Cypress by enabling Behavior-Driven Development (BDD). Tests are written in Gherkin (`.feature` files) describing scenarios in plain language, which are then implemented by step definitions in JavaScript/TypeScript.

#### 1.2.1. Cypress Environment Setup

1.  **Copy example environment file**: In the `frontend/` directory, copy `cypress.env.example.json` to `cypress.env.json`.
    ```bash
    cd frontend
    cp cypress.env.example.json cypress.env.json
    ```
2.  **Edit `cypress.env.json`**: Fill in your specific IDIR and BCEID test credentials and any other required parameters. **Do not commit `cypress.env.json` to version control.**

#### 1.2.2. Running Cypress Tests

Navigate to the `frontend/` directory:

*   **Open Cypress Test Runner (interactive mode)**:
    ```bash
    npm run cypress:open
    ```
*   **Run Cypress tests headlessly** (e.g., for CI):
    ```bash
    npm run cypress:run
    ```
*   **Run specific feature tests using tags**:
    ```bash
    npm run cypress:run --env tags=@transfer
    npm run cypress:run --env tags="not @transfer"
    npm run cypress:run --env tags="@transfer or @organization"
    ```

#### 1.2.3. Writing Cypress & Cucumber Tests

*   **Project Structure (from original wiki)**:
    ```
    frontend/
    ├── cypress/
    │   ├── e2e/
    │   │   ├── Pages/ (or similar for BDD structure)
    │   │   │   ├── features/             # Cucumber .feature files
    │   │   │   └── step_definitions/     # Step definition .js files
    │   │   └── cypress_tests/          # Traditional Cypress .cy.js files (if any)
    │   ├── fixtures/                     # Test data fixtures
    │   ├── reports/                      # Generated test reports
    │   ├── screenshots/                  # Screenshots on failure
    │   └── support/                      # Custom commands (commands.js), plugins (index.js)
    ├── cypress.config.js                 # Main Cypress configuration
    ├── .cypress-cucumber-preprocessorrc.json # Cucumber preprocessor config
    └── ...
    ```
*   **Best Practices**:
    *   Write feature files in `frontend/cypress/e2e/Pages/features/` (or as per project convention).
    *   Implement step definitions in `frontend/cypress/e2e/Pages/step_definitions/`.
    *   Use descriptive names for files and scenarios.
    *   Utilize custom commands in `frontend/cypress/support/commands.js` for common actions.
    *   Prefer `data-testid` attributes or other stable selectors for interacting with DOM elements.
    *   Refer to official Cypress and Cucumber documentation for detailed guidance.
*   **Chrome Recorder**: Consider using Chrome DevTools' Recorder to export Cypress tests as a starting point (see `cypress/chrome-recorder` if this tool is integrated).

## 2. Backend Testing (Pytest)

*   **Pytest**: The primary framework for testing the Python backend (FastAPI application).

### 2.1. Prerequisites

*   **Running PostgreSQL Instance**: Tests typically require a PostgreSQL database. The project setup often uses Docker Compose to provide this.
*   **Python Environment**: Ensure all dependencies are installed via Poetry (`poetry install` in the `backend/` directory).

### 2.2. Running Pytest Tests

From the `backend/` directory:

```bash
poetry run pytest -s -v
```

*   `-s`: Disables output capturing (shows `print` statements).
*   `-v`: Verbose mode (detailed test information).

The testing framework (as described in the original wiki) handles:
1.  **Test Database Setup**: Automatically creates a separate test database.
2.  **Database Migrations**: Runs Alembic migrations to set up the schema.
3.  **Data Seeding**: Uses a test seeder (e.g., from `backend/lcfs/db/seeders/`) to populate the test database.
4.  **Test Execution**: Runs all test cases.
5.  **Teardown**: Drops the test database after tests complete.

(Pytest configuration is often in `backend/pyproject.toml` or `pytest.ini`.)

### 2.3. Writing Pytest Tests

*   Tests are typically located in `backend/lcfs/tests/`.
*   Mirror the application structure within the `tests/` directory for organization.
*   Use Pytest fixtures (`backend/lcfs/conftest.py`) for setting up test data and dependencies.
*   Test API endpoints, service layer logic, database interactions, and utility functions.
*   Leverage FastAPI's `TestClient` for testing API endpoints.
*   Use mocking libraries (like `unittest.mock` or Pytest's built-in mocking) to isolate units.

## 3. Code Coverage

*   **Frontend**: Coverage reports are generated by Vitest (`npm run test.coverage`). Minimum thresholds are enforced; see below.
*   **Backend**: Pytest can be configured with `pytest-cov` to generate coverage reports (check `backend/pyproject.toml` for configuration).
*   Strive for high code coverage, but prioritize testing critical paths and complex logic effectively.

### 3.1. Frontend coverage thresholds

Vitest enforces global minimum coverage for `frontend/src` (configured in `frontend/vite.config.ts`, `test.coverage.thresholds`). The thresholds are **floors, not targets**: they exist so coverage cannot silently regress as new code lands. A pull request that pushes any metric below its floor fails CI.

| Metric     | Floor | Baseline (2026-09-08) |
|------------|------:|----------------------:|
| Statements |   60% |                63.96% |
| Branches   |   50% |                55.47% |
| Functions  |   52% |                56.66% |
| Lines      |   60% |                64.61% |

The baseline was measured on `develop` with 376 test files / 6,187 tests, v8 provider, and the exclusions listed in `vite.config.ts` (`src/*.{jsx,js,tsx,ts}`, `src/assets`, `src/constants`, `src/themes`, `src/tests`).

**Where thresholds are enforced**

*   Locally: `npm run test.coverage` runs the whole suite once, prints a coverage summary, writes the HTML report to `frontend/coverage/`, and exits non-zero if a floor is missed.
*   In CI (`pr-test.yaml`): the test suite runs as 32 shards, each of which writes its coverage into a blob report. The "Publish Frontend Test Results" job merges the blobs with `vitest --merge-reports`; that merged map covers the whole suite and is where the thresholds are checked. A miss looks like `ERROR: Coverage for lines (58.1%) does not meet global threshold (60%)` in the "Merge reports" step, and the merged HTML report is uploaded as the `frontend-coverage-report` artifact.

Thresholds are only applied when `ENFORCE_COVERAGE_THRESHOLDS=true` is set (the coverage script and the CI merge step both set it). Vitest checks thresholds against whatever was collected in the current process, so a filtered run such as `vitest run src/views/Transfers` or a single CI shard would otherwise always fail. Plain `npm run test:run` and per-area scripts are therefore never gated.

**What to do when a PR fails the threshold**

1. Download the `frontend-coverage-report` artifact from the failed run (or run `npm run test.coverage` locally) and open `coverage/index.html`.
2. Add tests for the new or changed code in the PR. Do not lower a floor to get a PR through; a floor is only lowered by an explicit, separately reviewed change with a stated reason.
3. If a file genuinely cannot be unit tested (for example a thin wrapper around a browser-only API), exclude it explicitly in `coverage.exclude` with a comment rather than leaving it uncovered.

**Plan for raising the floors**

The floors are deliberately a few points under the baseline so ordinary churn does not flake. They should ratchet up as coverage improves:

*   Whenever the measured baseline is at least 8 points above a floor, raise that floor to 5 points under the new baseline (round down to a whole number). Re-measure with `npm run test.coverage` on `develop`.
*   Target for the next step: 65% statements / lines, 55% branches and functions. Long-term goal: 80% across all four metrics, matching the values that were originally sketched in `vite.config.ts`.
*   New code should aim for close to full coverage (see 1.1.2), which is what moves the baseline.

Lowest-coverage areas at the baseline, in rough priority order for new tests (statement coverage): `views/OtherUses` (17%), `views/FuelExports` (35%), `views/AllocationAgreements` (43%), `views/FinalSupplyEquipments` (44%), `views/FuelSupplies` (46%), `views/ChargingEquipment` (47%), `views/NotionalTransfers` (49%), `views/ChargingSite` (55%), `components/BCDataGrid` (59%), `views/FuelCodes` (60%). Small files with 0% (`components/BCBox`, `views/ComplianceReporting`, `layouts/PublicPageLayout`, `views/CreditMarket`) are quick wins.

---
*Refer to the official documentation for Vitest, React Testing Library, MSW, Cypress, Cucumber, and Pytest for more in-depth information. Consistent and thorough testing is crucial for maintaining the quality and reliability of the LCFS application.* 