# CLAUDE.md

See [AGENTS.md](./AGENTS.md) for project facts shared across agents (tech stack, directory
structure, commands, architecture, MDX compatibility baseline, conventions, gotchas, glossary).
本文件只记 **Claude Code 专属**的偏好与机制，不重复 AGENTS.md 的项目事实。

## Claude Code 专属偏好

- **库文档查询走 Context7**：涉及 Vite、`@mdx-js/*`、React、remark/rehype 生态、KaTeX、
  Mermaid 等的 API / 配置 / 版本迁移，优先用 Context7 MCP 取最新文档，别凭记忆答。
- **改编译管线先查官方文档**：`src/mdx/plugins.mjs` / `@mdx-js/rollup` 选项、remark/rehype
  插件顺序等，动手前用 Context7 核对，避免破坏官方 MDX 兼容。
- **验证渲染用浏览器工具**：改了组件 / 样式 / 图管线后，用 Playwright（或 chrome-devtools）
  MCP 打开 `mdxv` dev server 截图 + 查控制台错误，别只凭构建成功下结论。选框架前先看
  `plugin-infra:graceful-browser` skill。
- **临时文件**放会话 scratchpad / job tmp，不要污染项目目录（截图、导出产物等勿留在仓库根）。

## Subagents

下表列出本项目可用的 Subagent。**遇到匹配场景，必须优先通过 `Agent` 工具委派**，而不是在主
Agent 里硬做。表中为能力摘要，具体行为以各 agent 定义为准。

| 名称 | 来源 | 触发场景 | 不要用于 |
|------|------|----------|----------|
| researcher | plugin (gen-ai-development) | research-pipeline 派发的调研执行单元；快速 scoped 查证 | 直接面向用户的调研入口（用 research-pipeline）；广域 web 扫描（主 Agent 调 deep-research） |
| planner | plugin (gen-ai-development) | 走 OpenSpec 流程提案新功能 / 大重构（写四契约 spec） | 单文件修复；实现代码 |
| arch-reviewer | plugin (gen-ai-development) | spec 含 DDL / 新接口 / 跨模块 / 删除时，实施前设计审查 | 纯逻辑小 spec（跳过留痕）；审实现代码（那是 code-reviewer） |
| developer | plugin (gen-ai-development) | spec 已就绪的 TDD 实施（产品代码 + 单测） | 缺少 spec 时禁用；e2e 测试代码 |
| e2e-author | plugin (gen-ai-development) | spec 声明脚本化载体后写 e2e 测试代码（与 developer 并行） | 改产品代码；agent 驱动载体的变更 |
| code-reviewer | plugin (gen-ai-development) | merge 进 dev 前的增量审查（门禁，两判定）；全量仅显式要求 | 一次性脚本；审设计（那是 arch-reviewer） |
| e2e-runner | plugin (gen-ai-development) | 实施 + QA 交付后的 E2E 验收（先拉起应用） | 单测验证；写 / 改任何代码 |
| debugger | plugin (gen-ai-development) | bug / 失败 / 栈回溯出现时的假设驱动调试 | spec 创建；无 bug 背景的功能实现（只诊断 + 写红回归测试，不改产品码） |
| release-coordinator | plugin (gen-ai-development) | 发布准备（SemVer 决策、版本同步点核验、release notes 草稿） | 执行 merge/push/publish（不可逆动作由主 Agent 在用户同意下做） |
| code-simplifier | plugin | 近期改动的可读性 / 一致性 / 简化清理（不找 bug） | 找 bug（用 code-reviewer / debugger）；改行为 |
| claude-code-guide | plugin | 关于 Claude Code / Agent SDK / Claude API 的用法问答 | 本项目业务代码 |
| Explore | built-in | 跨多文件的代码定位与「在哪定义」 | 已知路径直接 Read |
| Plan | built-in | 设计实施方案 | 单行修改 |
| general-purpose | built-in | 多步开放式搜索 / 调研 | 单次明确查找 |

> 本项目无用户级（`~/.claude/agents/`）与项目级（`.claude/agents/`）自定义 Subagent；
> 新增后请在此表登记。

## 委派规则

- **并行原则**：多个互不依赖的子任务，一次消息里发起多个 `Agent` 调用并行跑。
- **理解不外包**：不要把「基于结果再修复」的判断完全交给 Subagent；主 Agent 必须读关键文件
  并做综合，Subagent 的最终报告不会展示给用户，需由主 Agent 转述要点。
- **研发按 `gen-ai-development:autonomy-controller` skill 编排**：三信号分类、自治档位、轨道
  组装、按档位定门、按强度验证、`PIPELINE.md` 状态落盘均以该 skill 为准；此处只留指针，不复制内容。
- **调研需求按 `gen-ai-development:research-pipeline` skill 编排**：澄清、确认、追问都在主
  Agent；`researcher` 仅作为执行单元被派发。
- **改 skill / agent / command / prompt / 文档本身不算研发**，不走上述编排（以 skill-creator 为权威轨道）。

### 本项目场景匹配示例

- 改动跨 ≥3 文件且不确定影响面（如动 `theme.css` + 组件 + 图管线）→ 先 `Explore`。
- 调研 / 对比 / 可行性（如「换 Preact 是否可行」「Shiki vs starry-night」）→ `research-pipeline` skill（researcher 仅执行单元）。
- 提议新模块 / 大重构（如新增「多文档静态站点导出」轨道）→ `planner` 走 OpenSpec。
- spec 含新接口 / 跨模块（如给 CLI 加插件协议）→ 实施前 `arch-reviewer` 设计审查。
- 实施已通过 spec 的需求 → `developer`（TDD）∥ `e2e-author`（e2e 测试代码），同消息并行。
- 渲染 bug / 构建失败 / 栈回溯 → `debugger` 假设驱动调试（产出红回归测试，不直接改产品码）。
- merge 前 → `code-reviewer`（增量审查）∥ `e2e-runner`（拉起 `mdxv` 做验收），同消息并行。
- 发布准备（发 npm / 版本 bump）→ `release-coordinator`（只准备，主 Agent 在用户同意下执行）。

## Claude Code 在本项目中的注意事项

- **不自动 commit / push**：仅在用户明确要求时提交。
- **默认工作分支 `dev`**：`main` 只用于发布；不要直接往 `main` 提交或 push。
- **保持双端渲染一致**：`src/mdx/plugins.mjs` 与 `src/cli/vite-config.mjs` 由 view 与 build
  共用；改其一要确认 `mdxv`（dev）与 `mdxx`（导出）两条路径都仍正确。
- **自包含是硬约束**：导出产物不得引任何 CDN / 外链；新增资源须能被内联，改动后核实零外链。
- **验证到位再收口**：涉及组件 / 图 / 数学 / 主题的改动，跑一遍 `mdxv examples/demo.mdx`
  或对 `examples/` 目录用浏览器工具核对，不要只说「应该没问题」。
