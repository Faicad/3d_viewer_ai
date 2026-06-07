import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serveScript = join(__dirname, 'scripts', 'serve.mjs')
const mcpScript = join(__dirname, 'scripts', 'mcp-server.mjs')
const skillRoot = __dirname

// Skill tests run standalone (no package.json). Resolve playwright from
// the sibling 3d_viewer_web project where it's already installed.
const webNodeModules = join(__dirname, '..', '..', '..', '3d_viewer_web', 'node_modules')
const webRequire = createRequire(join(webNodeModules, 'playwright', 'package.json'))
async function getPlaywright() {
  return webRequire('playwright')
}

// ============================================================
// Helpers
// ============================================================

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${msg}`) }
  else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${msg}`) }
}

// ============================================================
// Server lifecycle
// ============================================================

async function startServer(port = 4185) {
  const proc = spawn('node', [serveScript, skillRoot], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port) },
  })

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server start timeout')), 10000)
    proc.stdout.on('data', d => {
      if (d.toString().includes('running')) { clearTimeout(timeout); resolve() }
    })
    proc.stderr.on('data', () => {}) // silence
  })

  return { proc, port }
}

function stopServer({ proc }) {
  proc.kill()
}

// ============================================================
// MCP helpers
// ============================================================

function spawnMcp(viewerPort) {
  return spawn('node', [mcpScript], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, MCP_VIEWER_URL: `http://localhost:${viewerPort}` },
  })
}

async function mcpCall(mcp, toolName, args = {}) {
  const n = collect(mcp, 1)
  send(mcp, { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } })
  const [res] = await n
  return res
}

// ============================================================
// Tests — Part 1: MCP Protocol (no browser)
// ============================================================

async function testMcpHandshake() {
  console.log('\n--- MCP handshake ---')

  const mcp = spawnMcp(4173) // port doesn't matter for init
  const result = collect(mcp, 1)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  mcp.stdin.end()

  const [res] = await result
  assert(res.jsonrpc === '2.0', 'jsonrpc 2.0')
  assert(res.id === 1, 'id matches')
  assert(res.result?.protocolVersion === '2024-11-05', 'protocol version 2024-11-05')
  assert(res.result?.capabilities?.tools, 'declares tools capability')
  assert(res.result?.serverInfo?.name === '3d-viewer-mcp', 'server name is 3d-viewer-mcp')
  assert(res.result?.serverInfo?.version, 'server version present')
}

async function testToolsList() {
  console.log('\n--- MCP tools/list ---')

  const mcp = spawnMcp(4173)
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.id === 2, 'id matches')
  assert(Array.isArray(res.result?.tools), 'result.tools is array')
  assert(res.result.tools.length >= 28, `has ${res.result.tools.length} tools (≥28)`)

  // All tools must follow MCP schema
  assert(res.result.tools.every(t => t.name && t.description && t.inputSchema),
    'every tool has name + description + inputSchema')

  // Required tool categories
  const required = [
    'set_theme', 'get_theme',
    'set_language', 'get_language',
    'set_env', 'get_env', 'set_env_intensity', 'set_env_rotation',
    'play_animation', 'pause_animation', 'stop_animation',
    'select_animation', 'seek', 'set_speed',
    'set_camera_mode', 'reset_camera',
    'clear_selection', 'set_active_tool', 'set_transform_mode',
    'set_fullscreen', 'toggle_left_panel', 'toggle_right_panel',
    'toggle_model_info', 'toggle_env_panel',
    'set_default_material', 'clear_default_material',
    'clear_all_overrides', 'toggle_override_material',
    'take_screenshot',
  ]
  for (const name of required) {
    assert(res.result.tools.some(t => t.name === name), `has tool: ${name}`)
  }

  // Verify a few parameter schemas
  const setTheme = res.result.tools.find(t => t.name === 'set_theme')
  assert(setTheme.inputSchema.required?.includes('value'), 'set_theme requires value')
  assert(setTheme.inputSchema.properties?.value?.enum?.includes('dark'), 'set_theme accepts dark')
  assert(setTheme.inputSchema.properties?.value?.enum?.includes('light'), 'set_theme accepts light')

  const setSpeed = res.result.tools.find(t => t.name === 'set_speed')
  assert(setSpeed.inputSchema.properties?.value?.type === 'number', 'set_speed value is number')
}

async function testUnknownMethod() {
  console.log('\n--- MCP unknown method ---')

  const mcp = spawnMcp(4173)
  const result = collect(mcp, 1)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'bogus_method', params: {} })
  mcp.stdin.end()

  const [res] = await result
  assert(res.error?.code === -32601, 'returns error -32601 (method not found)')
}

async function testUnknownTool() {
  console.log('\n--- MCP unknown tool ---')

  const mcp = spawnMcp(4173)
  const result = collect(mcp, 2)
  send(mcp, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  send(mcp, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nonexistent_tool', arguments: {} } })
  mcp.stdin.end()

  const [, res] = await result
  assert(res.error?.code === -32602, 'returns error -32602 (invalid params)')
  assert(res.error?.message?.includes('nonexistent_tool'), 'error message mentions tool name')
}

// ============================================================
// Tests — Part 2: Server + Browser E2E
// ============================================================

async function testServerStartsAndServes() {
  console.log('\n--- Server starts and serves app ---')

  const server = await startServer()

  // Verify HTTP server is reachable
  const resp = await fetch(`http://localhost:${server.port}/`)
  const html = await resp.text()
  assert(resp.status === 200, `GET / returns 200 (got ${resp.status})`)
  assert(html.includes('<!DOCTYPE html>') || html.includes('<html'), 'response is HTML')
  assert(html.includes('id="root"'), 'HTML contains React mount point')

  // Verify API endpoint exists
  const apiResp = await fetch(`http://localhost:${server.port}/api/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: '3d-viewer', command: 'getTheme' }),
  })
  const apiJson = await apiResp.json()
  assert(apiResp.status === 200, `POST /api/command returns 200`)
  assert(apiJson.status === 'ok', `POST /api/command status: ${apiJson.status}`)

  stopServer(server)
}

async function testE2EThemeChange() {
  console.log('\n--- E2E: theme change via MCP ---')

  const { chromium } = await getPlaywright()
  const server = await startServer()

  // Open browser to the app
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('pageerror', err => console.log(`  [browser error] ${err.message}`))

  await page.goto(`http://localhost:${server.port}/#/workspace`, { waitUntil: 'load', timeout: 15000 })
  await sleep(2000) // wait for React + SSE

  // Spawn MCP
  const mcp = spawnMcp(server.port)

  // Set dark theme
  let res = await mcpCall(mcp, 'set_theme', { value: 'dark' })
  const parsed = JSON.parse(res.result.content[0].text)
  assert(parsed.status === 'ok', `set_theme delivery: ${parsed.status}`)

  await sleep(1500)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  assert(isDark === true, 'browser: dark class applied')

  // Verify sync result contains browser data
  if (parsed.result) {
    assert(parsed.result.command === 'setTheme', 'sync result: command matches')
    assert(parsed.result.status === 'success', 'sync result: browser executed successfully')
    assert(parsed.result.data?.theme === 'dark', 'sync result: browser returned theme=dark')
  }

  // Set light theme
  res = await mcpCall(mcp, 'set_theme', { value: 'light' })
  const p2 = JSON.parse(res.result.content[0].text)
  assert(p2.status === 'ok', 'set_theme light delivery ok')

  await sleep(1000)
  const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'))
  assert(isLight === true, 'browser: dark class removed (light mode)')

  mcp.stdin.end()
  await browser.close()
  stopServer(server)
}

async function testE2ELanguageChange() {
  console.log('\n--- E2E: language change via MCP ---')

  const { chromium } = await getPlaywright()
  const server = await startServer()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(`http://localhost:${server.port}/#/workspace`, { waitUntil: 'load', timeout: 15000 })
  await sleep(2000)

  const mcp = spawnMcp(server.port)

  // Set English
  let res = await mcpCall(mcp, 'set_language', { value: 'en' })
  const p1 = JSON.parse(res.result.content[0].text)
  assert(p1.status === 'ok', `set_language en: ${p1.status}`)

  await sleep(1000)
  const langEn = await page.evaluate(() => document.documentElement.lang)
  assert(langEn === 'en', `browser: lang = '${langEn}' (expected 'en')`)

  // Set Chinese
  res = await mcpCall(mcp, 'set_language', { value: 'zh' })
  const p2 = JSON.parse(res.result.content[0].text)
  assert(p2.status === 'ok', `set_language zh: ${p2.status}`)

  await sleep(1000)
  const langZh = await page.evaluate(() => document.documentElement.lang)
  assert(langZh === 'zh', `browser: lang = '${langZh}' (expected 'zh')`)

  mcp.stdin.end()
  await browser.close()
  stopServer(server)
}

async function testE2ESyncGetters() {
  console.log('\n--- E2E: sync getters return browser data ---')

  const { chromium } = await getPlaywright()
  const server = await startServer()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(`http://localhost:${server.port}/#/workspace`, { waitUntil: 'load', timeout: 15000 })
  await sleep(2000)

  const mcp = spawnMcp(server.port)

  // get_theme — should return actual browser theme
  let res = await mcpCall(mcp, 'get_theme', {})
  const themeData = JSON.parse(res.result.content[0].text)
  assert(themeData.status === 'ok', `get_theme: delivery ok`)
  assert(themeData.result !== undefined, 'get_theme: has result field (browser data)')
  if (themeData.result) {
    assert(themeData.result.type === '3d-viewer', 'get_theme: correct type')
    assert(themeData.result.command === 'getTheme', 'get_theme: correct command')
    assert(themeData.result.status === 'success', 'get_theme: browser success')
    assert(typeof themeData.result.data?.theme === 'string', 'get_theme: theme is string')
  }

  // get_language
  res = await mcpCall(mcp, 'get_language', {})
  const langData = JSON.parse(res.result.content[0].text)
  assert(langData.status === 'ok', 'get_language: delivery ok')
  if (langData.result) {
    assert(typeof langData.result.data?.language === 'string', 'get_language: language is string')
  }

  // get_env
  res = await mcpCall(mcp, 'get_env', {})
  const envData = JSON.parse(res.result.content[0].text)
  assert(envData.status === 'ok', 'get_env: delivery ok')
  if (envData.result) {
    assert(typeof envData.result.data?.env === 'string', 'get_env: env is string')
  }

  mcp.stdin.end()
  await browser.close()
  stopServer(server)
}

async function testE2EErrorRecovery() {
  console.log('\n--- E2E: error recovery ---')

  const { chromium } = await getPlaywright()
  const server = await startServer()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`http://localhost:${server.port}/#/workspace`, { waitUntil: 'load', timeout: 15000 })
  await sleep(2000)

  const mcp = spawnMcp(server.port)

  // 1. Unknown tool → error
  let res = await mcpCall(mcp, 'nonexistent_tool', {})
  assert(res.error?.code === -32602, 'unknown tool: error -32602')

  // 2. Valid tool right after → should work
  res = await mcpCall(mcp, 'get_theme', {})
  const data = JSON.parse(res.result.content[0].text)
  assert(data.status === 'ok', 'valid tool after error: still works')

  mcp.stdin.end()
  await browser.close()
  stopServer(server)
}

async function testE2EMultiCommand() {
  console.log('\n--- E2E: rapid multi-command sequence ---')

  const { chromium } = await getPlaywright()
  const server = await startServer()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`http://localhost:${server.port}/#/workspace`, { waitUntil: 'load', timeout: 15000 })
  await sleep(2000)

  const mcp = spawnMcp(server.port)

  const commands = [
    { tool: 'set_theme', args: { value: 'dark' } },
    { tool: 'set_env_intensity', args: { value: 1.5 } },
    { tool: 'clear_selection', args: {} },
    { tool: 'toggle_left_panel', args: {} },
  ]

  let allOk = true
  for (const cmd of commands) {
    const res = await mcpCall(mcp, cmd.tool, cmd.args)
    if (res.error) { allOk = false; console.log(`  ✗ ${cmd.tool}: ${res.error.message}`) }
  }
  assert(allOk, `all ${commands.length} commands executed without error`)

  await sleep(2000)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  assert(isDark === true, 'browser: theme is dark after multi-command sequence')

  mcp.stdin.end()
  await browser.close()
  stopServer(server)
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(50))
  console.log('3D Viewer Skill — Integration Tests')
  console.log('='.repeat(50))

  // Part 1: MCP protocol (no browser needed)
  await testMcpHandshake()
  await testToolsList()
  await testUnknownMethod()
  await testUnknownTool()

  // Part 2: Server
  await testServerStartsAndServes()

  // Part 3: Full E2E (server + browser + MCP)
  await testE2EThemeChange()
  await testE2ELanguageChange()
  await testE2ESyncGetters()
  await testE2EErrorRecovery()
  await testE2EMultiCommand()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(50)}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
