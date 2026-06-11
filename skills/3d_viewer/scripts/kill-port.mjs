#!/usr/bin/env node
import { execSync } from 'child_process'
import { platform } from 'os'

const PORT = process.argv[2] || '4273'

function kill(pid) {
  const cmd = platform() === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`
  execSync(cmd, { stdio: 'ignore' })
}

try {
  if (platform() === 'win32') {
    const out = execSync(`netstat -ano | findstr ":${PORT}"`, { encoding: 'utf8', stdio: 'pipe' })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      if (/LISTENING/.test(line)) {
        const m = line.match(/(\d+)\s*$/)
        if (m) pids.add(m[1])
      }
    }
    for (const pid of pids) kill(pid)
  } else {
    let pid
    try { pid = execSync(`lsof -t -i:${PORT} 2>/dev/null`, { encoding: 'utf8' }).trim() }
    catch { pid = execSync(`fuser ${PORT}/tcp 2>/dev/null`, { encoding: 'utf8' }).trim() }
    if (pid) kill(pid)
  }
} catch {
  // port not in use
}
