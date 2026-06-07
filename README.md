# 3D Viewer — AI 技能说明

基于浏览器的 3D 模型查看器，支持 29+ 种文件格式，所有资源离线运行。\
用户说"查看这个 3D 模型文件"——AI 自动完成。

---

## 功能

- **拖放加载**：直接将模型文件拖入浏览器窗口即可加载
- **4 种显示模式**：实体 / 线框 / 实体+线框 / 三角网格
- **材质编辑**：PBR 材质参数调整（金属度、粗糙度、颜色等）
- **环境贴图**：HDR/EXR 环境贴图切换
- **拓扑叠加**：STEP 文件拓扑线显示
- **线框模式**：所有格式均支持网格线框叠加
- **测量工具**：点间距测量
- **变换工具**：平移/旋转/缩放
- **选择工具**：对象/面/边/顶点选择
- **模型下载**：导出为 STL 或 GLB
- **场景树**：模型部件分层展示，独立控制可见性
- **深色/浅色主题**、**中英文界面**

## 完整流程

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# 打开 http://localhost:4173/#/workspace?url=./models/model.stl
```

详见 [`SKILL.md`](skills/3d_viewer/SKILL.md)。

GitHub Pages 在线版：`https://faicad.github.io/3d_viewer/`
