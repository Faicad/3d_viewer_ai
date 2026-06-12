---
name: 3d_viewer
description: >-
  View 3D model files directly locally without installing other large software. Supports 30+ formats including
  STL/3MF/STEP/STP/GLB/GLTF/OBJ/PLY/FBX/USDZ/SCAD. Can generate 3D models from natural language using OpenSCAD.
  Supports material editing, environment maps, animation playback, wireframe/topology overlay, measurement, etc.
  Trigger words: view this 3D model, open stl file, view step model, 3mf viewer, glb viewer, generate a gear, create a bolt,
  查看这个3D模型, 打开这个STL文件, 浏览STEP模型, 3D模型查看.
license: LGPL-2.0-only
compatibility:
  - opencode
  - claude
metadata:
  formats: "stl,3mf,step,stp,glb,gltf,obj,ply,fbx,usdz,scad,3ds,dae,drc,dxf,svg,hdr,exr"
  features: "url-auto-load,drag-and-drop,STEP-topology,wireframe,material-editor,environment-maps,measurement,ai-model-generation"
---

# 3D Model Viewer

A browser-based full-featured 3D model file viewer. Supports 30+ file formats with real-time 3D rendering.
The `?url=` parameter enables auto-loading models — users see the model directly when they open the browser, no manual drag-and-drop needed.
Can generate 3D models from OpenSCAD code — describe the shape in natural language and the AI compiles it to a visible model.

## Supported Formats

| Category | Formats |
|----------|---------|
| CAD | STEP/STP, 3MF, STL, OBJ, PLY, FBX, DAE, 3DS, IFC, 3DM |
| Programmatic | SCAD (OpenSCAD — AI can generate models from code) |
| 3D Graphics | GLB/GLTF, USDZ, DRC, BVH, VTK, XYZ, PDB |
| Other | NRRD, GCode, WRL, VOX, KMZ, AMF, LWO, MD2, PCD |
| 2D | SVG, DXF |
| Environment Maps | HDR, EXR |

## Workflow

When a user asks to view a 3D model file (by path or filename), follow these steps:

### Step 1: Verify the file exists
Confirm the model file path provided by the user exists, and record its absolute path.

### Step 2: Copy file to the service directory
```bash
cp "<model_file_path>" <skill_dir>/models/
```

### Step 3: Start local HTTP server (run in background, do NOT set timeout)

Choose the appropriate method for your OS:

**Windows:**
```powershell
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "<skill_dir>/scripts/serve.mjs"
```

**macOS / Linux:**
```bash
nohup node "<skill_dir>/scripts/serve.mjs" > /dev/null 2>&1 &
```

> After starting, verify port 4273 is listening (e.g. `netstat -ano | findstr :4273`).

The HTTP service is a long-running process and must be started in the background. **Do not** run it in the foreground, otherwise the bash timeout will kill the process.

Default port is **4273** (use `PORT=4174 node ...` to specify a different port).

This service also provides an **HTTP API** for AI to remotely control the viewer via `curl`:
```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","command":"setTheme","params":{"value":"dark"}}'
```
The browser receives commands in real-time via SSE (`/api/events`). See Step 5 below for details.

> If `scripts/serve.mjs` is unavailable (non-Node.js environment), you can use `python -m http.server 4273` as a fallback — but this loses HTTP API remote control capability.

### Step 4: Open browser to auto-load the model
Open the following URL in the system default browser with the `?url=` parameter:

```
http://localhost:4273/#/workspace?url=./models/<filename>
```

The user will **see the model immediately** without needing to open the browser themselves, drag-and-drop files, or click upload.

Additional initial parameters can be appended:
```
http://localhost:4273/#/workspace?url=./models/<filename>&theme=dark&lang=zh
```

### Step 5: Further control (optional)

You can control the viewer at runtime through the following methods:

**Method A: MCP (Recommended — AI-native calling)**
MCP (Model Context Protocol) server exposes 30+ typed tools. AI calls them directly during conversation (e.g. "dim the theme" → automatically calls `set_theme`), no need to craft JSON:
```bash
# Point opencode/Claude Desktop config to this path
node "<skill_dir>/scripts/mcp-server.mjs"
```
The MCP server automatically connects to the running `serve.mjs`. See `docs/AI_CONTROL_API.md` for the full tool list.

**Method B: HTTP API**
Send commands to `serve.mjs` via `curl`, pushed to the browser through SSE:
```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","command":"setTheme","params":{"value":"dark"}}'
```

**Method C: postMessage (requires browser JS execution)**
```js
window.postMessage({ type: '3d-viewer', command: 'setTheme', params: { value: 'dark' } }, '*')
```

### Step 6: Cleanup
After viewing is complete, shut down the local HTTP service to release the port.


## AI Model Generation

When the user describes a 3D model in natural language (e.g. "a gear with 20 teeth", "a bolt with hex head"), follow these steps:

### Step 1: Start local HTTP server (run in background, do NOT set timeout)

Start the HTTP service as described in the workflow above.

### Step 2: Open browser to default address

```
http://localhost:4273/
```

### Step 3: Write the OpenSCAD code based on the user's description

### Step 4: Send via the `generateScadModel` command

```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"gen-1","command":"generateScadModel","params":{
    "code": "difference() { cube([10,20,30], center=true); cylinder(r=5, h=35, center=true); }",
    "name": "my-part",
    "mode": "replace"
  }}'
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | Yes | — | OpenSCAD source code |
| `name` | string | No | `"generated-model"` | Display name in scene tree |
| `mode` | `"replace"` \| `"append"` | No | `"replace"` | `replace` clears existing models; `append` adds to scene |

The model will now appear in the browser.

> **Note**: The first SCAD compilation needs to download `openscad.wasm` (~13MB), which may take several tens of seconds. Please be patient.
>
> **Note**: `generateScadModel` automatically generates the model mesh and loads it into the 3D viewer; it does not directly produce an STL file. If the user needs an STL file, use the export functionality.


## Skill Directory Structure

```
skills/3d_viewer/
├── SKILL.md              # Skill description (English)
├── SKILL_cn.md           # Skill description (Chinese)
├── index.html            # Viewer entry point
├── step-worker.js        # STEP conversion Web Worker
├── scripts/serve.mjs     # Node.js HTTP server + SSE bridge
├── scripts/mcp-server.mjs # MCP protocol server (AI-native call interface)
├── assets/               # JavaScript/CSS assets
├── wasm/                 # WebAssembly modules (OCCT/OpenSCAD/Draco/Basis/Rhino3DM)
├── env/                  # Environment maps
└── models/               # AI copies models to this directory
```

## API Command List

| Category | Command | Parameters | Description |
|----------|---------|------------|-------------|
| Model | `loadModel` | `{ url \| data }` | Load model from URL or base64 |
| Model | `generateScadModel` | `{ code, name?, mode? }` | Generate model from OpenSCAD code |
| Model | `getModelInfo` | — | Get current model info |
| Model | `resetViewer` | — | Clear scene |
| Model | `exportModel` | `{ format }` | Export scene as GLB/STL (base64) |
| Theme | `setTheme` | `{ value }` | Switch theme (light/dark/system) |
| Theme | `getTheme` | — | Get current theme |
| Language | `setLanguage` | `{ value }` | Switch UI language |
| Language | `getLanguage` | — | Get current language |
| Env Map | `setEnv` | `{ value }` | Set environment map |
| Env Map | `getEnv` | — | Get current env map |
| Env Map | `setEnvIntensity` | `{ value }` | Set env intensity 0-5 |
| Env Map | `setEnvRotation` | `{ value }` | Rotate env map (radians) |
| Env Map | `loadEnvFile` | `{ url, name }` | Load custom HDR/EXR |
| Material | `getMaterialPresets` | — | List 29 material presets |
| Material | `setPartMaterialByPreset` | `{ preset, partName? }` | Apply preset to part |
| Material | `setPartMaterial` | `{ appearance, partName? }` | Apply custom material |
| Material | `getPartMaterial` | `{ partName? }` | Get part material state |
| Animation | `getAnimationInfo` | — | List animations & state |
| Animation | `playAnimation` | — | Play selected animation |
| Animation | `pauseAnimation` | — | Pause |
| Animation | `stopAnimation` | — | Stop and rewind |
| Animation | `selectAnimation` | `{ index }` | Select animation by index |
| Animation | `seek` | `{ time }` | Seek to time (seconds) |
| Animation | `setSpeed` | `{ value }` | Set playback speed |
| Animation | `setAnimationMaximized` | `{ value }` | Toggle animation panel |
| Camera | `setCameraPosition` | `{ position, target? }` | Set camera position/target |
| Camera | `resetCamera` | — | Reset to default |
| Camera | `zoomToFit` | `{ padding? }` | Fit all visible geometry |
| Camera | `setCameraMode` | `{ value }` | Perspective/orthographic |
| Selection | `clearSelection` | — | Clear selection |
| Selection | `getSelection` | — | Get selected parts |
| Selection | `setActiveTool` | `{ value }` | View/transform tool |
| Selection | `setTransformMode` | `{ value }` | Translate/rotate/scale |
| UI | `toggleRightPanel` | — | Toggle scene tree panel |
| Screenshot | `takeScreenshot` | `{ width?, height? }` | Capture viewport (base64 PNG) |
| Code | `executeCode` | `{ html?, css?, js?, mode? }` | Inject custom UI (experimental) |

> See [AI_CONTROL_API.md](./docs/AI_CONTROL_API.md) for complete parameter types, response formats, error codes, and detailed command behavior.

## AI Code Injection

> **Experimental.** `executeCode` injects AI-generated HTML/CSS/JS into a sandboxed DOM layer (`#ai-layer`). Injected code can call `viewerAPI` to query scene state, control camera, animate parts with GSAP, etc.
>
> Three built-in demos (`node demos/<name>.mjs`): `gsap-rotate-demo.mjs` (rotation control panel), `gsap-assemble-demo.mjs` (assembly animation), `gsap-explode-demo.mjs` (explosion animation).
>
> See [AI_CODE_INJECTION.md](./docs/AI_CODE_INJECTION.md).
