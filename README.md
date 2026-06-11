# 3D Viewer — AI Skill Description

A browser-based 3D model viewer supporting 30+ file formats, fully offline capable.\
When users say "view this 3D model file" — AI handles it automatically.\
AI can also generate 3D models from natural language via OpenSCAD.

[中文版说明](README_zh.md)

---

## Features

- **Drag & Drop**: Load models by dragging files into the browser window
- **Material Editing**: PBR material parameter adjustment (metalness, roughness, color, etc.)
- **Environment Map**: HDR/EXR environment map switching
- **Wireframe Mode**: Mesh wireframe overlay for all formats
- **Transform Tools**: Translate / Rotate / Scale
- **Selection Tools**: Object / Face / Edge / Vertex selection
- **Model Animation**: Play model animations, clip switching, looping, speed control
- **Scene Tree**: Hierarchical display of model parts with independent visibility control
- **3D Printing**: Heated bed display, filament cost calculation
- **AI Model Generation**: Generate 3D models from natural language via OpenSCAD code compilation
- **Model Download**: Export as STL or GLB (todo)
- **Measurement Tool**: Point-to-point distance measurement (todo)
- **Dark/Light Theme**, **Chinese/English UI**
- **4 Display Modes**: Solid / Wireframe / Solid+Wireframe / Triangle Mesh


## Install

```bash
npx skills add Faicad/3d_viewer
```

To update to the latest version later:

```bash
npx skills update
```

Or use it as a Claude Code plugin marketplace:

```
/plugin marketplace add Faicad/3d_viewer
/plugin install 3d_viewer
```

Once installed, the skill activates on its trigger words, and other agents can also invoke it to generate these pages.

## Full Workflow

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# Open http://localhost:4273/#/workspace?url=./models/model.stl
```

See [`SKILL.md`](skills/3d_viewer/SKILL.md) for details.

GitHub Pages online: `https://faicad.github.io/3d_viewer/`

## Acknowledgments

This project is ported from `https://github.com/Faicad/3d_viewer_electron`.

It can be deployed as a static website or as an AI skill package.

The 3d_viewer_electron project provides a desktop application with access to OS native capabilities.
