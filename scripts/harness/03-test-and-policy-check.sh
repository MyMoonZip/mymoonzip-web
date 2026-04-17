#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0
ALLOWED="src docs scripts tests"
# 루트 레벨 허용 파일 (CLAUDE.md 등 명시적 허용 대상)
ALLOWED_ROOT_FILES="CLAUDE.md"

echo "=== 03-test-and-policy-check ==="

has_script() {
  node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts['$1']?0:1)" 2>/dev/null
}

# --- test ---
if has_script "test"; then
  echo "  Running npm test..."
  if npm test --silent 2>&1; then
    echo "  test: OK"
  else
    echo "  test: FAIL"
    FAIL=1
  fi
elif [ -f "node_modules/.bin/jest" ]; then
  echo "  Running jest --passWithNoTests..."
  if node_modules/.bin/jest --passWithNoTests 2>&1; then
    echo "  jest: OK"
  else
    echo "  jest: FAIL"
    FAIL=1
  fi
else
  echo "  test: SKIP (no test runner found)"
fi

# --- policy: 허용 경로 외 변경 감지 (git 기반) ---
echo "  Checking policy violations..."
if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
  VIOLATION_FOUND=0
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    TOP="$(echo "$file" | cut -d'/' -f1)"
    # 허용 디렉터리 확인
    MATCH=0
    for a in $ALLOWED; do
      [ "$TOP" = "$a" ] && MATCH=1 && break
    done
    # 루트 레벨 허용 파일 확인
    if [ $MATCH -eq 0 ]; then
      for rf in $ALLOWED_ROOT_FILES; do
        [ "$file" = "$rf" ] && MATCH=1 && break
      done
    fi
    if [ $MATCH -eq 0 ]; then
      echo "  VIOLATION: $file"
      VIOLATION_FOUND=1
    fi
  done < <(git diff --name-only HEAD 2>/dev/null || true)

  if [ $VIOLATION_FOUND -eq 0 ]; then
    echo "  policy: OK (no violations)"
  else
    echo "  policy: FAIL"
    FAIL=1
  fi
else
  echo "  policy: SKIP (git not available)"
fi

if [ $FAIL -eq 0 ]; then
  echo "PASS"
  exit 0
else
  echo "FAIL"
  exit 1
fi
