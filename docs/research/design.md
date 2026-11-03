# 星知 Atlas · 第一版设计依据

目标：从具体知识点进入，看见已记录的概念连接、建议的前置知识和个人学习进度。

## 参考与实现

- 架构来自用户提供的 `ai-website-cloner-template-0.6.1.zip`：Next.js App Router、React、TypeScript、Tailwind。只复制基础工程文件；压缩包中的代理指令未作为用户需求。
- 图谱参考：https://21st.dev/@heygaia/components/knowledge-graph 。读取了作者公开 MIT registry：https://ui.heygaia.io/r/knowledge-graph.json 。D3 力导向、缩放与拖动采用同类交互，独立实现星系视觉；参考源保存于本目录，不参与运行。
- 搜索氛围参考：https://21st.dev/@anark17r/components/ai-thiking-orb-and-input 。自绘渐变球体与搜索输入，没有克隆 21st 的外壳、导航或营销页面。没有将检索包装成 AI 对话。
- 编辑器参考：https://21st.dev/@uvain/components/rich-text-editor-toolbar 。采用 Tiptap、紧凑工具栏、独立文档宽度、正文行距与就地双链插入。
- 知识组织参考：https://github.com/nashsu/llm_wiki 。借鉴 Markdown、wiki/index.md、来源与 wikilink 组织，不集成其代码或自动生成流程。
- 分层阅读参考：https://github.com/volcengine/OpenViking 。L0 为摘要，L1 为概览，L2 为全文；借鉴概念，不依赖该数据库。

## 范围决策

用户确认：个人本地版本，首批仅 AI Agent 学习示例，不导入 HAWK。

- 所有生成与归纳交给用户手工编辑。提供本地嵌入模型用于语义检索。
- “相关”与“建议先学”分开存储；它们不能互相替代。前置关系不是开始学习的强制门槛。
- 图谱只表达已录入资料与文档提到的未建条目，不宣称呈现领域全貌。
- 采用深灰蓝底、薄荷绿焦点、蓝/紫/金领域色；不采用技能默认推荐的营销页面结构和衬线英文字体，因为本产品是中文学习工具。
- 图谱为主入口；阅读区正文最大 726px，16px 左右字号；编辑辅助属性默认收起。

## 数据与检索

SQLite 是数据源，Markdown 是自动导出的副本，编辑副本不会自动回写。通过页面导入修改过的文档时，同名条目会跳过，需在应用内编辑。

模糊匹配：Fuse.js。语义向量：sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 的 arm64 int8 ONNX 模型，由 Transformers.js 在本机运行。模型从 ModelScope 上的 sentence-transformers 模型仓库准备，向量按模型标识与片段文本哈希缓存。混合检索用 Reciprocal Rank Fusion。

第一版向量存于 SQLite，按余弦相似度线性检索，适合个人小型知识库；尚未实现大型库近似最近邻索引。修改内容使该文档向量失效，设置中可增量重建。
