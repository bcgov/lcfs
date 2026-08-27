---
name: lcfs-repo-context
description: Use this skill when working in the LCFS repository to understand the monorepo layout, local development commands, coding conventions, feature boundaries, tests, migrations, and documentation sources before making changes.
---

# LCFS Repo Context

## What this repo is

LCFS is the BC Low Carbon Fuel Standard web application. It is a monorepo with:

- `backend/`: Python 3.9 FastAPI service using SQLAlchemy async ORM, Alembic, Redis, MinIO/S3, Keycloak auth, Poetry, pytest, Black, Isort, Flake8, and MyPy.
- `frontend/`: React 18 + Vite app using MUI 6, React Query, React Hook Form, Yup, Zustand, AG Grid, Vitest, Testing Library, Cypress, ESLint, and Prettier.
- `etl/`: Apache NiFi, Groovy scripts, PostgreSQL migration/import tooling, anonymization scripts, and a Python migration subsystem.
- `openshift/`: deployment templates and maintenance/cleanup resources.
- `mcp-server/`: TypeScript MCP server for local LCFS development and testing workflows.
- `wiki/`: project documentation. Prefer these docs for deeper context instead of guessing.

## First orientation steps

1. Check `git status --short` before editing. The worktree may contain user changes; do not overwrite or revert them unless explicitly asked.
2. Use `rg` and `rg --files` first for code search.
3. Read the nearest implementation and test files for the feature area before editing. Most backend and frontend features are organized by domain.
4. Load detailed docs only when relevant:
   - Setup: `wiki/Development-Environment-Setup.md`
   - Coding style: `wiki/Coding-Standards-and-Conventions.md`
   - Testing: `wiki/Testing-Procedures.md`
   - API map: `wiki/API-Endpoint-Reference.md`
   - Schema overview: `wiki/Database-Schema-Overview.md`
   - Compliance report states: `wiki/Compliance-Report-State-Matrix.md`
   - Migration work: `wiki/Data-Migration-TFRS-to-LCFS.md`, `etl/python_migration/MIGRATION_CONTEXT.md`
   - Deployment: `wiki/Deployment-Procedures.md`, `wiki/Deployment-Architecture.md`, `wiki/CI-CD-Pipeline.md`

## Backend conventions

- App package: `backend/lcfs`.
- API feature slices usually live under `backend/lcfs/web/api/<feature>/` with `views.py`, `services.py`, `repo.py`, `schema.py`, and sometimes `validation.py`, `export.py`, or `importer.py`.
- Routes are wired in `backend/lcfs/web/api/router.py`.
- Models live under `backend/lcfs/db/models/<domain>/`.
- Alembic migrations live in `backend/lcfs/db/migrations/versions/`; there are many existing migrations, so inspect recent patterns before adding one.
- Tests live under `backend/lcfs/tests/<feature>/` and usually mirror backend feature names.
- Configuration uses `backend/lcfs/settings.py`; environment variables use the `LCFS_` prefix, with `APP_ENVIRONMENT` mapped to `environment`.
- Prefer existing decorators and dependency patterns from nearby routes. Public endpoints commonly use `public_view_handler`; authenticated routes commonly use `view_handler`.
- Keep business logic in service classes, persistence in repos, request/response contracts in Pydantic schemas, and thin FastAPI route handlers.

Backend commands:

```bash
cd backend
poetry install
poetry run python -m lcfs
poetry run pytest lcfs/tests/<feature>
poetry run black lcfs
poetry run isort lcfs
poetry run flake8 --count .
poetry run mypy lcfs
./migrate.sh -g "description"
./migrate.sh -u
```

Backend tests require PostgreSQL. The root `docker-compose.yml` provides `db`, `redis`, `minio`, `backend`, and `frontend`; `docker-compose-db-only.yml` is available when only the database is needed.

## Frontend conventions

- App source: `frontend/src`.
- Use the `@/` alias for imports from `frontend/src`.
- Reusable UI belongs in `frontend/src/components`; page/domain features belong in `frontend/src/views/<Feature>`.
- API hooks live in `frontend/src/hooks`, and HTTP plumbing is in `frontend/src/services/useApiService.ts`.
- Route config lives in `frontend/src/routes/routeConfig`.
- Shared auth context lives in `frontend/src/contexts/AuthorizationContext.tsx`.
- Tests sit near code in `__tests__` directories and use Vitest/Testing Library.
- Prefer existing BC-prefixed components (`BCButton`, `BCDataGrid`, `BCForm`, `BCAlert`, `BCTypography`, etc.) and existing MUI theme patterns before adding new styling conventions.
- Use React Query for server state, React Hook Form + Yup for form state/validation, and Zustand only for global client state.

Frontend commands:

```bash
cd frontend
npm install
npm run dev
npm run test:run -- <path-or-pattern>
npm run type-check
npm run lint
npm run prettier
npm run build
npm run cypress:run
```

## ETL and migration context

- NiFi/Groovy scripts are in `etl/nifi_scripts`.
- NiFi templates are in `etl/templates`.
- Local ETL compose file is `etl/docker-compose.yml`.
- Python migration work is under `etl/python_migration`, with its own `README.md`, `Makefile`, `requirements.txt`, `migrations/`, `validation/`, and `setup/`.
- Data transfer scripts may require OpenShift CLI access and should not be run casually against shared environments.
- Anonymization for non-production data is documented in `etl/ANONYMIZER.md`.

## Local service map

The root compose stack exposes:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

ETL compose exposes:

- NiFi: `http://localhost:8091/nifi/`
- NiFi Registry: `http://localhost:18080`

## Validation guidance

- For backend-only changes, run the closest `poetry run pytest lcfs/tests/<feature>` target. Add or update tests when service, repo, validation, permissions, state-transition, calculation, import/export, or migration behavior changes.
- For frontend changes, run the closest `npm run test:run -- <test-file-or-folder>` target. Add or update tests for visible behavior, hooks, routes, forms, permissions, and API interactions.
- Run `npm run type-check` after TypeScript changes.
- Run formatting/linting commands for the touched area when practical.
- If a command cannot run because dependencies, containers, credentials, or services are missing, state that clearly and include the exact command attempted.

## Agent behavior in this repo

- Keep edits narrowly scoped to the requested feature or bug.
- Preserve user changes in the working tree.
- Prefer established domain patterns over new abstractions.
- Do not edit generated, cache, binary, or data-dump files unless the task specifically requires it.
- Do not commit local config or secrets such as `frontend/cypress.env.json`, `.env`, database dumps, or OpenShift tokens.
- For compliance calculations, report states, credit ledger behavior, and migrations, inspect existing tests and wiki docs before changing logic; these areas have high business risk.
- When touching a backend API and frontend consumer together, update route/schema/service/hook/view/test contracts consistently.
