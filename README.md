# Litematic Studio

基于 Web 的 Minecraft 建筑文件（`.litematic` / `.nbt`）3D 查看与编辑工具。

## 功能

- **3D 可视化** — 使用 Three.js 渲染建筑结构，支持自由视角（WASD 移动 / 拖拽旋转）
- **多格式支持** — 兼容 Litematica 投影文件（`.litematic`）和原版结构方块文件（`.nbt`）
- **悬停高亮** — 射线检测实时显示指向方块坐标与类型
- **区块调色板** — 浏览、搜索、批量重命名方块
- **元数据编辑** — 修改名称、作者、描述等元信息
- **Raw NBT 查看** — 直接查看完整 NBT 数据结构
- **解包设置** — 切换 spanning / non-spanning 模式和 6 种遍历顺序
- **格式转换** — 在 `.litematic` 和 `.nbt` 之间导出
- **可拖拽面板** — dockable 布局，自由排布功能面板

## 技术栈

| 类别       | 技术                                                       |
| ---------- | ---------------------------------------------------------- |
| 框架       | React 19 + TypeScript + Vite                               |
| 3D 渲染    | Three.js（`@react-three/fiber` + `@react-three/drei`）    |
| NBT 解析   | `prismarine-nbt`                                           |
| Gzip 压缩  | `pako`                                                     |
| 面板布局   | `flexlayout-react`                                        |
| 数学库     | `gl-matrix`                                                |
| 测试       | Vitest + `@vitest/coverage-v8`                             |

## 项目结构

```
src/
├── core/                  # 核心数据模型
│   ├── Schematic.ts       # Schematic 接口定义
│   ├── Litematic.ts       # .litematic 文件读写
│   ├── Structure.ts       # .nbt 结构文件读写
│   ├── Region.ts          # 区域（调色板 + 方块存储）
│   ├── BlockStorage.ts    # 方块存储接口
│   ├── PackedBlockStorage.ts  # 压缩方块存储（只读）
│   ├── ArrayBlockStorage.ts   # 数组方块存储（可读写）
│   └── __tests__/         # 单元测试
├── utils/                 # 工具模块
│   ├── Raycaster.ts       # 3D DDA 体素射线检测
│   ├── litematicParser.ts # 位宽计算 / 可见性检查
│   ├── deepslateAdapter.ts
│   ├── LineRenderer.ts
│   └── __tests__/         # 单元测试
├── components/            # React UI 组件
│   ├── MenuBar.tsx        # 菜单栏
│   ├── StatusBar.tsx      # 状态栏
│   └── panels/
│       ├── ViewerPanel.tsx    # 3D 视图面板
│       ├── MetadataPanel.tsx  # 元数据编辑面板
│       ├── PalettePanel.tsx   # 调色板面板
│       ├── SettingsPanel.tsx  # 设置面板
│       └── NbtPanel.tsx       # Raw NBT 查看面板
├── hooks/
│   └── useBlockRaycast.ts # 方块悬停射线检测 Hook
├── App.tsx                # 主应用（布局工厂、文件处理）
├── LitematicViewer.tsx    # 3D 场景渲染
├── types.ts               # 公共类型定义
└── main.tsx               # 入口
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 预览构建产物
npm run preview

# 运行测试
npm test

# 测试 + 覆盖率
npm run test:coverage
```

## 使用说明

1. 点击 **File > Open** 或拖拽 `.litematic` / `.nbt` 文件到窗口
2. 在 **3D Viewer** 面板中可自由浏览建筑结构
3. 在 **Metadata** 面板修改名称、作者、描述
4. 在 **Palette** 面板搜索并批量重命名方块类型
5. 在 **Settings** 面板调整解包方式和遍历顺序
6. 点击 **File > Save** 保存修改后的文件，可在 `.litematic` 和 `.nbt` 格式间选择

## 格式说明

- **Litematic（`.litematic`）** — Litematica Mod 的投影格式，支持多区域、Version 5 (1.13-1.15) / Version 6 (1.16+)
- **NBT Structure（`.nbt`）** — Minecraft 原版结构方块格式，支持单/多调色板
- **Spanning** — Version 5 的跨长边界压缩方式
- **Non-spanning** — Version 6 的对齐长边界压缩方式

## License

MIT
