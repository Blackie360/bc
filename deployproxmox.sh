#!/usr/bin/env bash

set -Eeuo pipefail

 

# Deploy BC inside a Debian/Ubuntu Proxmox LXC container.

# Run inside the container as root or with sudo:

#   sudo bash scripts/deploy-proxmox.sh

 

APP_NAME="${APP_NAME:-BC}"

PM2_NAME="${PM2_NAME:-BC}"

REPO_URL="${REPO_URL:-git@github.com:Angelasoila/bc.git}"

BRANCH="${BRANCH:-}"

APP_DIR="${APP_DIR:-${HOME}/craft/BC}"

INTERNAL_PORT="${INTERNAL_PORT:-3000}"

NGINX_PORT="${NGINX_PORT:-80}"

ENABLE_NGINX="${ENABLE_NGINX:-true}"

NODE_MAJOR="${NODE_MAJOR:-20}"

PACKAGE_MANAGER="${PACKAGE_MANAGER:-pnpm}"

PNPM_HOME="${PNPM_HOME:-${HOME}/.local/share/pnpm}"

PUBLIC_HOST="${PUBLIC_HOST:-10.169.81.153}"

export PNPM_HOME

export PATH="${PNPM_HOME}:${HOME}/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin:${PATH}"

 

log() {

  printf '\n[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"

}

 

die() {

  printf '\nERROR: %s\n' "$*" >&2

  exit 1

}

 

need_root() {

  if [[ "${EUID}" -ne 0 ]]; then

    die "Run this script as root, for example: sudo bash $0"

  fi

}

 

prepare_ssh_known_hosts() {

  if [[ "${REPO_URL}" != git@github.com:* && "${REPO_URL}" != ssh://git@github.com/* ]]; then

    return

  fi

 

  mkdir -p "${HOME}/.ssh"

  chmod 700 "${HOME}/.ssh"

 

  if ! ssh-keygen -F github.com >/dev/null 2>&1; then

    log "Adding github.com to SSH known_hosts"

    ssh-keyscan github.com >>"${HOME}/.ssh/known_hosts"

    chmod 600 "${HOME}/.ssh/known_hosts"

  fi

}

 

verify_runtime_tools() {

  log "Checking installed runtime tools"

 

  command -v curl >/dev/null 2>&1 || die "curl is not installed"

  command -v git >/dev/null 2>&1 || die "git is not installed"

  command -v node >/dev/null 2>&1 || die "node is not installed"

  command -v npm >/dev/null 2>&1 || die "npm is not installed"

  command -v pm2 >/dev/null 2>&1 || die "pm2 is not installed"

  if [[ "${ENABLE_NGINX}" == "true" ]]; then

    command -v nginx >/dev/null 2>&1 || die "nginx is not installed"

  fi

 

  if [[ "${REPO_URL}" == git@github.com:* || "${REPO_URL}" == ssh://git@github.com/* ]]; then

    command -v ssh-keygen >/dev/null 2>&1 || die "ssh-keygen is not installed"

    command -v ssh-keyscan >/dev/null 2>&1 || die "ssh-keyscan is not installed"

  fi

 

  local current_major

  current_major="$(node -p "process.versions.node.split('.')[0]")"

  if [[ "${current_major}" -lt "${NODE_MAJOR}" ]]; then

    die "Node.js ${NODE_MAJOR}+ is required, found $(node -v)"

  fi

 

  if [[ "${PACKAGE_MANAGER}" == "pnpm" ]]; then

    command -v pnpm >/dev/null 2>&1 || die "pnpm is not installed"

  fi

 

  log "Using Node.js $(node -v), PM2 $(pm2 -v), ${PACKAGE_MANAGER}"

}

 

prepare_app_dir() {

  local parent_dir

  parent_dir="$(dirname "${APP_DIR}")"

  mkdir -p "${parent_dir}"

 

  if [[ -d "${APP_DIR}/.git" ]]; then

    log "Updating existing repo at ${APP_DIR}"

    git -C "${APP_DIR}" remote set-url origin "${REPO_URL}"

    git -C "${APP_DIR}" remote set-head origin --auto >/dev/null 2>&1 || true

 

    local branch="${BRANCH}"

    if [[ -z "${branch}" ]]; then

      branch="$(git -C "${APP_DIR}" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"

    fi

    if [[ -z "${branch}" ]]; then

      branch="$(git -C "${APP_DIR}" branch --show-current)"

    fi

    [[ -n "${branch}" ]] || die "Could not determine deploy branch; set BRANCH explicitly"

 

    log "Deploying branch ${branch}"

    git -C "${APP_DIR}" fetch origin "${branch}"

    git -C "${APP_DIR}" checkout "${branch}"

    git -C "${APP_DIR}" pull --ff-only origin "${branch}"

  else

    log "Cloning ${REPO_URL} into ${APP_DIR}"

    if [[ -n "${BRANCH}" ]]; then

      git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"

    else

      git clone "${REPO_URL}" "${APP_DIR}"

    fi

  fi

}

 

install_dependencies() {

  cd "${APP_DIR}"

 

  log "Installing app dependencies"

  case "${PACKAGE_MANAGER}" in

    pnpm)

      [[ -f pnpm-lock.yaml ]] || die "PACKAGE_MANAGER=pnpm but pnpm-lock.yaml is missing"

      pnpm install --frozen-lockfile

      ;;

    npm)

      [[ -f package-lock.json ]] || die "PACKAGE_MANAGER=npm but package-lock.json is missing"

      npm ci

      ;;

    *)

      die "Unsupported PACKAGE_MANAGER=${PACKAGE_MANAGER}; use pnpm or npm"

      ;;

  esac

}

 

run_package_script() {

  local script_name="$1"

 

  if [[ "${PACKAGE_MANAGER}" == "pnpm" ]]; then

    pnpm run "${script_name}"

  else

    npm run "${script_name}"

  fi

}

 

package_script_exists() {

  local script_name="$1"

 

  node -e "const pkg=require('./package.json'); process.exit(pkg.scripts && pkg.scripts['${script_name}'] ? 0 : 1)"

}

 

load_production_env() {

  cd "${APP_DIR}"

 

  if [[ ! -f .env.production ]]; then

    die "Missing required production env file: ${APP_DIR}/.env.production"

  fi

 

  log "Loading production environment from .env.production"

  while IFS= read -r line || [[ -n "${line}" ]]; do

    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue

    [[ "${line}" == *"="* ]] || continue

 

    local key="${line%%=*}"

    local value="${line#*=}"

 

    key="${key#"${key%%[![:space:]]*}"}"

    key="${key%"${key##*[![:space:]]}"}"

    value="${value#"${value%%[![:space:]]*}"}"

 

    if [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then

      die "Invalid env key in .env.production: ${key}"

    fi

 

    if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then

      value="${value:1:${#value}-2}"

    fi

 

    export "${key}=${value}"

  done <.env.production

}

 

check_production_db() {

  cd "${APP_DIR}"

 

  if package_script_exists "check:production-db"; then

    log "Checking production database connection and schema"

    run_package_script "check:production-db"

  else

    log "No check:production-db script found; skipping production database check"

  fi

}

 

build_app() {

  cd "${APP_DIR}"

 

  log "Building Next.js app"

  run_package_script build

}

 

pm2_app_id() {

  PM2_NAME="${PM2_NAME}" APP_DIR="${APP_DIR}" node <<'NODE'

const { execFileSync } = require('node:child_process');

const fs = require('node:fs');

 

const pm2Name = process.env.PM2_NAME;

const appDir = fs.realpathSync(process.env.APP_DIR);

const list = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }));

const matches = list.filter((process) => process.name === pm2Name);

 

if (matches.length === 0) {

  process.exit(0);

}

 

if (matches.length > 1) {

  console.error(`Multiple PM2 processes named ${pm2Name}; refusing to choose one`);

  process.exit(2);

}

 

const processCwd = matches[0].pm2_env && matches[0].pm2_env.pm_cwd;

if (!processCwd || fs.realpathSync(processCwd) !== appDir) {

  console.error(`PM2 process ${pm2Name} does not belong to ${appDir}; refusing to reload it`);

  process.exit(2);

}

 

console.log(matches[0].pm_id);

NODE

}

 

cleanup_legacy_pm2_processes() {

  local legacy_processes

  legacy_processes="$(PM2_NAME="${PM2_NAME}" APP_NAME="${APP_NAME}" APP_DIR="${APP_DIR}" node <<'NODE'

const { execFileSync } = require('node:child_process');

const fs = require('node:fs');

 

const pm2Name = process.env.PM2_NAME;

const appName = process.env.APP_NAME;

const appDir = fs.realpathSync(process.env.APP_DIR);

const legacyNames = new Set([

  pm2Name.replaceAll('-', '_'),

  pm2Name.replaceAll('_', '-'),

  appName.replaceAll('-', '_'),

  appName.replaceAll('_', '-'),

]);

legacyNames.delete(pm2Name);

 

const list = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }));

for (const pm2Process of list) {

  const processCwd = pm2Process.pm2_env && pm2Process.pm2_env.pm_cwd;

  if (!processCwd || !legacyNames.has(pm2Process.name)) {

    continue;

  }

 

  let realProcessCwd;

  try {

    realProcessCwd = fs.realpathSync(processCwd);

  } catch {

    continue;

  }

 

  if (realProcessCwd === appDir) {

    console.log(`${pm2Process.pm_id}\t${pm2Process.name}`);

  }

}

NODE

)"

 

  if [[ -z "${legacy_processes}" ]]; then

    return

  fi

 

  while IFS=$'\t' read -r legacy_id legacy_name; do

    [[ -n "${legacy_id}" ]] || continue

    log "Deleting legacy PM2 process ${legacy_name} (${legacy_id}) from ${APP_DIR}"

    pm2 delete "${legacy_id}"

  done <<<"${legacy_processes}"

}

 

pm2_app_status() {

  local pm2_id="$1"

 

  PM2_ID="${pm2_id}" node <<'NODE'

const { execFileSync } = require('node:child_process');

 

const pm2Id = Number(globalThis.process.env.PM2_ID);

const list = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }));

const pm2Process = list.find((item) => item.pm_id === pm2Id);

if (!pm2Process) {

  process.exit(1);

}

 

console.log(pm2Process.pm2_env && pm2Process.pm2_env.status ? pm2Process.pm2_env.status : 'unknown');

NODE

}

 

verify_pm2_online() {

  local pm2_id="$1"

  local status

 

  sleep 2

  status="$(pm2_app_status "${pm2_id}" || true)"

  if [[ "${status}" == "online" ]]; then

    return

  fi

 

  pm2 describe "${pm2_id}" || true

  pm2 logs "${pm2_id}" --lines 80 --nostream || true

  die "PM2 process ${PM2_NAME} (${pm2_id}) is ${status:-missing}, not online"

}

 

restart_pm2() {

  cd "${APP_DIR}"

 

  cleanup_legacy_pm2_processes

 

  local pm2_id

  pm2_id="$(pm2_app_id)"

 

  log "Starting PM2 process ${PM2_NAME} on port ${INTERNAL_PORT}"

  if [[ -n "${pm2_id}" ]]; then

    log "Deleting existing PM2 process ${PM2_NAME} (${pm2_id}) to clear stale environment"

    pm2 delete "${pm2_id}"

  fi

 

  NODE_ENV=production PORT="${INTERNAL_PORT}" pm2 start "${PACKAGE_MANAGER}" --name "${PM2_NAME}" -- start

  pm2_id="$(pm2_app_id)"

 

  [[ -n "${pm2_id}" ]] || die "PM2 process ${PM2_NAME} was not created"

  verify_pm2_online "${pm2_id}"

 

  pm2 save

  env PATH="${PATH}" pm2 startup systemd -u root --hp "${HOME}" >/tmp/pm2-startup.log || true

}

 

configure_nginx() {

  local site_available="/etc/nginx/sites-available/${APP_NAME}"

  local site_enabled="/etc/nginx/sites-enabled/${APP_NAME}"

 

  if [[ "${ENABLE_NGINX}" != "true" ]]; then

    log "Nginx disabled; removing ${APP_NAME} site if present"

    rm -f "${site_enabled}"

    if command -v nginx >/dev/null 2>&1; then

      nginx -t

      systemctl reload nginx || true

    fi

    return

  fi

 

  if [[ "${NGINX_PORT}" == "${INTERNAL_PORT}" ]]; then

    die "NGINX_PORT and INTERNAL_PORT cannot both be ${INTERNAL_PORT}; set ENABLE_NGINX=false for a single-port deploy"

  fi

 

  log "Writing Nginx config for port ${NGINX_PORT} -> 127.0.0.1:${INTERNAL_PORT}"

  cat >"${site_available}" <<NGINX

server {

    listen ${NGINX_PORT};

    server_name _;

 

    location / {

        proxy_pass http://127.0.0.1:${INTERNAL_PORT};

        proxy_http_version 1.1;

 

        proxy_set_header Host \$host;

        proxy_set_header X-Real-IP \$remote_addr;

        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        proxy_set_header X-Forwarded-Proto \$scheme;

 

        proxy_set_header Upgrade \$http_upgrade;

        proxy_set_header Connection "upgrade";

    }

}

NGINX

 

  ln -sfn "${site_available}" "${site_enabled}"

  rm -f /etc/nginx/sites-enabled/default

 

  nginx -t

  systemctl enable nginx

  systemctl reload nginx

}

 

health_check() {
  log "Checking local app endpoint"

  curl -fsS "http://127.0.0.1:${INTERNAL_PORT}" >/dev/null || die "App did not respond on internal port ${INTERNAL_PORT}"

  if [[ "${ENABLE_NGINX}" == "true" ]]; then
    log "Checking Nginx endpoint"
    curl -fsS "http://127.0.0.1:${NGINX_PORT}" >/dev/null || die "Nginx did not respond on port ${NGINX_PORT}"
  fi
}

 

main() {

  need_root

  verify_runtime_tools

  prepare_ssh_known_hosts

  prepare_app_dir

  install_dependencies

  load_production_env

  check_production_db

  build_app

  restart_pm2

  configure_nginx

  health_check

}

 

main "$@"