# 前沿 AI 研究首批来源与知识连接

整理日期：2026-11-02。共 17 篇主题笔记，来自 34 个独立的一手论文或机构文章；每篇至少综合两个独立来源，不把同一论文的网页和 PDF 计成两份文献。

这是围绕学习 Agent 所需知识的首批精选，不是全站爬取、机构完整文献库或截至今天的最新研究综述。文献主要覆盖 2015—2025 年。研究笔记的完整正文和可导入元数据保存在 `seed/research-notes.json`；下文保留选题、结论入口、来源与重要限制。

## 核验口径

- 实际打开官方原文、arXiv 摘要/技术正文与 AlphaCode 2 原始报告，核对标题、作者机构、日期和直接支持的结论；没有抓取全文镜像或下载完整文章。
- `publishedAt` 对论文表示首次 arXiv 提交日期，对机构文章表示页面发布日期。o1 系统卡页面仅明确标注更新日期，因此未填首次发布日期。T5 正文链接是 v4，日期仍记录论文首次提交时间；R1 显式固定为 v1。
- 采用原创中文摘要，区分机制、实验观察、工程经验、限制与阅读练习；阅读练习是学习建议，不能当作来源已经验证的产品实验。
- `prerequisites` 表示建议先了解的概念；`relations` 的解释、应用、评测、扩展、对照不应全部显示成前置依赖。文档双链与模型内部残差连接也不是同一层次的“连接”。
- 历史 Google Brain / Google Research 归入 Google；历史 DeepMind 在机构入口归入 Google DeepMind，来源信息保留发表时名称。合著大学和 Microsoft Research 的归属在来源与正文中单独保留。

## 覆盖

| 机构入口 | 涉及笔记数 | 主要方向 |
| --- | ---: | --- |
| Anthropic | 3 | Agent 架构、上下文、工具设计、MCP |
| OpenAI | 4 | 偏好对齐、推理时计算、输出约束、缩放规律 |
| DeepSeek | 3 | MoE、MLA、均衡路由、GRPO 与推理训练 |
| Google | 6 | Transformer、T5、MoE、CoT、ReAct、REALM |
| Google DeepMind | 5 | Universal Transformer、WebAgent、RETRO、Chinchilla、AlphaCode |

同一笔记可有多个机构来源，表内数字相加不等于总篇数。另补 Microsoft Research 的 ResNet 原作，避免把残差连接的原始研究错归给 Google。

## 主题笔记

### 1. 从工作流到自主 Agent：何时值得增加复杂度

先分清任务路径能否预先确定，再决定使用单次调用、固定工作流或自主 Agent。多 Agent 的价值来自可并行探索，也需要付出协调与调用成本。

边界：架构文章与内部研究评测提供经验性证据，不能证明多 Agent 普遍更好。

连接：[[AI Agent]]（explains）、[[工作流]]（contrasts）、[[上下文窗口]]（applies）、[[上下文工程：把有限窗口留给有用信息]]（extends）

- [S1 · Building effective agents](https://www.anthropic.com/research/building-effective-agents) · Anthropic · 2024-12-19
- [S2 · How we built our multi-agent research system](https://www.anthropic.com/research/multi-agent-research-system) · Anthropic · 2025-06-13

### 2. 上下文工程：把有限窗口留给有用信息

上下文工程关注每轮推理实际看见什么。检索负责选择，压缩负责保留关键状态，持久笔记负责跨窗口延续；这些环节需要分别评估。

边界：think 工具文章后续更新已建议多数场景采用集成的扩展思考；压缩也可能丢失关键状态。

连接：[[上下文工程]]（explains）、[[记忆机制]]（applies）、[[分层索引]]（applies）、[[提示词工程]]（extends）

- [S1 · Effective context engineering for AI agents](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) · Anthropic · 2025-09-29
- [S2 · The think tool: Enabling Claude to stop and think in complex tool use situations](https://www.anthropic.com/research/claude-think-tool) · Anthropic · 2025-03-20

### 3. 工具设计与 MCP：连接能力和使用能力是两回事

把工具描述、参数、结果内容和返回长度一起设计。协议建立连接，真实任务评测才能判断连接后是否完成工作。

边界：MCP 解决连接标准，工具任务成功率还需要独立验证。

连接：[[MCP]]（explains）、[[工具调用]]（applies）、[[模型评测]]（applies）、[[函数调用与结构化输出：格式正确之后还要验证什么]]（contrasts）

- [S1 · Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) · Anthropic · 2024-11-25
- [S2 · Writing effective tools for agents — with agents](https://www.anthropic.com/research/writing-tools-for-agents) · Anthropic · 2025-09-11

### 4. 从人类偏好到指令遵循：RLHF 如何改变模型行为

人类示范提供初始行为，成对偏好训练奖励模型，强化学习再优化输出策略。奖励只是对人类偏好的近似，需要评估偏差与泛化。

边界：人类偏好与奖励模型都是训练目标的近似，不等于事实真值。

连接：[[强化学习]]（explains）、[[大语言模型]]（extends）、[[提示词工程]]（contrasts）、[[DeepSeek-R1 与 DeepSeekMath：奖励怎样塑造推理]]（contrasts）

- [S1 · Learning to summarize from human feedback](https://arxiv.org/abs/2009.01325) · OpenAI · 2020-09-02
- [S2 · Aligning language models to follow instructions](https://openai.com/index/instruction-following/) · OpenAI · 2022-01-27

### 5. OpenAI o1：把计算预算放到回答之前

推理模型通过训练学习更有效的中间求解过程，并在回答前使用额外计算。能力提升需要与任务类型、预算和局限一起解释。

边界：历史型号的能力评测不能当作当前 API 可用性说明；推理预算影响成绩。

连接：[[推理模型]]（explains）、[[强化学习]]（applies）、[[模型评测]]（evaluates）、[[思维链与自洽性：从一条路径到多条候选]]（contrasts）

- [S1 · Learning to reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/) · OpenAI · 2024-09-12
- [S2 · OpenAI o1 System Card](https://openai.com/index/openai-o1-system-card/) · OpenAI · 首次发布日期未填

### 6. 函数调用与结构化输出：格式正确之后还要验证什么

函数调用让模型提出可执行的参数，结构化输出让结果满足约定格式。应用仍负责执行、鉴权、结果校验和失败处理。

边界：符合 Schema 的值仍可能错误，拒答和中断需要单独处理。

连接：[[结构化输出]]（explains）、[[工具调用]]（applies）、[[模型评测]]（applies）、[[工具设计与 MCP：连接能力和使用能力是两回事]]（extends）

- [S1 · Function calling and other API updates](https://openai.com/index/function-calling-and-other-api-updates/) · OpenAI · 2023-06-13
- [S2 · Introducing Structured Outputs in the API](https://openai.com/index/introducing-structured-outputs-in-the-api/) · OpenAI · 2024-08-06

### 7. DeepSeek-V2 与 DeepSeekMoE：容量和计算分开增长

MoE 用少量激活专家提供更大参数容量；MLA 压缩推理缓存。两者优化的是不同资源，不能仅用总参数量判断部署成本。

边界：总参数、激活参数、缓存和吞吐是不同维度，性能比较要保留硬件条件。

连接：[[混合专家模型]]（explains）、[[多头潜在注意力]]（explains）、[[记忆机制]]（contrasts）、[[DeepSeek-V3：专家负载均衡也是学习问题]]（extends）

- [S1 · DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) · DeepSeek · 2024-01-11
- [S2 · DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model](https://arxiv.org/abs/2405.04434) · DeepSeek · 2024-05-07

### 8. DeepSeek-V3：专家负载均衡也是学习问题

路由既要把 Token 分给合适专家，也要避免少数专家过载。动态偏置为负载调节提供途径，但整套模型收益不能归于单一技巧。

边界：完整 V3 系统同时包含多项改动，不能将所有收益归于单一均衡策略。

连接：[[混合专家模型]]（extends）、[[多头潜在注意力]]（applies）、[[模型评测]]（evaluates）、[[DeepSeek-V2 与 DeepSeekMoE：容量和计算分开增长]]（extends）

- [S1 · Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) · DeepSeek / Peking University · 2024-08-28
- [S2 · DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) · DeepSeek · 2024-12-27

### 9. DeepSeek-R1 与 DeepSeekMath：奖励怎样塑造推理

可检查答案为推理学习提供奖励信号。R1-Zero 与 R1 的训练流程不同，不能把前者的纯强化学习实验直接套到后者的完整产品模型。

边界：固定采用 R1 的 2025 年 v1，明确区分纯强化学习实验 R1-Zero 与含冷启动等步骤的 R1。

连接：[[强化学习]]（applies）、[[思维链]]（extends）、[[推理模型]]（explains）、[[从人类偏好到指令遵循：RLHF 如何改变模型行为]]（contrasts）、[[OpenAI o1：把计算预算放到回答之前]]（contrasts）

- [S1 · DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300) · DeepSeek · 2024-02-05
- [S2 · DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning (v1)](https://arxiv.org/html/2501.12948v1) · DeepSeek · 2025-01-22

### 10. Transformer 与 Universal Transformer：信息交互和重复计算

注意力决定信息如何交互，网络结构决定交互重复多少次。原始翻译结果不能直接推出通用推理能力，自适应计算也是独立研究问题。

边界：原始 Transformer 主要在翻译等任务验证；Universal Transformer 的理论结果依赖假设。

连接：[[Transformer]]（explains）、[[注意力机制]]（explains）、[[上下文窗口]]（applies）、[[推理模型]]（contrasts）、[[残差连接与归一化：深层网络如何保持可训练]]（extends）

- [S1 · Attention Is All You Need](https://arxiv.org/abs/1706.03762) · Google (Google Brain / Google Research) · 2017-06-12
- [S2 · Universal Transformers](https://arxiv.org/abs/1807.03819) · Google Brain / DeepMind / University of Amsterdam · 2018-07-10

### 11. 残差连接与归一化：深层网络如何保持可训练

残差连接把输入与学习到的变化相加；归一化调整中间表示的尺度。它们常一起出现，却不是同一个机制，也不是知识图谱里的文档链接。

边界：ResNet 原作来自 Microsoft Research；T5 明确未单独消融这些架构修改，不能构造单一因果归因。

连接：[[残差连接]]（explains）、[[归一化]]（explains）、[[Transformer]]（applies）、[[双向链接]]（contrasts）、[[知识图谱]]（applies）

- [S1 · Deep Residual Learning for Image Recognition](https://arxiv.org/abs/1512.03385) · Microsoft Research · 2015-12-10
- [S2 · Attention Is All You Need](https://arxiv.org/abs/1706.03762) · Google (Google Brain / Google Research) · 2017-06-12
- [S3 · Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/html/1910.10683v4) · Google · 2019-10-23

### 12. Switch 与 GShard：稀疏模型为什么仍需要系统工程

GShard 连接条件计算与自动分片，Switch 简化专家路由。总参数、激活计算量、通信与内存需要分别记录，不能混为一个成本数字。

边界：专家稀疏激活不消除权重存储、路由和跨设备通信成本。

连接：[[混合专家模型]]（explains）、[[Transformer]]（extends）、[[模型评测]]（evaluates）、[[DeepSeek-V2 与 DeepSeekMoE：容量和计算分开增长]]（contrasts）、[[DeepSeek-V3：专家负载均衡也是学习问题]]（contrasts）

- [S1 · GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding](https://arxiv.org/abs/2006.16668) · Google · 2020-06-30
- [S2 · Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) · Google · 2021-01-11

### 13. 思维链与自洽性：从一条路径到多条候选

思维链示例鼓励分步生成，自洽性从多条候选推理路径聚合答案。收益取决于模型、任务与采样预算，重复生成不代表独立求证。

边界：多次答案一致不表示独立证据，采样预算也属于评测条件。

连接：[[思维链]]（explains）、[[少样本学习]]（applies）、[[提示词工程]]（extends）、[[强化学习]]（contrasts）、[[OpenAI o1：把计算预算放到回答之前]]（contrasts）

- [S1 · Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903) · Google · 2022-01-28
- [S2 · Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://arxiv.org/abs/2203.11171) · Google · 2022-03-21

### 14. ReAct 与 WebAgent：让行动带回新证据

ReAct 让推理、行动和观察交替；WebAgent 把网页规划、相关内容提取与程序生成分工。环境反馈是连接语言模型和真实任务的重要环节。

边界：ReAct 为 Princeton 与 Google 合作，WebAgent 为 Google DeepMind 与东京大学合作；网站外推需谨慎。

连接：[[AI Agent]]（explains）、[[工具调用]]（applies）、[[上下文工程]]（applies）、[[从工作流到自主 Agent：何时值得增加复杂度]]（extends）

- [S1 · ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) · Princeton University / Google · 2022-10-06
- [S2 · A Real-World WebAgent with Planning, Long Context Understanding, and Program Synthesis](https://arxiv.org/abs/2307.12856) · Google DeepMind / University of Tokyo · 2023-07-24

### 15. REALM 与 RETRO：把知识放进可检索的外部记忆

REALM 研究联合学习知识检索，RETRO 用检索片段与分块交叉注意力增强生成。二者不能直接等同于“搜索几段文字再拼提示”的所有 RAG 系统。

边界：训练与结构内检索不同于所有应用层 RAG；相似性不等于来源支持度。

连接：[[RAG]]（explains）、[[向量检索]]（applies）、[[记忆机制]]（extends）、[[文档分块]]（applies）、[[语义相似度]]（contrasts）

- [S1 · REALM: Retrieval-Augmented Language Model Pre-Training](https://arxiv.org/abs/2002.08909) · Google · 2020-02-10
- [S2 · Improving language models by retrieving from trillions of tokens](https://arxiv.org/abs/2112.04426) · DeepMind (now Google DeepMind) · 2021-12-08

### 16. 从缩放定律到 Chinchilla：参数不是唯一的规模

缩放规律是对实验区域内关系的拟合。Chinchilla 将更多预算分配给训练 Token，提醒读者不要只按参数规模判断能力或效率。

边界：经验拟合依赖数据、训练设置与范围，训练预算最优不能直接等同于部署最优。

连接：[[缩放定律]]（explains）、[[Token]]（applies）、[[模型评测]]（evaluates）、[[OpenAI o1：把计算预算放到回答之前]]（contrasts）、[[Switch 与 GShard：稀疏模型为什么仍需要系统工程]]（contrasts）

- [S1 · Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) · OpenAI · 2020-01-23
- [S2 · Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) · DeepMind (now Google DeepMind) · 2022-03-29

### 17. AlphaCode 系列：生成候选、运行检查与最终评测

先生成多种代码候选，再依据执行行为过滤、聚类并选择提交。系统表现来自模型与搜索组合，不能直接代表一次调用的可靠性。

边界：竞赛系统组合了生成、搜索和筛选，不能用其排名推断单次回答或真实软件工程质量。

连接：[[模型评测]]（explains）、[[工具调用]]（applies）、[[大语言模型]]（evaluates）、[[思维链与自洽性：从一条路径到多条候选]]（contrasts）

- [S1 · Competition-Level Code Generation with AlphaCode](https://arxiv.org/abs/2203.07814) · DeepMind (now Google DeepMind) · 2022-02-08
- [S2 · AlphaCode 2 Technical Report](https://storage.googleapis.com/deepmind-media/AlphaCode2/AlphaCode2_Tech_Report.pdf) · Google DeepMind · 2023-12-06

## 基础概念的来源映射

| 概念 | 来源一 | 来源二 | 阅读提醒 |
| --- | --- | --- | --- |
| 残差连接 | [ResNet](https://arxiv.org/abs/1512.03385) | [T5 §2.1](https://arxiv.org/html/1910.10683v4) | 原作来自 Microsoft Research；信息捷径与文档双链不同 |
| 归一化 | [Transformer §3.1](https://arxiv.org/html/1706.03762v7) | [T5 §2.1](https://arxiv.org/html/1910.10683v4) | 注意位置变化；T5 未单独消融这些改动 |
| 混合专家模型 | [Switch](https://arxiv.org/abs/2101.03961) | [DeepSeekMoE](https://arxiv.org/abs/2401.06066) | 总参数与激活计算分别记录 |
| 多头潜在注意力 | [DeepSeek-V2](https://arxiv.org/abs/2405.04434) | [DeepSeek-V3](https://arxiv.org/abs/2412.19437) | 缓存压缩不等于长期记忆 |
| 强化学习 | [InstructGPT](https://openai.com/index/instruction-following/) | [DeepSeek-R1 v1](https://arxiv.org/html/2501.12948v1) | 比较偏好奖励与可检查结果奖励 |
| 思维链 | [CoT](https://arxiv.org/abs/2201.11903) | [Self-consistency](https://arxiv.org/abs/2203.11171) | 提示策略、解码策略与训练方式分别理解 |
| 缩放定律 | [OpenAI](https://arxiv.org/abs/2001.08361) | [Chinchilla](https://arxiv.org/abs/2203.15556) | 经验规律不是固定的通用最优公式 |
| 上下文工程 | [Context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) | [Multi-agent research system](https://www.anthropic.com/research/multi-agent-research-system) | 选择、压缩、持久状态与读回分别评估 |

## 数据校验

- 17 个不同标题；34 个去重来源；每篇 2—3 个独立来源。
- 所有双链、前置概念、类型关系目标均在约定的 34 个基础概念或本批 17 篇研究标题内。
- 正文中文汉字数为 463—506 字（不含原始来源列表；另有 L0 摘要与 L1 概览）。
- 本批没有将模型发布日期、参数规模或单项榜单成绩排序成唯一学习路线。
