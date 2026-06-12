---
name: 3d_viewer
description: >-
  直接在本地查看 3D 模型文件，无需安装其它大型软件。支持 STL/3MF/STEP/STP/GLB/GLTF/OBJ/PLY/FBX/USDZ/SCAD 等 30+ 种格式。
  支持通过自然语言生成 3D 模型（OpenSCAD）。支持材质编辑、环境贴图、动画播放、线框/拓扑叠加、测量等。
  触发词：查看这个3D模型, 打开这个STL文件, 浏览STEP模型, 3D模型查看, 生成一个模型, 做一个螺栓, view this 3D model, open stl file,
license: LGPL-2.0-only
compatibility:
  - opencode
  - claude
metadata:
  formats: "stl,3mf,step,stp,glb,gltf,obj,ply,fbx,usdz,scad,3ds,dae,drc,dxf,svg,hdr,exr"
  features: "url-auto-load,drag-and-drop,STEP-topology,wireframe,material-editor,environment-maps,measurement,ai-model-generation"
---

# 3D 模型查看器

一个基于浏览器的全功能 3D 模型文件查看器。支持 30+ 种文件格式，实时 3D 渲染。
通过 `?url=` 参数可自动加载模型，用户打开浏览器后直接看到模型，无需手动拖放。
支持 AI 通过 OpenSCAD 代码实时生成 3D 模型——用自然语言描述形状，AI 将其编译为可见模型。

## 支持格式

| 类别 | 格式 |
|------|------|
| CAD | STEP/STP, 3MF, STL, OBJ, PLY, FBX, DAE, 3DS, IFC, 3DM |
| 编程式建模 | SCAD（OpenSCAD — AI 可通过代码生成模型） |
| 3D 图形 | GLB/GLTF, USDZ, DRC, BVH, VTK, XYZ, PDB |
| 其他 | NRRD, GCode, WRL, VOX, KMZ, AMF, LWO, MD2, PCD |
| 2D | SVG, DXF |
| 环境贴图 | HDR, EXR |

## 工作流程

当用户要求查看一个 3D 模型文件时（通过路径或文件名），执行以下步骤：

### 第 1 步：确认文件存在
确认用户提到的模型文件路径存在，记录其绝对路径。

### 第 2 步：复制文件到服务目录
```bash
cp "<model_file_path>" <skill_dir>/models/
```


### 第 3 步：启动本地 HTTP 服务（后台运行，禁止设置超时）

根据操作系统选择对应方式：

**Windows：**
```powershell
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "<skill_dir>/scripts/serve.mjs"
```

**macOS / Linux：**
```bash
nohup node "<skill_dir>/scripts/serve.mjs" > /dev/null 2>&1 &
```

> 无论哪种方式，启动后都应验证端口 4273 是否在监听（如 `netstat -ano | findstr :4273`）。

HTTP 服务是长驻进程，必须在后台启动。**不要**直接在前台运行，否则 bash 超时后会杀死进程。


端口默认 **4273**（`PORT=4174 node ...` 可指定其他端口）。

这个服务同时提供 **HTTP API**，AI 可通过 `curl` 远程控制查看器（请始终携带 `id` 以获取同步返回结果）：
```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"req-001","command":"setTheme","params":{"value":"dark"}}'
```
浏览器通过 SSE (`/api/events`) 实时接收命令并执行。详见下方第 5 步。

> 如果 `scripts/serve.mjs` 不可用（非 Node.js 环境），也可以用`python -m http.server 4273` 替代——但会失去 HTTP API 远程控制能力。


### 第 4 步：打开浏览器自动加载模型
用系统默认的浏览器打开下面的链接，带上 `?url=` 参数：

```
http://localhost:4273/#/workspace?url=./models/<文件名>
```

用户能够 **立即看到模型**，不需要自己打开浏览器，自己拖放文件或点击上传。

也可附带其他初始参数：
```
http://localhost:4273/#/workspace?url=./models/<文件名>&theme=dark&lang=zh
```

### 第 5 步：进一步控制（可选）
可通过以下方式控制查看器运行时行为：

**方式 A：MCP（推荐——AI 原生调用）**
MCP（Model Context Protocol）服务器暴露 30+ 个类型化工具，AI 在对话中直接调用（如"把主题调暗"→ 自动调 `set_theme`），无需拼 JSON：
```bash
# opencode/Claude Desktop 配置指向此路径
node "<skill_dir>/scripts/mcp-server.mjs"
```
MCP 服务器自动连接运行中的 `serve.mjs`，工具列表见 `docs/AI_CONTROL_API.md`。

**方式 B：HTTP API**
用 `curl` 向 `serve.mjs` 发命令，通过 SSE 推送到浏览器（请始终携带 `id` 以获取同步返回结果）：
```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"req-001","command":"setTheme","params":{"value":"dark"}}'
```

**方式 C：postMessage（需浏览器 JS 执行能力）**
```js
window.postMessage({ type: '3d-viewer', id: 'req-001', command: 'setTheme', params: { value: 'dark' } }, '*')
```

### 第 6 步：清理
查看结束后，关闭本地 HTTP 服务，释放端口。


## AI 模型生成

当用户用自然语言描述 3D 模型需求时（如"一个 20 齿的齿轮"、"一个内六角螺栓"），按以下步骤操作：

1. 根据用户描述编写 OpenSCAD 代码, 然后保存到models目录，存为后缀名为scad的文件。

2. 然后执行工作流程描述的第三步以及后续步骤。


> **注意**：首次编译 SCAD 文件时需要下载很大的 `openscad.wasm` 包（约 13MB），可能要几十秒，需要耐心等待。

> **注意**：编译后自动生成模型mesh并加载到3D_viewer中，不直接生成stl格式模型文件。如果用户需要stl格式文件，需要使用导出功能。


## 技能目录结构

```
skills/3d_viewer/
├── SKILL.md              # 本技能说明
├── index.html            # 查看器入口
├── step-worker.js        # STEP 转换 Web Worker
├── scripts/serve.mjs     # 基于 Node.js 的 HTTP 服务 + SSE 桥
├── scripts/mcp-server.mjs # MCP 协议服务器（AI 原生调用接口）
├── assets/               # JavaScript/CSS 资源
├── wasm/                 # WebAssembly 模块 (OCCT/OpenSCAD/Draco/Basis/Rhino3DM)
├── env/                  # 环境贴图
└── models/               # AI 复制模型到此目录
```

## API 命令清单

| 分类 | 命令 | 参数 | 说明 |
|------|------|------|------|
| 模型 | `loadModel` | `{ url \| data }` | 从 URL 或 base64 加载模型 |
| 模型 | `generateScadModel` | `{ code, name?, mode? }` | 根据 OpenSCAD 代码生成模型 |
| 模型 | `getModelInfo` | — | 获取当前模型信息 |
| 模型 | `resetViewer` | — | 清空场景 |
| 模型 | `exportModel` | `{ format }` | 导出为 GLB/STL（base64） |
| 主题 | `setTheme` | `{ value }` | 切换主题（light/dark/system） |
| 主题 | `getTheme` | — | 获取当前主题 |
| 语言 | `setLanguage` | `{ value }` | 切换界面语言 |
| 语言 | `getLanguage` | — | 获取当前语言 |
| 环境 | `setEnv` | `{ value }` | 设置环境贴图 |
| 环境 | `getEnv` | — | 获取当前环境贴图 |
| 环境 | `setEnvIntensity` | `{ value }` | 设置环境强度 0-5 |
| 环境 | `setEnvRotation` | `{ value }` | 旋转环境贴图（弧度） |
| 环境 | `loadEnvFile` | `{ url, name }` | 加载自定义 HDR/EXR |
| 材质 | `getMaterialPresets` | — | 列出 29 种材质预设 |
| 材质 | `setPartMaterialByPreset` | `{ preset, partName? }` | 应用预设材质到零件 |
| 材质 | `setPartMaterial` | `{ appearance, partName? }` | 应用自定义材质 |
| 材质 | `getPartMaterial` | `{ partName? }` | 获取零件材质状态 |
| 动画 | `getAnimationInfo` | — | 获取动画列表与状态 |
| 动画 | `playAnimation` | — | 播放选中动画 |
| 动画 | `pauseAnimation` | — | 暂停 |
| 动画 | `stopAnimation` | — | 停止并回到起点 |
| 动画 | `selectAnimation` | `{ index }` | 按索引选择动画 |
| 动画 | `seek` | `{ time }` | 跳转到指定时间（秒） |
| 动画 | `setSpeed` | `{ value }` | 设置播放速度 |
| 动画 | `setAnimationMaximized` | `{ value }` | 最大化/还原动画面板 |
| 相机 | `setCameraPosition` | `{ position, target? }` | 设置相机位置与目标 |
| 相机 | `resetCamera` | — | 重置为默认位置 |
| 相机 | `zoomToFit` | `{ padding? }` | 缩放适配所有几何体 |
| 相机 | `setCameraMode` | `{ value }` | 透视/正交投影 |
| 选择 | `clearSelection` | — | 清除选中 |
| 选择 | `getSelection` | — | 获取选中部件列表 |
| 选择 | `setActiveTool` | `{ value }` | 查看/变换工具 |
| 选择 | `setTransformMode` | `{ value }` | 平移/旋转/缩放 |
| UI | `toggleRightPanel` | — | 切换场景树面板 |
| 截图 | `takeScreenshot` | `{ width?, height? }` | 截取视口（base64 PNG） |
| 代码 | `executeCode` | `{ html?, css?, js?, mode? }` | 注入自定义 UI（实验性） |

> 完整参数类型、响应格式、错误码及详细行为说明见 [AI_CONTROL_API.md](./docs/AI_CONTROL_API.md)。

## AI 代码注入

> **实验性功能。** `executeCode` 命令将 AI 生成的 HTML/CSS/JS 注入独立沙盒 DOM 层（`#ai-layer`）。注入代码可调用 `viewerAPI` 查询场景状态、控制相机、使用 GSAP 驱动零件动画等。
>
> 三个内置 Demo（`node demos/<name>.mjs` 运行）：`gsap-rotate-demo.mjs`（旋转控制面板）、`gsap-assemble-demo.mjs`（装配动画）、`gsap-explode-demo.mjs`（爆炸图动画）。
>
> 详见 [AI_CODE_INJECTION.md](./docs/AI_CODE_INJECTION.md)。
