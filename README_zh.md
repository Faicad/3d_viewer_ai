# 3D Viewer — AI 技能说明

基于浏览器的 3D 模型查看器，支持 29+ 种文件格式，所有资源离线运行。\
用户说"查看这个 3D 模型文件"——AI 自动完成。

---

## 功能

- **拖放加载**：直接将模型文件拖入浏览器窗口即可加载
- **材质编辑**：PBR 材质参数调整（金属度、粗糙度、颜色等）
- **环境贴图**：HDR/EXR 环境贴图切换
- **线框模式**：所有格式均支持网格线框叠加
- **变换工具**：平移/旋转/缩放
- **选择工具**：对象/面/边/顶点选择
- **模型动画**：支持播放模型动画，支持clip切换，支持循环播放，支持播放速度控制
- **场景树**：模型部件分层展示，独立控制可见性
- **3D打印**：热床显示，耗材计算
- **模型下载**：导出为 STL 或 GLB (todo)
- **测量工具**：点间距测量 (todo)
- **深色/浅色主题**、**中英文界面**
- **4 种显示模式**：实体 / 线框 / 实体+线框 / 三角网格



## 安装

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


## 完整流程

```bash
cp /path/to/model.stl <skill_dir>/models/
node <skill_dir>/scripts/serve.mjs
# 打开 http://localhost:4273/#/workspace?url=./models/model.stl
```

详见 [`SKILL.md`](skills/3d_viewer/SKILL.md)。

GitHub Pages 在线版：`https://faicad.github.io/3d_viewer/`

## 代码说明
本项目代码移植自 `https://github.com/Faicad/3d_viewer_electron` 项目。

本项目可以部署为静态web网站，也可以部署为一个AI的技能包。

3d_viewer_electron项目则是提供电脑版的应用程序，可以访问os的原生能力。
