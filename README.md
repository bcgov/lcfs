# Low Carbon Fuel Standard (LCFS)

An official online application designed for fuel and electricity suppliers in British Columbia to manage compliance obligations under the Low Carbon Fuels Act. This tool streamlines the process, ensuring efficiency and adherence to regulations.

# Documentation

Check out our [wiki docs](https://github.com/bcgov/lcfs/wiki) for documentation!

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## AI Analytics Assistant

The repository now includes an in-app AI analytics feature for government users at `/ai-analytics`.

### What it does

- Inspects SQLAlchemy models and live PostgreSQL tables/views
- Builds a grounded schema catalog
- Plans analytical questions before generating SQL
- Generates read-only `SELECT` queries only
- Executes the validated query and returns:
  - plain-English summary
  - raw rows
  - ECharts-ready option JSON
  - entities used
  - SQL used
  - assumptions and warnings
- Can run in three explicit modes:
  - `heuristic_only`
  - `local_llm_direct`
  - `openclaw_local`
- Can optionally use local/private MindsDB for forecasting and predictive analytics

### Local-only architecture

```text
User -> React AI Analytics page
     -> FastAPI /api/ai-analytics/*
     -> Schema catalog + semantic metadata + session memory
     -> Planning:
        - heuristic_only: deterministic planner only
        - local_llm_direct: local LLM endpoint (for JSON plan/summary only)
        - openclaw_local: local OpenCLAW endpoint (for JSON plan/summary only)
     -> deterministic SQL generation
     -> SQL safety validator
     -> PostgreSQL execution
     -> deterministic chart config
     -> grounded response back to frontend
     -> optional MindsDB forecast layer for historical+future projections
```

No cloud AI provider is used. The application is designed to fail closed if an AI endpoint is configured to a public host.

### Backend endpoints

- `POST /api/ai-analytics/schema/catalog`
- `POST /api/ai-analytics/query/plan`
- `POST /api/ai-analytics/query/run`
- `POST /api/ai-analytics/query/follow-up`
- `GET /api/ai-analytics/views`

### Example environment variables

These are optional in `heuristic_only` mode. Local/private endpoints are required in `local_llm_direct` and `openclaw_local` modes:

```env
LCFS_AI_ANALYTICS_MODE=heuristic_only
LCFS_AI_ANALYTICS_MAX_ROWS=500
LCFS_AI_ANALYTICS_DEFAULT_LIMIT=100
LCFS_AI_ANALYTICS_SCHEMA_CACHE_TTL_SECONDS=300
LCFS_AI_ANALYTICS_LLM_PROVIDER=ollama
LCFS_AI_ANALYTICS_LLM_BASE_URL=http://ollama:11434
LCFS_AI_ANALYTICS_LLM_MODEL=llama3.1:8b
LCFS_AI_ANALYTICS_OPENCLAW_BASE_URL=http://openclaw:8080
LCFS_AI_ANALYTICS_OPENCLAW_MODEL=local-planner
LCFS_AI_ANALYTICS_OPENCLAW_PATH=/orchestrate
LCFS_AI_ANALYTICS_ALLOW_PRIVATE_HOSTS_ONLY=true
LCFS_AI_ANALYTICS_ALLOWED_INTERNAL_HOSTS=localhost,127.0.0.1,ollama,openclaw
LCFS_AI_ANALYTICS_REQUEST_TIMEOUT_SECONDS=60
LCFS_AI_ANALYTICS_MAX_RETRIES=2
LCFS_AI_ANALYTICS_ENABLE_LLM_SUMMARY=true
LCFS_AI_ANALYTICS_ENABLE_MINDSDB=true
LCFS_AI_ANALYTICS_MINDSDB_BASE_URL=http://mindsdb:47334
LCFS_AI_ANALYTICS_MINDSDB_ALLOWED_INTERNAL_HOSTS=localhost,127.0.0.1,mindsdb
LCFS_AI_ANALYTICS_MINDSDB_PRIVATE_ONLY=true
LCFS_AI_ANALYTICS_MINDSDB_SQL_PATH=/api/sql/query
LCFS_AI_ANALYTICS_MINDSDB_PROJECT=mindsdb
LCFS_AI_ANALYTICS_MINDSDB_POSTGRES_INTEGRATION=lcfs_postgres
LCFS_AI_ANALYTICS_MIN_FORECAST_POINTS=12
LCFS_AI_ANALYTICS_DEFAULT_FORECAST_HORIZON=6
```

### Running fully local with Ollama

1. Start the base stack:

```bash
docker compose up db redis rabbitmq minio create_bucket backend frontend ollama
```

2. Pull the local model inside the Ollama container:

```bash
docker exec -it ollama ollama pull llama3.1:8b
```

3. Set backend env:

```env
LCFS_AI_ANALYTICS_MODE=local_llm_direct
LCFS_AI_ANALYTICS_LLM_PROVIDER=ollama
LCFS_AI_ANALYTICS_LLM_BASE_URL=http://ollama:11434
LCFS_AI_ANALYTICS_LLM_MODEL=llama3.1:8b
```

### Running with local OpenCLAW

Use a private/internal OpenCLAW service only:

```env
LCFS_AI_ANALYTICS_MODE=openclaw_local
LCFS_AI_ANALYTICS_OPENCLAW_BASE_URL=http://openclaw:8080
LCFS_AI_ANALYTICS_OPENCLAW_MODEL=local-planner
LCFS_AI_ANALYTICS_OPENCLAW_PATH=/orchestrate
LCFS_AI_ANALYTICS_ALLOWED_INTERNAL_HOSTS=localhost,127.0.0.1,ollama,openclaw
```

OpenCLAW is only used for structured plan/summary JSON. It cannot directly execute SQL. SQL generation and validation stay inside application code.

### Forecasting with local MindsDB

Forecast questions such as:

- `Forecast total credits for the next 12 months`
- `Predict quarterly report volume for next year`
- `Show historical lead time and forecast next 6 months`

follow this path:

1. App detects forecast intent
2. App builds safe historical training SQL
3. App validates and extracts the historical time-series shape
4. App creates or reuses a local MindsDB model
5. App requests predictions from local MindsDB
6. App returns historical rows, forecast rows, combined series, chart config, and model metadata

MindsDB is private/local only and does not replace deterministic SQL control in the app.

### Docker compose example for private local deployment

```yaml
services:
  backend:
    environment:
      LCFS_AI_ANALYTICS_MODE: local_llm_direct
      LCFS_AI_ANALYTICS_LLM_PROVIDER: ollama
      LCFS_AI_ANALYTICS_LLM_BASE_URL: http://ollama:11434
      LCFS_AI_ANALYTICS_LLM_MODEL: llama3.1:8b
      LCFS_AI_ANALYTICS_ALLOWED_INTERNAL_HOSTS: localhost,127.0.0.1,ollama,openclaw
      LCFS_AI_ANALYTICS_ENABLE_MINDSDB: true
      LCFS_AI_ANALYTICS_MINDSDB_BASE_URL: http://mindsdb:47334
      LCFS_AI_ANALYTICS_MINDSDB_ALLOWED_INTERNAL_HOSTS: localhost,127.0.0.1,mindsdb

  ollama:
    image: ollama/ollama:latest
    networks:
      - shared_network

  mindsdb:
    image: mindsdb/mindsdb:latest
    networks:
      - shared_network

  # optional
  openclaw:
    image: your-private-registry/openclaw:latest
    networks:
      - shared_network
```

### Sample request

```json
{
  "question": "Show total credits by compliance period",
  "sessionId": "demo-session-1"
}
```

### Sample response shape

```json
{
  "sessionId": "demo-session-1",
  "executionMode": "local_llm_direct",
  "llmProvider": "ollama",
  "modelName": "llama3.1:8b",
  "summary": "Highest value is 1200 for 2023.",
  "sql": "SELECT ...",
  "queryPlan": {
    "intent": "aggregation",
    "candidateChartType": "bar"
  },
  "result": {
    "columns": ["compliance period", "value"],
    "rows": [
      { "compliance period": "2022", "value": 900 },
      { "compliance period": "2023", "value": 1200 }
    ]
  },
  "chart": {
    "chartType": "bar",
    "option": {
      "xAxis": { "type": "category" },
      "series": [{ "type": "bar" }]
    }
  },
  "entitiesUsed": [
    {
      "schemaName": "public",
      "name": "mv_credit_ledger",
      "entityType": "materialized_view"
    }
  ],
  "warnings": [],
  "assumptions": []
}
```

### Example forecast response shape

```json
{
  "sessionId": "forecast-session-1",
  "executionMode": "local_llm_direct",
  "llmProvider": "ollama",
  "modelName": "llama3.1:8b",
  "forecastMode": true,
  "mindsdbModelName": "forecast_public_mv_credit_ledger_compliance_units_month_ab12cd34ef",
  "forecastHorizon": 12,
  "forecastGranularity": "month",
  "sourceEntityUsed": "public.mv_credit_ledger",
  "sourceSqlUsed": "SELECT DATE_TRUNC('month', ...) AS ds, SUM(...) AS y ...",
  "historicalRows": [
    { "ds": "2024-01-01", "y": 900.0 }
  ],
  "forecastRows": [
    { "ds": "2025-01-01", "y": 950.0 }
  ],
  "combinedSeries": [
    { "period": "2024-01-01", "value": 900.0, "kind": "historical" },
    { "period": "2025-01-01", "value": 950.0, "kind": "forecast" }
  ]
}
```

### Usage notes

- The assistant prefers analytics views such as `vw_*`, `v_*`, and `mv_*` before raw tables.
- Follow-up prompts reuse `sessionId`, for example: `show this by year`, `filter to 2023`, or `make this a bar chart`.
- If the schema does not support a grounded answer, the assistant is expected to narrow the request instead of inventing tables or columns.
- If the local model returns invalid JSON, the app falls back to heuristic planning instead of calling any cloud service.
- If a configured AI endpoint is public, backend startup fails immediately.
- If there are not enough historical points for forecasting, the app refuses to fabricate a forecast.
- If a configured MindsDB endpoint is public, backend startup fails immediately.

### Troubleshooting

- `ValueError ... not local/private`:
  The configured AI endpoint host is public or not on the allowlist.
- `Local model planning failed, so heuristic planning was used`:
  The local model or OpenCLAW endpoint responded with malformed JSON.
- No `vitest`/Python tooling in the shell:
  Run tests inside the normal project container or your standard dev environment where dependencies are installed.

## License

This project is under the Apache License 2.0 - see [LICENSE.md](LICENSE.md).

## Acknowledgements

- BC Government for the initiative to simplify compliance through technology.
- Contributors and maintainers of this project.
