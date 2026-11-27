# Local Metabase Setup

Metabase is optional for local development. This setup runs Metabase alongside the LCFS Compose stack and points it at the local PostgreSQL database. Metabase's own settings, users, and saved dashboards persist in a Docker volume.

## Start the services

From the repository root, start the application stack with the Metabase Compose overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.metabase.yml up --build -d
```

Open Metabase at <http://localhost:3001>. To use another host port, set `LCFS_METABASE_PUBLISHED_PORT` before running Compose.

## Complete onboarding automatically

The Compose overlay runs a one-time bootstrap service automatically whenever the stack starts. It waits for Metabase to become healthy, creates the admin account on a fresh instance, then registers the LCFS database. The example credentials are for local development only; change them in `.env` before starting the stack if you want different credentials.

Copy the example environment file before starting Compose to use or customize the supplied local values:

```bash
cp .env.example .env
```

The script reads Metabase's one-time setup token from the API, creates the first administrator with the `LCFS Local` site preference, signs in, and registers the local LCFS PostgreSQL database. It is safe to run again with the same credentials: it skips onboarding if already complete and avoids adding a second `LCFS Local` connection. The Compose service disables Metabase's sample database and sample content.

The `.env` file is git-ignored. Keep any customized admin password private. The database connection uses the local development credentials described below.

The overlay sets `MB_SITE_URL` to `http://localhost:3001` so OAuth discovery advertises an address local MCP clients can reach.

The bootstrap follows Metabase's [documented API setup flow](https://www.metabase.com/articles/set-up-metabase-from-code-with-the-api).

## Connect Metabase to LCFS PostgreSQL

During Metabase's first-run setup, add a PostgreSQL database with these connection values:

| Setting | Value |
| --- | --- |
| Host | `db` |
| Port | `5432` |
| Database name | `lcfs` |
| Username | `lcfs` |
| Password | `development_only` |
| Schema | `public` |

These credentials match the repository's local Compose database defaults. Use them only with a local development database. For any shared or non-local database, create a dedicated read-only account and grant it access only to the reporting views needed by Metabase.

The database must have its schema and reporting views installed before Metabase can query them. The application container runs Alembic migrations on startup. If you started only PostgreSQL, run the migrations with the backend's configured database settings, then create the reporting views from the backend directory:

```bash
cd backend
poetry run alembic upgrade head
poetry run python -m lcfs.db.sql.manage_views dev
```

The reporting view definitions are in `backend/lcfs/db/sql/views/metabase.sql`.

## Stop and reset

Stop the stack while retaining Metabase's saved state:

```bash
docker compose -f docker-compose.yml -f docker-compose.metabase.yml down
```

To erase Metabase's local users, settings, and saved dashboards, remove the `metabase_data` volume for the Compose project. This does not remove the LCFS database volume.

The backend's monthly credit-market report integration is separate from Metabase's database connection. It requires `METABASE_BASE_URL`, an API key or username/password, and `METABASE_CREDIT_MARKET_DASHBOARD_ID` in the backend environment.
