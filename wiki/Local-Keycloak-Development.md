# Local Keycloak for parallel development stacks

The local Keycloak overlay gives each Compose project its own disposable local
identity provider and realm. The local client accepts arbitrary HTTP(S) callback
URIs, so frontend stacks can use different host ports without changing the
shared development Keycloak client.

The local Keycloak service is published on `127.0.0.1` only. Each launcher
stack gets a distinct `*.localhost` Keycloak hostname so browser sessions and
cookies stay separate while stacks run on different ports. Its realm contains
development-only wildcard redirect and web-origin settings. Do not reuse this
realm or client configuration in a shared or deployed environment.

## Start a stack

The launcher creates a Compose project scoped to this worktree and stack name,
chooses eight available host ports, saves its port assignments outside the
repository, and waits for Keycloak, the backend, and the frontend to become
healthy:

```sh
./scripts/local-keycloak-stack.sh start agent-a
```

Start another parallel stack with a different label, or omit the label to have
the launcher generate a unique name:

```sh
./scripts/local-keycloak-stack.sh start agent-b
./scripts/local-keycloak-stack.sh start
```

Use `list` to see stacks started from this worktree and their frontend URLs.
Labels can be reused in different worktrees without sharing containers or
volumes. Stop a stack without removing its data volumes with `stop`:

```sh
./scripts/local-keycloak-stack.sh list
./scripts/local-keycloak-stack.sh stop agent-a
```

## Access from a remote development machine

Open local-Keycloak stacks in a browser on the machine running Compose with
`http://localhost:<frontend-port>`. Directly opening the host's Tailscale IP
selects the normal development Keycloak settings in the frontend. For a remote
browser, use SSH local forwarding so its origin remains `localhost`.

On the remote machine, forward each stack's frontend, backend, and Keycloak
ports. Get the allocated ports from `./scripts/local-keycloak-stack.sh list`:

```sh
ssh -N \
  -L 127.0.0.1:<frontend-port>:127.0.0.1:<frontend-port> \
  -L 127.0.0.1:<backend-port>:127.0.0.1:<backend-port> \
  -L 127.0.0.1:<keycloak-port>:127.0.0.1:<keycloak-port> \
  <mac-ssh-user>@<mac-tailscale-address>
```

Repeat those three `-L` entries for each stack, using its own ports, then open
each frontend at `http://localhost:<frontend-port>` on the remote machine.
Vite uses each stack's published frontend port for HMR, so that same frontend
tunnel carries its WebSocket connection; no shared port 3000 tunnel is needed.

After starting two or more stacks, the live smoke test authenticates all 17 role
accounts against every stack in this worktree, verifies their backend role
assignments, and checks that each Keycloak cookie host remains separate:

```sh
LCFS_LOCAL_KEYCLOAK_INTEGRATION=1 python3 -m unittest \
  scripts.tests.test_local_keycloak_auth -v
```

The launcher keeps active stack port assignments under
`${XDG_STATE_HOME:-${TMPDIR:-/tmp}}/lcfs-local-keycloak` (or the directory set
by `LCFS_LOCAL_KEYCLOAK_STATE_DIR`). It writes one `<project-name>.env` file
there and passes it to Compose; it does not overwrite the repository's `.env`.
The launcher ignores exported `LCFS_*_PUBLISHED_PORT` variables so its selected
ports are the ones Compose uses. Running `start` again for an active name
reuses its ports. `stop` releases that port assignment but keeps the data
volumes; starting the name later assigns new ports and reuses its volumes.
Removing volumes is a separate, manual cleanup step.

To manage Compose directly, create an env file with unique values for
`LCFS_FRONTEND_PUBLISHED_PORT`, `LCFS_BACKEND_PUBLISHED_PORT`,
`LCFS_BACKEND_DEBUG_PUBLISHED_PORT`, `LCFS_DB_PUBLISHED_PORT`,
`LCFS_REDIS_PUBLISHED_PORT`, `LCFS_RUSTFS_PUBLISHED_PORT`,
`LCFS_RUSTFS_CONSOLE_PUBLISHED_PORT`, and `LCFS_KEYCLOAK_PUBLISHED_PORT`, then
combine `docker-compose.yml` and `docker-compose.local-keycloak.yml` with a
unique Compose project name and a unique
`LCFS_LOCAL_KEYCLOAK_HOSTNAME` ending in `.localhost` for each concurrently
running stack. The hostname keeps each Keycloak instance's browser cookies
separate.

## Local accounts

All role fixtures use the password `development_only`. The frontend's local
Keycloak login accepts these usernames:

| Identity | LCFS role | Username |
| --- | --- | --- |
| IDIR | Government | `idir-government` |
| IDIR | Administrator | `idir-administrator` |
| IDIR | System Admin | `idir-system-admin` |
| IDIR | Analyst | `idir-analyst` |
| IDIR | Compliance Manager | `idir-compliance-manager` |
| IDIR | Director | `idir-director` |
| IDIR | IA Analyst | `idir-ia-analyst` |
| IDIR | IA Manager | `idir-ia-manager` |
| BCeID | Supplier | `bceid-supplier` |
| BCeID | Manage Users | `bceid-manage-users` |
| BCeID | Transfer | `bceid-transfer` |
| BCeID | Compliance Reporting | `bceid-compliance-reporting` |
| BCeID | Signing Authority | `bceid-signing-authority` |
| BCeID | Read Only | `bceid-read-only` |
| BCeID | CI Applicant | `bceid-ci-applicant` |
| BCeID | IA Proponent | `bceid-ia-proponent` |
| BCeID | IA Signer | `bceid-ia-signer` |

Each account also receives its required base affiliation role (Government or
Supplier). The IA Signer fixture also has IA Proponent. The existing
`lcfstest` account remains available with its seeded Government,
Administrator, and Analyst roles.

The local override seeds matching profiles and LCFS role assignments in the
local override's dedicated database volume. Its PostgreSQL, Redis, and RustFS
volumes are separate from a normal Compose run, even if both use the same
project name. These identities and the Keycloak bootstrap admin defaults are for local
development only. Without the local override, the local Keycloak service,
login mode, and role fixtures are disabled; the app uses the normal development
Keycloak configuration and database volume.

The backend fetches Keycloak's discovery document and signing keys through the
Compose service name, while the browser uses the published localhost port.
The local configuration sets the expected browser issuer and an internal JWKS
endpoint so the backend never tries to reach a container's `localhost` URL.

## Stop and reset

The launcher preserves one stack's volumes when you stop it:

```sh
./scripts/local-keycloak-stack.sh stop agent-a
```

Keycloak realm imports run when its project data volume is first created. To
re-import the realm, clear that stack's cached signing keys, stop the stack,
and remove only its Keycloak volume. Keep the PostgreSQL and RustFS volumes if
their data should remain. The following commands reset the Keycloak realm for
the `agent-a` stack and then start it again with a newly assigned port set:

```sh
state_dir="${LCFS_LOCAL_KEYCLOAK_STATE_DIR:-${XDG_STATE_HOME:-${TMPDIR:-/tmp}}/lcfs-local-keycloak}"
repo_root="$(git rev-parse --show-toplevel)"
worktree_id="$(python3 - "${repo_root}" <<'PY'
import hashlib
import sys

print(hashlib.sha256(sys.argv[1].encode()).hexdigest()[:10])
PY
)"
project_name="lcfs-local-${worktree_id}-agent-a"

docker compose --env-file "$state_dir/$project_name.env" -p "$project_name" \
  -f docker-compose.yml -f docker-compose.local-keycloak.yml \
  exec redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -n 1 DEL jwks_data'

./scripts/local-keycloak-stack.sh stop agent-a

docker volume rm "${project_name}_keycloak_data"

./scripts/local-keycloak-stack.sh start agent-a
```
