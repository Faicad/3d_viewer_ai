import { execSync } from 'child_process'
import { platform } from 'os'

const port = process.argv[2] || '4273'

try {
  if (platform() === 'win32') {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: 'pipe' })
    for (const line of result.trim().split('\n')) {
      const pid = line.trim().split(/\s+/).pop()
      if (pid && /^\d+$/.test(pid)) {
        try { process.kill(parseInt(pid), 'SIGTERM') } catch {}
      }
    }
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' })
  }
} catch {}
