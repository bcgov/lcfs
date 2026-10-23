#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_path="${script_dir}/$(basename "${BASH_SOURCE[0]}")"
repo_root="$(cd "${script_dir}/.." && pwd)"
state_dir="${LCFS_LOCAL_KEYCLOAK_STATE_DIR:-${XDG_STATE_HOME:-${TMPDIR:-/tmp}}/lcfs-local-keycloak}"
mkdir -p "${state_dir}"
state_dir="$(cd "${state_dir}" && pwd)"
worktree_id="$(python3 - "${repo_root}" <<'PY'
import hashlib
import sys

print(hashlib.sha256(sys.argv[1].encode()).hexdigest()[:10])
PY
)"
project_prefix="lcfs-local-${worktree_id}"

usage() {
  cat <<'EOF'
Usage:
  scripts/local-keycloak-stack.sh start [name]
  scripts/local-keycloak-stack.sh stop <name>
  scripts/local-keycloak-stack.sh status <name>
  scripts/local-keycloak-stack.sh list

With no name, start creates a unique stack name. Stop keeps the stack's data
volumes so the same named stack can be started again later.
EOF
}

normalise_project_name() {
  local requested_name="$1"
  local name_suffix

  if [[ "${requested_name}" == "${project_prefix}-"* ]]; then
    name_suffix="${requested_name#"${project_prefix}-"}"
  else
    name_suffix="${requested_name#lcfs-local-}"
  fi
  if [[ ! "${name_suffix}" =~ ^[[:alnum:]][[:alnum:]_-]*$ ]]; then
    printf 'Invalid stack name: %s\nUse letters, numbers, hyphens, and underscores.\n' \
      "${requested_name}" >&2
    return 2
  fi

  name_suffix="$(printf '%s' "${name_suffix}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${#name_suffix}" -gt 40 ]]; then
    local name_hash
    name_hash="$(python3 - "${name_suffix}" <<'PY'
import hashlib
import sys

print(hashlib.sha256(sys.argv[1].encode()).hexdigest()[:8])
PY
)"
    name_suffix="${name_suffix:0:31}-${name_hash}"
  fi

  printf '%s-%s' "${project_prefix}" "${name_suffix}"
}

compose() {
  (
    # The shell otherwise overrides values from --env-file during Compose
    # interpolation. The launcher owns port selection; direct Compose users
    # can still choose ports by exporting these variables themselves.
    unset \
      LCFS_FRONTEND_PUBLISHED_PORT \
      LCFS_BACKEND_PUBLISHED_PORT \
      LCFS_BACKEND_DEBUG_PUBLISHED_PORT \
      LCFS_DB_PUBLISHED_PORT \
      LCFS_REDIS_PUBLISHED_PORT \
      LCFS_RUSTFS_PUBLISHED_PORT \
      LCFS_RUSTFS_CONSOLE_PUBLISHED_PORT \
      LCFS_KEYCLOAK_PUBLISHED_PORT \
      LCFS_LOCAL_KEYCLOAK_HOSTNAME

    docker compose \
      --env-file "${env_file}" \
      --project-name "${project_name}" \
      --file "${repo_root}/docker-compose.yml" \
      --file "${repo_root}/docker-compose.local-keycloak.yml" \
      "$@"
  )
}

run_with_project_lock() {
  local locked_project="$1"
  local project_lock_path="${state_dir}/${locked_project}.compose.lock"
  shift

  python3 - "${project_lock_path}" "${script_path}" "$@" <<'PY'
import fcntl
import subprocess
import sys
from pathlib import Path

lock_path = Path(sys.argv[1])
script_path = sys.argv[2]
command = ["bash", script_path, *sys.argv[3:]]
with lock_path.open("a") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
    result = subprocess.run(command)
raise SystemExit(result.returncode)
PY
}

start_stack() {
  local requested_name="${1:-}"
  local start_timeout="${LCFS_LOCAL_KEYCLOAK_START_TIMEOUT:-240}"

  if [[ -n "${requested_name}" ]]; then
    project_name="$(normalise_project_name "${requested_name}")"
  else
    project_name="$(normalise_project_name "$(date -u '+%Y%m%d%H%M%S')-$$")"
  fi
  env_file="${state_dir}/${project_name}.env"

  python3 - "${state_dir}" "${env_file}" "${project_name}" "${worktree_id}" <<'PY'
import fcntl
import hashlib
import os
import socket
import sys
import tempfile
from pathlib import Path

state_dir = Path(sys.argv[1])
env_file = Path(sys.argv[2])
project_name = sys.argv[3]
worktree_id = sys.argv[4]
port_names = [
    "LCFS_FRONTEND_PUBLISHED_PORT",
    "LCFS_BACKEND_PUBLISHED_PORT",
    "LCFS_BACKEND_DEBUG_PUBLISHED_PORT",
    "LCFS_DB_PUBLISHED_PORT",
    "LCFS_REDIS_PUBLISHED_PORT",
    "LCFS_RUSTFS_PUBLISHED_PORT",
    "LCFS_RUSTFS_CONSOLE_PUBLISHED_PORT",
    "LCFS_KEYCLOAK_PUBLISHED_PORT",
]

keycloak_host_hash = hashlib.sha256(project_name.encode()).hexdigest()[:8]
keycloak_hostname = f"lcfs-keycloak-{worktree_id}-{keycloak_host_hash}.localhost"


def write_config(config):
    temporary_path = None
    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".lcfs-local-keycloak-", dir=state_dir
        )
        temporary_path = Path(temporary_name)
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            for name in port_names:
                stream.write(f"{name}={config[name]}\n")
            stream.write(f"LCFS_LOCAL_KEYCLOAK_HOSTNAME={keycloak_hostname}\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, env_file)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


lock_path = state_dir / ".ports.lock"
with lock_path.open("a") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

    if env_file.exists():
        config = {}
        for line in env_file.read_text().splitlines():
            key, separator, value = line.partition("=")
            if separator:
                config[key] = value
        try:
            existing_ports = {name: int(config[name]) for name in port_names}
        except (KeyError, ValueError) as error:
            raise SystemExit(
                f"Incomplete stack configuration at {env_file}; remove it and restart the stack."
            ) from error
        if len(set(existing_ports.values())) != len(port_names):
            raise SystemExit(f"Duplicate ports in stack configuration at {env_file}")
        existing_ports["LCFS_LOCAL_KEYCLOAK_HOSTNAME"] = keycloak_hostname
        if config.get("LCFS_LOCAL_KEYCLOAK_HOSTNAME") != keycloak_hostname:
            write_config(existing_ports)
        sys.exit(0)

    reserved = set()
    for existing_env in state_dir.glob("lcfs-local-*.env"):
        for line in existing_env.read_text().splitlines():
            key, separator, value = line.partition("=")
            if separator and key in port_names:
                try:
                    reserved.add(int(value))
                except ValueError:
                    continue

    sockets = []
    ports = {}
    try:
        for name in port_names:
            for _ in range(20):
                reservation = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                try:
                    reservation.bind(("0.0.0.0", 0))
                except OSError:
                    reservation.close()
                    continue
                port = reservation.getsockname()[1]
                if port in reserved:
                    reservation.close()
                    continue
                sockets.append(reservation)
                reserved.add(port)
                ports[name] = port
                break
            else:
                raise RuntimeError(f"Could not find an available port for {name}")

        ports["LCFS_LOCAL_KEYCLOAK_HOSTNAME"] = keycloak_hostname
        write_config(ports)
    finally:
        for reservation in sockets:
            reservation.close()
PY

  case "${start_timeout}" in
    ''|*[!0-9]*)
      printf 'LCFS_LOCAL_KEYCLOAK_START_TIMEOUT must be a number of seconds.\n' >&2
      return 2
      ;;
  esac

  printf 'Starting %s; waiting for Keycloak, backend, and frontend readiness...\n' \
    "${project_name}"
  compose up --detach --wait --wait-timeout "${start_timeout}"

  local frontend_port
  frontend_port="$(awk -F= '$1 == "LCFS_FRONTEND_PUBLISHED_PORT" { print $2 }' "${env_file}")"
  printf '\nStack ready: %s\nFrontend: http://localhost:%s\n' \
    "${project_name}" "${frontend_port}"
  printf 'List stacks: %s list\nStop stack: %s stop %s\n' \
    "${BASH_SOURCE[0]}" "${BASH_SOURCE[0]}" "${project_name}"
}

stop_stack() {
  local requested_name="$1"
  project_name="$(normalise_project_name "${requested_name}")"
  env_file="${state_dir}/${project_name}.env"
  if [[ ! -f "${env_file}" ]]; then
    printf 'No saved configuration for %s in %s\n' "${project_name}" "${state_dir}" >&2
    return 1
  fi

  compose down
  python3 - "${env_file}" <<'PY'
import fcntl
from pathlib import Path
import sys

env_file = Path(sys.argv[1])
lock_path = env_file.parent / ".ports.lock"
with lock_path.open("a") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
    env_file.unlink(missing_ok=True)
PY
  printf 'Stopped %s; data volumes were kept.\n' "${project_name}"
}

show_status() {
  local requested_name="$1"
  project_name="$(normalise_project_name "${requested_name}")"
  env_file="${state_dir}/${project_name}.env"
  if [[ ! -f "${env_file}" ]]; then
    printf 'No saved configuration for %s in %s\n' "${project_name}" "${state_dir}" >&2
    return 1
  fi
  compose ps
}

show_list_status() {
  local requested_name="$1"
  project_name="$(normalise_project_name "${requested_name}")"
  env_file="${state_dir}/${project_name}.env"
  [[ -f "${env_file}" ]] || return 0
  compose ps
}

list_stacks() {
  local stack_records
  local frontend_port
  local count=0

  stack_records="$(python3 - "${state_dir}" "${project_prefix}" <<'PY'
import fcntl
from pathlib import Path
import sys

state_dir = Path(sys.argv[1])
project_prefix = sys.argv[2]
lock_path = state_dir / ".ports.lock"
with lock_path.open("a") as lock_file:
    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
    for env_file in sorted(state_dir.glob(f"{project_prefix}-*.env")):
        try:
            config = dict(
                line.split("=", 1) for line in env_file.read_text().splitlines()
            )
        except FileNotFoundError:
            continue
        frontend_port = config.get("LCFS_FRONTEND_PUBLISHED_PORT")
        if frontend_port:
            print(f"{env_file.stem}\t{frontend_port}")
PY
)"

  while IFS=$'\t' read -r project_name frontend_port; do
    [[ -n "${project_name}" ]] || continue
    printf '\n%s — http://localhost:%s\n' "${project_name}" "${frontend_port}"
    run_with_project_lock "${project_name}" __list_status_locked "${project_name}"
    count=$((count + 1))
  done <<<"${stack_records}"

  if [[ "${count}" -eq 0 ]]; then
    printf 'No local Keycloak stacks found in %s\n' "${state_dir}"
  fi
}

action="${1:-start}"
case "${action}" in
  start|up)
    if [[ "$#" -gt 2 ]]; then usage >&2; exit 2; fi
    requested_name="${2:-}"
    if [[ -z "${requested_name}" ]]; then
      requested_name="$(date -u '+%Y%m%d%H%M%S')-$$"
    fi
    project_name="$(normalise_project_name "${requested_name}")"
    run_with_project_lock "${project_name}" __start_locked "${project_name}"
    ;;
  stop|down)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    project_name="$(normalise_project_name "$2")"
    run_with_project_lock "${project_name}" __stop_locked "${project_name}"
    ;;
  status)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    project_name="$(normalise_project_name "$2")"
    run_with_project_lock "${project_name}" __status_locked "${project_name}"
    ;;
  __start_locked)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    start_stack "$2"
    ;;
  __stop_locked)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    stop_stack "$2"
    ;;
  __status_locked)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    show_status "$2"
    ;;
  __list_status_locked)
    if [[ "$#" -ne 2 ]]; then usage >&2; exit 2; fi
    show_list_status "$2"
    ;;
  list)
    if [[ "$#" -ne 1 ]]; then usage >&2; exit 2; fi
    list_stacks
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
