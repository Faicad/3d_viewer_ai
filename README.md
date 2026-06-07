# 3D Viewer — AI 技能说明

## 这是什么

这是一个**基于浏览器的 3D 模型查看器**，支持 29+ 种文件格式，可直接在浏览器中拖放加载和浏览 3D 模型。所有资源离线运行，无需网络。

**适用场景**：用户有一个 3D 模型文件（STL/STEP/GLB/OBJ 等），想在浏览器中查看其内容。AI 代理需要启动一个本地 HTTP 服务，打开浏览器，让用户拖入文件即可查看。

---

## 快速调用

```bash
# 1. 进入技能目录
cd skills/3d_viewer

# 2. 启动 HTTP 服务（任选其一）
npx serve --cors -p 4173 .           # Node.js 方式
python -m http.server 4173           # Python 方式

# 3. 打开浏览器访问 http://localhost:4173
# 4. 用户拖入模型文件即可查看
```

---

## 支持的格式

| 类别 | 格式 | 扩展名 |
|------|------|--------|
| CAD | STEP/STP | `.step` `.stp` |
| | 3MF | `.3mf` |
| | STL | `.stl`（ASCII + Binary） |
| | OBJ | `.obj` |
| | PLY | `.ply`（ASCII + Binary） |
| | FBX | `.fbx` |
| | DAE (Collada) | `.dae` |
| | 3DS | `.3ds` |
| | IFC | `.ifc` |
| | 3DM (Rhino) | `.3dm`（需 WASM） |
| 3D 图形 | GLB/GLTF | `.glb` `.gltf` |
| | USDZ | `.usdz` |
| | DRC (Draco) | `.drc`（需 WASM） |
| | BVH (骨骼动画) | `.bvh` |
| | VTK | `.vtk` `.vtp` |
| | XYZ (点云) | `.xyz` |
| | PDB (蛋白质) | `.pdb` |
| 其他 3D | NRRD (体积) | `.nrrd` |
| | GCode (3D 打印) | `.gcode` |
| | WRL (VRML) | `.wrl` |
| | VOX (体素) | `.vox` |
| | KMZ | `.kmz` |
| | AMF | `.amf` |
| | LWO | `.lwo` |
| | MD2 (Quake II) | `.md2` |
| | PCD (点云) | `.pcd` |
| 2D | SVG | `.svg` |
| | DXF | `.dxf` |
| 环境贴图 | HDR | `.hdr` |
| | EXR | `.exr` |

---

## URL 参数

查看器支持通过 URL 查询参数传递配置。URL 格式：

```
http://localhost:4173/#/workspace?url=<encoded_url>
```

| 参数 | 说明 | 示例 |
|------|------|------|
| `url` | 指定一个远程 3D 模型文件的 URL，查看器打开后自动下载并加载该文件 | `?url=https://example.com/model.stl` |

### `url` 参数说明

- 查看器通过 `fetch()` 下载该 URL 的内容，然后作为文件加载
- 文件名从 URL 最后一段路径或 `Content-Disposition` 响应头提取
- 文件格式通过扩展名自动识别
- 支持所有 [支持的格式](#支持的格式) 中列出的格式

---

## 查看器功能

- **拖放加载**：直接将模型文件拖入浏览器窗口即可加载
- **文件选择**：点击右上角上传按钮，按类别筛选格式
- **4 种显示模式**：实体 / 线框 / 实体+线框 / 三角网格
- **材质编辑**：支持 PBR 材质参数调整（金属度、粗糙度、颜色等）
- **环境贴图**：支持 HDR/EXR 环境贴图切换
- **拓扑叠加**：STEP 文件支持拓扑线显示
- **线框模式**：所有格式均支持网格线框叠加
- **测量工具**：支持点间距测量
- **剖切工具**：支持模型剖切查看内部结构
- **变换工具**：平移/旋转/缩放
- **选择工具**：支持对象/面/边/顶点选择
- **模型下载**：导出为 STL 或 GLB 格式
- **场景树**：模型部件分层展示，可独立控制可见性
- **深色/浅色主题**：支持亮色/暗色/跟随系统
- **中英文切换**：支持简体中文和英文界面

---

## AI 调用流程

当用户要求查看一个 3D 模型文件时，按以下步骤操作：

### 第 1 步：确认文件存在
确认用户提到的模型文件绝对路径存在。

### 第 2 步：启动本地 HTTP 服务
```bash
npx serve --cors -p 4173 "skills/3d_viewer"
```
或 Python：
```bash
python -m http.server 4173 --directory "skills/3d_viewer"
```
端口如果被占用则换一个，并告知用户访问地址。

> **注意**：`file://` 协议无法加载 WASM，必须通过 HTTP 服务提供。

### 第 3 步：打开浏览器
用 AI 的浏览器能力（如 `preview` 工具）打开 `http://localhost:4173`。如果运行在无 GUI 环境，则跳过此步。

### 第 4 步：指导用户加载模型
告知用户模型文件的完整绝对路径，用户可以通过拖放或文件选择按钮加载。

### 第 5 步：清理
查看结束后关闭本地 HTTP 服务，释放端口。

---

## 触发关键词

当用户消息包含以下内容时，适合调用此技能：

- 查看这个 3D 模型 / 打开这个 STL 文件 / 浏览 STEP 模型
- 3D 模型查看 / 3D 文件浏览 / 给我看看这个模型
- view this 3D model / open stl file / view step model
- 3mf viewer / glb viewer / 打开这个三维文件

---

## 限制

- 不支持 GLTF 外部 `.bin` 和纹理引用（必须用自包含的 GLB）
- 不支持 STEP 文件的外部引用
- 首次加载包含 WASM 的格式（STEP/DRC/3DM）时较慢（约 1-3 秒）
- 大型文件（>500MB）加载可能消耗大量内存
- 此查看器仅用于单次查看，不提供文件列表、历史记录或持久化功能

---

## 目录结构

```
3d_viewer/
├── .claude-plugin/          # 插件注册信息
│   ├── plugin.json
│   └── marketplace.json
└── skills/3d_viewer/        # 技能根目录
    ├── SKILL.md             # 技能定义元数据
    ├── index.html           # 查看器入口 HTML
    ├── step-worker.js       # STEP→GLB 转换 Worker
    ├── assets/              # JS/CSS 资源
    ├── wasm/                # WebAssembly 模块
    └── env/                 # 环境贴图
```

GitHub Pages 在线版：`https://faicad.github.io/3d_viewer/`
