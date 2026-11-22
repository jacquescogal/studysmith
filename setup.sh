#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Flashcard Study - guided local setup wizard
#
# Checks prerequisites, configures the repo-root .env, starts local Supabase,
# installs backend + frontend dependencies, then runs both app servers.
# Safe to re-run: every step skips work that is already done.
#
# Usage: ./setup.sh [--yes] [--no-run]
#   --yes, -y   Accept defaults without prompting (still asks for missing secrets)
#   --no-run    Set everything up but do not start the app servers
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.local.example"
SUPABASE_CLI_VERSION="$(awk -F" *:= *" '/^SUPABASE_CLI_VERSION/ {print $2; exit}' "$ROOT_DIR/Makefile")"
SUPABASE=(npx --yes "supabase@${SUPABASE_CLI_VERSION:?SUPABASE_CLI_VERSION missing from Makefile}")
TOTAL_STEPS=6

ASSUME_YES=false
RUN_APP=true
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=true ;;
    --no-run) RUN_APP=false ;;
    -h|--help) sed -n '5,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

# ---- output helpers --------------------------------------------------------
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && tput setaf 1 >/dev/null 2>&1; then
  C_GREEN="$(tput setaf 2)"; C_YELLOW="$(tput setaf 3)"; C_RED="$(tput setaf 1)"
  C_BOLD="$(tput bold)"; C_RESET="$(tput sgr0)"
else
  C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_RESET=""
fi
ok()   { echo "  ${C_GREEN}✓${C_RESET} $*"; }
warn() { echo "  ${C_YELLOW}!${C_RESET} $*"; }
fail() { echo "  ${C_RED}✗${C_RESET} $*"; exit 1; }
info() { echo "    $*"; }
STEP=0
step() { STEP=$((STEP + 1)); echo ""; echo "${C_BOLD}[$STEP/$TOTAL_STEPS] $*${C_RESET}"; }

# confirm "question" default(Y|N) -> returns 0 for yes
confirm() {
  local prompt="$1" default="${2:-Y}" reply hint="[Y/n]"
  [ "$default" = "N" ] && hint="[y/N]"
  if $ASSUME_YES; then [ "$default" = "Y" ]; return; fi
  printf "  %s %s " "$prompt" "$hint"
  read -r reply || reply=""
  reply="${reply:-$default}"
  [[ "$reply" =~ ^[Yy] ]]
}

# ---- .env helpers ----------------------------------------------------------
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  awk -v k="$1" 'index($0, k "=") == 1 { print substr($0, length(k) + 2); exit }' "$ENV_FILE"
}

# Replace KEY=... in place (or append it). Avoids sed so values need no escaping.
env_set() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  KEY="$key" VALUE="$value" awk '
    BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"]; done = 0 }
    index($0, k "=") == 1 { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"   # keep the original file's permissions
  rm -f "$tmp"
}

is_placeholder() { [ -z "$1" ] || [[ "$1" == *from_make_supabase_status* ]]; }
is_local_url() { [[ "$1" == *127.0.0.1* || "$1" == *localhost* ]]; }

echo "${C_BOLD}Flashcard Study - local setup${C_RESET}"

# ---- Step 1: prerequisites -------------------------------------------------
step "Checking prerequisites"

if ! command -v uv >/dev/null 2>&1; then
  fail "uv not found. Install it (brew install uv, or see https://docs.astral.sh/uv/) and re-run."
fi
ok "uv $(uv --version | awk '{print $2}') (manages Python for the backend)"

command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 18+ and re-run."
command -v npm  >/dev/null 2>&1 || fail "npm not found. Install Node.js 18+ and re-run."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node $(node -v) found; 18+ is required."
ok "Node $(node -v)"

command -v docker >/dev/null 2>&1 || fail "docker not found. Install Docker Desktop and re-run."
ok "Docker CLI installed"

# ---- Step 2: .env ----------------------------------------------------------
step "Configuring .env"

if [ -f "$ENV_FILE" ]; then
  ok "Using existing .env"
else
  [ -f "$ENV_EXAMPLE" ] || fail "Missing $ENV_EXAMPLE"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Created .env from .env.local.example"
fi

OPENAI_KEY="$(env_get OPENAI_API_KEY)"
if [ -z "$OPENAI_KEY" ]; then
  while true; do
    printf "  OpenAI API key (input hidden): "
    read -rs OPENAI_KEY; echo ""
    [[ "$OPENAI_KEY" == sk-* ]] && break
    warn "Key should start with 'sk-'. Try again."
  done
  env_set OPENAI_API_KEY "$OPENAI_KEY"
  ok "Saved OPENAI_API_KEY"
else
  ok "OPENAI_API_KEY already set"
fi

ADMIN="$(env_get ADMIN_EMAILS)"
if [ -z "$ADMIN" ] && ! $ASSUME_YES; then
  GIT_EMAIL="$(git -C "$ROOT_DIR" config user.email 2>/dev/null || true)"
  if [ -n "$GIT_EMAIL" ]; then
    printf "  Admin email(s), comma-separated [%s]: " "$GIT_EMAIL"
  else
    printf "  Admin email(s), comma-separated (blank to skip): "
  fi
  read -r ADMIN || ADMIN=""
  ADMIN="${ADMIN:-$GIT_EMAIL}"
  if [ -n "$ADMIN" ]; then env_set ADMIN_EMAILS "$ADMIN"; ok "Saved ADMIN_EMAILS"; fi
elif [ -n "$ADMIN" ]; then
  ok "ADMIN_EMAILS already set"
fi

# ---- Step 3: Docker + local Supabase ---------------------------------------
step "Starting local Supabase"

SUPABASE_URL_VALUE="$(env_get SUPABASE_URL)"
if [ -n "$SUPABASE_URL_VALUE" ] && ! is_local_url "$SUPABASE_URL_VALUE"; then
  warn "SUPABASE_URL points at $SUPABASE_URL_VALUE, so I'm skipping local Supabase."
else
  if ! docker info >/dev/null 2>&1; then
    if [ "$(uname)" = "Darwin" ] && confirm "Docker isn't running. Launch Docker Desktop?" Y; then
      open -a Docker
      printf "    Waiting for Docker"
      for _ in $(seq 1 90); do
        docker info >/dev/null 2>&1 && break
        printf "."; sleep 2
      done
      echo ""
    fi
    docker info >/dev/null 2>&1 || fail "Docker isn't running. Start Docker Desktop and re-run."
  fi
  ok "Docker is running"

  cd "$ROOT_DIR"
  if "${SUPABASE[@]}" status >/dev/null 2>&1; then
    ok "Supabase is already running"
  else
    info "Running supabase start (the first run pulls images and can take a few minutes)..."
    "${SUPABASE[@]}" start
    ok "Supabase started"
  fi

  # Sync the local keys into .env. They are generated by the local stack.
  STATUS_ENV="$("${SUPABASE[@]}" status -o env 2>/dev/null || true)"
  status_get() {
    local k
    for k in "$@"; do
      printf '%s\n' "$STATUS_ENV" | awk -v k="$k" 'index($0, k "=") == 1 { v = substr($0, length(k) + 2); gsub(/^"|"$/, "", v); print v; exit }'
    done | head -n 1
  }
  SECRET_KEY="$(status_get SECRET_KEY SERVICE_ROLE_KEY)"
  PUBLISHABLE_KEY="$(status_get PUBLISHABLE_KEY ANON_KEY)"

  sync_key() {
    local env_key="$1" value="$2" current
    current="$(env_get "$env_key")"
    if [ -z "$value" ]; then
      if is_placeholder "$current"; then
        warn "Couldn't read $env_key from 'supabase status'."
        printf "  Paste %s (see 'make supabase-status'): " "$env_key"
        read -r value || value=""
        [ -n "$value" ] || fail "$env_key is required."
        env_set "$env_key" "$value"; ok "Saved $env_key"
      else
        ok "$env_key already set"
      fi
    elif [ "$current" = "$value" ]; then
      ok "$env_key is up to date"
    else
      env_set "$env_key" "$value"; ok "Updated $env_key from local Supabase"
    fi
  }
  sync_key SUPABASE_SECRET_KEY "$SECRET_KEY"
  sync_key VITE_SUPABASE_PUBLISHABLE_KEY "$PUBLISHABLE_KEY"
  info "Supabase Studio: http://127.0.0.1:54323"
fi

# ---- Step 4: backend -------------------------------------------------------
step "Backend dependencies"

# uv sync creates backend/.venv (downloading Python if needed) and installs
# exactly what uv.lock pins. It is a fast no-op when already in sync.
info "Syncing backend/.venv with uv.lock..."
(cd "$BACKEND_DIR" && uv sync --frozen --quiet)
ok "Python packages match uv.lock"

# ---- Step 5: frontend ------------------------------------------------------
step "Frontend dependencies"

if [ -f "$FRONTEND_DIR/node_modules/.package-lock.json" ] && \
   [ ! "$FRONTEND_DIR/package-lock.json" -nt "$FRONTEND_DIR/node_modules/.package-lock.json" ]; then
  ok "npm packages are up to date"
else
  info "Running npm install..."
  (cd "$FRONTEND_DIR" && npm install --no-fund --no-audit --loglevel=error)
  ok "npm packages installed"
fi

# ---- Step 6: run -----------------------------------------------------------
step "Run the app"

port_busy() { lsof -tiTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
if port_busy 8000 || port_busy 5173; then
  warn "Port 8000 or 5173 is already in use (an app may already be running)."
  if confirm "Stop those processes first (make stop)?" Y; then make -C "$ROOT_DIR" stop; fi
fi

if ! $RUN_APP || ! confirm "Start the backend and frontend now?" Y; then
  echo ""
  ok "Setup complete. Start the app anytime with: make run"
  exit 0
fi

echo ""
ok "Backend:  http://localhost:8000"
ok "Frontend: http://localhost:5173  (press Ctrl+C to stop both)"
if [ "$(uname)" = "Darwin" ]; then
  ( for _ in $(seq 1 60); do port_busy 5173 && { open http://localhost:5173; break; }; sleep 1; done ) &
fi
exec make -C "$ROOT_DIR" run
