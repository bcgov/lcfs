# API Endpoint Reference

This page provides narrative documentation for the LCFS backend API: the route
groups it exposes, which endpoints are public versus authenticated, the
role-based access model, common query conventions (pagination, filtering,
sorting), and worked request/response examples for the most-used endpoints.

It complements — but does not replace — the auto-generated, always-current
interactive documentation:

- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`
- **OpenAPI schema (JSON)**: `/openapi.json`

For the exhaustive, authoritative list of every endpoint, parameter, and schema,
use the OpenAPI documents above. This page is the conceptual map that explains
*how the API is organized and secured*.

> All routes are mounted under the `/api` prefix (e.g. the calculator
> compliance-periods endpoint is `GET /api/calculator/compliance-periods`). The
> route groups below are listed by their path prefix relative to `/api`.

---

## Authentication & authorization

Authentication is handled by **Keycloak** using OpenID Connect. The frontend
obtains a JWT (access token) and sends it on every protected request as
`Authorization: Bearer <token>`. The backend validates the token and resolves
the caller's roles. See [Security Architecture](Security-Architecture.md) for
the token lifecycle.

Each endpoint declares its access requirement with one of three decorators
(`backend/lcfs/web/core/decorators.py`):

| Decorator | Meaning |
| --- | --- |
| `@public_view_handler` | **Public** — no token required. Used only for the calculator and a few read-only reference endpoints. May be rate-limited. |
| `@view_handler(["*"])` | **Any authenticated user** — a valid token is required, but no specific role. |
| `@view_handler([RoleEnum.X, ...])` | **Role-gated** — the caller must hold at least one of the listed roles. |

### Roles

Roles come from `RoleEnum` (`backend/lcfs/db/models/user/Role.py`) and fall into
two families:

**Government (IDIR) roles**

- `Government` — base role held by all government users
- `Administrator` — user/account administration
- `Analyst`, `Compliance Manager`, `Director` — compliance-review workflow
- `System Admin` — platform configuration (background images, report openings, system notifications)

**Supplier (BCeID) roles**

- `Supplier` — base role held by all organization users
- `Manage Users` — manage their organization's users
- `Transfer` — initiate/respond to transfers
- `Compliance Reporting` — create and edit compliance reports
- `Signing Authority` — submit/sign reports and transfers
- `Read Only` — view-only access
- `CI Applicant` — work on carbon-intensity (CI) applications
- `IA Proponent` / `IA Analyst` / `IA Manager` / `IA Signer` — initiative-agreement workflow

Government and supplier users are also segregated at the **data** layer: a
supplier can only ever see their own organization's records (enforced in the
service/repository layer, in addition to the role checks above).

---

## Common query patterns

### Pagination, sorting, and filtering

List endpoints follow a consistent convention: they are **`POST`** requests
(so the query can be sent as a JSON body) that accept a
`PaginationRequestSchema` (`backend/lcfs/web/api/base.py`):

```jsonc
// POST body
{
  "page": 1,                 // 1-based page number (default 1)
  "size": 10,                // page size (default 10)
  "sortOrders": [            // optional; applied in order
    { "field": "updateDate", "direction": "desc" }
  ],
  "filters": [               // optional; AND-combined
    {
      "field": "status",     // column to filter on
      "filterType": "text",  // text | number | date | set
      "type": "equals",      // equals | contains | greaterThan | inRange | ...
      "filter": "Recorded"   // the value (or filter/filterTo for ranges)
    }
  ]
}
```

The matching paginated **response** wraps the rows in a named collection plus a
`pagination` object:

```jsonc
{
  "transactions": [ /* ... rows ... */ ],
  "pagination": { "total": 134, "page": 1, "size": 10 }
}
```

The collection key matches the resource (e.g. `transactions`, `reports`,
`users`, `ledger`). Field names in request/response bodies are **camelCase**
(the backend maps them to snake_case internally via Pydantic aliases).

---

## Route group reference

The table below maps every router group (`backend/lcfs/web/api/router.py`) to
its purpose and access tier. "Supplier & Government" means both families can
reach the group, typically with suppliers scoped to their own organization and
specific sub-roles (e.g. *Compliance Reporting* / *Signing Authority*) required
for write operations. Exact per-endpoint roles are declared in each module's
`views.py` and surfaced in Swagger.

| Prefix | Purpose | Access |
| --- | --- | --- |
| *(monitoring)* `/health` | Health/liveness probe | **Public** |
| `/calculator` | Public compliance-unit calculator and CI lookup table | **Public** |
| `/fuel-codes` | Fuel codes; approved carbon-intensity lookups | **Mixed** — public CI lookups; Government/Analyst/Director to manage |
| `/transactions` | Credit transaction ledger (transfers, adjustments, agreements) | Government; suppliers via org-scoped reads |
| `/transfers` | Credit transfers between organizations | Supplier & Government (recording: Director) |
| `/reports` | Compliance reports (annual supply reporting) | Supplier & Government |
| `/allocation-agreement` | Allocation-agreement line items on a report | Supplier (Compliance Reporting/Signing) & Government |
| `/fuel-supply` | Fuel-supply line items on a report | Supplier & Government |
| `/fuel-exports` | Fuel-export line items on a report | Supplier & Government |
| `/notional-transfers` | Notional-transfer line items on a report | Supplier & Government |
| `/other-uses` | "Other uses" line items on a report | Supplier & Government |
| `/final-supply-equipments` | Final supply equipment (FSE) records | Supplier & Government (Analyst) |
| `/charging-equipment` | Charging equipment records | Supplier & Government |
| `/charging-sites` | Charging site records | Supplier & Government |
| `/ci-applications` | Carbon-intensity applications | Supplier (CI Applicant/Signing) & Government |
| `/admin-adjustments` | Government-initiated credit adjustments | Government (Analyst/Director) |
| `/initiative-agreements` | Initiative agreements | Government |
| `/organizations` | Organization management (IDIR view) | Government (Analyst/Administrator/Director) |
| `/organization` | Organization self-service (BCeID view) | Supplier (Manage Users / Compliance Reporting / Signing) |
| `/organizations/{id}/comments`, `/internal_comments` | Internal comments on records | Supplier & Government (visibility-scoped) |
| `/credit-ledger` | Per-organization credit ledger | Supplier & Government |
| `/organization_snapshot` | Point-in-time org snapshots on reports | Supplier & Government |
| `/notifications` | Per-user notifications & subscriptions | Authenticated (per-user) |
| `/government-notifications` | System-wide government notices | Any authenticated (read); System Admin (manage) |
| `/users` | User accounts & activity | Authenticated; management requires Administrator |
| `/roles` | Role reference data | Authenticated (Government & Supplier) |
| `/dashboard` | Role-specific dashboard cards/counts | Role-specific (Analyst, Compliance Manager, Director, Transfer, Compliance Reporting, Signing Authority) |
| `/documents` | File attachments (MinIO-backed) | Supplier & Government (Analyst) |
| `/audit-log` | Audit trail | Government (Administrator) |
| `/report-openings` | Compliance-period report openings | System Admin (suppliers may read) |
| `/fuel-type` | Fuel-type reference data | Any authenticated |
| `/geocoder` | Address geocoding/autocomplete | Any authenticated |
| `/email` | Email send/templates | Any authenticated |
| `/forms` | Public/linkable form definitions & exports | Authenticated; public access via secret link key |
| `/login-bg-images` | Login-page background image management | System Admin |
| `/echo` | Diagnostic echo (development) | Authenticated |

---

## Worked examples

### Calculator (public) — compliance units from a quantity

The calculator is the primary **public** API: external stakeholders use it to
estimate compliance units without authentication. No token is required.

**Request**

```http
GET /api/calculator/2024/calculate/?fuelCategoryId=2&fuelTypeId=3&endUseId=24&quantity=100000
```

Query parameters (`CalculatorQueryParams`):

| Param | Required | Notes |
| --- | --- | --- |
| `fuelCategoryId` | yes | Fuel category id |
| `fuelTypeId` | yes | Fuel type id |
| `endUseId` | no | End-use id (required for most post-2024 calculations) |
| `quantity` | yes | Quantity supplied, in the fuel's unit |
| `fuelCodeId` | no | When using an approved fuel code |
| `useCustomCi` | no | `true` to supply a custom carbon intensity |
| `customCiValue` | no | The custom CI value (gCO₂e/MJ) when `useCustomCi=true` |

**Response** (`CreditsResultSchema`, HTTP 200)

```json
{
  "rci": 20.5,
  "tci": 79.28,
  "eer": 1.0,
  "energyDensity": 37.0,
  "uci": 0,
  "quantity": 100000,
  "energyContent": 3700000,
  "complianceUnits": 1234
}
```

The reverse endpoint `GET /api/calculator/{compliance_period}/calculate/quantity/`
takes `complianceUnits` instead of `quantity` and returns the same schema with a
derived `quantity`. The lookup table is available at
`GET /api/calculator/{year}/lookup-table/`.

Other public calculator endpoints: `GET /api/calculator/compliance-periods`,
`GET /api/calculator/{year}/` (fuel types for a category), and
`GET /api/calculator/{year}/fuel-type-options/`.

### Transactions — paginated, filtered list

Transactions list endpoints require a Government role (suppliers read their own
organization's transactions via the org-scoped variant). They use the standard
pagination contract.

**Request**

```http
POST /api/transactions/
Authorization: Bearer <token>
Content-Type: application/json

{
  "page": 1,
  "size": 10,
  "sortOrders": [{ "field": "updateDate", "direction": "desc" }],
  "filters": [{ "field": "transactionType", "filterType": "text", "type": "equals", "filter": "Transfer" }]
}
```

**Response** (`TransactionListSchema`, HTTP 200)

```jsonc
{
  "transactions": [
    {
      "transactionId": 5012,
      "transactionType": "Transfer",
      "compliancePeriod": "2024",
      "fromOrganization": "Organization A",
      "toOrganization": "Organization B",
      "quantity": 1000,
      "status": "Recorded",
      "updateDate": "2024-05-01T12:00:00Z"
    }
    // ... up to `size` rows
  ],
  "pagination": { "total": 134, "page": 1, "size": 10 }
}
```

> Item field names are representative; consult `/openapi.json` for the exact
> `TransactionView` schema.

### Compliance reports — list and detail

Suppliers manage their own reports; government users review them.

**List** — `POST /api/reports/list` with a `PaginationRequestSchema` body,
returning `ComplianceReportListSchema` (`{ "reports": [...], "pagination": {...} }`).

**Detail** — `GET /api/reports/{report_id}` returns a
`ChainedComplianceReportSchema` (the report plus its supplemental chain).

**Supporting reference endpoints**

- `GET /api/reports/compliance-periods` — available compliance periods
- `GET /api/reports/statuses` — report status values

---

## Error responses

The API uses standard HTTP status codes:

| Status | Meaning |
| --- | --- |
| `200` / `201` | Success |
| `400` | Validation error (malformed body or query) |
| `401` | Missing/invalid token |
| `403` | Authenticated but lacking the required role, or accessing another organization's data |
| `404` | Resource not found |
| `422` | Request schema validation failed (FastAPI/Pydantic) |
| `500` | Unhandled server error |

Error bodies typically include a `detail` field; server errors may include a
correlation reference (`reference_number` / `x-correlation-id`) for log
tracing.

---

## See also

- [Integration Points and APIs](Integration-Points-and-APIs.md) — system-level integration overview
- [Security Architecture](Security-Architecture.md) — authentication, JWT, and Keycloak
- Swagger UI (`/docs`) / ReDoc (`/redoc`) / OpenAPI (`/openapi.json`) — authoritative, always-current endpoint reference
