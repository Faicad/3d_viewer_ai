# 3D Viewer AI 控制接口

## 概述

三种方式控制查看器：

- **URL 参数**：页面加载时自动设置初始状态（语言、主题、环境贴图、自动加载模型）
- **HTTP API**（推荐）：`serve.mjs` 内置 SSE 桥，AI 通过 `curl` 发送命令，浏览器实时执行。无需浏览器 JS 能力。
- **postMessage API**：同窗口/iframe 内实时控制

---

## 一、模型加载

AI 将模型文件复制到服务目录下的 `models/`，然后通过 URL 参数或 API 命令加载。

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# 打开 http://localhost:4273/#/workspace?url=./models/model.stl
```

HDR/EXR 环境贴图同样处理（复制到 `models/` 后通过 `loadEnvFile` 命令加载）：

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
| `env` | string | `studio` / `studio_small_08` / 任意 HDR URL | `studio` | 环境贴图。支持 Poly Haven 等支持 CORS 的 CDN 链接，例如 `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloppenheim_02_2k.hdr` |

---

## 三、SSE/HTTP 桥接（跨进程控制）

`serve.mjs` 内置 SSE 桥，解决 AI 进程与浏览器进程隔离的问题：

```
AI (curl) ──POST /api/command──→ serve.mjs ──SSE──→ 浏览器执行
```

### 两种模式

根据是否提供 `id` 字段，API 分两种模式：

#### 模式 A：Fire-and-Forget（无 `id`）

适用于 `setTheme`、`playAnimation`、`toggleLeftPanel` 等**设置类命令**，不关心返回值。

```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","command":"setTheme","params":{"value":"dark"}}'
# 响应: {"status":"ok","delivered":1}
```

#### 模式 B：同步等待（有 `id`）

适用于 `getTheme`、`getEnv`、`takeScreenshot` 等**需要浏览器返回数据**的命令。

```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"req-001","command":"getTheme","params":{}}'
# 响应: {"status":"ok","delivered":1,"result":{"theme":"dark"}}
# 超时（30s）: {"status":"error","delivered":1,"error":"Command timeout: getTheme"}
```

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
| `id` | string | 否 | 请求 ID。提供时进入**同步模式**，serve.mjs 等待浏览器回传结果；省略则为 **fire-and-forget** |
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

---

### 命令列表

#### 模型控制

| 命令 | 参数 | 说明 |
|------|------|------|
| `loadModel` | `{ url: string }` | 加载模型文件（服务目录下相对路径） |
| `getModelInfo` | — | 获取当前模型信息 |

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
| `setEnv` | `{ value: string }` | 切换环境贴图（`studio`、`studio_small_08`、`custom_N`） |
| `getEnv` | — | 获取当前环境贴图 ID |
| `setEnvIntensity` | `{ value: number }` | 设置环境强度 0-5 |
| `setEnvRotation` | `{ value: number }` | 旋转环境贴图（弧度） |
| `loadEnvFile` | `{ url: string, name: string }` | 加载自定义 HDR/EXR |

#### 材质控制

| 命令 | 参数 | 说明 |
|------|------|------|
| `setDefaultMaterial` | `{ appearance: MaterialAppearance }` | 设置全局默认材质 |
| `clearDefaultMaterial` | — | 清除全局默认材质 |
| `clearAllOverrides` | — | 清除所有材质覆盖 |
| `toggleOverrideMaterial` | `{ enabled: boolean }` | 全局开关材质覆盖 |
| `getMaterialPresets` | — | 获取内置材质预设列表 |
| `applyMaterialPreset` | `{ name: string }` | 应用内置材质预设 |

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

#### 相机

| 命令 | 参数 | 说明 |
|------|------|------|
| `resetCamera` | — | 重置相机适配模型 |
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
| `toggleLeftPanel` | — | 切换左侧面板 |
| `toggleRightPanel` | — | 切换右侧面板 |
| `toggleModelInfo` | — | 切换模型信息面板 |
| `toggleEnvPanel` | — | 切换环境面板 |

#### 截屏

| 命令 | 参数 | 说明 |
|------|------|------|
| `takeScreenshot` | — | 截取当前视口，返回 base64 PNG data URL |

---

### 事件（查看器 → AI）

| 事件 | data | 触发时机 |
|------|------|----------|
| `modelLoaded` | `{ format, fileName, vertexCount, faceCount }` | 模型加载成功 |
| `modelError` | `{ error }` | 模型加载失败 |
| `loadProgress` | `{ message, percentage? }` | 加载进度更新 |
| `selectionChanged` | `{ selectedIds }` | 用户选中部件 |
| `themeChanged` | `{ theme }` | 主题变更 |
| `languageChanged` | `{ language }` | 语言变更 |
| `animationStateChanged` | `{ isPlaying, currentTime }` | 动画状态变化 |

```js
window.addEventListener('message', (event) => {
  if (event.data?.type !== '3d-viewer') return
  const msg = event.data
  if (msg.event === 'modelLoaded') {
    console.log('模型已加载:', msg.data.fileName)
  }
})
```

---

## 五、AI 完整调用流程

```bash
# 1. 确认文件存在
# 2. 复制文件到服务目录
cp /path/to/model.stl <skill_dir>/models/

# 3. 启动服务
node <skill_dir>/scripts/serve.mjs

# 4. 打开浏览器
# http://localhost:4273/#/workspace?url=./models/model.stl&theme=dark&lang=zh

# 5. （可选）远程控制
curl -X POST http://localhost:4273/api/command \
  -d '{"command":"setTheme","params":{"value":"dark"}}'

# 6. 关闭服务
```
