#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/anonymize_nonprod.sql"

print_usage() {
    cat <<'EOF'
Usage:
  ./etl/anonymize-nonprod.sh --env <local|test> [options]

Required:
  --env <local|test>              Target environment guard.

Optional:
  --host <host>                   DB host (default: LCFS_DB_HOST or localhost)
  --port <port>                   DB port (default: LCFS_DB_PORT or 5432)
  --db-name <name>                DB name (default: LCFS_DB_NAME or LCFS_DB_BASE or lcfs)
  --db-user <user>                DB user (default: LCFS_DB_USER or lcfs)
  --db-password <password>        DB password (default: LCFS_DB_PASSWORD or LCFS_DB_PASS)
  --db-container <name|id>        Docker container running postgres (used when local psql is missing)
  --dictionary <path>             JSON dictionary file for realistic fake values
                                  (default: etl/anonymizer_dictionary.json)
  --salt-phrase <text>            Salt used for org-name hash suffix (default: ANONYMIZER_SALT or lcfs-nonprod-salt)
  --dry-run                       Execute then roll back (no data changes persisted)
  --skip-seed-users               Skip loading seeded users from backend seeders
  -h, --help                      Show this help

Examples:
  ./etl/anonymize-nonprod.sh \
    --env local \
    --db-container lcfs-db \
    --dictionary ./etl/anonymizer_dictionary.json \
    --host localhost --port 5432 --db-name lcfs --db-user lcfs --db-password development_only

  ./etl/anonymize-nonprod.sh \
    --env test \
    --dry-run
EOF
}

TARGET_ENV=""
DB_HOST="${LCFS_DB_HOST:-localhost}"
DB_PORT="${LCFS_DB_PORT:-5432}"
DB_NAME="${LCFS_DB_NAME:-${LCFS_DB_BASE:-lcfs}}"
DB_USER="${LCFS_DB_USER:-lcfs}"
DB_PASSWORD="${LCFS_DB_PASSWORD:-${LCFS_DB_PASS:-}}"
DB_CONTAINER="${LCFS_DB_CONTAINER:-}"
DICTIONARY_FILE="${ANONYMIZER_DICTIONARY:-$SCRIPT_DIR/anonymizer_dictionary.json}"
SALT_PHRASE="${ANONYMIZER_SALT:-lcfs-nonprod-salt}"
DRY_RUN=false
SKIP_SEED_USERS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            TARGET_ENV="${2:-}"
            shift 2
            ;;
        --host)
            DB_HOST="${2:-}"
            shift 2
            ;;
        --port)
            DB_PORT="${2:-}"
            shift 2
            ;;
        --db-name)
            DB_NAME="${2:-}"
            shift 2
            ;;
        --db-user)
            DB_USER="${2:-}"
            shift 2
            ;;
        --db-password)
            DB_PASSWORD="${2:-}"
            shift 2
            ;;
        --db-container)
            DB_CONTAINER="${2:-}"
            shift 2
            ;;
        --dictionary)
            DICTIONARY_FILE="${2:-}"
            shift 2
            ;;
        --salt-phrase)
            SALT_PHRASE="${2:-}"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-seed-users)
            SKIP_SEED_USERS=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            print_usage
            exit 1
            ;;
    esac
done

if [[ ! -f "$SQL_FILE" ]]; then
    echo "Missing SQL script: $SQL_FILE"
    exit 1
fi

if [[ -z "$TARGET_ENV" ]]; then
    echo "Missing required --env"
    exit 1
fi

if [[ "$TARGET_ENV" != "local" && "$TARGET_ENV" != "test" ]]; then
    echo "Invalid --env '$TARGET_ENV'. Allowed values: local, test"
    exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
    echo "Database password is required (set --db-password or LCFS_DB_PASSWORD/LCFS_DB_PASS)."
    exit 1
fi

if [[ -z "$SALT_PHRASE" ]]; then
    echo "Salt phrase cannot be empty (set --salt-phrase or ANONYMIZER_SALT)."
    exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
    EXECUTE_CHANGES="off"
else
    EXECUTE_CHANGES="on"
fi

if [[ ! -f "$DICTIONARY_FILE" ]]; then
    echo "Dictionary file not found: $DICTIONARY_FILE"
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to parse dictionary JSON."
    exit 1
fi

FIRST_NAMES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['person']['first_names']))" "$DICTIONARY_FILE")"
LAST_NAMES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['person']['last_names']))" "$DICTIONARY_FILE")"
ORG_PREFIXES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['org']['prefixes']))" "$DICTIONARY_FILE")"
ORG_FOCI_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['org']['focuses']))" "$DICTIONARY_FILE")"
ORG_SUFFIXES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['org']['suffixes']))" "$DICTIONARY_FILE")"
STREET_NAMES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['address']['street_names']))" "$DICTIONARY_FILE")"
STREET_TYPES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['address']['street_types']))" "$DICTIONARY_FILE")"
CITIES_JSON="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); print(json.dumps(d['address']['cities']))" "$DICTIONARY_FILE")"

echo "Running LCFS anonymizer"
echo "  env: $TARGET_ENV"
echo "  db:  $DB_HOST:$DB_PORT/$DB_NAME"
echo "  mode: $( [[ "$DRY_RUN" == true ]] && echo "dry-run (rollback)" || echo "apply (commit)" )"
echo "  seed users: $( [[ "$SKIP_SEED_USERS" == true ]] && echo "skipped" || echo "enabled" )"
echo "  dictionary: $DICTIONARY_FILE"

export PGPASSWORD="$DB_PASSWORD"

if command -v psql >/dev/null 2>&1; then
    psql \
        -v ON_ERROR_STOP=1 \
        -v target_env="$TARGET_ENV" \
        -v salt_phrase="$SALT_PHRASE" \
        -v first_names_json="$FIRST_NAMES_JSON" \
        -v last_names_json="$LAST_NAMES_JSON" \
        -v org_prefixes_json="$ORG_PREFIXES_JSON" \
        -v org_focuses_json="$ORG_FOCI_JSON" \
        -v org_suffixes_json="$ORG_SUFFIXES_JSON" \
        -v street_names_json="$STREET_NAMES_JSON" \
        -v street_types_json="$STREET_TYPES_JSON" \
        -v cities_json="$CITIES_JSON" \
        -v execute_changes="$EXECUTE_CHANGES" \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$SQL_FILE"
else
    if [[ -z "$DB_CONTAINER" ]]; then
        echo "psql is not installed and --db-container was not provided."
        echo "Provide --db-container <name|id> to run psql through docker exec."
        exit 1
    fi

    docker exec -i \
        -e PGPASSWORD="$DB_PASSWORD" \
        "$DB_CONTAINER" \
        psql \
        -v ON_ERROR_STOP=1 \
        -v target_env="$TARGET_ENV" \
        -v salt_phrase="$SALT_PHRASE" \
        -v first_names_json="$FIRST_NAMES_JSON" \
        -v last_names_json="$LAST_NAMES_JSON" \
        -v org_prefixes_json="$ORG_PREFIXES_JSON" \
        -v org_focuses_json="$ORG_FOCI_JSON" \
        -v org_suffixes_json="$ORG_SUFFIXES_JSON" \
        -v street_names_json="$STREET_NAMES_JSON" \
        -v street_types_json="$STREET_TYPES_JSON" \
        -v cities_json="$CITIES_JSON" \
        -v execute_changes="$EXECUTE_CHANGES" \
        -h localhost \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$SQL_FILE"
fi

if [[ "$DRY_RUN" != true && "$SKIP_SEED_USERS" != true ]]; then
    echo "Loading seeded non-production users into user_profile and user_role"
    SEED_SCRIPT="$SCRIPT_DIR/../backend/lcfs/db/seeders/load_nonprod_users.py"
    if [[ ! -f "$SEED_SCRIPT" ]]; then
      echo "Seed loader script not found: $SEED_SCRIPT"
      exit 1
    fi
    (
      if command -v poetry >/dev/null 2>&1; then
        cd "$SCRIPT_DIR/../backend"
        LCFS_DB_HOST="$DB_HOST" \
        LCFS_DB_PORT="$DB_PORT" \
        LCFS_DB_BASE="$DB_NAME" \
        LCFS_DB_USER="$DB_USER" \
        LCFS_DB_PASS="$DB_PASSWORD" \
        poetry run python lcfs/db/seeders/load_nonprod_users.py --env "$TARGET_ENV"
      else
        cd "$SCRIPT_DIR/.."
        LCFS_DB_HOST="$DB_HOST" \
        LCFS_DB_PORT="$DB_PORT" \
        LCFS_DB_BASE="$DB_NAME" \
        LCFS_DB_USER="$DB_USER" \
        LCFS_DB_PASS="$DB_PASSWORD" \
        PYTHONPATH="$SCRIPT_DIR/../backend" \
        python3 "$SEED_SCRIPT" --env "$TARGET_ENV"
      fi
    )
fi

echo "Anonymizer completed successfully."
