const e=`
<div id="gsap-panel">
  <div class="ctrl-row">
    <button class="btn-icon btn-play" id="btn-play" title="播放 (Space)">▶</button>
    <button class="btn-icon secondary" id="btn-reset" title="重置 (R)">⟲</button>
    <div class="scrub-wrap">
      <input type="range" id="scrub" min="0" max="1000" value="0">
      <span class="time-label" id="time-label">0.00s / 0.00s</span>
    </div>
  </div>
  <hr class="sep-line">
  <div class="params-grid">
    <label>Axis</label>
    <select class="ctrl-select" id="axis-select">
      <option value="x">X</option>
      <option value="y">Y</option>
      <option value="z" selected>Z</option>
    </select>
    <span></span>
    <label>Easing</label>
    <select class="ctrl-select" id="easing-select">
      <option value="back.out(1.7)">back.out(1.7) — 微回弹</option>
      <option value="back.out(2.5)">back.out(2.5) — 强回弹</option>
      <option value="elastic.out(1,0.2)">elastic.out — 弹簧震荡</option>
      <option value="bounce.out">bounce.out — 弹跳</option>
      <option value="power3.out" selected>power3.out — 平滑缓出</option>
      <option value="expo.out">expo.out — 指数缓出</option>
      <option value="power3.inOut">power3.inOut — 缓入缓出</option>
      <option value="none">none — 线性</option>
    </select>
    <span></span>
    <label>Duration</label>
    <input type="range" id="dur-slider" min="0.3" max="5" step="0.1" value="1.5">
    <span class="value" id="dur-val">1.5s</span>
    <span></span>
    <label>Spread</label>
    <input type="range" id="spread-slider" min="1" max="3" step="0.1" value="2">
    <span class="value" id="spread-val">2.0×</span>
  </div>
  <div class="ctrl-row" style="justify-content:space-between;">
    <span id="part-info">0 parts</span>
  </div>
</div>
`,a=`
#gsap-panel {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  background: rgba(13,13,26,0.92); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
  padding: 14px 20px; min-width: 400px;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  font-family: 'Segoe UI', system-ui, sans-serif; color: #ccc;
  pointer-events: auto;
}
#gsap-panel .ctrl-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
#gsap-panel .ctrl-row label {
  font-size: 11px; color: #888; white-space: nowrap;
}
#gsap-panel .ctrl-row .value {
  font-size: 11px; color: #88cc44; font-weight: 600; min-width: 36px;
  text-align: right; font-variant-numeric: tabular-nums;
}
#gsap-panel .btn-icon {
  width: 34px; height: 34px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 16px; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s;
}
#gsap-panel .btn-play { background: #88cc44; color: #0d0d1a; }
#gsap-panel .btn-play:hover { background: #a0e060; }
#gsap-panel .btn-play.paused { background: #ff8844; }
#gsap-panel .btn-play.paused:hover { background: #ffaa66; }
#gsap-panel .btn-icon.secondary { background: rgba(255,255,255,0.08); color: #ccc; }
#gsap-panel .btn-icon.secondary:hover { background: rgba(255,255,255,0.15); }
#gsap-panel .sep-line { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0; }
#gsap-panel .scrub-wrap {
  display: flex; align-items: center; gap: 10px; flex: 1;
}
#gsap-panel .time-label {
  font-size: 11px; color: #888; min-width: 100px; text-align: right; font-variant-numeric: tabular-nums;
}
#gsap-panel input[type="range"] {
  flex: 1; min-width: 60px; height: 4px; -webkit-appearance: none;
  appearance: none; background: rgba(255,255,255,0.12); border-radius: 2px;
  outline: none; cursor: pointer;
}
#gsap-panel input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: #88cc44; cursor: pointer; border: 2px solid #0d0d1a;
  transition: transform 0.1s;
}
#gsap-panel input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
#gsap-panel input[type="range"]::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: #88cc44; cursor: pointer; border: 2px solid #0d0d1a;
}
#gsap-panel .ctrl-select {
  padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06); color: #ccc; font-size: 11px; outline: none; cursor: pointer;
}
#gsap-panel .ctrl-select:focus { border-color: #88cc44; }
#gsap-panel .params-grid {
  display: grid; grid-template-columns: auto 1fr auto auto 1fr auto;
  gap: 4px 8px; width: 100%; align-items: center;
}
#gsap-panel #part-info { font-size: 11px; color: #555; white-space: nowrap; }
`,t=`
;(function() {
  var gsap = window.__gsap
  var THREE = window.__THREE
  var api = window.viewerAPI || window.__viewerAPI

  if (!gsap || !THREE || !api) {
    console.error('[gsap-explode] Missing dependencies')
    return
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

  // ---- Range computation ----
  // Spread = model's largest bounding-box dimension × slider (1–5×, centered on model midpoint)

  function getVisibleRangeOnAxis(axis, positions) {
    var multiplier = parseFloat(document.getElementById('spread-slider').value)
    var minVal = Infinity, maxVal = -Infinity
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i]
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z
      if (p[axis] < minVal) minVal = p[axis]; if (p[axis] > maxVal) maxVal = p[axis]
    }
    var axisModelRange = maxVal - minVal
    var maxAxisRange = Math.max(maxX - minX || 0, maxY - minY || 0, maxZ - minZ || 0) || 1
    // 1×: axisModelRange (no visible change)
    // >1×: axisModelRange × multiplier + progressive floor based on model's largest dimension
    //   so flat axes still get visible explosion at higher multipliers
    var base = axisModelRange || (multiplier > 1 ? maxAxisRange : 0)
    var progressive = maxAxisRange * Math.max(0, multiplier - 1) * 0.3
    var range = base * multiplier + progressive
    var mid = (minVal + maxVal) / 2
    // padding: 10% margin at >1× to keep extreme parts off the spread boundary; 0 at 1× for no effect
    var padding = multiplier > 1 ? 0.1 : 0
    return { min: mid - range/2, max: mid + range/2, range: range, padding: padding }
  }

  // ---- Build explode data ----
  function buildExplode() {
    if (timeline) { timeline.progress(0).kill(); timeline = null }
    isPlaying = false
    var btnPlay = document.getElementById('btn-play')
    btnPlay.textContent = '▶'
    btnPlay.classList.remove('paused')

    var partInfos = api.getParts()
    if (!partInfos || !partInfos.length) {
      document.getElementById('part-info').textContent = '0 parts — 请先加载模型'
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
      document.getElementById('part-info').textContent = '0 parts — 未找到零件'
      return
    }

    console.log('[gsap-explode] parts:', partIds.length, 'first:', partIds[0], 'pos:', localPositions[0].x.toFixed(3), localPositions[0].y.toFixed(3), localPositions[0].z.toFixed(3), 'last:', partIds[partIds.length-1], 'pos:', localPositions[localPositions.length-1].x.toFixed(3), localPositions[localPositions.length-1].y.toFixed(3), localPositions[localPositions.length-1].z.toFixed(3))
    var camera = window.__r3f_dev && window.__r3f_dev.camera
    console.log('[gsap-explode] camera:', !!camera, camera ? 'pos: ' + [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)].join(',') : 'null', camera ? 'fov: ' + camera.fov : '')

    computeTargets(partIds, localPositions, partInfos)

    document.getElementById('part-info').textContent = parts.length + ' parts'
    buildTimeline()
  }

  function computeTargets(partIds, localPositions, partInfos) {
    var axis = document.getElementById('axis-select').value
    var vr = getVisibleRangeOnAxis(axis, localPositions)
    var p = vr.padding || 0
    var spreadMin = vr.min + vr.range * p
    var spreadMax = vr.max - vr.range * p
    if (spreadMin > spreadMax) { var _t = spreadMin; spreadMin = spreadMax; spreadMax = _t }

    console.log('[gsap-explode] axis:', axis, 'vr:', (vr.min).toFixed(2), (vr.max).toFixed(2), (vr.range).toFixed(2), 'spread:', (spreadMin).toFixed(2), (spreadMax).toFixed(2))

    var indexed = []
    for (var i = 0; i < partIds.length; i++) {
      indexed.push({ idx: i, axisVal: localPositions[i][axis] })
    }
    indexed.sort(function(a, b) { return a.axisVal - b.axisVal })

    var N = indexed.length
    var centerIdx = Math.floor(N / 2)
    var centerVal = indexed[centerIdx].axisVal
    var origMin = indexed[0].axisVal
    var origMax = indexed[N - 1].axisVal

    console.log('[gsap-explode] orig:', (origMin).toFixed(3), (origMax).toFixed(3), 'center:', (centerVal).toFixed(3))

    parts = []
    for (var si = 0; si < N; si++) {
      var k = indexed[si].idx
      var lPos = localPositions[k]
      var target = lPos.clone()

      // All parts share the same position → spread evenly across range
      if (origMin === origMax) {
        var partCount = N - 1 || 1
        target[axis] = spreadMin + (si / partCount) * (spreadMax - spreadMin)
        parts.push({ partId: partIds[k], proxy: api.getPartProxy(partIds[k]), localPos: lPos, target: target, name: partInfos[k].name })
        continue
      }

      if (lPos[axis] < centerVal) {
        var t = origMin === centerVal ? 0 : (lPos[axis] - origMin) / (centerVal - origMin)
        target[axis] = spreadMin + t * (centerVal - spreadMin)
      } else if (lPos[axis] > centerVal) {
        var t = origMax === centerVal ? 0 : (lPos[axis] - centerVal) / (origMax - centerVal)
        target[axis] = centerVal + t * (spreadMax - centerVal)
      }
      // else: lPos[axis] === centerVal → stays at center (target already = lPos)

      parts.push({
        partId: partIds[k],
        proxy: api.getPartProxy(partIds[k]),
        localPos: lPos,
        target: target,
        name: partInfos[k].name,
      })
    }

    console.log('[gsap-explode] first 3 targets:', parts.slice(0,3).map(function(p) { return (p.target[axis]).toFixed(3) }).join(', '), 'last 3:', parts.slice(-3).map(function(p) { return (p.target[axis]).toFixed(3) }).join(', '))
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
`;function n(){return JSON.stringify({type:"3d-viewer",command:"executeCode",params:{html:e,css:a,js:t,mode:"replace"},id:"gsap-explode-"+Date.now()})}export{a as GSAP_EXPLODE_DEMO_CSS,e as GSAP_EXPLODE_DEMO_HTML,t as GSAP_EXPLODE_DEMO_JS,n as buildGSAPExplodePayload};
