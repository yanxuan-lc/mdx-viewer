# Code Review Checklist — i18n-preferences

- **Mode**: Incremental re-review（最终修复复审；仓库无历史，无法隔离 fix diff，只能复核当前未跟踪快照）
- **Branch**: main（unborn repository）
- **Commit**: unavailable（`git rev-parse --verify HEAD` 退出 128；不存在可用 `HEAD`）
- **Reviewer model**: gpt-5.6-sol
- **Review date**: 2026-07-25
- **Scope limitation**: 当前所有文件均为 untracked，既无 merge base 也无候选提交戳。本轮按规格声明的产品、测试与 e2e 范围复核代码正确性；缺失历史本身未被当作代码缺陷，但本 artifact 不能证明无范围外夹带，也不能作为 commit freshness 证明。

## Verdict A — Spec-compliance（code-vs-spec；NOT intent）
**Status: HELD**（当前无未解决 P0/P1；仅表示当前实现匹配磁盘规格，不表示或判断人的真实意图）

- [x] 🟠 **P1 #A1 — Resolved** `src/app/PreferencesProvider.tsx` L103–L114、L130–L135 — DOM 属性同步位于 `useLayoutEffect`；仅 `auto` 注册 media-query listener，手动模式清理 listener；循环回 `auto` 前同步刷新系统主题。S4/S5 浏览器状态流通过。
- [x] 🟠 **P1 #A2 — Resolved** `src/cli/resolve.mjs` L30–L55 — 输入边界现在以 `accessSync` 验证文件/目录权限，递归 `readdirSync` 失败统一转换为 `INPUT_NOT_FOUND`；不可读文件和扫描失败路径已有 `test/resolve.test.mjs` L60–L79 覆盖。
- [x] 🟠 **P1 #A3 — Resolved** `bin/mdxx.mjs` L47–L67 — build/read/write 失败被 `CliOutputError("EXPORT_FAILED")` 边界捕获并输出所选 Locale 的单行诊断；中英文目录分别在 `src/i18n/messages.mjs` L36、L72 提供消息。真实损坏 MDX 子进程验证退出 1、英文诊断且无堆栈。
- [x] 🟠 **P1 #A4 — Resolved** `e2e/empty-states.spec.mjs` L3–L23、`e2e/i18n-preferences.spec.mjs` L139–L197 — 两种 Locale 的 directory/select-document 空状态均有正向浏览器断言；not-found、render-error、导航/TOC、控件 a11y、Grid、三种 Colophon 连接词与 GitHub 辅助标签也被触发。完整 Playwright 套件 21/21 通过。
- [x] 🟠 **P1 #A5 — Resolved** `test/cli-language.test.mjs` L87–L107、L179–L224 — S9 的两个真实入口矩阵现已完整覆盖 flag/env/system/fallback/invalid flag/invalid env。`mdxv` 启动真实 Vite 并读取 `virtual:mdxv-config`；`mdxx` 真实构建并检查静态 Locale 与 bundled provenance；新增 invalid `MDXV_LANG` 用例对两入口断言退出 1、本地化 allowed-values 诊断、无启动/构建输出、无堆栈且无请求产物。本轮定向套件 14/14 通过。
- [x] 🟠 **P1 #A6 — Resolved** `e2e/i18n-preferences.spec.mjs` L200–L226 — S11 现在验证抽屉中的非 ASCII 文件名在语言切换前后不变；S12 实际点击抽屉文档、进入非 ASCII `.mdx`，再沿正文相对 `.md` 链接往返。对应 fixture 为 `e2e/fixtures/中文文档.mdx` 与 `e2e/fixtures/guide/linked.md`。

## Verdict B — Code-quality
**Status: HELD**（当前无未解决 P0/P1；本 verdict 不替代独立 security/a11y/performance gates）

- [x] 🟠 **P1 #B1 — Resolved** `src/app/main.tsx` L59–L69、`src/app/PreferencesProvider.tsx` L103–L105 — 首屏在 `root.render` 前用共享解析结果初始化 `<html>`；后续 DOM 变更只在已提交的 layout effect 中发生，React render 已恢复为纯计算。
- [x] 🟠 **P1 #B2 — Resolved** `src/cli/language.mjs` L36–L92、`bin/mdxv.mjs` L24–L30/L92–L97、`bin/mdxx.mjs` L19–L25/L73–L78 — 两入口共享同一 raw-argv 解析边界，覆盖缺值、重复、`--lang=value`，并捕获 CAC parser error。本轮子进程验证畸形/未知参数均退出 1、只打印本地化诊断且无 `CACError`/调用栈。

## Tracked（P2 / P3 — may remain past merge）

- [x] 🟡 **P2 #A7 — Resolved after review** `src/cli/language.mjs` — `formatCliError` 与 `formatCliParserError` 已补齐 `@param` / `@returns` 公共契约。
- [x] 🟡 **P2 #B3 — Resolved** `src/app/preferences.mjs` L34–L41 — writer 或 storage 缺失时现在先返回 `false`，只有真实 `setItem` 成功才返回 `true`；`test/locale.test.mjs` L49–L55 覆盖缺失 writer 与抛错 storage。

## Verification evidence

- Full-suite trigger: 记录证据无法匹配提交戳（仓库无有效 `HEAD`），因此按例外重跑完整机器套件，而非仅信任 `tdd-evidence.md`。
- `node --test test/cli-language.test.mjs` — exit 0；14 passed，0 failed。真实 `mdxv`/`mdxx` 的 flag/env/system/fallback/invalid 矩阵及 provenance、无副作用断言全部通过。
- `npm test` — exit 0；50 passed，0 failed（包含 locale/preferences、完整 CLI 子进程矩阵、resolve、MDX pipeline 与真实 Vite export）。
- `CI=1 npm run test:e2e` — exit 0；21 passed，0 failed（S1–S8、S10–S12，以及两种 Locale 的两个额外空状态）。
- A5 fix re-review — 新增 invalid-env 测试直接驱动两个 CLI 入口，并与此前手工探针观察一致；未发现通过纯函数替代入口、测试钩子污染产品或只断言叙述性输出的问题。
- Scoped lint/typecheck — `package.json` 未定义 lint 或 typecheck 命令，仓库事实也明确无该门禁，因此无法执行。
- TDD yardstick — 新/改公共规则总体由公开接口行为测试覆盖；本轮不声称项目达到 skill 的仓库级 coverage gate，因为项目没有配置 coverage threshold。当前阻断项是 S9 明文规定的 scripted carrier 缺格，不是产品运行错误或行覆盖率数字。
- Dedicated gates — 本审查未重新运行 security/a11y/performance 确定性扫描，也不以它们替代两个代码审查 verdict。
- Glossary conformance — 仓库不存在 `CONTEXT.md`，无法给出机械 pass；本项不提供正确性信用。

---
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **HELD**
**Progress**: 8 / 8 P0+P1 resolved

两个 verdict 均已持有；#A7 是可留存的 P2，不阻断 merge gate。无有效 `HEAD` 未被算作代码正确性 finding，因此当前 code/spec gate 为 HELD；但本 artifact 仍不能提供候选提交 freshness 证明，产生候选提交后必须以该提交重新审查并刷新 `Commit` 字段。
