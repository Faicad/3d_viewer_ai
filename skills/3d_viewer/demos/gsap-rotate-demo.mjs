/**
 * GSAP 场景旋转 Demo — standalone JS payload
 *
 * 复刻 animation_gen/demos/raw/gsap_rotate_demo.html。
 * 返回 executeCode payload，可注入到 #ai-layer。
 * 直接执行: node scripts/demos/gsap-rotate-demo.mjs [port]
 */

import { fileURLToPath } from 'url'

export const GSAP_ROTATE_DEMO_HTML = `<div id="gsap-panel">
  <div class="ctrl-row">
    <button class="btn-icon btn-play" id="btn-play" title="播放/暂停">▶</button>
    <label>速度</label>
    <input type="range" id="speed" min="0" max="4" step="0.05" value="1">
    <span class="value" id="speed-val">1.00</span>
    <button class="btn-icon secondary" id="btn-dir" title="切换方向">⟳</button>
    <button class="btn-icon secondary" id="btn-mode" title="切换模式">📷</button>
    <span id="mode-label">相机</span>
  </div>
  <div class="ctrl-row">
    <label>轴</label>
    <select id="axis-select">
      <option value="y">Y</option>
      <option value="x">X</option>
      <option value="z">Z</option>
    </select>
    <label>运动</label>
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

export const GSAP_ROTATE_DEMO_CSS = `#gsap-panel {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(13,13,26,0.6); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;
  padding: 5px 8px; min-width: 140px;
  display: flex; flex-direction: column; gap: 3px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  font-family: 'Segoe UI', system-ui, sans-serif; color: #ccc;
  pointer-events: auto;
}
#gsap-panel .ctrl-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
#gsap-panel .ctrl-row label { font-size: 11px; color: #888; white-space: nowrap; }
#gsap-panel .ctrl-row .value { font-size: 11px; color: #66bbff; font-weight: 600; min-width: 24px; text-align: right; font-variant-numeric: tabular-nums; }
#gsap-panel input[type="range"] { flex: 1; min-width: 40px; height: 3px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 2px; outline: none; cursor: pointer; }
#gsap-panel input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #66bbff; cursor: pointer; border: 2px solid #0d0d1a; }
#gsap-panel .btn-icon { width: 24px; height: 24px; border-radius: 5px; border: none; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
#gsap-panel .btn-play { background: #66bbff; color: #0d0d1a; }
#gsap-panel .btn-play:hover { background: #88ddff; }
#gsap-panel .btn-play.paused { background: #ff8844; }
#gsap-panel .btn-play.paused:hover { background: #ffaa66; }
#gsap-panel .btn-icon.secondary { background: rgba(255,255,255,0.08); color: #ccc; }
#gsap-panel .btn-icon.secondary:hover { background: rgba(255,255,255,0.18); }
#gsap-panel select { padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #ccc; font-size: 11px; outline: none; cursor: pointer; max-width: 56px; }
#gsap-panel select:focus { border-color: #66bbff; }`

export const GSAP_ROTATE_DEMO_JS = `;(function() {
  var gsap = window.__gsap, THREE = window.__THREE, api = window.viewerAPI || window.__viewerAPI;
  if (!gsap || !THREE || !api) { console.error('[gsap-demo] Missing dependencies'); return }
  var orbit = { angle: 0 };
  var cfg = { speed: 1, dir: 1, paused: false, axis: 'y', ease: 'elastic.inOut', mode: 'camera' };
  var _axisVec = new THREE.Vector3(0, 1, 0), _offset = new THREE.Vector3();
  function initOrbit() {
    var cam = api.getCameraState(), target = new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]);
    _offset.copy(new THREE.Vector3(cam.position[0], cam.position[1], cam.position[2])).sub(target);
    orbit.angle = 0;
  }
  function rebuild() {
    gsap.killTweensOf(orbit); orbit.angle = 0;
    if (cfg.mode === 'object') api.setPartTransform('__model__', { quaternion: [0,0,0,1] });
    if (cfg.paused) return;
    var total = cfg.dir * (Math.PI * 2), dur = Math.max(0.1, 6 / Math.max(0.01, cfg.speed));
    if (cfg.mode === 'camera') {
      var cam = api.getCameraState(), target = new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]);
      _offset.copy(new THREE.Vector3(cam.position[0], cam.position[1], cam.position[2])).sub(target);
      gsap.to(orbit, { angle: total, duration: dur, ease: cfg.ease, overwrite: true,
        onUpdate: function() { var q = new THREE.Quaternion().setFromAxisAngle(_axisVec, orbit.angle); var pos = _offset.clone().applyQuaternion(q); api.setCameraPosition([target.x+pos.x, target.y+pos.y, target.z+pos.z], [target.x, target.y, target.z]); },
        onComplete: rebuild });
    } else {
      gsap.to(orbit, { angle: total, duration: dur, ease: cfg.ease, overwrite: true,
        onUpdate: function() { var q = new THREE.Quaternion().setFromAxisAngle(_axisVec, orbit.angle); api.setPartTransform('__model__', { quaternion: [q.x,q.y,q.z,q.w] }); },
        onComplete: rebuild });
    }
  }
  var el = function(id) { return document.getElementById(id) };
  el('btn-play').addEventListener('click', function() { cfg.paused = !cfg.paused; el('btn-play').textContent = cfg.paused ? '▶' : '⏸'; if (cfg.paused) el('btn-play').classList.add('paused'); else el('btn-play').classList.remove('paused'); rebuild() });
  el('speed').addEventListener('input', function() { cfg.speed = parseFloat(el('speed').value); el('speed-val').textContent = cfg.speed.toFixed(2); rebuild() });
  el('btn-dir').addEventListener('click', function() { cfg.dir *= -1; rebuild() });
  el('btn-mode').addEventListener('click', function() { cfg.mode = cfg.mode === 'camera' ? 'object' : 'camera'; el('btn-mode').textContent = cfg.mode === 'object' ? '🧊' : '📷'; el('mode-label').textContent = cfg.mode === 'object' ? '物体' : '相机'; rebuild() });
  el('axis-select').addEventListener('change', function() { cfg.axis = el('axis-select').value; _axisVec = cfg.axis === 'x' ? new THREE.Vector3(1,0,0) : cfg.axis === 'z' ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0); initOrbit(); rebuild() });
  el('ease-select').addEventListener('change', function() { cfg.ease = el('ease-select').value; rebuild() });
  document.addEventListener('keydown', function(e) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === ' ') { e.preventDefault(); el('btn-play').click() } });
  initOrbit(); rebuild();
  console.log('[gsap-demo] ready');
})()`

export function buildGSAPRotatePayload() {
  return JSON.stringify({
    type: '3d-viewer', command: 'executeCode',
    params: { html: GSAP_ROTATE_DEMO_HTML, css: GSAP_ROTATE_DEMO_CSS, js: GSAP_ROTATE_DEMO_JS, mode: 'replace' },
    id: 'gsap-rotate-' + Date.now(),
  })
}

const _filename = fileURLToPath(import.meta.url)
if (process.argv[1] === _filename) {
  const payload = buildGSAPRotatePayload()
  const port = process.env.VIEWER_PORT || process.argv[2] || '4273'
  fetch(`http://localhost:${port}/api/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
  })
    .then(r => r.json()).then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error('Failed:', e.message))
}
