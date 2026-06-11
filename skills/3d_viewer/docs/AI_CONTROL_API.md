# 3D Viewer AI 控制接口

## 概述

三种方式控制查看器：

- **URL 参数**：页面加载时自动设置初始状态（语言、主题、环境贴图、自动加载模型）
- **HTTP API**（推荐）：`serve.mjs` 内置 SSE 桥，AI 通过 `curl` 发送命令，浏览器实时执行。无需浏览器 JS 能力。
- **postMessage API**：同窗口内实时控制

---

## 一、模型加载

将模型文件复制到服务目录下的 `models/`，然后通过 URL 参数或 API 命令加载。

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# 打开 http://localhost:4273/#/workspace?url=./models/model.stl
```

支持格式：GLB、glTF、STEP、STP、STL、OBJ、3MF、FBX、PLY，以及其他 Three.js 支持的格式。

STEP/STP 文件在加载时自动通过 OCCT WASM 转换为 GLB 再渲染。

HDR/EXR 环境贴图同样处理（复制到 `models/` 后通过 `loadEnvFile` 命令加载）。

---

## 二、URL 参数（初始状态）

```
http://localhost:4273/#/workspace?url=<path>&theme=dark&lang=zh&env=studio
```

| 参数 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| `url` | string | 服务目录下的相对路径 | — | 页面加载后自动加载该模型 |
| `theme` | string | `light` / `dark` / `system` | `system` | 界面主题 |
| `lang` | string | `zh` / `en` / `es` / `ja` / `ko` / `fr` / `de` / `pt` / `ru` / `ar` / `hi` / `id` / `tr` / `it` / `nl` / `pl` / `vi` / `th` / `uk` / `sv` | 浏览器语言 | 界面语言 |
| `env` | string | `studio` / 任意 HDR URL | `studio` | 环境贴图。支持 Poly Haven 等支持 CORS 的 CDN 链接 |

---

## 三、SSE/HTTP 桥接（跨进程控制）

`serve.mjs` 内置 SSE 桥，解决 AI 进程与浏览器进程隔离的问题：

```
AI (curl) ──POST /api/command──→ serve.mjs ──SSE──→ 浏览器执行
```

### 请求格式

所有命令**必须携带 `id`**，serve.mjs 等待浏览器回传结果后返回。超时 30 秒。

```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"req-001","command":"getTheme","params":{}}'
# 响应: {"status":"ok","delivered":1,"result":{"theme":"dark"}}
# 超时（30s）: {"status":"error","delivered":1,"error":"Command timeout: getTheme"}
```

#### 异步命令说明

`loadModel` 是异步命令。SSE handler 会 `await` 直到模型完全加载（含 STEP→GLB 转换），然后 POST `/api/result` 唤醒 MCP Promise。因此 `loadModel` 请求会阻塞到模型真正可用才返回，response 中直接包含完整的模型信息。

#### 错误响应

| 状态码 | 条件 | 响应体 |
|--------|------|--------|
| 400 | JSON 格式错误 | `{"error":"Invalid JSON"}` |
| 503 | 无 SSE 客户端连接 | `{"status":"error","error":"No connected clients","delivered":0}` |
| 504 | 同步模式超时（30s） | `{"status":"error","delivered":N,"error":"Command timeout: <cmd>"}` |

### 命令格式

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定 `"3d-viewer"` |
| `command` | string | 是 | 命令名称 |
| `id` | string | 是 | 请求 ID。serve.mjs 等待浏览器回传结果后同步返回 |
| `params` | object | 否 | 命令参数 |

> 命令列表与 postMessage API 完全一致，见下文。

---

## 四、postMessage API（同窗口控制）

### 协议格式

#### 请求
```js
window.postMessage({
  type: '3d-viewer',
  id: 'req-001',
  command: 'setTheme',
  params: { value: 'dark' }
}, '*')
```

#### 响应
```js
{
  type: '3d-viewer',
  id: 'req-001',
  command: 'setTheme',
  status: 'success' | 'error',
  data: { theme: 'dark' }
}
```

异步命令（`loadModel`）即时返回 `{ loading: true }`，AI 通过 SSE 通道使用时可忽略此差异（SSE 会 await 完整结果）。

---

### 命令列表

#### 模型控制

| 命令 | 参数 | 说明 | 状态 |
|------|------|------|------|
| `loadModel` | `{ url: string }` 或 `{ data: string }` | 从 URL 或 base64 data URL 加载模型。STEP 自动转换为 GLB | ✅ 已实现 |
| `getModelInfo` | — | 获取当前模型信息（fileName、format、partCount、parts、animations） | ✅ 已实现 |
| `resetViewer` | — | 清空场景、清除选中、重置动画状态 | ✅ 已实现 |

#### 主题

| 命令 | 参数 | 说明 |
|------|------|------|
| `setTheme` | `{ value: 'light' \| 'dark' \| 'system' }` | 切换主题 |
| `getTheme` | — | 获取当前主题 |

#### 语言

| 命令 | 参数 | 说明 |
|------|------|------|
| `setLanguage` | `{ value: string }` | 切换界面语言 |
| `getLanguage` | — | 获取当前语言 |

#### 环境贴图

| 命令 | 参数 | 说明 |
|------|------|------|
| `setEnv` | `{ value: string }` | 切换环境贴图（`studio`、`custom_N`、或 HDR URL） |
| `getEnv` | — | 获取当前环境贴图 ID |
| `setEnvIntensity` | `{ value: number }` | 设置环境强度 0-5 |
| `setEnvRotation` | `{ value: number }` | 旋转环境贴图（弧度） |
| `loadEnvFile` | `{ url: string, name: string }` | 加载自定义 HDR/EXR |

#### 材质控制

| 命令 | 参数 | 说明 |
|------|------|------|
| `getMaterialPresets` | — | 获取所有内置材质预设（名称 → 完整 MaterialAppearance 字典） |
| `setPartMaterialByPreset` | `{ preset: string, partName?: string }` | 应用内置预设到指定零件 |
| `setPartMaterial` | `{ appearance: MaterialAppearance, partName?: string }` | 应用自定义材质到指定零件 |
| `getPartMaterial` | `{ partName?: string }` | 获取指定零件的当前材质状态 |

##### 零件材质定位规则

`partName` 是**场景树中显示的零件名**（`GlbPartInfo.name`）。不传时按以下优先级自动确定目标：

| 优先级 | 条件 | 行为 |
|--------|------|------|
| 1 | 指定了 `partName` | 按名称匹配（重名取首个） |
| 2 | 有选中（`selectedReferenceIds` 非空） | 该节点下所有零件，支持零件/文件/组 |
| 3 | 未选中 | 当前活跃文件 → 其下所有零件 |

> **提示**：`getModelInfo` 返回每个零件的 `name`（场景树显示名）和 `partId`。

##### 预设 vs 自定义材质

- **`setPartMaterialByPreset`** — 从内置预设库中选择，系统记录该零件使用的是哪个 preset
- **`setPartMaterial`** — 传入任意 MaterialAppearance，系统标记该零件为"自定义材质"（清掉 preset 引用）

`getPartMaterial` 的返回值会区分这两种情况：

```typescript
{
  fileId: "...",
  parts: [
    { partId: "...", partName: "Box",
      override: { name:"Chrome", metalness:1, roughness:0.02, ... },
      original: { ... },
      preset: "chrome" },
    { partId: "...", partName: "Lid",
      override: { name:"Chrome", ... },
      original: { ... },
      preset: "chrome" },
  ],
  partCount: 2
}
```

##### MaterialAppearance 结构

```typescript
{
  name?: string
  color?: [number, number, number, number]   // RGBA 0-1
  metalness?: number       // 0-1
  roughness?: number       // 0-1
  transmission?: number    // 0-1
  thickness?: number
  ior?: number
  emissive?: [number, number, number]
  emissiveIntensity?: number
  clearcoat?: number
  clearcoatRoughness?: number
  sheen?: number
  sheenColor?: [number, number, number]
  anisotropy?: number
  doubleSided?: boolean
}
```

> **建议**：优先使用 `setPartMaterialByPreset`。AI 应先调用 `getMaterialPresets` 了解可用预设（29 个，覆盖金属/塑料/玻璃/橡胶/油漆等），按名字匹配后应用。

##### `getMaterialPresets` 返回结构

```typescript
{
  presets: {
    chrome:        { name:"Chrome",         color:[0.95,0.95,0.96], metalness:1.0, roughness:0.02 },
    gold:          { name:"Gold",           color:[1.0,0.84,0.0],   metalness:1.0, roughness:0.1 },
    // ...共 29 个预设
  }
}
```

#### 动画控制

| 命令 | 参数 | 说明 |
|------|------|------|
| `getAnimationInfo` | — | 获取动画列表和播放状态 |
| `playAnimation` | — | 播放当前选中动画 |
| `pauseAnimation` | — | 暂停播放 |
| `stopAnimation` | — | 停止并回到起点 |
| `selectAnimation` | `{ index: number }` | 选择第 N 个动画片段（从 0 开始） |
| `seek` | `{ time: number }` | 跳转到指定时间点（秒） |
| `setSpeed` | `{ value: number }` | 设置播放速度倍数 |
| `setAnimationMaximized` | `{ value: boolean }` | 最大化/还原动画窗口 |

#### 相机

| 命令 | 参数 | 说明 |
|------|------|------|
| `setCameraPosition` | `{ position: [x,y,z], target?: [x,y,z] }` | 设置相机位置和观察目标 |
| `resetCamera` | — | 重置相机到默认位置 `(0, -6, 4)`，看向原点 |
| `zoomToFit` | `{ padding?: number }` | 缩放适配所有可见几何体（`padding` 默认 1.5） |
| `setCameraMode` | `{ value: 'perspective' \| 'orthographic' }` | 切换透视/正交投影 |

#### 选择 & 工具

| 命令 | 参数 | 说明 |
|------|------|------|
| `clearSelection` | — | 清除选中 |
| `getSelection` | — | 获取当前选中部件列表 |
| `setActiveTool` | `{ value: 'view' \| 'objectTransform' }` | 切换查看/变换工具 |
| `setTransformMode` | `{ value: 'translate' \| 'rotate' \| 'scale' }` | 设置变换 gizmo 模式 |

#### UI 面板

| 命令 | 参数 | 说明 |
|------|------|------|
| `toggleRightPanel` | — | 切换右侧场景树面板 |

#### 截屏

| 命令 | 参数 | 说明 |
|------|------|------|
| `takeScreenshot` | `{ width?: number, height?: number }` | 截取当前视口，返回 base64 PNG data URL |

#### 代码注入（AI 生成自定义 UI）

| 命令 | 参数 | 说明 |
|------|------|------|
| `executeCode` | `{ html?: string, css?: string, js?: string, mode?: 'replace' \| 'append' \| 'clear' }` | 在 `#ai-layer` 中注入 AI 生成的 UI，可操作场景 |

> `executeCode` 是 AI 生成自定义 UI 的核心入口。详见 [八、AI Code Injection](#八ai-code-injection代码注入)。

---

## 五、反射 API（安全动态调用）

类似 Java 运行时反射，AI 可动态发现和调用 Store 对象的方法与属性，**无需预定义命令**，且**不可执行任意代码**（无 `eval` / `new Function`）。

### 已注册的安全对象

| 对象名 | 说明 |
|--------|------|
| `ui` | UI store：theme、language、面板可见性、camera mode |
| `model` | 3D 模型 store：已加载文件、场景树、零件信息、加载状态 |
| `engine` | 3D 引擎 store：环境贴图、阴影、地板、模型变换 |
| `animation` | 动画 store：动画片段、播放状态、速度、当前时间 |
| `material` | 材质 store：覆盖层、预设、纹理状态 |
| `selection` | 选择 store：悬停/选中的 reference ID |
| `tool` | 工具 store：变换模式、选择模式、活跃工具 |
| `svg` | SVG workspace store：导入的 SVG 文件 |
| `r3f` | Three.js 运行时引用：camera、scene、renderer、controls（只读） |

### 命令列表

| 命令 | 参数 | 说明 |
|------|------|------|
| `listReflectObjects` | — | 列出所有可反射的对象 |
| `inspectReflectObject` | `{ objectName: string }` | 列出指定对象的所有公开方法和属性 |
| `invokeReflectMethod` | `{ objectName, method, args? }` | 调用指定对象的方法 |
| `getReflectProperty` | `{ objectName, property }` | 读取指定对象的属性值 |
| `setReflectProperty` | `{ objectName, property, value }` | 设置属性值（⚠️ 优先用 `invokeReflectMethod` 调用官方 action） |

### 安全限制

- 仅允许调用 **已注册对象** 的成员
- 内置 `constructor`、`__proto__`、`call`/`apply`/`bind`、`toString`、`valueOf` 等 **39 个危险方法被锁定**
- 以下划线 `_` 开头的成员被屏蔽
- 返回结果深度限制 5 层，复杂对象自动安全序列化

### 示例

```bash
# 1. 发现可用对象
curl -X POST http://localhost:4273/api/command \
  -d '{"type":"3d-viewer","id":"r1","command":"listReflectObjects"}'
# → [{name:"ui",description:"..."}, ...]

# 2. 查看 ui 对象的方法和属性
curl -X POST http://localhost:4273/api/command \
  -d '{"type":"3d-viewer","id":"r2","command":"inspectReflectObject","params":{"objectName":"ui"}}'
# → {methods:["setTheme","setLanguage",...], properties:["theme","language",...]}

# 3. 调用方法
curl -X POST http://localhost:4273/api/command \
  -d '{"type":"3d-viewer","id":"r3","command":"invokeReflectMethod","params":{"objectName":"ui","method":"setTheme","args":["dark"]}}'

# 4. 读取属性
curl -X POST http://localhost:4273/api/command \
  -d '{"type":"3d-viewer","id":"r4","command":"getReflectProperty","params":{"objectName":"ui","property":"theme"}}'
# → {objectName:"ui", property:"theme", value:"dark"}
```

> **设计目标**：替代 `runJS`/`eval` 方案，提供受控的反射能力。AI 可以像 Java 反射那样先 `inspectReflectObject` 了解 API 面，再 `invokeReflectMethod` 调用。同时保留现有预定义命令（`setTheme`、`loadModel` 等）作为常用操作的快捷方式。
>
> **什么时候用反射，什么时候用预定义命令？**
> - 标准操作（加载模型、切换主题、材质控制等）→ 用预定义命令（更稳定、返回结构更友好）
> - 实验性操作、读取未在预定义命令中暴露的 state → 用反射 API

---

## 六、loadModel 命令详解

### 请求

```js
{ type: '3d-viewer', id: 'load-1', command: 'loadModel', params: { url: 'https://example.com/model.glb' } }
// 或 base64 数据（小文件）：
{ type: '3d-viewer', id: 'load-1', command: 'loadModel', params: { data: 'data:model/gltf-binary;base64,...' } }
```

### 响应（SSE/HTTP 通道）

SSE handler `await` 异步结果，阻塞直到模型完全加载后返回：

```json
{
  "status": "success",
  "data": {
    "fileId": "uuid",
    "fileName": "model.glb",
    "format": "glb",
    "sourceUnit": "mm",
    "partCount": 3,
    "parts": [{ "partId": "0", "name": "Part1", "triangleCount": 1200 }, ...],
    "animations": [{ "name": "Take 001", "duration": 2.5 }]
  }
}
```

### 执行流程

1. AI 调用 MCP `load_model` → POST `/api/command` → serve.mjs SSE 到浏览器
2. 浏览器 SSE handler `await executeCommand(msg)`
3. `loadModel` 返回 Promise，内部执行 `fetch` → `detectFormat` → (可选 STEP→GLB 转换) → `loadFormat` → `addLoadedFile`
4. 完成后 handler POST `/api/result`，serve.mjs 唤醒 MCP Promise
5. AI 拿到包含 `{ fileId, fileName, format, partCount, parts }` 的完整响应

---

## 七、AI 完整调用流程

```bash
# 1. 复制文件到服务目录
cp /path/to/model.stl <skill_dir>/models/

# 2. 启动服务
node <skill_dir>/scripts/serve.mjs

# 3. 打开浏览器
# http://localhost:4273/#/workspace?url=./models/model.stl&theme=dark&lang=zh

# 4. 远程控制
curl -X POST http://localhost:4273/api/command \
  -d '{"command":"setTheme","params":{"value":"dark"}}'

# 5. 关闭服务
```

---

## 八、AI Code Injection（代码注入）

`executeCode` 命令允许 AI 生成 HTML/CSS/JS 并注入到 3D Viewer 中的独立 DOM 层（`#ai-layer`）。注入的代码可调用**所有前线命令**对应的 `viewerAPI` 方法，以及 `window.__gsap`（GSAP 动画库）和 `window.__THREE`（Three.js 数学工具）。

### 设计哲学

- **独立沙地**：注入的 UI 在 `#ai-layer` 中运行，与主界面互不干扰
- **观察窗**：通过 `viewerAPI` 查询场景状态、控制相机、操作物体 transform
- **直接动画**：`getPartProxy()` 返回真实的 `THREE.Vector3`/`Euler`/`Quaternion` 对象，GSAP 可直接读写，无须胶水代码

### executeCode 命令格式

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

### viewerAPI 完整接口

AI 注入的 JS 代码可直接使用 `viewerAPI`（已挂在 `window`），这是 AI 与 3D 场景交互的**唯一契约入口**。

#### 场景查询（返回纯数据拷贝）

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

#### 坐标投影

```js
viewerAPI.worldToScreen(x, y, z)
// → { x: 320, y: 240 } | null

viewerAPI.screenToWorld(screenX, screenY)
// → { origin: [0,0,5], direction: [0.1, 0.2, -1] } | null
```

#### 相机操作

```js
viewerAPI.setCameraPosition([5, 4, 8], [0, 0, 0])
viewerAPI.zoomToFit(/* padding?: number */)
viewerAPI.zoomToPart("uuid:part-0")
```

#### 选择与高亮

```js
viewerAPI.highlightPart("uuid:part-0", /* color?: string */)
viewerAPI.clearHighlight()
```

#### 动画：getPartProxy() — GSAP 直接操作

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

有了 `getPartProxy`，AI 代码可以直接将 GSAP tween 到这些对象上，**与源码中写 GSAP 的代码完全一致**：

```js
// AI 注入的代码 — 和项目源码里写 GSAP 一模一样
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

#### 动画：setPartTransform() — 纯数据写入

当不需要持有对象引用时，可以通过纯数据方式设置 transform：

```js
viewerAPI.setPartTransform("__model__", {
  quaternion: [0, 0.707, 0, 0.707],  // [x, y, z, w]
  // position: [1, 2, 3],   // 可选
  // scale: [1, 1, 1],       // 可选
})
```

#### 事件订阅

```js
const unsub = viewerAPI.on("animationTick", () => {
  // 每帧触发（rAF 驱动）
})
viewerAPI.on("cameraChange", () => {
  // 相机变化时触发（每 10 帧采样）
})
viewerAPI.on("selectionChange", () => {
  // 选择变化时触发
})
```

### 全局可用变量

AI 注入的 JS 代码可直接使用以下全局变量：

| 变量 | 说明 |
|------|------|
| `viewerAPI` / `window.__viewerAPI` | 3D 场景桥接接口 |
| `window.__gsap` | GSAP 动画库（`gsap.to()` / `gsap.timeline()` 等全部 API） |
| `window.__THREE` | Three.js 模块（`new THREE.Vector3()`、`new THREE.Quaternion()` 等数学工具） |

### 完整案例：GSAP 旋转控制面板

文件位置：`skills/3d_viewer/demos/gsap-rotate-demo.html`

功能：
- 🎮 播放/暂停按钮
- ⏩ 速度滑块 (0–4x)
- 🔄 方向切换
- 📷/🧊 相机环绕 / 物体自转 模式切换
- 🪄 X/Y/Z 旋转轴选择
- 🎨 8 种缓动函数（linear / power1-3 / sine / expo / back / elastic / bounce）
- ⌨️ 空格键播放/暂停

该案例完整展示了如何使用 `executeCode` 注入自定义 UI、利用 `viewerAPI` 控制场景、以及通过 `window.__gsap` 实现复杂动画效果。AI 可直接参考该文件的结构生成类似的控制面板。

### 注入 UI 的 CSS 注意事项

- `#ai-layer` 默认 `pointer-events: none`（点击穿透到 3D 视口），按钮/输入框需设置 `pointer-events: auto`
- AI 提供的 CSS 自动加 `#ai-layer` 前缀，不会影响主界面样式
- Tailwind CSS 样式不会影响 `#ai-layer`（Tailwind 的 `@source` 不扫描注入的 HTML）
