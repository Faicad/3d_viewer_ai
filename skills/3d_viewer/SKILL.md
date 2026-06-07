---
name: 3d_viewer
description: >-
  直接在浏览器中查看 3D 模型文件。支持 STL/3MF/STEP/STP/GLB/GLTF/OBJ/PLY/FBX/USDZ 等 29+ 种格式。
  拖入文件即可浏览，支持材质编辑、环境贴图、线框/拓扑叠加、测量、剖切等。
  用户给出一个 3D 模型文件路径时，启动一个临时 HTTP 服务打开此查看器，用户拖入模型即可查看。
  触发词：查看这个3D模型, 打开这个STL文件, 浏览STEP模型, 3D模型查看, view this 3D model, open stl file,
  view step model, 3mf viewer, glb viewer.
license: LGPL-2.0-only
compatibility:
  - opencode
  - claude
metadata:
  formats: "stl,3mf,step,stp,glb,gltf,obj,ply,fbx,usdz,3ds,dae,drc,dxf,svg,hdr,exr"
  features: "drag-and-drop,STEP-topology,wireframe,material-editor,environment-maps,measurement,slicing"
---

# 3D 模型查看器

一个基于浏览器的全功能 3D 模型文件查看器。支持拖放加载 29+ 种文件格式，实时 3D 渲染。

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

### 第 2 步：启动本地 HTTP 服务
在这个技能目录下启动一个临时静态文件服务：

```bash
# 方法 A：Node.js（推荐）
npx serve --cors -p 4173 "<skill_dir>"

# 方法 B：Python
python -m http.server 4173 --directory "<skill_dir>"
```

> 端口使用 **4173**（与 Vite 开发服务器默认端口一致）。如果被占用则换一个端口并告知用户。

### 第 3 步：打开浏览器
告知用户浏览器已打开，可访问 `http://localhost:4173`。如果运行在无 GUI 环境，则跳过此步。

用 opencode/claude 的浏览器打开能力（如 `preview` 工具）打开查看器页面。

### 第 4 步：指导用户加载模型
用户可以通过以下方式加载模型文件到查看器：
1. **拖放**：直接将模型文件拖入浏览器窗口
2. **文件选择**：点击查看器界面中的文件选择按钮

告知用户模型文件的完整路径，以便他们拖放。

### 第 5 步：清理
查看结束后，关闭本地 HTTP 服务，释放端口。

## 技能目录结构

```
skills/3d_viewer/
├── SKILL.md              # 本技能说明
├── index.html            # 查看器入口
├── step-worker.js        # STEP 转换 Web Worker
├── assets/               # JavaScript/CSS 资源
├── wasm/                 # WebAssembly 模块 (OCCT/Draco/Basis/Rhino3DM)
└── env/                  # 环境贴图
```

## 注意事项

- 查看器是完全离线的——所有 WASM 和 JS 都在本地，无需网络。
- STEP 文件需要 WASM 加载 OCCT 内核，首次加载较慢（约 1-2 秒）。
- 查看器以 `file://` 协议无法正常加载 WASM，务必通过 HTTP 服务提供。
