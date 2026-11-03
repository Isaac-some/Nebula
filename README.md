# Nebula

[在线个人 Demo](https://isaac-some.github.io/Nebula/) · [自动部署记录](https://github.com/Isaac-some/Nebula/actions)

在线版无需安装，首次打开自动载入 56 篇示例。笔记、新增内容和学习状态保存在当前浏览器的 IndexedDB 中，访问者之间独立，不上传服务器、不跨设备同步。清除网站数据会删除笔记，请在设置中导出 ZIP 备份。支持编辑、双链图谱、收藏、学习状态、关键词模糊搜索，以及 Markdown 导入/导出；语义模型仅在下面的本机服务版提供。

本地运行的 Web 知识库：文档、双向链接、星图与学习路径。当前包含 26 篇 AI Agent 学习示例、8 篇基础概念、17 篇研究综述和 5 个机构入口。运行时不调用生成式 AI。研究综述覆盖 Anthropic、OpenAI、DeepSeek、Google、Google DeepMind，选取 34 个独立一手来源，主要为 2015—2025 年资料；每篇综述保留 2—3 个原始链接，不是全面抓取或最新文献目录。

## 打开

双击 `启动Nebula.command`。或在终端运行：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm install
npm run setup:model
npm run build
npm run preview
```

浏览器打开 http://127.0.0.1:3210 。首次模型下载约 130 MB，之后离线使用。Node.js 24+。本机开发已经安装好依赖和模型。

更新代码后，先在运行服务的终端按 Control+C 停止服务，再运行 `npm run build`，最后运行 `npm run preview`。不要在服务仍运行时覆盖 `.next` 构建目录，否则旧服务可能继续引用已被新构建替换的样式文件，出现无样式白页。

开发：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm run dev -- --hostname 127.0.0.1 --port 3210
```

## 使用

- 新建知识点，编辑 L0 一句话、L1 概览和 L2 全文。
- 输入 `[[AI Agent]]` 或使用工具栏双链按钮，连接已有文档。未建文档显示待补充节点，点击可创建。
- “前置知识”表达建议的学习顺序；修改学习状态后，学习路径会更新。
- 平面关系图采用 Obsidian 风格的力导向布局与直线连接：拖动节点可整理布局，拖动画布平移，滚轮/双指缩放；支持领域、节点类型、关系筛选、局部关联与沉浸模式。默认不选中任何节点。悬浮临时突出相邻节点和连线，单击预览并保留选择，双击阅读全文，空白处单击或 Escape 取消聚焦。拖动时邻居实时让位，关联节点跟随，松手后继续缓动。文字随缩放与关联距离分层显示，并自动避让。
- 图谱领域、类型、关系与学习状态使用统一深色下拉菜单，支持鼠标、键盘和屏幕边缘自动避让。
- 星图右上角“疏密与显示”可调向心力、排斥力、连接拉力、连线长度、文字密度、节点大小及线宽，自动保存到本机浏览器。力度调整保留当前视角，“查看全图”可重新收拢视野。
- 星图底部直接模糊匹配标题、别名、标签、机构和摘要，选择结果会解除筛选并定位节点，无需等待向量模型。`⌘K` 可搜索完整文档。
- 文献页集中列出原始来源、机构和日期，并保留“解释、应用、评测、扩展、对比”等关系；这些元数据支持 Markdown 导入导出。
- 全库搜索支持关键词（默认）、语义和混合检索；`⌘S` 保存编辑。设置内建立或增量更新语义索引。
- 导入 `.md` / `.markdown` / `.txt`，每次最多 500 篇、10 MB。同名文档跳过并提示。导入面板可复制或下载 [Nebula Markdown Skill](public/skills/nebula-markdown/SKILL.md)，交给模型生成包含 L0/L1/L2、双链、前置知识和来源的文档；也提供可直接导入的格式示例。已有文件仍可直接选择导入。
- 在设置导出 ZIP，解压后把“Nebula知识库”文件夹作为 Obsidian vault 打开。包含元数据、索引和双链。

## 数据

- `data/atlas.sqlite`：文档与向量索引，重启保留。
- `data/vault/wiki/`：Markdown 副本，应用保存时更新；不自动监听外部改动。
- `data/models/`：本地嵌入模型。
- `data/trash/`：删除文档原文；可将其中 Markdown 重新导入来恢复。
- 浏览器本地保存未提交草稿；保存到知识库后移除。

备份可使用设置中的导出，或停止程序后复制整个 data 目录。导出不包含语义模型和向量，导入后可重新建立索引。多页面同时修改时检查版本，防止旧内容覆盖。重命名保留旧标题为别名，已有双链仍可解析。

程序绑定本机地址，适用于个人使用。未实现账号、多人协作、网络部署鉴权、自动 AI 整理、网页剪藏、PDF / Office 导入、附件管理和自动同步。不要直接公开部署。

## GitHub 与在线部署

推送到 `main` 后，GitHub Actions 自动检查源码、构建在线个人版、运行浏览器验收并发布到 GitHub Pages。Pull Request 执行检查与构建，不发布。在线版本通过 `npm run build:pages` 生成 `out/` 静态文件，默认子路径 `/Nebula`，可用环境变量 `PAGES_BASE_PATH` 修改。

发布构建在被 Git 忽略的 `temp/pages-build/` 中独立运行，不会覆盖正在运行的本机服务的 `.next/`，也不会读取或上传 `data/`。构建只使用仓库中的 `seed/` 示例。服务端 API 保留给本机版，在线版所有数据操作在浏览器内执行。

本地预览发布版本：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm ci
npm run build:pages
mkdir -p temp/pages-preview
ln -sfn ../../out temp/pages-preview/Nebula
python3 -m http.server 3220 --bind 127.0.0.1 --directory temp/pages-preview
```

打开 http://127.0.0.1:3220/Nebula/ 。在线个人版验收：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
ATLAS_TEST_URL=http://127.0.0.1:3220/Nebula/ ATLAS_BROWSER_DEMO=true npx playwright test tests/browser-demo.spec.ts tests/render.spec.ts tests/graph-drag.spec.ts tests/graph-interaction.spec.ts
```

## 验证

先停止运行中的应用，再检查与构建：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm run lint
npm run typecheck
npm run build
```

然后启动应用，在另一个终端运行浏览器验收：

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm run preview
```

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npm run test
```

端到端测试使用本机 Chrome，对临时验收文档进行创建与删除，不修改示例内容。语义用例要求已建立索引。另见 `docs/research/design.md`、`docs/research/obsidian-graph-interaction.md`、`docs/research/drag-and-select-fix.md` 与 `docs/验收记录.md`。

## 给已有知识库导入本轮研究

新建知识库会自动带上全部示例。已有知识库运行下方命令补入 30 篇新文档，同名文档跳过，保留已有编辑；导入前自动在 `data/backups/` 创建 SQLite 快照。

```bash
cd /Users/isaac/Documents/ChatGPT/知识图谱
npx tsx scripts/import-research.ts
```

导入后，在设置中增量更新语义索引。首次研究清单与原始来源见 `docs/research/frontier-ai-sources-2026-11-02.md`。
