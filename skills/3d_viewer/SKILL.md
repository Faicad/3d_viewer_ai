---
name: 3d_viewer
description: >-
  直接在浏览器中查看 3D 模型文件。支持 STL/3MF/STEP/STP/GLB/GLTF/OBJ/PLY/FBX/USDZ 等 29+ 种格式。
  支持通过 ?url= 参数自动加载模型，用户打开页面即可看到模型，无需手动拖放。
  也支持材质编辑、环境贴图、线框/拓扑叠加、测量、剖切等。
  用户给出一个 3D 模型文件路径时，复制文件到服务目录 → 启动 HTTP 服务 → 打开浏览器自动加载模型。
  触发词：查看这个3D模型, 打开这个STL文件, 浏览STEP模型, 3D模型查看, view this 3D model, open stl file,
  view step model, 3mf viewer, glb viewer.
license: LGPL-2.0-only
compatibility:
  - opencode
  - claude
metadata:
  formats: "stl,3mf,step,stp,glb,gltf,obj,ply,fbx,usdz,3ds,dae,drc,dxf,svg,hdr,exr"
  features: "url-auto-load,drag-and-drop,STEP-topology,wireframe,material-editor,environment-maps,measurement,slicing"
---

# 3D 模型查看器

一个基于浏览器的全功能 3D 模型文件查看器。支持 29+ 种文件格式，实时 3D 渲染。
通过 `?url=` 参数可自动加载模型，用户打开浏览器后直接看到模型，无需手动拖放。

## 支持格式

| 类别 | 格式 |
|------|------|
| CAD | STEP/STP, 3MF, STL, OBJ, PLY, FBX, DAE, 3DS, IFC, 3DM |
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
mkdir -p <skill_dir>/models
cp "<model_file_path>" <skill_dir>/models/
```

### 第 3 步：启动本地 HTTP 服务
在这个技能目录下启动一个临时静态文件服务：

```bash
# 方法 A：Node.js（推荐）
npx serve --cors -p 4173 "<skill_dir>"

# 方法 B：Python
python -m http.server 4173 --directory "<skill_dir>"
```

> 端口使用 **4173**（与 Vite 开发服务器默认端口一致）。如果被占用则换一个端口并告知用户。

### 第 4 步：打开浏览器自动加载模型
用 opencode/claude 的浏览器打开能力（如 `preview` 工具）打开查看器页面，带上 `?url=` 参数：

```
http://localhost:4173/#/workspace?url=./models/<文件名>
```

用户打开浏览器后 **立即看到模型**，不需要拖放文件或点击上传。

也可附带其他初始参数：
```
http://localhost:4173/#/workspace?url=./models/<文件名>&theme=dark&lang=zh&env=studio_small_08
```

### 第 5 步：进一步控制（可选）
如果 AI 有浏览器 JS 执行能力，可通过 postMessage 发送指令进一步控制查看器：
- 改材质、播放动画、切换环境贴图、截屏等
- 详见项目根目录 `docs/AI_CONTROL_API.md`

### 第 6 步：清理
查看结束后，关闭本地 HTTP 服务，释放端口。

## 技能目录结构

```
skills/3d_viewer/
├── SKILL.md              # 本技能说明
├── index.html            # 查看器入口
├── step-worker.js        # STEP 转换 Web Worker
├── assets/               # JavaScript/CSS 资源
├── wasm/                 # WebAssembly 模块 (OCCT/Draco/Basis/Rhino3DM)
├── env/                  # 环境贴图
└── models/               # AI 复制的模型文件（临时，gitignore）
```

## URL 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `url` | 加载 HTTP 服务目录下的模型文件（相对路径） | `?url=./models/model.stl` |
| `theme` | 主题：`light` / `dark` / `system` | `&theme=dark` |
| `lang` | 语言：`zh` / `en` / `es` / `ja` 等 20 种 | `&lang=en` |
| `env` | 环境贴图：`studio` / `studio_small_08` | `&env=studio_small_08` |

## 注意事项

- 查看器是完全离线的——所有 WASM 和 JS 都在本地，无需网络。
- STEP 文件需要 WASM 加载 OCCT 内核，首次加载较慢（约 1-2 秒）。
- 查看器以 `file://` 协议无法正常加载 WASM，务必通过 HTTP 服务提供。
- 模型文件需要复制到 HTTP 服务目录下（`models/` 子目录），文件才能被浏览器访问。
