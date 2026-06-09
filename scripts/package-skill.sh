#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/skills/3d_viewer"
OUTPUT="${1:-$SRC_DIR/3d_viewer_skill.zip}"

EXCLUDES=(
  'env/*'
  'tests/*'
  'test.mjs'
  'playwright.config.ts'
  'scripts/smoke-test.mjs'
  'wasm/*'
)

echo "Packaging to $OUTPUT ..."
rm -f "$OUTPUT"

EXCLUDE_ARGS=()
for p in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=("-x" "$p")
done

(cd "$SRC_DIR" && zip -r "$OUTPUT" . "${EXCLUDE_ARGS[@]}")

echo "Done: $OUTPUT"
