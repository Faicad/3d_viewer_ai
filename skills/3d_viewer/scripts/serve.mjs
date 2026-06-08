import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '4273', 10)
const ROOT = path.resolve(process.argv[2] || path.dirname(__dirname))

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.stl': 'application/sla',
  '.3mf': 'application/vnd.ms-3mfdocument',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

const sseClients = new Set()

function sendSSE(client, event, data) {
  client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(ROOT, urlPath)

  if (!fs.existsSync(filePath)) {
    console.error(`[serve.mjs] 404: ${req.url} → ${filePath}`)
    return false
  }

  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
  return true
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // SSE endpoint
  if (req.url === '/api/events' && req.method === 'GET') {
    res.writeHead(200, SSE_HEADERS)
    sendSSE(res, 'connected', {})
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  // AI command endpoint
  if (req.url === '/api/command' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      let cmd
      try {
        cmd = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      const delivered = sseClients.size
      if (delivered === 0) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'error', error: 'No connected clients', delivered: 0 }))
        return
      }

      for (const client of sseClients) {
        sendSSE(client, 'command', cmd)
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', delivered }))
    })
    return
  }

  // SPA fallback: serve index.html for any unmatched non-file route
  if (!serveStatic(req, res)) {
    const fallback = path.join(ROOT, 'index.html')
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      fs.createReadStream(fallback).pipe(res)
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  }
})

server.listen(PORT, () => {
  console.log(`3D Viewer server running at http://localhost:${PORT}`)
  console.log(`  Serving: ${ROOT}`)
  console.log(`  API:     POST http://localhost:${PORT}/api/command`)
  console.log(`  SSE:     GET  http://localhost:${PORT}/api/events`)
})
