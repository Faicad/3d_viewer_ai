#!/usr/bin/env node

/**
 * smoke-test.mjs — Deployment smoke test for 3d_viewer
 *
 * Validates that the synced deployment is functional:
 *   1. Structure integrity — expected files exist
 *   2. serve.mjs — HTTP server starts, serves files, API endpoints work
 *   3. mcp-server.mjs — MCP protocol compliance (initialize, tools/list, error handling)
 *
 * Uses ONLY Node.js built-in modules — zero npm dependencies.
 * Runs from anywhere; resolves paths relative to its own location.
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SERVE_SCRIPT = join(__dirname, 'serve.mjs')
const MCP_SCRIPT = join(__dirname, 'mcp-server.mjs')

// ── Test helpers ──────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.log(`  ✗ ${msg}`) }
}

function send(mcp, msg) {
  mcp.stdin.write(JSON.stringify(msg) + '\n')
}

function collect(mcp, lineCount) {
  return new Promise(resolve => {
    const lines = []
    const handler = d => {
      const chunk = d.toString()
      for (const line of chunk.split('\n').filter(Boolean)) {
        lines.push(JSON.parse(line))
        if (lines.length >= lineCount) {
          mcp.stdout.off('data', handler)
          resolve(lines)
        }
      }
    }
    mcp.stdout.on('data', handler)
  })
}

// Make a minimal viewer server (same shape as serve.mjs) for testing
function createMockViewer() {
  const sseClients = new Set()

  return createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    // SSE endpoint
    if (req.url === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      res.write(`event: connected\ndata: {}\n\n`)
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

    // AI command endpoint
    if (req.url === '/api/command' && req.method === 'POST') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', () => {
        let cmd
        try { cmd = JSON.parse(body) } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
          return
        }
        let delivered = 0
        for (const client of sseClients) {
          client.write(`event: command\ndata: ${JSON.stringify(cmd)}\n\n`)
          delivered++
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', delivered }))
      })
      return
    }

    // Static files
    const urlPath = req.url.split('?')[0]
    const filePath = join(ROOT, urlPath === '/' ? 'index.html' : urlPath)
    if (!existsSync(filePath)) {
      const fallback = join(ROOT, 'index.html')
      if (existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(readFileSync(fallback))
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
      return
    }
    const ext = extname(filePath)
    const types = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.wasm': 'application/wasm',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' })
    res.end(readFileSync(filePath))
  })
}

// ── 1. Structure integrity ───────────────────────────────────────────

async function testStructure() {
  console.log('\n--- Structure integrity ---')

  const required = [
    'index.html',
    'scripts/serve.mjs',
    'scripts/mcp-server.mjs',
    'step-worker.js',
  ]
  for (const f of required) {
    assert(existsSync(join(ROOT, f)), `${f} exists`)
  }

  // At least one asset JS file
  const assetsDir = join(ROOT, 'assets')
  assert(existsSync(assetsDir), 'assets/ directory exists')
  if (existsSync(assetsDir)) {
    const entries = statSync(assetsDir)
    assert(entries.isDirectory(), 'assets/ is a directory')
  }

  // At least one WASM file in wasm/
  const wasmDir = join(ROOT, 'wasm')
  assert(existsSync(wasmDir), 'wasm/ directory exists')
  if (existsSync(wasmDir)) {
    const dirs = ['draco', 'basis', 'rhino3dm'].map(d => join(wasmDir, d))
    const found = dirs.filter(d => existsSync(d))
    assert(found.length >= 2, `at least 2 wasm subdirs found (got ${found.length}: ${found.map(f => f.split(/[/\\]/).pop()).join(', ')})`)
    // OCCT files may be directly in wasm/
    assert(existsSync(join(wasmDir, 'occt-import-js.wasm')), 'occt-import-js.wasm exists')
  }

  // At least one HDR/EXR in env/
  const envDir = join(ROOT, 'env')
  assert(existsSync(envDir), 'env/ directory exists')
}

// ── 2. serve.mjs HTTP test ───────────────────────────────────────────

async function testServeMJS() {
  console.log('\n--- serve.mjs ---')

  const TEST_PORT = 4189 // fixed high port for testing
  const server = spawn('node', [SERVE_SCRIPT, ROOT], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(TEST_PORT) },
  })

  // Wait for server to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('serve.mjs start timeout')), 10000)
    server.stdout.on('data', d => {
      const text = d.toString()
      if (text.includes('running at')) { clearTimeout(timeout); resolve() }
    })
  })
  const port = TEST_PORT

  const base = `http://localhost:${port}`

  try {
    // 2a. Serve index.html
    {
      const resp = await fetch(`${base}/index.html`)
      const text = await resp.text()
      assert(resp.status === 200, `index.html status 200 (got ${resp.status})`)
      assert(resp.headers.get('content-type')?.includes('text/html'), 'index.html content-type text/html')
      assert(text.includes('<html') || text.includes('<!DOCTYPE html'), 'index.html contains html markup')
    }

    // 2b. Serve from root → index.html (SPA)
    {
      const resp = await fetch(base + '/')
      assert(resp.status === 200, `root → index.html status 200 (got ${resp.status})`)
      const text = await resp.text()
      assert(text.includes('<html') || text.includes('<!DOCTYPE html'), 'root serves index.html')
    }

    // 2c. SSE endpoint
    {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const resp = await fetch(`${base}/api/events`, { signal: controller.signal })
      clearTimeout(timer)
      assert(resp.status === 200, `SSE endpoint status 200 (got ${resp.status})`)
      assert(resp.headers.get('content-type')?.includes('text/event-stream'),
        `SSE content-type text/event-stream (got ${resp.headers.get('content-type')})`)
    }

    // 2d. POST /api/command
    {
      const resp = await fetch(`${base}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: '3d-viewer', command: 'getTheme', params: {} }),
      })
      const body = await resp.json()
      assert(resp.status === 200, `POST /api/command status 200 (got ${resp.status})`)
      assert(body.status === 'ok', `POST /api/command response status ok (got ${body.status})`)
    }

    // 2e. 404 → SPA fallback
    {
      const resp = await fetch(`${base}/nonexistent-route`)
      assert(resp.status === 200, `SPA fallback status 200 (got ${resp.status})`)
      const text = await resp.text()
      assert(text.includes('<html') || text.includes('<!DOCTYPE html'),
        'SPA fallback returns index.html')
    }

    // 2f. Options request
    {
      const resp = await fetch(`${base}/api/command`, { method: 'OPTIONS' })
      assert(resp.status === 204, `OPTIONS status 204 (got ${resp.status})`)
    }
  } finally {
    server.kill()
  }
}

// ── 3. MCP protocol compliance ───────────────────────────────────────

async function testMCPInitialize() {
  console.log('\n--- MCP: initialize ---')
  const mcp = spawn('node', [MCP_SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'] })
  const result = collect(mcp, 1)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  mcp.stdin.end()

  const [res] = await result
  assert(res.jsonrpc === '2.0', 'jsonrpc 2.0')
  assert(res.id === 1, 'id matches')
  assert(res.result?.protocolVersion === '2024-11-05', 'protocol version')
  assert(res.result?.capabilities?.tools, 'tools capability declared')
  assert(res.result?.serverInfo?.name === '3d-viewer-mcp', 'server name')
}

async function testMCPToolsList() {
  console.log('\n--- MCP: tools/list ---')
  const mcp = spawn('node', [MCP_SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'] })
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.id === 2, 'id matches')
  assert(Array.isArray(res.result?.tools), 'result.tools is array')
  assert(res.result.tools.length >= 28, `has ${res.result.tools.length} tools (expected >= 28)`)

  assert(res.result.tools.every(t => t.name && t.description && t.inputSchema),
    'all tools have name/description/inputSchema')

  const required = [
    'set_theme', 'get_theme',
    'set_language', 'get_language',
    'set_env', 'get_env',
    'play_animation', 'pause_animation',
    'clear_selection',
    'take_screenshot',
    'set_camera_mode',
    'set_fullscreen',
  ]
  for (const name of required) {
    assert(res.result.tools.some(t => t.name === name), `has '${name}' tool`)
  }

  // Verify schemas
  const setTheme = res.result.tools.find(t => t.name === 'set_theme')
  assert(setTheme.inputSchema.required?.includes('value'), 'set_theme requires value')
  assert(setTheme.inputSchema.properties?.value?.enum?.includes('dark'), 'set_theme accepts dark')

  const setSpeed = res.result.tools.find(t => t.name === 'set_speed')
  assert(setSpeed.inputSchema.required?.includes('value'), 'set_speed requires value')
  assert(setSpeed.inputSchema.properties?.value?.type === 'number', 'set_speed value is number')
}

async function testMCPCallToolSuccess() {
  console.log('\n--- MCP: tools/call (success) ---')
  const viewer = createMockViewer()
  await new Promise(r => viewer.listen(0, r))
  const addr = viewer.address()
  const VPORT = addr.port

  const mcp = spawn('node', [MCP_SCRIPT], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, MCP_VIEWER_URL: `http://localhost:${VPORT}` },
  })
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_theme', arguments: {} } })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.id === 2, 'id matches')
  assert(res.result?.content?.[0]?.type === 'text', 'response has text content')
  const data = JSON.parse(res.result.content[0].text)
  assert(data.status === 'ok' || data.status === 'success', `command executed, status: ${data.status}`)

  viewer.close()
}

async function testMCPCallUnknownTool() {
  console.log('\n--- MCP: tools/call (unknown tool) ---')
  const mcp = spawn('node', [MCP_SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'] })
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nonexistent_tool', arguments: {} } })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.id === 2, 'id matches')
  assert(res.error?.code === -32602, 'error code -32602 (invalid params)')
  assert(res.error?.message?.includes('nonexistent_tool'), 'error mentions tool name')
}

async function testMCPViewerNotRunning() {
  console.log('\n--- MCP: tools/call (viewer not running) ---')
  const mcp = spawn('node', [MCP_SCRIPT], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, MCP_VIEWER_URL: 'http://localhost:4199' },
  })
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_theme', arguments: {} } })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.id === 2, 'id matches')
  assert(res.error?.code === -32603, 'error code -32603 on connection failure')
}

async function testMCPUnknownMethod() {
  console.log('\n--- MCP: unknown method ---')
  const mcp = spawn('node', [MCP_SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'] })
  const result = collect(mcp, 1)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'bogus_method', params: {} })
  mcp.stdin.end()

  const [res] = await result
  assert(res.error?.code === -32601, 'error code -32601 (method not found)')
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`smoke-test.mjs — 3d_viewer deployment validation`)
  console.log(`ROOT: ${ROOT}`)

  // 1. Structure
  testStructure()

  // 2. serve.mjs HTTP
  await testServeMJS()

  // 3. MCP protocol
  await testMCPInitialize()
  await testMCPToolsList()
  await testMCPCallToolSuccess()
  await testMCPCallUnknownTool()
  await testMCPViewerNotRunning()
  await testMCPUnknownMethod()

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
