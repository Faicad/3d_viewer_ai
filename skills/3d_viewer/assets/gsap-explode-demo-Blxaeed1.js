const e=`
<div id="gsap-panel">
  <div class="ctrl-row">
    <button class="btn-icon btn-play" id="btn-play" title="播放 (Space)">▶</button>
    <button class="btn-icon secondary" id="btn-reset" title="重置 (R)">⟲</button>
    <div class="scrub-wrap">
      <input type="range" id="scrub" min="0" max="1000" value="0">
      <span class="time-label" id="time-label">0.00s / 0.00s</span>
    </div>
    <label>轴</label>
    <select class="ctrl-select" id="axis-select" style="max-width:40px">
      <option value="x">X</option>
      <option value="y">Y</option>
      <option value="z" selected>Z</option>
    </select>
    <label>运动</label>
    <select class="ctrl-select" id="easing-select">
      <option value="back.out(1.7)">微回弹</option>
      <option value="back.out(2.5)">强回弹</option>
      <option value="elastic.out(1,0.2)">弹簧震荡</option>
      <option value="bounce.out">弹跳</option>
      <option value="power3.out" selected>平滑缓出</option>
      <option value="expo.out">指数缓出</option>
      <option value="power3.inOut">缓入缓出</option>
      <option value="none">线性</option>
    </select>
  </div>
  <div class="ctrl-row">
    <label>时长</label>
    <input type="range" id="dur-slider" min="0.3" max="5" step="0.1" value="1.5">
    <span class="value" id="dur-val">1.5s</span>
    <label>扩散</label>
    <input type="range" id="spread-slider" min="1" max="3" step="0.1" value="2">
    <span class="value" id="spread-val">2.0×</span>
  </div>
</div>
`,t=`
#gsap-panel {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(13,13,26,0.6); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;
  padding: 5px 8px; min-width: 260px;
  display: flex; flex-direction: column; gap: 3px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  font-family: 'Segoe UI', system-ui, sans-serif; color: #ccc;
  pointer-events: auto;
}
#gsap-panel .ctrl-row {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
}
#gsap-panel .ctrl-row label {
  font-size: 11px; color: #888; white-space: nowrap;
}
#gsap-panel .ctrl-row .value {
  font-size: 11px; color: #88cc44; font-weight: 600; min-width: 24px;
  text-align: right; font-variant-numeric: tabular-nums;
}
#gsap-panel .btn-icon {
  width: 24px; height: 24px; border-radius: 5px; border: none;
  cursor: pointer; font-size: 12px; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s;
}
#gsap-panel .btn-play { background: #88cc44; color: #0d0d1a; }
#gsap-panel .btn-play:hover { background: #a0e060; }
#gsap-panel .btn-play.paused { background: #ff8844; }
#gsap-panel .btn-play.paused:hover { background: #ffaa66; }
#gsap-panel .btn-icon.secondary { background: rgba(255,255,255,0.08); color: #ccc; }
#gsap-panel .btn-icon.secondary:hover { background: rgba(255,255,255,0.15); }
#gsap-panel .sep-line { border: none; border-top: 1px solid rgba(255,255,255,0.04); margin: 1px 0; }
#gsap-panel .scrub-wrap {
  display: flex; align-items: center; gap: 4px; flex: 1;
}
#gsap-panel .scrub-wrap input[type="range"] { max-width: none; }
#gsap-panel .time-label {
  font-size: 11px; color: #888; min-width: 65px; text-align: right; font-variant-numeric: tabular-nums;
}
#gsap-panel input[type="range"] {
  flex: 1; min-width: 40px; height: 3px; -webkit-appearance: none;
  appearance: none; background: rgba(255,255,255,0.12); border-radius: 2px;
  outline: none; cursor: pointer;
}
#gsap-panel input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%;
  background: #88cc44; cursor: pointer; border: 2px solid #0d0d1a;
  transition: transform 0.1s;
}
#gsap-panel input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
#gsap-panel input[type="range"]::-moz-range-thumb {
  width: 10px; height: 10px; border-radius: 50%;
  background: #88cc44; cursor: pointer; border: 2px solid #0d0d1a;
}
#gsap-panel .ctrl-select {
  padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06); color: #ccc; font-size: 11px; outline: none; cursor: pointer; max-width: 56px;
}
#gsap-panel .ctrl-select:focus { border-color: #88cc44; }
`,a=`
;(function() {
  var gsap = window.__gsap
  var THREE = window.__THREE
  var api = window.viewerAPI || window.__viewerAPI

  if (!gsap || !THREE || !api) {
    console.error('[gsap-explode] Missing dependencies')
    return
  }

  // ---- Cross-demo position reset ----
  function resetPartsPosition() {
    var saved = window.__gsap_initial_positions
    if (saved) {
      var all = api.getParts()
      for (var i = 0; i < all.length; i++) {
        var s = saved[all[i].partId]
        if (s) { var p = api.getPartProxy(all[i].partId); if (p) p.position.set(s[0], s[1], s[2]) }
      }
    } else {
      window.__gsap_initial_positions = {}
      var all = api.getParts()
      for (var i = 0; i < all.length; i++) {
        var p = api.getPartProxy(all[i].partId)
        if (p) window.__gsap_initial_positions[all[i].partId] = [p.position.x, p.position.y, p.position.z]
      }
    }
  }

  var parts = []
  var timeline = null
  var isPlaying = false

  // ---- Find mesh by partId ----
  function findMeshByPartId(partId) {
    var scene = window.__r3f_dev && window.__r3f_dev.scene
    if (!scene) return null
    var found = null
    scene.traverse(function(child) {
      if (found) return
      if (child.isMesh && child.userData && child.userData.partId === partId) {
        found = child
      }
    })
    return found
  }

  // Spread offset = (worldGeomCenter - worldCenterOfMass) × (multiplier - 1)
  // 1× = no offset (parts stay at original position), 2× = double the original spread

  // ---- Build explode data ----
  function buildExplode() {
    resetPartsPosition()
    if (timeline) { timeline.progress(0).kill(); timeline = null }
    isPlaying = false
    var btnPlay = document.getElementById('btn-play')
    btnPlay.textContent = '▶'
    btnPlay.classList.remove('paused')

    var partInfos = api.getParts()
    if (!partInfos || !partInfos.length) {
      return
    }

    var localPositions = []
    var partIds = []

    for (var i = 0; i < partInfos.length; i++) {
      var info = partInfos[i]
      var proxy = api.getPartProxy(info.partId)
      if (!proxy) continue

      var lPos = proxy.position.clone()
      localPositions.push(lPos)
      partIds.push(info.partId)
    }

    if (!partIds.length) {
      return
    }

    console.log('[gsap-explode] parts:', partIds.length, 'first:', partIds[0], 'pos:', localPositions[0].x.toFixed(3), localPositions[0].y.toFixed(3), localPositions[0].z.toFixed(3), 'last:', partIds[partIds.length-1], 'pos:', localPositions[localPositions.length-1].x.toFixed(3), localPositions[localPositions.length-1].y.toFixed(3), localPositions[localPositions.length-1].z.toFixed(3))
    var camera = window.__r3f_dev && window.__r3f_dev.camera
    console.log('[gsap-explode] camera:', !!camera, camera ? 'pos: ' + [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)].join(',') : 'null', camera ? 'fov: ' + camera.fov : '')

    computeTargets(partIds, localPositions, partInfos)

    buildTimeline()
  }

  function computeTargets(partIds, localPositions, partInfos) {
    var axis = document.getElementById('axis-select').value
    var multiplier = parseFloat(document.getElementById('spread-slider').value)

    // Compute world geometric centers via Box3 (geometry-aware, not pivot positions)
    var worldPositions = []
    for (var i = 0; i < partInfos.length; i++) {
      var mesh = findMeshByPartId(partInfos[i].partId)
      if (mesh) {
        var box = new THREE.Box3().setFromObject(mesh)
        worldPositions.push(box.getCenter(new THREE.Vector3()))
      } else {
        worldPositions.push(localPositions[i].clone())
      }
    }

    // Sort by world position on chosen axis
    var indexed = []
    for (var i = 0; i < partIds.length; i++) {
      indexed.push({ idx: i, wVal: worldPositions[i][axis] })
    }
    indexed.sort(function(a, b) { return a.wVal - b.wVal })

    var N = indexed.length
    var worldMin = indexed[0].wVal
    var worldMax = indexed[N - 1].wVal
    var worldRange = worldMax - worldMin
    var worldCenter = (worldMin + worldMax) / 2

    // Overall model bounding box (for fallback when all parts share same position)
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (var i = 0; i < worldPositions.length; i++) {
      var p = worldPositions[i]
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z
    }
    var modelDiagonal = Math.max(maxX - minX || 0, maxY - minY || 0, maxZ - minZ || 0) || 1

    console.log('[gsap-explode] axis:', axis, 'multiplier:', multiplier, 'worldCenter:', worldCenter.toFixed(3), 'worldRange:', worldRange.toFixed(3), 'modelDiagonal:', modelDiagonal.toFixed(3))

    parts = []
    for (var si = 0; si < N; si++) {
      var k = indexed[si].idx
      var lPos = localPositions[k]
      var target = lPos.clone()

      var offset
      if (worldRange < 0.001) {
        // All parts at same world position → spread evenly using model diagonal
        var partCount = N - 1 || 1
        offset = ((si / partCount) - 0.5) * modelDiagonal * Math.max(0, multiplier - 1)
      } else {
        offset = (worldPositions[k][axis] - worldCenter) * Math.max(0, multiplier - 1)
      }
      target[axis] = lPos[axis] + offset

      parts.push({
        partId: partIds[k],
        proxy: api.getPartProxy(partIds[k]),
        localPos: lPos,
        target: target,
        name: partInfos[k].name,
      })
    }

    console.log('[gsap-explode] first 3 targets:', parts.slice(0, 3).map(function(p) { return (p.target[axis]).toFixed(3) }).join(', '), 'last 3:', parts.slice(-3).map(function(p) { return (p.target[axis]).toFixed(3) }).join(', '))
  }

  function buildTimeline() {
    if (!parts.length) return
    if (timeline) { timeline.progress(0).kill(); timeline = null }

    var btnPlay = document.getElementById('btn-play')
    var easing = document.getElementById('easing-select').value
    var duration = parseFloat(document.getElementById('dur-slider').value)

    timeline = gsap.timeline({
      paused: true,
      onComplete: function() {
        isPlaying = false
        btnPlay.textContent = '⟳'
        btnPlay.classList.remove('paused')
      },
    })

    // All parts simultaneously — fromTo to avoid GSAP caching start values at creation
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]
      // Verify proxy.position is a valid THREE.Vector3
      if (!p.proxy || !p.proxy.position || typeof p.proxy.position.x !== 'number') {
        console.log('[gsap-explode] INVALID proxy at index', i, p.partId)
        continue
      }
      timeline.fromTo(p.proxy.position, {
        x: p.localPos.x, y: p.localPos.y, z: p.localPos.z,
      }, {
        x: p.target.x, y: p.target.y, z: p.target.z,
        duration: duration, ease: easing, overwrite: true,
      }, 0)
    }

    console.log('[gsap-explode] timeline built with', timeline.totalDuration().toFixed(3), 's total,', timeline.getChildren ? timeline.getChildren().length + ' children' : '')
    syncUI()
  }

  // ---- Playback ----
  function togglePlay() {
    if (!timeline || !parts.length) return
    var btnPlay = document.getElementById('btn-play')

    if (isPlaying) {
      timeline.pause()
      isPlaying = false
      btnPlay.textContent = '▶'
      btnPlay.classList.remove('paused')
    } else {
      if (timeline.progress() >= 1) timeline.progress(0)
      console.log('[gsap-explode] play, progress:', timeline.progress().toFixed(3), 'duration:', timeline.duration().toFixed(3))
      timeline.play()
      isPlaying = true
      btnPlay.textContent = '⏸'
      btnPlay.classList.add('paused')
    }
  }

  function resetAnim() {
    if (!timeline) return
    var btnPlay = document.getElementById('btn-play')
    timeline.progress(0).pause()
    isPlaying = false
    btnPlay.textContent = '▶'
    btnPlay.classList.remove('paused')
    syncUI()
  }

  function syncUI() {
    var scrub = document.getElementById('scrub')
    var timeLabel = document.getElementById('time-label')
    if (!timeline) { scrub.value = 0; timeLabel.textContent = '0.00s / 0.00s'; return }
    var p = timeline.progress()
    scrub.value = p * 1000
    timeLabel.textContent = (p * timeline.duration()).toFixed(2) + 's / ' + timeline.duration().toFixed(2) + 's'
  }

  // ---- UI Bindings ----
  var btnPlay = document.getElementById('btn-play')
  var btnReset = document.getElementById('btn-reset')
  var scrub = document.getElementById('scrub')
  var easingSelect = document.getElementById('easing-select')
  var durSlider = document.getElementById('dur-slider')
  var spreadSlider = document.getElementById('spread-slider')

  btnPlay.addEventListener('click', togglePlay)
  btnReset.addEventListener('click', resetAnim)

  scrub.addEventListener('input', function() {
    if (!timeline) return
    timeline.progress(scrub.value / 1000).pause()
    isPlaying = false
    btnPlay.textContent = '▶'
    btnPlay.classList.remove('paused')
    syncUI()
  })

  document.getElementById('axis-select').addEventListener('change', function() { buildExplode() })

  easingSelect.addEventListener('change', buildTimeline)

  durSlider.addEventListener('input', function() {
    document.getElementById('dur-val').textContent = parseFloat(durSlider.value).toFixed(1) + 's'
  })
  durSlider.addEventListener('change', buildTimeline)

  spreadSlider.addEventListener('input', function() {
    document.getElementById('spread-val').textContent = parseFloat(spreadSlider.value).toFixed(1) + '×'
  })
  spreadSlider.addEventListener('change', function() { buildExplode() })

  // ---- Keyboard ----
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.key === ' ') { e.preventDefault(); togglePlay() }
    if (e.key === 'r') resetAnim()
    if (e.key === 'ArrowRight' && timeline) {
      var p = Math.min(1, timeline.progress() + 0.02)
      timeline.progress(p).pause()
      isPlaying = false
      btnPlay.textContent = '▶'
      btnPlay.classList.remove('paused')
      syncUI()
    }
    if (e.key === 'ArrowLeft' && timeline) {
      var p = Math.max(0, timeline.progress() - 0.02)
      timeline.progress(p).pause()
      isPlaying = false
      btnPlay.textContent = '▶'
      btnPlay.classList.remove('paused')
      syncUI()
    }
  })

  // ---- Init ----
  buildExplode()
  console.log('[gsap-explode] ready')
})()
`;function i(){return JSON.stringify({type:"3d-viewer",command:"executeCode",params:{html:e,css:t,js:a,mode:"replace"},id:"gsap-explode-"+Date.now()})}export{t as GSAP_EXPLODE_DEMO_CSS,e as GSAP_EXPLODE_DEMO_HTML,a as GSAP_EXPLODE_DEMO_JS,i as buildGSAPExplodePayload};
