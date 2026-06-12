#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT/skills/3d_viewer"
OUTPUT_DIR="${1:-$ROOT}"

EXCLUDES=(
  'env/*'
  'tests/*'
  'test.mjs'
  'playwright.config.ts'
  'tests/smoke-test.mjs'
  'wasm/*'
  'favicon.ico'
  'models/*'
)

EXCLUDE_ARGS=()
for p in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=("-x" "$p")
done

# --- English package ---
EN_OUTPUT="$OUTPUT_DIR/3d_viewer_skill_en.zip"
echo "Packaging EN to $EN_OUTPUT ..."
rm -f "$EN_OUTPUT"
(cd "$SRC_DIR" && zip -r "$EN_OUTPUT" . -x 'SKILL_cn.md' "${EXCLUDE_ARGS[@]}")
echo "Done: $EN_OUTPUT"

# --- Chinese package ---
CN_OUTPUT="$OUTPUT_DIR/3d_viewer_skill_cn.zip"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Packaging CN to $CN_OUTPUT ..."
rm -f "$CN_OUTPUT"

(cd "$SRC_DIR" && find . -type f | while IFS= read -r rel; do
  rel="${rel#./}"
  for p in "${EXCLUDES[@]}"; do
    case "$rel" in
      $p) continue 2 ;;
    esac
  done
  case "$rel" in
    SKILL.md | SKILL_cn.md) continue ;;
  esac
  d="$(dirname "$rel")"
  mkdir -p "$TMPDIR/$d"
  cp "$SRC_DIR/$rel" "$TMPDIR/$rel"
done)

cp "$SRC_DIR/SKILL.md" "$TMPDIR/SKILL_en.md"
cp "$SRC_DIR/SKILL_cn.md" "$TMPDIR/SKILL.md"

(cd "$TMPDIR" && zip -r "$CN_OUTPUT" .)
echo "Done: $CN_OUTPUT"
