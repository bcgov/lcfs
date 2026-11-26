# Database Query Timeouts and Connection Monitoring

This page describes how the backend protects the database from long-running queries, how to make an endpoint use a longer timeout, and how to see what the database connections are doing.

## Why

Without a per-query timeout, one slow statement holds its connection (and a PostgreSQL backend) until it finishes. Under load this exhausts the connections available to the app (PostgreSQL `max_connections = 100`, of which the app is budgeted 80), with no indication of why.

## How the app connects (important context)

Both application engines use SQLAlchemy's **`NullPool`**: each session opens its own connection and closes it when done. There is no `pool_size` / `max_overflow` / `pool_timeout` in effect, even though older docs describe them. Consequences:

* A connection is held for exactly the lifetime of a session/request, so a slow query directly holds a PostgreSQL backend.
* There is no pool to inspect (`pool.status()` has no data). Utilization is therefore measured by counting checked-out connections via pool events (see [Monitoring](#connection-utilization-monitoring)).

There are two engines:

| Engine label | Defined in | Used for |
|---|---|---|
| `app` | `backend/lcfs/db/dependencies.py` | API request sessions (`get_async_db_session`) |
| `lifetime` | `backend/lcfs/web/lifetime.py` | Auth backend lookups and scheduled jobs (`REINDEX CONCURRENTLY`, materialized view refresh, supplemental report jobs, credit market report) |

## Statement timeouts

| Scope | Default | Setting | Applied by |
|---|---|---|---|
| API requests (`app` engine) | 30 s | `LCFS_DB_STATEMENT_TIMEOUT_MS` | `SET LOCAL` at the start of every transaction |
| Export / report endpoints | 5 min | `LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS` | `SET LOCAL` for the request's transaction (see below) |
| `lifetime` engine (auth + scheduled jobs) | unlimited (`0`) | `LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS` | `SET LOCAL` at the start of every transaction (not the `REINDEX CONCURRENTLY` statements, see below) |

The engine defaults come from `register_statement_timeout` in `backend/lcfs/db/engine_config.py`: a SQLAlchemy `begin` listener that runs `SET LOCAL statement_timeout = <ms>` as the first statement of each transaction. They are deliberately **not** sent as asyncpg `server_settings` startup parameters: the deployed environments connect through PgBouncer, which rejects startup parameters it does not track (`unsupported startup parameter: statement_timeout`), and that fails every connection.

A value of `0` disables the timeout; it is sent to PostgreSQL as an explicit `statement_timeout = 0`, so it also overrides any server/database/role level default. The export override is skipped when `LCFS_DB_STATEMENT_TIMEOUT_MS=0`, or when the export value is nonzero and no larger than the normal one, so an export can never get a *tighter* limit than a normal request (an export value of `0` stays unlimited). Invalid values (negative timeouts, a budget below 1, a warn ratio outside `(0, 1]`) are rejected at startup. When a statement exceeds the limit PostgreSQL cancels it (`canceling statement due to statement timeout`, SQLSTATE `57014`) and the request fails with a server error; the transaction is rolled back and the connection is released.

The `lifetime` engine is intentionally unlimited by default: scheduled maintenance jobs legitimately run for minutes. Set `LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS` only if you have measured your longest job. It covers the FSE reporting materialized view refresh, which runs in one transaction. It does **not** cover the `REINDEX TABLE CONCURRENTLY` statements of the quarterly compliance reindex: that command cannot run inside a transaction, so `SET LOCAL` has nothing to attach to, a session-level `SET` would leak through PgBouncer, and a `REINDEX CONCURRENTLY` cancelled part way leaves an invalid index (`*_ccnew`) behind. The reindex job's short lease transactions do get the timeout.

### Extended timeout for exports and reports

Export endpoints opt in with a route-level dependency:

```python
from lcfs.db.dependencies import extended_statement_timeout

@router.get(
    "/export",
    response_class=StreamingResponse,
    dependencies=[Depends(extended_statement_timeout)],
)
@view_handler([RoleEnum.GOVERNMENT])
async def export_things(...):
    ...
```

How it works: FastAPI resolves route-level `dependencies` *before* parameter dependencies, so `extended_statement_timeout` records the longer limit on `request.state` before `get_async_db_session` opens the session. The session then runs `set_config('statement_timeout', ..., true)` (equivalent to `SET LOCAL`) right after the engine default, so it wins for that transaction and cannot leak to another request.

**When adding a new export or report endpoint, add this dependency**, otherwise it is limited to the 30 s default. A unit test (`TestExportRoutesUseExtendedTimeout`) fails if a route whose path ends in `/export`, contains `/export/` or is the FSE `update-template` is missing it.

Currently applied to: user, organizations, organization (transactions), transaction, credit ledger, fuel code (+ bulletins), forms, charging equipment, final supply equipment (including the FSE reporting update-template, which exports all eligible FSE), allocation agreement and compliance report export endpoints.

Not extended (they remain at 30 s): blank Excel *template* downloads (they load no data) and *import* endpoints.

### Notes and limits

* The timeout is per **statement**, not per request. A request that runs many fast queries is not affected.
* `SET LOCAL` is discarded at commit/rollback. The engine default is applied again to the next transaction, but the export override is not, so export paths must not commit mid-request; they currently do not.
* Do not move the timeout back to a connection-level setting. PgBouncer's transaction pooling hands the server connection to another client after each transaction, so a session-level `SET` would leak, and a startup parameter is rejected outright. Adding it to PgBouncer's `ignore_startup_parameters` would only silence the error: the timeout would be dropped.
* Migrations (`alembic`), the importers and scripts create their own engines and are not subject to these timeouts.

## PgBouncer transaction pooling: rules for session state

The deployed environments reach PostgreSQL through PgBouncer with `pool_mode = transaction`. Each transaction can run on a different server connection, and a statement outside a transaction (`AUTOCOMMIT`) is its own transaction. Anything left on a server connection at commit (a session `SET`, a session advisory lock, a prepared statement) is inherited by whichever client gets that server connection next. Code that talks to the database must therefore:

* **Keep settings transaction-local.** Use `SET LOCAL` or `set_config(name, value, true)`, never `SET` / `SET SESSION`.
* **Use transaction-scoped advisory locks** (`pg_try_advisory_xact_lock`) and do the guarded work in the same transaction. A session lock (`pg_try_advisory_lock` / `pg_advisory_unlock`) taken in `AUTOCOMMIT` lands on one server connection and its unlock on another: the unlock fails, the lock stays on a pooled server connection, later runs are skipped, and a run that lands on that server connection re-enters the lock while another pod is working.
* **Not rely on statements outside a transaction sharing a connection.** If work cannot run in a transaction, coordinate it through a table instead (see the reindex lease below).

How each piece follows these rules:

| What | How |
|---|---|
| Audit username (`app.username`, read by `audit_trigger_func`) | `set_user_context` runs `set_config('app.username', :username, true)`, and an `after_begin` listener sets it again on every later transaction of the same session (a request that commits part way still attributes its later writes). A transaction that never sets it records an empty username (`NULL` or `''`), never the previous client's. |
| FSE reporting MV refresh (every 30 s on every pod) | One transaction: `pg_try_advisory_xact_lock`, then `REFRESH MATERIALIZED VIEW CONCURRENTLY` (allowed inside a transaction) and the generation update. The lock is released at commit or rollback. |
| Compliance reindex (quarterly) | A lease row in `scheduled_job_lease`, claimed with a conditional upsert in its own transaction, renewed after each table and released at the end, including when the run fails. A pod that dies mid-run leaves a lease that expires after `COMPLIANCE_REINDEX_LEASE_SECONDS` (2 h after the last renewal). Each `REINDEX TABLE CONCURRENTLY` is sent as a simple query (no prepared statement). |
| Monthly credit market report | Session advisory lock taken and released inside one open transaction, so it stays on one server connection. |
| Statement timeouts | `SET LOCAL` per transaction (above). |

### Prepared statements

asyncpg prepares every statement it sends through SQLAlchemy, even with its statement cache off. Inside a transaction the prepare and the execute run on the same server connection. Outside a transaction they need PgBouncer to track prepared statements: `max_prepared_statements` must be nonzero (the default is `200` from PgBouncer 1.24; it was `0` before). With it at `0`, a prepared statement sent outside a transaction fails with `prepared statement "__asyncpg_stmt_N__" does not exist`. The scheduled jobs no longer send any statement through SQLAlchemy outside a transaction, but the deployed PgBouncer should still have `max_prepared_statements` above `0` in every environment.

### Checking through PgBouncer locally

`backend/lcfs/tests/db/test_transaction_pooling.py` runs each check directly against PostgreSQL and, when `LCFS_TEST_PGBOUNCER_PORT` is set, through PgBouncer as well, with several simulated pods and request traffic. To run it locally against the compose database (`db` on port 5432):

```bash
docker run -d --name lcfs-pgbouncer-check -p 127.0.0.1:6432:5432 \
  --add-host=host.docker.internal:host-gateway \
  -e DB_HOST=host.docker.internal -e DB_PORT=5432 \
  -e DB_USER=lcfs -e DB_PASSWORD=development_only -e AUTH_TYPE=scram-sha-256 \
  -e POOL_MODE=transaction -e DEFAULT_POOL_SIZE=4 -e MAX_PREPARED_STATEMENTS=200 \
  edoburu/pgbouncer:v1.23.1-p3

cd backend
LCFS_TEST_PGBOUNCER_PORT=6432 poetry run pytest lcfs/tests/db/test_transaction_pooling.py

docker rm -f lcfs-pgbouncer-check
```

A small `DEFAULT_POOL_SIZE` makes clients share server connections, which is what exposes session state. Leave out `MAX_PREPARED_STATEMENTS` to check against the PgBouncer 1.23 default.

## Slow query logging

Implemented in `backend/lcfs/utils/query_analyzer.py` using SQLAlchemy cursor-level events. Because the hook sits at the cursor, it covers **all** statements, including raw SQL executed through `text()`, not just ORM queries.

| Setting | Default | Meaning |
|---|---|---|
| `LCFS_DB_SLOW_QUERY_THRESHOLD_SECONDS` | `1.3` | Statements slower than this log `Slow query detected` (WARNING) |

Log fields: `query`, `execution_time`, `parameters`, `transaction_id`, `correlation_id`, `engine`.

> **Privacy:** `Slow query detected` includes bound `parameters` (existing behaviour), which may contain personal data, so treat those logs accordingly.

Statements cancelled by `statement_timeout` never complete, so they are logged separately as `Query cancelled by statement_timeout` (ERROR) with the same fields except `parameters`, which are deliberately omitted. Use the `correlation_id` to find the originating request.

## Connection utilization monitoring

Implemented in `backend/lcfs/db/pool_monitor.py`. Every connection checkout/checkin on both engines is counted.

| Setting | Default | Meaning |
|---|---|---|
| `LCFS_DB_POOL_MONITORING_ENABLED` | `true` | Master switch |
| `LCFS_DB_CONNECTION_BUDGET` | `80` | Denominator for the utilization ratio (connections the app may use of PostgreSQL's 100) |
| `LCFS_DB_POOL_UTILIZATION_WARN_RATIO` | `0.8` | Log a warning at/above this utilization (throttled to one per 10 s) |
| `LCFS_DB_CONNECTION_HOLD_WARN_SECONDS` | `30` | Warn when one connection is held longer than this |
| `LCFS_DB_POOL_STATS_LOG_INTERVAL_SECONDS` | `60` | Interval for periodic `Database connection stats` log (only emitted while connections are being used) |

`LCFS_DB_CONNECTION_BUDGET` is only used to compute the ratio; with `NullPool` it is **not** a hard cap. If it is lower than real usage the ratio exceeds 1.0.

Counts and metrics are **per Uvicorn worker process** (`LCFS_WORKERS_COUNT`, default 2), and a `/metrics` scrape only reports the worker that served it. The ratio compares one worker's connections to the budget, so set `LCFS_DB_CONNECTION_BUDGET` to the connections *each worker* may use (for example `40` for 2 workers sharing 80) and treat cluster-wide usage as the sum across workers.

### Log messages

| Message | Level | Meaning |
|---|---|---|
| `Database connection utilization is high` | WARNING | `checked_out / budget` reached the warn ratio |
| `Database connection held for a long time` | WARNING | A connection was held longer than the hold threshold |
| `Database connection stats` | INFO | Periodic: `checked_out`, `by_engine`, `peak_in_interval`, `total_checkouts`, `utilization` |

### Prometheus metrics

Exposed on the existing `/metrics` endpoint:

| Metric | Type | Labels | Description |
|---|---|---|---|
| `lcfs_db_connections_checked_out` | gauge | `engine` | Connections currently in use |
| `lcfs_db_connection_utilization_ratio` | gauge | | Total checked out / budget |
| `lcfs_db_connection_hold_seconds` | histogram | `engine` | How long connections are held |
| `lcfs_db_connection_long_holds_total` | counter | `engine` | Connections held over the warn threshold |
| `lcfs_db_high_utilization_events_total` | counter | | Times the warn ratio was reached |
| `lcfs_db_query_duration_seconds` | histogram | `engine` | Statement execution time |
| `lcfs_db_slow_queries_total` | counter | `engine` | Statements over the slow query threshold |
| `lcfs_db_statement_timeouts_total` | counter | `engine` | Statements cancelled by `statement_timeout` |

Each uvicorn worker process exposes its own counts; sum across workers/pods for totals. Suggested alerts: `lcfs_db_connection_utilization_ratio > 0.8` for 5 min, any increase in `lcfs_db_statement_timeouts_total`, and a rising `lcfs_db_slow_queries_total` rate.

## Configuration summary

All settings are environment variables with the `LCFS_` prefix (see `backend/lcfs/settings.py`).

```
LCFS_DB_STATEMENT_TIMEOUT_MS=30000
LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS=300000
LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS=0
LCFS_DB_SLOW_QUERY_THRESHOLD_SECONDS=1.3
LCFS_DB_POOL_MONITORING_ENABLED=true
LCFS_DB_CONNECTION_BUDGET=80
LCFS_DB_POOL_UTILIZATION_WARN_RATIO=0.8
LCFS_DB_CONNECTION_HOLD_WARN_SECONDS=30
LCFS_DB_POOL_STATS_LOG_INTERVAL_SECONDS=60
```

## Troubleshooting

* **An export fails after ~30 s with a statement timeout error**: the route is missing `dependencies=[Depends(extended_statement_timeout)]`, or the export genuinely exceeds `LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS`. Check the `Query cancelled by statement_timeout` log for the query and its `correlation_id`.
* **Utilization warnings under normal load**: look at `by_engine` and the long-hold warnings. Connections held for seconds usually point at a slow query (check slow query logs) or a request doing non-DB work (S3, external HTTP) inside an open session.
* **Check the live setting from PostgreSQL**: `SELECT pid, application_name, state, now() - query_start AS running, left(query, 80) FROM pg_stat_activity WHERE datname = 'lcfs' ORDER BY running DESC;`

See also: [Performance Considerations](Performance-Considerations.md), [Backend Logging Guide](Backend-Logging-Guide.md), [Troubleshooting Guides](Troubleshooting-Guides.md).
