#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0

echo "=== 01-structure-check ==="

check_dir() {
  if [ -d "$1" ]; then
    echo "  OK   dir  $1"
  else
    echo "  MISS dir  $1"
    FAIL=1
  fi
}

check_file() {
  if [ -f "$1" ]; then
    echo "  OK   file $1"
  else
    echo "  MISS file $1"
    FAIL=1
  fi
}

# 허용 경로 디렉터리 존재 확인
check_dir "src"
check_dir "docs"
check_dir "scripts"
check_dir "tests"

# 하네스 필수 문서 확인
check_file "docs/harness-spec.md"
check_file "docs/harness-run-log.md"
check_file "docs/harness-failures.md"

if [ $FAIL -eq 0 ]; then
  echo "PASS"
  exit 0
else
  echo "FAIL"
  exit 1
fi
