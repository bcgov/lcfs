# LCFS Non-Production Data Anonymizer

This anonymizer is intended for **local** and **test** databases after importing a production data copy.

It updates identity/contact fields while preserving report and transaction records.

## What it anonymizes

Tables and fields:

- `organization`
  - `name`, `operating_name`, `email`, `phone`, `records_address`
  - `credit_market_contact_name`, `credit_market_contact_email`, `credit_market_contact_phone`
- `organization_address`
  - `name`, `street_address`, `address_other`, `city`, `province_state`, `country`, `postalCode_zipCode`
- `organization_attorney_address`
  - `name`, `street_address`, `address_other`, `city`, `province_state`, `country`, `postalCode_zipCode`
- `user_profile`
  - `keycloak_username`, `keycloak_email`, `email`, `phone`, `mobile_phone`, `first_name`, `last_name`

Role assignment:

- Loads seeded users into `user_profile` and `user_role` after anonymization:
  - `local` env uses `dev` user seeders.
  - `test` env uses staging `test` user seeders.
- Existing seeded users are upserted; role mappings for seeded users are reset and re-applied.

## What it does not change

- Report and transaction data tables are not updated by this script.

## Safety controls

- Script only allows `--env local` or `--env test`.
- Script refuses to run if database name looks production-like (contains `prod`).
- Supports `--dry-run` to roll back all changes after validation.

## Deterministic behavior

- Values are generated as readable deterministic labels using record IDs
  and dictionary values from JSON (for example realistic names/companies/usernames).
- Organization `name` includes a deterministic hash suffix (for example `... #1a2b3c4d5e`)
  generated from original org name + salt phrase + organization id.
- Dictionary domains:
  - `person.first_names`, `person.last_names`
  - `org.prefixes`, `org.focuses`, `org.suffixes`
  - `address.street_names`, `address.street_types`, `address.cities`
- Original pre-anonymized values are stored in `anonymizer_original_values`
  so local environment can restore originals.

## Usage

From repo root:

```bash
./etl/anonymize-nonprod.sh \
  --env local \
  --db-container lcfs-db \
  --salt-phrase "<your-salt-phrase>" \
  --dictionary ./etl/anonymizer_dictionary.json \
  --host localhost --port 5432 --db-name lcfs --db-user lcfs --db-password development_only
```

Test environment run:

```bash
./etl/anonymize-nonprod.sh \
  --env test \
  --salt-phrase "<your-salt-phrase>" \
  --dictionary ./etl/anonymizer_dictionary.json \
  --host <host> --port <port> --db-name lcfs --db-user <user> --db-password <password>
```

Dry-run validation:

```bash
./etl/anonymize-nonprod.sh \
  --env local \
  --salt-phrase "<your-salt-phrase>" \
  --dry-run
```

## Environment variable defaults

If flags are omitted, the script uses:

- `LCFS_DB_HOST` (default `localhost`)
- `LCFS_DB_PORT` (default `5432`)
- `LCFS_DB_NAME` or `LCFS_DB_BASE` (default `lcfs`)
- `LCFS_DB_USER` (default `lcfs`)
- `LCFS_DB_PASSWORD` or `LCFS_DB_PASS` (required if no `--db-password`)
- `ANONYMIZER_DICTIONARY` (default `etl/anonymizer_dictionary.json`)
- `ANONYMIZER_SALT` (default `lcfs-nonprod-salt`)

## Re-run behavior

- Safe to re-run with same inputs.
- Existing seeded username conflicts are moved aside deterministically and seeded users are upserted.
- Use `--skip-seed-users` if you only want anonymization and do not want seeded user loading.

## Restore Original Values (Local Only)

- Admin UI exposes a restore action only in local/dev environments.
- API endpoint used by UI: `POST /users/anonymizer/restore-originals`
- Endpoint is blocked in non-local environments.
- Admin UI also exposes local-only org-name reveal by salt phrase.
- API endpoint used by UI: `POST /users/anonymizer/reveal-org-name`

## Prerequisites

- Either `psql` available in shell, or provide `--db-container <name|id>` to run via `docker exec`.
- `poetry` available for seeded user loading (preferred); fallback is `python3` with backend path.
- `python3` available to parse dictionary JSON.
