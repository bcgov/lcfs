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
| API requests (`app` engine) | 30 s | `LCFS_DB_STATEMENT_TIMEOUT_MS` | asyncpg `server_settings` startup parameter on every connection |
| Export / report endpoints | 5 min | `LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS` | `SET LOCAL` for the request's transaction (see below) |
| `lifetime` engine (auth + scheduled jobs) | unlimited (`0`) | `LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS` | asyncpg `server_settings` |

A value of `0` disables the timeout; it is sent to PostgreSQL as an explicit `statement_timeout=0`, so it also overrides any server/database/role level default. The export override is skipped when `LCFS_DB_STATEMENT_TIMEOUT_MS=0`, or when the export value is nonzero and no larger than the normal one, so an export can never get a *tighter* limit than a normal request (an export value of `0` stays unlimited). Invalid values (negative timeouts, a budget below 1, a warn ratio outside `(0, 1]`) are rejected at startup. When a statement exceeds the limit PostgreSQL cancels it (`canceling statement due to statement timeout`, SQLSTATE `57014`) and the request fails with a server error; the transaction is rolled back and the connection is released.

The `lifetime` engine is intentionally unlimited by default: scheduled maintenance jobs such as `REINDEX TABLE CONCURRENTLY` legitimately run for minutes. Set `LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS` only if you have measured your longest job.

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

How it works: FastAPI resolves route-level `dependencies` *before* parameter dependencies, so `extended_statement_timeout` records the longer limit on `request.state` before `get_async_db_session` opens the session. The session then runs `set_config('statement_timeout', ..., true)` (equivalent to `SET LOCAL`), which lasts only for that transaction and cannot leak to another request.

**When adding a new export or report endpoint, add this dependency**, otherwise it is limited to the 30 s default. A unit test (`TestExportRoutesUseExtendedTimeout`) fails if a route whose path ends in `/export`, contains `/export/` or is the FSE `update-template` is missing it.

Currently applied to: user, organizations, organization (transactions), transaction, credit ledger, fuel code (+ bulletins), forms, charging equipment, final supply equipment (including the FSE reporting update-template, which exports all eligible FSE), allocation agreement and compliance report export endpoints.

Not extended (they remain at 30 s): blank Excel *template* downloads (they load no data) and *import* endpoints.

### Notes and limits

* The timeout is per **statement**, not per request. A request that runs many fast queries is not affected.
* `SET LOCAL` is discarded at commit/rollback. Export paths must not commit mid-request; they currently do not.
* If PgBouncer in transaction mode is introduced, the `server_settings` startup parameter must be allowed (`ignore_startup_parameters = statement_timeout`) or the default moved to a per-transaction `SET LOCAL`.
* Migrations (`alembic`), the importers and scripts create their own engines and are not subject to these timeouts.

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
