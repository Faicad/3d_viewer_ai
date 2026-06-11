/**
 * GSAP 装配动画 Demo — standalone JS payload
 *
 * 复刻 animation_gen/demos/raw/gsap_assemble_demo.html。
 * 返回 executeCode payload，可注入到 #ai-layer。
 * 直接执行: node scripts/demos/gsap-assemble-demo.mjs [port]
 *
 * ── Debug Log（移植过程错误记录，2026-06-11）─────────────
 *
 * 1. scenePosZ = 0 硬编码错误
 *    修复: dropZ = localPos.z + (worldDropZ - worldPos.z)
 *
 * 2. proxyZ 绕弯子（fromTo + onUpdate 代理对象）
 *    修复: 直接用 timeline.fromTo(proxy.position, ...)
 *
 * 3. 零件不动 — GSAP .to() 在创建时缓存起始值
 *    修复: 改用 .fromTo() 显式指定起止值。
 *
 * 4. 所有零件一起下落 — world position 获取错误
 *    修复: 改用 Box3.setFromObject(mesh).getCenter()
 *
 * 5. updateWorldMatrix 缺失
 *    修复: Box3.setFromObject 内已自动处理。
 *
 * 6. 跨 demo 位置干扰 — 先执行 explode 再执行 assemble，
 *    captureParts 捕获的是 explode 修改后的位置，导致装配终点错误。
 *    修复: 增加 resetPartsPosition()，首次调用时缓存所有零件原始 position
 *    到 window.__gsap_initial_positions，后续 demo 开始前恢复。
 * ────────────────────────────────────────────────
 */

import { fileURLToPath } from 'url'

export const GSAP_ASSEMBLE_DEMO_HTML = `<div id="gsap-panel">
  <div class="ctrl-row">
    <button class="btn-icon btn-play" id="btn-play" title="播放 (Space)">▶</button>
    <button class="btn-icon secondary" id="btn-reset" title="重置 (R)">⟲</button>
    <div class="scrub-wrap">
      <input type="range" id="scrub" min="0" max="1000" value="0">
      <span class="time-label" id="time-label">0.00s / 0.00s</span>
    </div>
    <label>运动</label>
    <select class="ctrl-select" id="easing-select">
      <option value="power3.in" selected>重力加速</option>
      <option value="back.out(2.5)">强锁定</option>
      <option value="elastic.out(1,0.2)">弹簧着陆</option>
      <option value="bounce.out">弹跳着陆</option>
      <option value="back.out(1.5)">锁定回弹</option>
      <option value="power3.inOut">缓入缓出</option>
      <option value="expo.in">重重力感</option>
      <option value="none">线性</option>
    </select>
  </div>
  <div class="ctrl-row">
    <label>高度</label>
    <input type="range" id="height-slider" min="1.0" max="5.0" step="0.1" value="3.0">
    <span class="value" id="height-val">3.0×</span>
    <label>时长</label>
    <input type="range" id="duration-slider" min="0.2" max="3.0" step="0.1" value="0.8">
    <span class="value" id="duration-val">0.8s</span>
  </div>
</div>`

export const GSAP_ASSEMBLE_DEMO_CSS = `#gsap-panel {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(13,13,26,0.6); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;
  padding: 5px 8px; min-width: 220px;
  display: flex; flex-direction: column; gap: 3px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  font-family: 'Segoe UI', system-ui, sans-serif; color: #ccc;
  pointer-events: auto;
}
#gsap-panel .ctrl-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
#gsap-panel .ctrl-row label { font-size: 11px; color: #888; white-space: nowrap; }
#gsap-panel .ctrl-row .value { font-size: 11px; color: #44aaff; font-weight: 600; min-width: 24px; text-align: right; font-variant-numeric: tabular-nums; }
#gsap-panel .btn-icon { width: 24px; height: 24px; border-radius: 5px; border: none; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
#gsap-panel .btn-play { background: #44aaff; color: #0d0d1a; }
#gsap-panel .btn-play:hover { background: #66ccff; }
#gsap-panel .btn-play.paused { background: #ff8844; }
#gsap-panel .btn-play.paused:hover { background: #ffaa66; }
#gsap-panel .btn-icon.secondary { background: rgba(255,255,255,0.08); color: #ccc; }
#gsap-panel .btn-icon.secondary:hover { background: rgba(255,255,255,0.15); }
#gsap-panel .sep-line { border: none; border-top: 1px solid rgba(255,255,255,0.04); margin: 1px 0; }
#gsap-panel .scrub-wrap { display: flex; align-items: center; gap: 4px; flex: 1; }
#gsap-panel .scrub-wrap input[type="range"] { max-width: none; }
#gsap-panel .time-label { font-size: 11px; color: #888; min-width: 65px; text-align: right; font-variant-numeric: tabular-nums; }
#gsap-panel input[type="range"] { flex: 1; min-width: 40px; height: 3px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.12); border-radius: 2px; outline: none; cursor: pointer; }
#gsap-panel input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #44aaff; cursor: pointer; border: 2px solid #0d0d1a; }
#gsap-panel input[type="range"]::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: #44aaff; cursor: pointer; border: 2px solid #0d0d1a; }
#gsap-panel .ctrl-select { padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #ccc; font-size: 11px; outline: none; cursor: pointer; max-width: 56px; }
#gsap-panel .ctrl-select:focus { border-color: #44aaff; }
`

export const GSAP_ASSEMBLE_DEMO_JS = `;(function() {
  var gsap = window.__gsap, THREE = window.__THREE, api = window.viewerAPI || window.__viewerAPI;
  if (!gsap || !THREE || !api) { console.error('[gsap-assemble] Missing dependencies'); return }

  // ---- Cross-demo position reset ----
  function resetPartsPosition() {
    var saved = window.__gsap_initial_positions;
    if (saved) {
      var all = api.getParts();
      for (var i = 0; i < all.length; i++) {
        var s = saved[all[i].partId];
        if (s) { var p = api.getPartProxy(all[i].partId); if (p) p.position.set(s[0], s[1], s[2]) }
      }
    } else {
      window.__gsap_initial_positions = {};
      var all = api.getParts();
      for (var i = 0; i < all.length; i++) {
        var p = api.getPartProxy(all[i].partId);
        if (p) window.__gsap_initial_positions[all[i].partId] = [p.position.x, p.position.y, p.position.z]
      }
    }
  }
  var parts = [], initialPositions = [], timeline = null, isPlaying = false, _assemblyData = null;

  function findMeshByPartId(partId) {
    var scene = window.__r3f_dev && window.__r3f_dev.scene;
    if (!scene) return null;
    var found = null;
    scene.traverse(function(c) { if (!found && c.isMesh && c.userData && c.userData.partId === partId) found = c });
    return found;
  }

  function captureParts() {
    resetPartsPosition();
    var partInfos = api.getParts();
    initialPositions = []; parts = [];
    for (var i = 0; i < partInfos.length; i++) {
      var info = partInfos[i], proxy = api.getPartProxy(info.partId);
      if (!proxy) continue;
      var localPos = proxy.position.clone();
      initialPositions.push({ partId: info.partId, pos: localPos.clone() });
      var mesh = findMeshByPartId(info.partId), worldPos, height = 0;
      if (mesh) { var box = new THREE.Box3().setFromObject(mesh); worldPos = box.getCenter(new THREE.Vector3()); height = box.max.z - box.min.z }
      else { worldPos = localPos.clone() }
      parts.push({ partId: info.partId, proxy: proxy, localPos: localPos, worldPos: worldPos, height: height, name: info.name });
    }
    var box = new THREE.Box3();
    for (var j = 0; j < parts.length; j++) box.expandByPoint(parts[j].worldPos);
    _assemblyData = { parts: parts, assemblyTopZ: box.max.z };
    return true;
  }

  function restorePositions() {
    for (var i = 0; i < initialPositions.length; i++) {
      var ref = initialPositions[i], proxy = api.getPartProxy(ref.partId);
      if (proxy) proxy.position.copy(ref.pos);
      var m = findMeshByPartId(ref.partId);
      if (m) m.visible = true;
    }
  }

  function buildAssembly() {
    if (timeline) { timeline.progress(0).kill(); timeline = null }
    isPlaying = false;
    var btnPlay = document.getElementById('btn-play');
    btnPlay.textContent = '▶'; btnPlay.classList.remove('paused');
    if (!_assemblyData) return;
    var pData = _assemblyData.parts, assemblyTopZ = _assemblyData.assemblyTopZ;
    var dropRatio = parseFloat(document.getElementById('height-slider').value);
    var partDuration = parseFloat(document.getElementById('duration-slider').value);
    var easing = document.getElementById('easing-select').value;
    pData.sort(function(a, b) { return a.worldPos.z - b.worldPos.z });
    restorePositions();
    var worldDropZ = assemblyTopZ * dropRatio;
    for (var m = 0; m < pData.length; m++) { pData[m].dropZ = pData[m].localPos.z + (worldDropZ - pData[m].worldPos.z) }
    var groups = {}, groupKeys, groupIdx = 0;
    for (var i = 0; i < pData.length; i++) {
      var p = pData[i], key = p.worldPos.z.toFixed(2) + '|' + p.height.toFixed(2);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    groupKeys = Object.keys(groups).sort(function(a, b) { return parseFloat(a.split('|')[0]) - parseFloat(b.split('|')[0]) });
    timeline = gsap.timeline({ paused: true, onComplete: function() { isPlaying = false; btnPlay.textContent = '⟳'; btnPlay.classList.remove('paused') } });
    for (var n = 0; n < pData.length; n++) { var mm = findMeshByPartId(pData[n].partId); if (mm) timeline.set(mm, { visible: false }, 0) }
    var EPS = 1 / 60;
    for (var gi = 0; gi < groupKeys.length; gi++) {
      var tStart = groupIdx * partDuration, t = tStart < EPS ? EPS : tStart;
      var groupParts = groups[groupKeys[gi]];
      for (var pi = 0; pi < groupParts.length; pi++) {
        var gp = groupParts[pi];
        var gm = findMeshByPartId(gp.partId);
        if (gm) timeline.set(gm, { visible: true }, t);
        timeline.fromTo(gp.proxy.position, { x: gp.localPos.x, y: gp.localPos.y, z: gp.dropZ }, { x: gp.localPos.x, y: gp.localPos.y, z: gp.localPos.z, duration: partDuration, ease: easing, overwrite: true }, t);
      }
      groupIdx++;
    }
    syncUI();
  }

  function rebuild() { buildAssembly() }

  function togglePlay() {
    if (!timeline) return;
    var btnPlay = document.getElementById('btn-play');
    if (isPlaying) { timeline.pause(); isPlaying = false; btnPlay.textContent = '▶'; btnPlay.classList.remove('paused') }
    else { if (timeline.progress() >= 1) timeline.progress(0); timeline.play(); isPlaying = true; btnPlay.textContent = '⏸'; btnPlay.classList.add('paused') }
  }

  function resetAnim() {
    if (timeline) { timeline.progress(0).pause(); isPlaying = false; document.getElementById('btn-play').textContent = '▶'; document.getElementById('btn-play').classList.remove('paused'); syncUI() }
  }

  function syncUI() {
    var scrub = document.getElementById('scrub'), timeLabel = document.getElementById('time-label');
    if (!timeline) { scrub.value = 0; timeLabel.textContent = '0.00s / 0.00s'; return }
    var p = timeline.progress();
    scrub.value = p * 1000;
    timeLabel.textContent = (p * timeline.duration()).toFixed(2) + 's / ' + timeline.duration().toFixed(2) + 's';
  }

  var el = function(id) { return document.getElementById(id) };
  el('btn-play').addEventListener('click', togglePlay);
  el('btn-reset').addEventListener('click', resetAnim);
  el('scrub').addEventListener('input', function() { if (!timeline) return; timeline.progress(el('scrub').value / 1000).pause(); isPlaying = false; el('btn-play').textContent = '▶'; el('btn-play').classList.remove('paused'); syncUI() });
  el('easing-select').addEventListener('change', rebuild);
  el('height-slider').addEventListener('input', function() { el('height-val').textContent = parseFloat(el('height-slider').value).toFixed(1) + '×' });
  el('height-slider').addEventListener('change', rebuild);
  el('duration-slider').addEventListener('input', function() { el('duration-val').textContent = parseFloat(el('duration-slider').value).toFixed(1) + 's' });
  el('duration-slider').addEventListener('change', rebuild);
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay() }
    if (e.key === 'r') resetAnim();
  });
  if (captureParts()) buildAssembly();
  console.log('[gsap-assemble] ready');
})()`

export function buildGSAPAssemblePayload() {
  return JSON.stringify({
    type: '3d-viewer', command: 'executeCode',
    params: { html: GSAP_ASSEMBLE_DEMO_HTML, css: GSAP_ASSEMBLE_DEMO_CSS, js: GSAP_ASSEMBLE_DEMO_JS, mode: 'replace' },
    id: 'gsap-assemble-' + Date.now(),
  })
}

const _filename = fileURLToPath(import.meta.url)
if (process.argv[1] === _filename) {
  const payload = buildGSAPAssemblePayload()
  const port = process.env.VIEWER_PORT || process.argv[2] || '4273'
  fetch(`http://localhost:${port}/api/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
  })
    .then(r => r.json()).then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error('Failed:', e.message))
}
