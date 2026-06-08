#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1/3  npm ci"
npm ci

echo "==> 2/3  Smoke test"
npm test

echo "==> 3/4  E2E tests"
npx playwright install chromium --with-deps
npm run test:e2e

echo "==> 4/4  MCP integration tests"
npm run test:skill-mcp

echo "==> All CI checks passed"
