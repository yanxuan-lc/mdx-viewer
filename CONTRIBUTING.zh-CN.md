# 如何贡献 mdx-viewer

[English](./CONTRIBUTING.md) · **简体中文**

本项目的开发**完全基于 VibeCoding**：所有落地代码都由 AI Agent 依据一份已提交的 spec 写成，经人类
审查，跑在 [ExcaliVibe](https://github.com/yanxuan-lc/excalivibe) 能力套件上。欢迎你以同样的方式
参与——你提供意图与判断，Agent 产出变更，推理留痕与代码一并提交。

不跑 Agent 也能贡献。一个说清楚的 issue 就是一等贡献：流程正是从这份 brief 开始的。

## 这里的 VibeCoding 指什么

- **没有人手写补丁。** 人类负责意图、验收标准、审 diff，以及所有不可逆动作——commit、push、merge、
  publish 永不自动执行。
- **每个非平凡变更都以 OpenSpec 变更落地。** `openspec/changes/<id>/` 目录随代码一起提交，审查者能
  读到：需求是什么、决策是什么、哪些门禁过了。
- **例外：** 错别字、文案措辞、一行的显然修复可以直接改——但仍须通过测试。

## 环境准备

要求：Node ≥ 20、git，以及 Claude Code（或 Codex ≥ 0.117.0）。

```bash
git clone https://github.com/yanxuan-lc/mdx-viewer.git
cd mdx-viewer
make install        # 装依赖
make link           # 可选：把 mdxv / mdxx 注册到 PATH
make demo           # 自检——应当打开组件总览示例
git switch dev      # dev 是工作分支；main 只用于发布
```

安装开发框架——Claude Code：

```bash
claude plugin marketplace add yanxuan-lc/excalivibe
claude plugin install gen-ai-development@excalivibe   # 研发流程套件
claude plugin install plugin-infra@excalivibe         # 浏览器自动化 + mdx-artifact skill
claude plugin marketplace update excalivibe           # 之后拉框架更新用这条
```

Codex（CLI 0.117.0+）：

```bash
codex plugin marketplace add yanxuan-lc/excalivibe
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe

# gen-ai-development 的 9 个 subagent 是独立 TOML 文件——plugin 机制不会自动注册
# 自定义 agent 的 TOML，需单独安装：
git clone https://github.com/yanxuan-lc/excalivibe.git
mkdir -p ~/.codex/agents
cp excalivibe/codex/agents/*.toml ~/.codex/agents/
```

装完开一个**新会话**，skill、MCP 与 subagent 才会加载。**漏掉拷 TOML 这步，下文流程里的角色
（`planner`、`developer`、`code-reviewer`……）根本不存在。**

仓库自带面向 Agent 的契约文件：[`AGENTS.md`](./AGENTS.md) 是所有 Agent 都读的项目事实（技术栈、
目录结构、命令、测试清单、MDX 兼容基线、已知陷阱、术语表）；[`CLAUDE.md`](./CLAUDE.md) 只放
Claude Code 专属内容（Subagent 登记表、委派规则）。**不要在 prompt 里复述项目事实**——把 Agent
指向这两个文件即可。

## 研发闭环

用你自己的话描述需求——「给 `Callout` 加一个 `tone=success`」「`mdxx` 导出里 mermaid 图的深色主题
不对」——交给 `flow` 引擎编排。它会分类意图、为这次变更组装 FLOW，节点状态一律从磁盘检测得出，
不依赖任何人的记忆：

| 节点 | 承担者 | 产出 |
|---|---|---|
| `grill` | 主 Agent | `BRIEF.md`——把模糊的需求磨成明确的行为 brief |
| `design-spec` | `planner` | `proposal.md` · `design.md` · `specs/<capability>/spec.md` · `tasks.md` |
| `arch-review` | `arch-reviewer` | `REVIEW.mdx`——仅当 spec 含新接口、跨模块拆分或删除时 |
| `implement` | `developer` | 产品代码 + 单测，测试先行；`tdd-evidence.md` |
| `e2e-author` | `e2e-author` | Playwright spec + `e2e-manifest.md`，与 `implement` 并行 |
| `security` / `a11y` / `perf` 门 | skill | `security-scan-report.md` · `a11y-report.md` · `perf-report.md` |
| `e2e-run` | `e2e-runner` | `e2e-report.md`——对真实跑起来的应用执行场景 |
| `code-review` | `code-reviewer` | `CHECKLIST.md`，两个独立判定（spec 符合性、代码质量） |
| `merge` | 你 | 合入 `dev` |
| `archive` | `openspec archive <id>` | 变更移入 `openspec/changes/archive/`，其 spec 合并进 `openspec/specs/` |

不适用的节点会**带理由记为 skipped**，绝不静默丢弃。

上表的每份产物都落在该变更自己的 `genai/` 子目录里——`openspec/changes/<id>/genai/`——和记录节点
检测状态的 `flow.json` 放在一起。spec 本身（`proposal.md` · `design.md` · `specs/` · `tasks.md`）
仍留在变更根目录，那是 `openspec` 认的位置。项目级状态（BACKLOG · INBOX · sprint · `config.json`）
统一放在仓库根的 `genai/`。

完整的真实留痕见
[`openspec/changes/archive/2026-07-25-i18n-preferences/`](./openspec/changes/archive/2026-07-25-i18n-preferences/)
——注意归档变更早于当前布局，证据仍摊在变更根目录，用的是手写的 `PIPELINE.md`，而非今天检测得出的
`flow.json`。

## 红线

以下条目对任何变更一律适用（不论是否由 Agent 写成）。它们正是这个项目之所以是这个项目的原因。

1. **官方 MDX 兼容是红线。** `src/mdx/plugins.mjs` 是兼容性核心。动它之前先对着官方文档核对插件
   选项与顺序（在 Claude Code 里用 Context7，别凭记忆）。破坏官方标准的 CommonMark + JSX + `{}`
   表达式 + ESM `import`/`export` 的变更，无论换来什么好处都不接受。
2. **导出必须自包含。** `mdxx` 产物零外链——不引 CDN、不引远程字体、不引远程脚本。新增资源必须可
   内联；加了就补导出冒烟测试。
3. **两条路径保持一致。** `src/mdx/plugins.mjs` 与 `src/cli/vite-config.mjs` 由 `mdxv`（dev
   server）与 `mdxx`（导出）共用。改了其一，两条路径都要验。
4. **组件按 OCP 扩展。** 在 `src/app/components/blocks.tsx`（需浏览器运行时则用 `client.tsx`）写
   一个 React 组件，再在 `src/app/mdx-components.tsx` 的映射表加一行。核心渲染管线不动。
5. **只用语义参数；颜色写在 `theme.css`。** 组件接 `tone` / `ratio` / `status`，绝不接颜色值。
   明暗、配色、密度只经 `<html>` 上的 `data-theme` / `data-palette` / `data-density` 切换。
6. **产品文案 vs 作者内容。** 界面字符串放 `src/i18n/messages.mjs`，经 `t()` 取词；作者写在 MDX
   里的内容永不进入该目录，也不参与翻译。
7. **两种 locale 成对推进。** `zh-CN` 与 `en-US` 同步改动——`messages.mjs`、`demo/`、两份 README。

### 有一个下游消费者要记着

ExcaliVibe 的 `plugin-infra` 带一个 `mdx-artifact` skill：它写 `.mdx`，再用全局 `mdxv` 预览，其组件
速查明确对齐本包的某个版本（`mdx-viewer ≥ 0.2.0`，用 `mdxv --version` 核）。那份速查**故意不是权威
源，本仓库才是**。所以你新增 / 改动组件、组件参数或 frontmatter 字段后，那个 skill 的 `SKILL.md`
与 `references/blocks.md` 需要同步改一遍。先在这里落地，并在 PR 里点一句，好让框架侧跟上。

那个 `≥ 0.2.0` 只管**组件速查**这一面。同一个 skill 还**用 `mdxv --check` 做交付门禁**——编译不过
的文档它不交出去——而这个 flag 自 **0.3.0** 才有。所以 `--check` 的 CLI 契约（flag 名、退出码
`0` / `1` / `2`、报告走 stdout 与 `Error:` 走 stderr 的分流）同样是一条跨仓契约：改动其中任何一项
都会静默弄坏那道门禁，而本仓库看不到那边。

## 提 PR 前的验证

```bash
make test        # 单元 + 集成 + 导出冒烟（不含 e2e）
make test-e2e    # Playwright 端到端（首次需 npx playwright install）
make demo        # 用眼睛过一遍组件总览：两种主题 × 两种语言
```

- **车道按依赖表面选，不按耗时。** 每个 `test/*.test.mjs` 属于且只属于 `package.json` 里三条显式
  清单之一，**新文件必须加进对的那条**，否则那条 `make test-<lane>` 跑不到它（`make test` 走 glob，
  门控不会漏）：
  - `test:unit` —— 只在进程内，import `src/`，**零子进程**。亚秒级。
  - `test:cli` —— spawn `bin/`，断 stdout / 退出码，**不跑 Vite 构建**（起 dev server 可以）。
  - `test:build` —— 跑真实 Vite 构建。最慢，只放确实需要构建的断言。
- **新增纯逻辑模块** → 补 `test/*.test.mjs`，进 `test:unit`。
- **必须 spawn CLI 的测试** → 进 `test:cli`，哪怕它很快。**必须构建的测试** → 进 `test:build`，
  哪怕只有一条断言。把构建混进低一级车道，正是这套划分要防的缺陷 —— 上次它潜伏了好几个月。
- **改了编译管线** → 在 `test/mdx-pipeline.test.mjs` 补断言（它用官方 `@mdx-js/mdx` 编译）。
- **碰到自包含约束** → 在 `test/export.test.mjs` 补断言。
- **改了界面行为** → 补 `e2e/` spec。注意：任何断言目录（TOC）的测试都必须给 >1700px 的视口，因为
  `theme.css` 在此以下会把它隐藏（见 `AGENTS.md` 的「已知陷阱」）。
- **凡涉及视觉，「构建通过」不算验证。** 打开看一眼，或用浏览器工具截图。

## 分支、提交与 PR

- `dev` 是工作分支。`main` 只用于发布——不要直接往 `main` 提交或 push。
- 功能开发从 `dev` 切分支，审查门禁通过后合入 `dev`；只在发版时从 `dev` 向 `main` 提 PR。
- 提交标题用 Conventional Commits，小写、祈使句：`feat:` `fix:` `docs:` `test:` `build:`
  `refactor:` `chore:` `release:`。
- 正文写给「当时不在场的读者」：原来错在哪、你决定了什么、你验证了什么。翻一下 `git log`，那就是
  标准线。
- Agent 写的提交带 `Co-Authored-By:` trailer，注明写它的模型。
- 一个 PR 应包含：代码、其测试、`openspec/changes/<id>/` 目录（spec，以及 `genai/` 下的 `flow.json`
  与各门报告），
  以及用户可见行为变化时的文档更新——`README.md` 与 `README.zh-CN.md` 一起改，项目事实变了还要改
  `AGENTS.md`。

## 报 bug / 提需求

到 [issues](https://github.com/yanxuan-lc/mdx-viewer/issues) 开一条。

- **Bug**：能复现的最小 `.mdx`、完整命令（`mdxv` 还是 `mdxx`、带哪些参数）、Node 版本、操作系统，
  以及「预期 vs 实际」。一个五行就能挂掉的 MDX 文件，比一整段文字描述有用得多。
- **需求**：你想要的结果，以及现在绕过去有多难受。不必替我们做设计——`grill` 与 `design-spec` 两步
  就是干这个的。

提之前先看 `openspec/specs/` 与 `AGENTS.md` 的「已知陷阱」：有些意外其实是已记录的既定行为（例如
视口窄于 1700px 时目录不显示、落款时间永不自动生成）。

## 发布（维护者）

`make publish` 跑 `scripts/publish.sh`：版本核验 → 干净工作树与分支门禁 → 测试 → 发布到 npmjs 并打
`v<version>` tag。`make publish-dry` 只演练，不发布也不打 tag。版本号只写在 `package.json` 一处
（`publish.sh` 与导出测试都从它读），不需要同步别处。

## 许可证

提交贡献即表示你同意其以本项目的 [MIT](./LICENSE) 许可证授权。
