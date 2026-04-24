#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Flashcard Study — first-run setup wizard
# Run from any directory: bash /path/to/setup.sh
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
REQUIREMENTS="$BACKEND_DIR/requirements.txt"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
ENV_FILE="$BACKEND_DIR/.env"

# ---- colour helpers --------------------------------------------------------
_has_tput=false
if command -v tput &>/dev/null && tput setaf 1 &>/dev/null 2>&1; then
  _has_tput=true
fi

green()  { $_has_tput && echo "$(tput setaf 2)$*$(tput sgr0)" || echo "$*"; }
yellow() { $_has_tput && echo "$(tput setaf 3)$*$(tput sgr0)" || echo "$*"; }
red()    { $_has_tput && echo "$(tput setaf 1)$*$(tput sgr0)" || echo "$*"; }
bold()   { $_has_tput && echo "$(tput bold)$*$(tput sgr0)"   || echo "$*"; }

# ---- Step 1: Python version ------------------------------------------------
bold "Step 1/5  Python version check"

PYTHON_BIN="$(command -v python3 2>/dev/null || true)"
if [ -z "$PYTHON_BIN" ]; then
  red "  ✗ python3 not found. Install Python 3.10+ and re-run."
  exit 1
fi

PY_VERSION="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PY_MAJOR="${PY_VERSION%%.*}"
PY_MINOR="${PY_VERSION#*.}"

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  red "  ✗ Python $PY_VERSION detected. Python 3.10+ is required."
  exit 1
fi

green "  ✓ Python $PY_VERSION"

# ---- Step 2: Virtual environment -------------------------------------------
echo ""
bold "Step 2/5  Virtual environment"

if [ -d "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/activate" ]; then
  green "  ✓ Existing .venv found — activating"
else
  if [ -d "$VENV_DIR" ]; then
    yellow "  ⚠ .venv is incomplete — recreating"
  else
    echo "  Creating .venv…"
  fi
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  green "  ✓ .venv created"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

# ---- Step 3: Dependencies --------------------------------------------------
echo ""
bold "Step 3/5  Dependencies"

INSTALL_DEPS=true
if [ -f "$VENV_DIR/bin/uvicorn" ]; then
  green "  ✓ Dependencies appear to be installed"
  printf "  Re-install dependencies? [y/N] "
  read -r REINSTALL
  REINSTALL="${REINSTALL:-N}"
  if [[ "$REINSTALL" =~ ^[Yy]$ ]]; then
    INSTALL_DEPS=true
  else
    INSTALL_DEPS=false
    green "  ✓ Skipping reinstall"
  fi
fi

if $INSTALL_DEPS; then
  echo "  Installing from requirements.txt…"
  pip install -r "$REQUIREMENTS"
  green "  ✓ Dependencies installed"
fi

# ---- Step 4: OpenAI API key ------------------------------------------------
echo ""
bold "Step 4/5  OpenAI API key"

printf "  Enter your OpenAI API key (input hidden): "
read -rs OPENAI_API_KEY
echo ""  # newline after hidden input

if [ -z "$OPENAI_API_KEY" ]; then
  red "  ✗ API key cannot be empty."
  exit 1
fi

if [[ "$OPENAI_API_KEY" != sk-* ]]; then
  red "  ✗ API key must start with 'sk-'. Got: ${OPENAI_API_KEY:0:6}…"
  exit 1
fi

green "  ✓ API key accepted"

# ---- Step 5: Create backend/.env -------------------------------------------
echo ""
bold "Step 5/5  Creating backend/.env"

if [ -f "$ENV_FILE" ]; then
  yellow "  ⚠ backend/.env already exists."
  printf "  Overwrite? [y/N] "
  read -r OVERWRITE
  OVERWRITE="${OVERWRITE:-N}"
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    yellow "  Skipped — existing .env left unchanged."
    echo ""
    bold "Setup complete!"
    echo "  Run the app:"
    echo "    make build       # build frontend (first time or after frontend changes)"
    echo "    make run-prod    # start server at http://localhost:8000"
    echo ""
    echo "  Or for development (hot reload):"
    echo "    make run"
    exit 0
  fi
fi

cp "$ENV_EXAMPLE" "$ENV_FILE"

# Escape any special characters in the key for sed (/, &, \)
ESCAPED_KEY="$(printf '%s\n' "$OPENAI_API_KEY" | sed 's/[\/&]/\\&/g')"
sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$ESCAPED_KEY/" "$ENV_FILE"

green "  ✓ backend/.env created"

# ---- Done ------------------------------------------------------------------
echo ""
green "Setup complete!"
echo ""
echo "  Run the app:"
echo "    make build       # build frontend (first time or after frontend changes)"
echo "    make run-prod    # start server at http://localhost:8000"
echo ""
echo "  Or for development (hot reload):"
echo "    make run"
