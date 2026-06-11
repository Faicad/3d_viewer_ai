#!/usr/bin/env node

/**
 * GSAP 旋转控制面板 — AI Code Injection 案例
 *
 * 通过 executeCode 命令将旋转动画控制面板注入到 3D Viewer 中。
 * 需要先启动 3D Viewer 服务（serve.mjs），并在浏览器中打开页面。
 *
 * 用法:
 *   node skills/3d_viewer/demos/gsap-rotate-demo.mjs    # 注入
 *   node skills/3d_viewer/demos/gsap-rotate-demo.mjs --clear  # 清除
 *
 * 前置条件:
 *   1. node skills/3d_viewer/scripts/serve.mjs  已启动
 *   2. 浏览器已打开 http://localhost:4273/#/workspace（需有 SSE 连接）
 *
 * 两个模式:
 *   📷 相机环绕 — 相机绕模型旋转（自动适配当前相机距离）
 *   🧊 物体自转 — 模型整体绕选定轴旋转
 */

const BASE = 'http://localhost:4273'

// ══════════════════════════════════════════════════════════════
// executeCode 载荷: HTML + CSS + JS
// ══════════════════════════════════════════════════════════════

const HTML = `\
<div id="gsap-panel">
  <div class="ctrl-row">
    <button class="btn-icon btn-play" id="btn-play" title="播放/暂停">▶</button>
    <label>速度</label>
    <input type="range" id="speed" min="0" max="4" step="0.05" value="1">
    <span class="value" id="speed-val">1.00</span>
    <div class="sep"></div>
    <button class="btn-icon secondary" id="btn-dir" title="切换方向">⟳</button>
    <button class="btn-icon secondary" id="btn-mode" title="切换模式">📷</button>
    <span id="mode-label">相机</span>
  </div>
  <div class="ctrl-row">
    <label>旋转轴</label>
    <select id="axis-select">
      <option value="y">Y 轴（水平）</option>
      <option value="x">X 轴（俯仰）</option>
      <option value="z">Z 轴（翻滚）</option>
    </select>
    <label>缓动</label>
    <select id="ease-select">
      <option value="none">linear</option>
      <option value="power1.inOut">power1</option>
      <option value="power2.inOut">power2</option>
      <option value="power3.inOut">power3</option>
      <option value="sine.inOut">sine</option>
      <option value="expo.inOut">expo</option>
      <option value="back.inOut">back</option>
      <option value="elastic.inOut" selected>elastic</option>
      <option value="bounce.inOut">bounce</option>
    </select>
  </div>
</div>`

const CSS = `\
#gsap-panel {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  background: rgba(13,13,26,0.92); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
  padding: 14px 20px; min-width: 360px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  font-family: 'Segoe UI', system-ui, sans-serif; color: #ccc;
  pointer-events: auto;
}
#gsap-panel .ctrl-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
#gsap-panel .ctrl-row label {
  font-size: 11px; color: #888; white-space: nowrap; min-width: 36px;
}
#gsap-panel .ctrl-row .value {
  font-size: 11px; color: #66bbff; font-weight: 600; min-width: 36px;
  text-align: right; font-variant-numeric: tabular-nums;
}
#gsap-panel .sep {
  width: 1px; height: 24px; background: rgba(255,255,255,0.12);
}
#gsap-panel input[type="range"] {
  flex: 1; min-width: 80px; height: 4px; -webkit-appearance: none;
  appearance: none; background: rgba(255,255,255,0.12); border-radius: 2px; outline: none;
}
#gsap-panel input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: #66bbff; cursor: pointer; border: 2px solid #0d0d1a;
}
#gsap-panel .btn-icon {
  width: 34px; height: 34px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 16px; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s;
}
#gsap-panel .btn-play { background: #66bbff; color: #0d0d1a; }
#gsap-panel .btn-play:hover { background: #88ddff; }
#gsap-panel .btn-play.paused { background: #ff8844; }
#gsap-panel .btn-play.paused:hover { background: #ffaa66; }
#gsap-panel .btn-icon.secondary { background: rgba(255,255,255,0.08); color: #ccc; }
#gsap-panel .btn-icon.secondary:hover { background: rgba(255,255,255,0.18); }
#gsap-panel select {
  padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06); color: #ccc; font-size: 12px; outline: none;
}
#gsap-panel select:focus { border-color: #66bbff; }`

const JS = `\
(function() {
  var gsap = window.__gsap
  var THREE = window.__THREE
  var api = window.viewerAPI || window.__viewerAPI

  if (!gsap || !THREE || !api) {
    console.error('[gsap-demo] Missing: gsap=' + !!gsap + ' THREE=' + !!THREE + ' api=' + !!api)
    return
  }

  var orbit = { angle: 0 }
  var cfg = { speed: 1, dir: 1, paused: false, axis: 'y', ease: 'elastic.inOut', mode: 'camera' }
  var _axisVec = new THREE.Vector3(0, 1, 0)
  var _offset = new THREE.Vector3()

  function initOrbit() {
    var cam = api.getCameraState()
    var t = new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2])
    _offset.copy(new THREE.Vector3(cam.position[0], cam.position[1], cam.position[2])).sub(t)
    orbit.angle = 0
  }

  function rebuild() {
    gsap.killTweensOf(orbit)
    orbit.angle = 0
    if (cfg.mode === 'object') {
      api.setPartTransform('__model__', { quaternion: [0, 0, 0, 1] })
    }
    if (cfg.paused) return
    var total = cfg.dir * (Math.PI * 2)
    var dur = Math.max(0.1, 6 / Math.max(0.01, cfg.speed))

    if (cfg.mode === 'camera') {
      var cam = api.getCameraState()
      var t = new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2])
      _offset.copy(new THREE.Vector3(cam.position[0], cam.position[1], cam.position[2])).sub(t)
      gsap.to(orbit, {
        angle: total, duration: dur, ease: cfg.ease, overwrite: true,
        onUpdate: function() {
          var q = new THREE.Quaternion().setFromAxisAngle(_axisVec, orbit.angle)
          var pos = _offset.clone().applyQuaternion(q)
          api.setCameraPosition([t.x + pos.x, t.y + pos.y, t.z + pos.z], [t.x, t.y, t.z])
        },
        onComplete: rebuild
      })
    } else {
      gsap.to(orbit, {
        angle: total, duration: dur, ease: cfg.ease, overwrite: true,
        onUpdate: function() {
          var q = new THREE.Quaternion().setFromAxisAngle(_axisVec, orbit.angle)
          api.setPartTransform('__model__', { quaternion: [q.x, q.y, q.z, q.w] })
        },
        onComplete: rebuild
      })
    }
  }

  document.getElementById('btn-play').addEventListener('click', function() {
    cfg.paused = !cfg.paused
    var btn = document.getElementById('btn-play')
    btn.textContent = cfg.paused ? '▶' : '⏸'
    btn.classList.toggle('paused', cfg.paused)
    rebuild()
  })

  document.getElementById('speed').addEventListener('input', function(e) {
    cfg.speed = parseFloat(e.target.value)
    document.getElementById('speed-val').textContent = cfg.speed.toFixed(2)
    rebuild()
  })

  document.getElementById('btn-dir').addEventListener('click', function() {
    cfg.dir *= -1; rebuild()
  })

  document.getElementById('btn-mode').addEventListener('click', function() {
    cfg.mode = cfg.mode === 'camera' ? 'object' : 'camera'
    var btn = document.getElementById('btn-mode')
    var label = document.getElementById('mode-label')
    if (cfg.mode === 'object') { btn.textContent = '🧊'; label.textContent = '物体' }
    else { btn.textContent = '📷'; label.textContent = '相机' }
    rebuild()
  })

  document.getElementById('axis-select').addEventListener('change', function(e) {
    cfg.axis = e.target.value
    _axisVec = cfg.axis === 'x' ? new THREE.Vector3(1, 0, 0)
      : cfg.axis === 'z' ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0)
    initOrbit(); rebuild()
  })

  document.getElementById('ease-select').addEventListener('change', function(e) {
    cfg.ease = e.target.value; rebuild()
  })

  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.key === ' ') { e.preventDefault(); document.getElementById('btn-play').click() }
  })

  initOrbit()
  rebuild()
  console.log('[AI-injected] GSAP rotate panel ready')
})()`

// ══════════════════════════════════════════════════════════════
// HTTP API 发送
// ══════════════════════════════════════════════════════════════

const isClear = process.argv.includes('--clear')

const payload = {
  type: '3d-viewer',
  id: 'gsap-rotate-' + Date.now(),
  command: 'executeCode',
  params: isClear
    ? { mode: 'clear' }
    : { html: HTML, css: CSS, js: JS, mode: 'replace' },
}

console.log(isClear ? '→ 清除 AI 注入层…' : '→ 注入 GSAP 旋转控制面板…')

try {
  const res = await fetch(BASE + '/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (data.status === 'ok') {
    console.log('✓ 成功: ' + (isClear ? '已清除' : '面板已注入'))
    console.log(JSON.stringify(data.result ?? data, null, 2))
  } else {
    console.error('✗ 失败:', JSON.stringify(data, null, 2))
    if (data.error?.includes('No connected clients')) {
      console.error('\n提示: 请先在浏览器中打开 http://localhost:' + BASE.split(':').pop() + '/#/workspace')
    }
    process.exit(1)
  }
} catch (err) {
  console.error('✗ 请求失败:', err.message)
  console.error('\n提示: 请先启动 serve.mjs: node skills/3d_viewer/scripts/serve.mjs')
  process.exit(1)
}
