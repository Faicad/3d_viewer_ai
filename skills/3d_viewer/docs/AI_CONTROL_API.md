# 3D Viewer AI Control Interface

## Overview

Three ways to control the viewer:

- **URL Parameters**: Set initial state on page load (language, theme, environment map, auto-load model)
- **HTTP API** (recommended): `serve.mjs` has a built-in SSE bridge. AI sends commands via `curl`, the browser executes them in real-time. No browser JS capability required.
- **postMessage API**: Real-time control within the same window

---

## 1. Model Loading

Copy a model file to the `models/` directory under the server root, then load it via URL parameter or API command.

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# Open http://localhost:4273/#/workspace?url=./models/model.stl
```

Supported formats: GLB, glTF, STEP, STP, STL, OBJ, 3MF, FBX, PLY, SCAD, and other formats supported by Three.js.

STEP/STP files are automatically converted to GLB via OCCT WASM before rendering. SCAD files are compiled to mesh via openscad-wasm before rendering.

HDR/EXR environment maps work the same way (copy to `models/` then load via `loadEnvFile` command).

---

## 2. URL Parameters (Initial State)

```
http://localhost:4273/#/workspace?url=<path>&theme=dark&lang=en&env=studio
```

| Parameter | Type | Values | Default | Description |
|-----------|------|--------|---------|-------------|
| `url` | string | relative path under server root | — | Auto-load this model on page load |
| `theme` | string | `light` / `dark` / `system` | `system` | UI theme |
| `lang` | string | `zh` / `en` / `es` / `ja` / `ko` / `fr` / `de` / `pt` / `ru` / `ar` / `hi` / `id` / `tr` / `it` / `nl` / `pl` / `vi` / `th` / `uk` / `sv` | browser language | UI language |
| `env` | string | `studio` / any HDR URL | `studio` | Environment map. Supports CORS-compatible CDN links like Poly Haven |

---

## 3. SSE/HTTP Bridge (Cross-Process Control)

`serve.mjs` has a built-in SSE bridge that solves the process isolation problem between AI and browser:

```
AI (curl) ──POST /api/command──→ serve.mjs ──SSE──→ Browser executes
```

### Request Format

All commands **should include an `id`**. `serve.mjs` waits for the browser to return the result before responding. If no `id` is provided, one is auto-generated (a `_warning` is appended to the response). Timeout: 30 seconds.

```bash
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"req-001","command":"getTheme","params":{}}'
# Response: {"type":"3d-viewer","id":"req-001","command":"getTheme","status":"success","data":{"theme":"dark"}}
# Timeout (30s): {"type":"3d-viewer","id":"req-001","command":"getTheme","status":"error","error":"Command timeout: getTheme"}
```

#### Async Command Notes

`loadModel` is an async command. The SSE handler `await`s until the model is fully loaded (including STEP→GLB conversion), then POSTs to `/api/result` to resolve the MCP Promise. Therefore, `loadModel` requests block until the model is actually available, and the response directly includes complete model information.

#### Error Responses

| Status Code | Condition | Response Body |
|-------------|-----------|---------------|
| 400 | Invalid JSON | `{"type":"3d-viewer","status":"error","error":"Invalid JSON"}` |
| 503 | No SSE client connected | `{"type":"3d-viewer","status":"error","error":"No connected clients"}` |
| 504 | Sync mode timeout (30s) | `{"type":"3d-viewer","id":"<id>","command":"<cmd>","status":"error","error":"Command timeout: <cmd>"}` |

### Command Format

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Fixed `"3d-viewer"` |
| `command` | string | Yes | Command name |
| `id` | string | Strongly recommended | Request ID. Auto-generated if omitted (response includes `_warning`) |
| `params` | object | No | Command parameters |

> The command list is identical to the postMessage API — see below.

---

## 4. postMessage API (Same-Window Control)

### Protocol Format

#### Request
```js
window.postMessage({
  type: '3d-viewer',
  id: 'req-001',
  command: 'setTheme',
  params: { value: 'dark' }
}, '*')
```

#### Response

```js
// Success
{
  type: '3d-viewer',
  id: 'req-001',
  command: 'setTheme',
  status: 'success',
  data: { theme: 'dark' }
}

// Failure
{
  type: '3d-viewer',
  id: 'req-001',
  command: 'setTheme',
  status: 'error',
  error: 'Invalid theme: foo'
}
```

Async commands (`loadModel`, `exportModel`) return `{ loading: true }` immediately over the postMessage channel, then push `modelLoaded` / `modelLoadError` events when done. When using the SSE channel, this difference can be ignored (SSE awaits the full result).

---

### Command List

#### Model Control

| Command | Parameters | Description |
|---------|-----------|-------------|
| `loadModel` | `{ url: string }` or `{ data: string }` | Load a model from URL or base64 data URL. STEP is auto-converted to GLB |
| `getModelInfo` | — | Get current model info (fileName, format, partCount, parts, animations) |
| `resetViewer` | — | Clear scene, clear selection, reset animation state |
| `exportModel` | `{ format: 'glb' \| 'stl' }` | Export all visible models in the scene as GLB or STL, returns base64-encoded binary data |

#### Theme

| Command | Parameters | Description |
|---------|-----------|-------------|
| `setTheme` | `{ value: 'light' \| 'dark' \| 'system' }` | Switch theme |
| `getTheme` | — | Get current theme |

#### Language

| Command | Parameters | Description |
|---------|-----------|-------------|
| `setLanguage` | `{ value: string }` | Switch UI language |
| `getLanguage` | — | Get current language |

#### Environment Map

| Command | Parameters | Description |
|---------|-----------|-------------|
| `setEnv` | `{ value: string }` | Switch environment map (`studio`, `custom_N`, or HDR URL) |
| `getEnv` | — | Get current environment map ID |
| `setEnvIntensity` | `{ value: number }` | Set environment intensity 0-5 |
| `setEnvRotation` | `{ value: number }` | Rotate environment map (radians) |
| `loadEnvFile` | `{ url: string, name: string }` | Load a custom HDR/EXR |

#### Material Control

| Command | Parameters | Description |
|---------|-----------|-------------|
| `getMaterialPresets` | — | Get all built-in material presets (name → full MaterialAppearance dict) |
| `setPartMaterialByPreset` | `{ preset: string, partName?: string }` | Apply a built-in preset to a specific part |
| `setPartMaterial` | `{ appearance: MaterialAppearance, partName?: string }` | Apply a custom material to a specific part |
| `getPartMaterial` | `{ partName?: string }` | Get the current material state of a specific part |

##### Part Material Targeting Rules

`partName` is the **part name displayed in the scene tree** (`GlbPartInfo.name`). When omitted, the target is auto-determined by the following priority:

| Priority | Condition | Behavior |
|----------|-----------|----------|
| 1 | `partName` specified | Match by name (first match if duplicates) |
| 2 | Selection exists (`selectedReferenceIds` not empty) | All parts under that node, supports part/file/group |
| 3 | No selection | Current active file → all its parts |

> **Tip**: `getModelInfo` returns each part's `name` (scene tree display name) and `partId`.

##### Preset vs Custom Material

- **`setPartMaterialByPreset`** — Selects from the built-in preset library; the system records which preset the part uses
- **`setPartMaterial`** — Pass any MaterialAppearance; the system marks the part as "custom material" (clears preset reference)

`getPartMaterial` differentiates between these two cases:

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

##### MaterialAppearance Structure

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

> **Recommendation**: Prefer `setPartMaterialByPreset`. AI should first call `getMaterialPresets` to learn the available presets (29 presets covering metal/plastic/glass/rubber/paint, etc.), then apply by name.

##### `getMaterialPresets` Return Structure

```typescript
{
  presets: {
    chrome:        { name:"Chrome",         color:[0.95,0.95,0.96], metalness:1.0, roughness:0.02 },
    gold:          { name:"Gold",           color:[1.0,0.84,0.0],   metalness:1.0, roughness:0.1 },
    // ...29 presets total
  }
}
```

#### Animation Control

Skeletal/morph animations embedded in GLB files (e.g., product demo animations, character actions). **This is the GLB format's native animation system**, driven by Three.js `AnimationMixer`, controlled via `playAnimation` / `pauseAnimation` / `seek` and other commands.

> ⚠️ **Difference from GSAP Animation Demos**:
> - **GLB Built-in Animations** (this section) — skeletal/morph animation clips embedded in the model file; play/pause/seek controlled via API commands
> - **GSAP Demo Animations** (`executeCode` injection) — AI-generated GSAP assembly/explode/rotate effects that operate on entire parts; controlled via `node demos/<name>.mjs` injecting a UI panel
>
> They are independent: GLB built-in animations are defined by the model author; GSAP demos are generated by AI in real-time.

| Command | Parameters | Description |
|---------|-----------|-------------|
| `getAnimationInfo` | — | Get animation list and playback state |
| `playAnimation` | — | Play the currently selected animation |
| `pauseAnimation` | — | Pause playback |
| `stopAnimation` | — | Stop and return to start |
| `selectAnimation` | `{ index: number }` | Select the Nth animation clip (0-based) |
| `seek` | `{ time: number }` | Seek to a specific time point (seconds) |
| `setSpeed` | `{ value: number }` | Set playback speed multiplier |
| `setAnimationMaximized` | `{ value: boolean }` | Maximize/restore the animation window |

#### Camera

| Command | Parameters | Description |
|---------|-----------|-------------|
| `setCameraPosition` | `{ position: [x,y,z], target?: [x,y,z] }` | Set camera position and look-at target |
| `resetCamera` | — | Reset camera to default position `(0, -6, 4)`, looking at origin |
| `zoomToFit` | `{ padding?: number }` | Zoom to fit all visible geometry (`padding` defaults to 1.5) |
| `setCameraMode` | `{ value: 'perspective' \| 'orthographic' }` | Switch perspective/orthographic projection |

#### Selection & Tools

| Command | Parameters | Description |
|---------|-----------|-------------|
| `clearSelection` | — | Clear selection |
| `getSelection` | — | Get currently selected parts |
| `setActiveTool` | `{ value: 'view' \| 'objectTransform' }` | Switch view/transform tool |
| `setTransformMode` | `{ value: 'translate' \| 'rotate' \| 'scale' }` | Set transform gizmo mode |

#### UI Panel

| Command | Parameters | Description |
|---------|-----------|-------------|
| `toggleRightPanel` | — | Toggle the right scene tree panel |

#### Screenshot

| Command | Parameters | Description |
|---------|-----------|-------------|
| `takeScreenshot` | `{ width?: number, height?: number }` | Capture the current viewport, returns a base64 PNG data URL |

#### Code Injection (AI-Generated Custom UI)

| Command | Parameters | Description |
|---------|-----------|-------------|
| `executeCode` | `{ html?: string, css?: string, js?: string, mode?: 'replace' \| 'append' \| 'clear' }` | 🧪 Experimental. Injects AI-generated UI into `#ai-layer` that can manipulate the scene |

> `executeCode` is the entry point for AI-generated custom UI. **Currently experimental** — the interface and behavior may change in future versions. See [AI Code Injection](./AI_CODE_INJECTION.md).

Three built-in demos can be run directly via `node demos/<name>.mjs` to inject animation control panels into the local viewer:

| Demo | Description |
|------|-------------|
| `gsap-rotate-demo.mjs` | Rotation control panel — camera orbit / object rotation, speed, easing, axis selection |
| `gsap-assemble-demo.mjs` | Assembly animation — parts settle from bottom to top, adjustable drop height, duration, landing easing |
| `gsap-explode-demo.mjs` | Exploded view — parts scatter radially, adjustable distance, stagger, duration, easing |

---

## 5. loadModel Command Details

### Request

```js
{ type: '3d-viewer', id: 'load-1', command: 'loadModel', params: { url: 'https://example.com/model.glb' } }
// Or base64 data (small files):
{ type: '3d-viewer', id: 'load-1', command: 'loadModel', params: { data: 'data:model/gltf-binary;base64,...' } }
```

### Response (SSE/HTTP Channel)

The SSE handler `await`s the async result, blocking until the model is fully loaded:

```json
{
  "type": "3d-viewer",
  "id": "load-1",
  "command": "loadModel",
  "status": "success",
  "data": {
    "fileId": "uuid",
    "fileName": "model.glb",
    "format": "glb",
    "sourceUnit": "mm",
    "partCount": 3,
    "parts": [{ "partId": "0", "name": "Part1", "triangleCount": 1200 }],
    "animations": [{ "name": "Take 001", "duration": 2.5 }]
  }
}
```

On failure:

```json
{
  "type": "3d-viewer",
  "id": "load-1",
  "command": "loadModel",
  "status": "error",
  "error": "Failed to fetch: HTTP 404"
}
```

### Execution Flow

1. AI calls MCP `load_model` → POST `/api/command` → serve.mjs SSE to browser
2. Browser SSE handler `await executeCommand(msg)`
3. `loadModel` returns a Promise, internally executes `fetch` → `detectFormat` → (optional STEP→GLB conversion) → `loadFormat` → `addLoadedFile`
4. On completion, handler POSTs to `/api/result`, serve.mjs resolves the MCP Promise
5. AI receives the full response containing `{ fileId, fileName, format, partCount, parts }`

---

## 6. exportModel Command Details

Export all visible models in the current scene to GLB or STL format. **Exported data is returned via the API response (base64-encoded binary data)**. The Export button in the UI toolbar triggers a browser download.

### Request

```js
{
  type: '3d-viewer',
  id: 'exp-1',
  command: 'exportModel',
  params: {
    format: 'glb'
  }
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | `"glb"` \| `"stl"` | **Yes** | — | Export format. GLB preserves materials, STL is geometry-only (no materials) |

### Response (SSE/HTTP Channel)

```json
{
  "type": "3d-viewer",
  "id": "exp-1",
  "command": "exportModel",
  "status": "success",
  "data": {
    "base64": "Z2xURgIAAAB...（base64 encoded）",
    "byteLength": 43984,
    "format": "stl"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.base64` | string | Base64-encoded binary data (GLB or STL) |
| `data.byteLength` | number | Original byte count (size after decoding) |
| `data.format` | string | Export format (`"glb"` or `"stl"`) |

When there is no exportable geometry in the scene:

```json
{
  "type": "3d-viewer",
  "id": "exp-1",
  "command": "exportModel",
  "status": "error",
  "error": "No exportable geometry in scene"
}
```

### Execution Flow

1. `exportModel` collects all visible `THREE.Mesh` objects from the R3F scene
2. Selects the exporter based on the `format` parameter:
   - **STL** — uses Three.js `STLExporter`, exports in world-space coordinates, no materials
   - **GLB** — uses Three.js `GLTFExporter`, preserves currently active materials (including user modifications)
3. The export result is encoded as base64 and returned via the API response (SSE awaits the full result before returning synchronously)

### Typical Usage

```bash
# Export as GLB (preserves materials), decode and save to file
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"exp-1","command":"exportModel","params":{"format":"glb"}}' \
  | jq -r '.data.base64' | base64 -d > model.glb

# Export as STL (geometry only)
curl -X POST http://localhost:4273/api/command \
  -H "Content-Type: application/json" \
  -d '{"type":"3d-viewer","id":"exp-2","command":"exportModel","params":{"format":"stl"}}' \
  | jq -r '.data.base64' | base64 -d > model.stl
```

After receiving a successful response, `data.base64` contains base64-encoded binary data. Decoding the base64 yields the complete GLB or STL file. AI can use this to save the exported data to the `models/` directory, or reload it via `loadModel`.

---
