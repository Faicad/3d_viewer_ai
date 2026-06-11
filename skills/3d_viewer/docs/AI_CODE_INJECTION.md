# AI Code Injection（代码注入）🧪

> **实验性功能** — 接口和行为可能在未来版本中调整。

`executeCode` 命令允许 AI 生成 HTML/CSS/JS 并注入到 3D Viewer 中的独立 DOM 层（`#ai-layer`）。注入的代码可调用 `viewerAPI` 方法，以及 `window.__gsap`（GSAP 动画库）和 `window.__THREE`（Three.js 数学工具）。

## 设计哲学

- **独立沙地**：注入的 UI 在 `#ai-layer` 中运行，与主界面互不干扰
- **观察窗**：通过 `viewerAPI` 查询场景状态、控制相机、操作物体 transform
- **直接动画**：`getPartProxy()` 返回真实的 `THREE.Vector3`/`Euler`/`Quaternion` 对象，GSAP 可直接读写，无须胶水代码

## executeCode 命令格式

```json
{
  "type": "3d-viewer",
  "id": "inj-1",
  "command": "executeCode",
  "params": {
    "html": "<button id='btn'>旋转</button>",
    "css": "#btn { position: absolute; bottom: 20px; right: 20px; pointer-events: auto; }",
    "js": "document.getElementById('btn').onclick = () => { ... }",
    "mode": "replace"
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `html` | string | 否 | 注入到 `#ai-layer` 内的 HTML 片段 |
| `css` | string | 否 | CSS 样式（自动加 `#ai-layer` 作用域前缀） |
| `js` | string | 否 | 在页面 context 中执行的 JavaScript |
| `mode` | `"replace"` \| `"append"` \| `"clear"` | 否 | 注入模式，默认 `"replace"` |

**mode 语义**：

| mode | 行为 |
|------|------|
| `"replace"` | 清除 `#ai-layer` 全部子元素、`<style>` 和事件订阅，注入新内容 |
| `"append"` | 保留已有内容，追加到末尾 |
| `"clear"` | 仅清除，忽略 html/css/js 参数 |

## viewerAPI 完整接口

AI 注入的 JS 代码可直接使用 `viewerAPI`（已挂在 `window`），这是 AI 与 3D 场景交互的**唯一契约入口**。

### 场景查询（返回纯数据拷贝）

```js
viewerAPI.getLoadedFiles()
// → [{ id: "uuid", fileName: "model.glb", format: "glb" }]

viewerAPI.getParts()
// → [{ partId: "uuid:part-0", name: "Gear", triangleCount: 2400 }]

viewerAPI.getSceneTree()
// → [{ id: "file:uuid", name: "model.glb", visible: true, children: [...] }]

viewerAPI.getCameraState()
// → { position: [5, 4, 8], target: [0, 0, 0], mode: "perspective" }

viewerAPI.getSelection()
// → ["uuid:part-0"]
```

### 坐标投影

```js
viewerAPI.worldToScreen(x, y, z)
// → { x: 320, y: 240 } | null

viewerAPI.screenToWorld(screenX, screenY)
// → { origin: [0,0,5], direction: [0.1, 0.2, -1] } | null
```

### 相机操作

```js
viewerAPI.setCameraPosition([5, 4, 8], [0, 0, 0])
viewerAPI.zoomToFit(/* padding?: number */)
viewerAPI.zoomToPart("uuid:part-0")
```

### 选择与高亮

```js
viewerAPI.highlightPart("uuid:part-0", /* color?: string */)
viewerAPI.clearHighlight()
```

### getPartProxy() — GSAP 直接操作

`getPartProxy()` 返回真实的 `THREE.Vector3`/`THREE.Euler`/`THREE.Quaternion` 对象，**GSAP 可直接读写**。这是实现动画控制 UI 的核心能力。

```js
const part = viewerAPI.getPartProxy("uuid:part-0")
// part.position → THREE.Vector3  { x, y, z }
// part.rotation → THREE.Euler    { x, y, z, order }
// part.quaternion → THREE.Quaternion
// part.scale → THREE.Vector3    { x, y, z }

// 特殊值 "__model__" 返回整个模型组的引用
const model = viewerAPI.getPartProxy("__model__")
```

有了 `getPartProxy`，AI 代码可以直接将 GSAP tween 到这些对象上：

```js
// AI 注入的代码 — 直接用 GSAP 操作真实对象
const gsap = window.__gsap
const part = viewerAPI.getPartProxy("uuid:part-0")

// 基本动画
gsap.to(part.rotation, { y: Math.PI * 2, duration: 2, ease: "elastic.inOut(1,0.3)" })

// Timeline
const tl = gsap.timeline({ repeat: -1, yoyo: true })
tl.to(part.position, { x: 10, duration: 1 })
  .to(part.position, { y: 5, duration: 0.5 }, "-=0.3")

// Stagger
const all = ["part-0", "part-1", "part-2"].map(id => viewerAPI.getPartProxy(id))
gsap.from(all.map(p => p.position), { y: -5, duration: 0.5, stagger: 0.1 })
```

### setPartTransform() — 纯数据写入

当不需要持有对象引用时，可以通过纯数据方式设置 transform：

```js
viewerAPI.setPartTransform("__model__", {
  quaternion: [0, 0.707, 0, 0.707],  // [x, y, z, w]
  // position: [1, 2, 3],
  // scale: [1, 1, 1],
})
```

### 事件订阅

```js
viewerAPI.on("animationTick", () => {
  // 每帧触发（rAF 驱动）
})
viewerAPI.on("cameraChange", () => {
  // 相机变化时触发（每 10 帧采样）
})
viewerAPI.on("selectionChange", () => {
  // 选择变化时触发
})
```

## 全局可用变量

AI 注入的 JS 代码可直接使用以下全局变量：

| 变量 | 说明 |
|------|------|
| `viewerAPI` / `window.__viewerAPI` | 3D 场景桥接接口 |
| `window.__gsap` | GSAP 动画库（`gsap.to()` / `gsap.timeline()` 等全部 API） |
| `window.__THREE` | Three.js 模块（`new THREE.Vector3()`、`new THREE.Quaternion()` 等数学工具） |

## 内置 Demo 案例

三份完整案例可直接 `node` 执行注入 viewer：

```bash
node demos/gsap-rotate-demo.mjs    # 旋转控制面板
node demos/gsap-assemble-demo.mjs  # 装配动画
node demos/gsap-explode-demo.mjs   # 爆炸图动画
```

默认请求 `localhost:4273`（skill 默认端口）；可用 `VIEWER_PORT` 环境变量或传参覆盖：

```bash
VIEWER_PORT=5173 node demos/gsap-rotate-demo.mjs
```

### gsap-rotate-demo — 旋转控制面板

- 🎮 播放/暂停按钮、进度条
- ⏩ 速度滑块 (0–4x)、方向切换
- 📷/🧊 相机环绕 / 物体自转 模式切换
- 🪄 X/Y/Z 旋转轴选择
- 🎨 8 种缓动函数
- ⌨️ 空格键播放/暂停，R 键重置

### gsap-assemble-demo — 装配动画

- 📦 零件按包围盒 Z 轴排序，自下而上逐个落位
- 📏 落高倍率调节（1–5×）
- ⏱ 单零件时长调节（0.2–3s）
- 🎨 7 种着陆缓动（back.out / elastic / bounce / power3 / expo / 线性）
- 🎮 播放/暂停、进度条拖拽
- ⌨️ 空格键播放/暂停，R 键重置

### gsap-explode-demo — 爆炸图动画

- 💥 零件以场景中心为原点，沿径向飞散
- 📏 飞散距离倍率（0.2–5×）
- ⏱ 单零件时长（0.3–5s）
- ⏳ 交错延迟 stagger（0–0.8s）
- 🎨 8 种缓动函数
- 🎮 播放/暂停、进度条拖拽
- ⌨️ 空格键播放/暂停，R 键重置，← → 逐帧步进

三个案例完整演示了如何通过 `executeCode` 注入自定义 UI、利用 `viewerAPI.getPartProxy()` 配合 GSAP 实现复杂动画。

## 注入 UI 的 CSS 注意事项

- `#ai-layer` 默认 `pointer-events: none`（点击穿透到 3D 视口），按钮/输入框需设置 `pointer-events: auto`
- AI 提供的 CSS 自动加 `#ai-layer` 前缀，不会影响主界面样式
