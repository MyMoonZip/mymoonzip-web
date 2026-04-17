#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0

echo "=== 02-quality-check ==="

has_script() {
  node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts['$1']?0:1)" 2>/dev/null
}

# --- lint ---
if has_script "lint"; then
  echo "  Running lint..."
  if npm run lint --silent 2>&1; then
    echo "  lint: OK"
  else
    echo "  lint: FAIL"
    FAIL=1
  fi
else
  echo "  lint: SKIP (no lint script in package.json)"
fi

# --- typecheck ---
if has_script "typecheck" || has_script "type-check"; then
  SCRIPT_NAME="typecheck"
  has_script "type-check" && SCRIPT_NAME="type-check"
  echo "  Running $SCRIPT_NAME..."
  if npm run "$SCRIPT_NAME" --silent 2>&1; then
    echo "  typecheck: OK"
  else
    echo "  typecheck: FAIL"
    FAIL=1
  fi
elif [ -f "node_modules/.bin/tsc" ]; then
  echo "  Running tsc --noEmit..."
  if node_modules/.bin/tsc --noEmit 2>&1; then
    echo "  tsc: OK"
  else
    echo "  tsc: FAIL"
    FAIL=1
  fi
else
  echo "  typecheck: SKIP (no tsc in node_modules)"
fi

if [ $FAIL -eq 0 ]; then
  echo "PASS"
  exit 0
else
  echo "FAIL"
  exit 1
fi
