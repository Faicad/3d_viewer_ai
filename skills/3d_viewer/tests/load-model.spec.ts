import { test, expect } from '@playwright/test'

test.describe('Skill deployment — model loading', () => {
  test('loads box_boss.glb via ?url= parameter', async ({ page }) => {
    await page.goto('/#/workspace?url=./models/box_boss.glb')

    const loaded = await page.waitForFunction(() => {
      const store = (window as any).__modelStore
      if (!store) return false
      const s = store.getState()
      return s.loadedFiles.length >= 1 && !s.loadingState.isVisible
    }, { timeout: 30_000 })
    expect(loaded).toBeTruthy()

    const count = await page.evaluate(() => {
      return (window as any).__modelStore.getState().loadedFiles.length
    })
    expect(count).toBe(1)

    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 5_000 })
  })

  test('serves SSE /api/events endpoint', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      try {
        const resp = await fetch('http://localhost:4273/api/events', { signal: controller.signal })
        const contentType = resp.headers.get('content-type') || ''
        return { status: resp.status, contentType }
      } finally {
        clearTimeout(timer)
      }
    })
    expect(result.status).toBe(200)
    expect(result.contentType).toContain('text/event-stream')
  })

  test('returns 503 when no SSE client is connected', async ({ page }) => {
    const resp = await page.request.post('http://localhost:4273/api/command', {
      data: { type: '3d-viewer', command: 'getTheme', params: {} },
    })
    expect(resp.status()).toBe(503)
    const body = await resp.json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('No connected clients')
  })

  test('serves POST /api/command endpoint', async ({ page }) => {
    await page.goto('/')
    const connected = page.evaluate(() => new Promise<void>(resolve => {
      const es = new EventSource('http://localhost:4273/api/events')
      es.addEventListener('connected', () => {
        es.close()
        resolve()
      })
    }))
    await connected

    const resp = await page.request.post('http://localhost:4273/api/command', {
      data: { type: '3d-viewer', command: 'getTheme', params: {} },
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
  })
})
