# Code Review Checklist — localized-document-variants

- **Mode**: Incremental（最终修复复审；fix diff only）
- **Branch**: `main`（unborn branch）
- **Commit**: `UNAVAILABLE` — 仓库没有有效 `HEAD`，无法验证本报告与 merge-candidate HEAD 同戳
- **Reviewed snapshot SHA-256**: `db9821692ae83576b6d0992055a825e5901690cbf134f9d10ec38e4aff9fbff4`（审查范围内文件的内容清单哈希；不能替代 Git commit）
- **Reviewer model**: `gpt-5.6-sol`
- **Scope limitation**: 所有仓库文件均未跟踪，无法取得 merge base 或真实增量 diff；本次按 `localized-document-variants` OpenSpec、其相关实现/测试及当前工作树做 change-scoped 审查。创建有效候选提交后必须刷新 `Commit` 并确认内容未变，当前报告本身不能满足按提交戳读取的 merge gate freshness 要求。

## Verification evidence

- 修复相关测试：`node --test test/local-document-links.test.mjs test/localized-docs.test.mjs test/locale.test.mjs test/resolve.test.mjs` → exit 0，31 pass / 0 fail。
- 完整 Node 套件：`npm test` → exit 0，61 pass / 0 fail。重跑触发条件是证据无可匹配的 Git commit stamp。
- 变更 E2E：`CI=1 npm run test:e2e -- localized-document-variants.spec.mjs --reporter=line` → exit 0，12 pass / 0 fail。
- B6 聚焦复审：`PW_PORT=4198 CI=1 npx playwright test localized-document-variants.spec.mjs --grep 'S4:' --reporter=line` → exit 0，1 pass / 0 fail；覆盖正常持久化、损坏 locale variant 和 Storage 不可用分支。
- 仓库没有 lint、typecheck 或 coverage 命令，故没有可执行的 scoped lint；未把缺失工具表示为通过。
- 已读独立 security / a11y / perf gate 报告，但未替代或重跑这些确定性门禁。
- 项目没有 `CONTEXT.md`；无法作 glossary-conformance 命名结论，这不构成正确性信用。

## Verdict A — Spec-compliance (code-vs-spec; NOT intent)

**Status: HELD（仅针对上述未提交工作树快照；不代表 human intent，也不解除 freshness 限制）**

当前快照对 S1–S12 均有对应实现：精确 locale 与 base-only 回退、直接 URL canonicalization、逻辑导航去重、点号 basename、POSIX/Windows 相对链接与 query/hash 保留、双语 demo、单物理文件导出边界、36px 顶栏及匹配的本地化 `title` / `aria-label`。未发现本 verdict 下未解决的 P0/P1。

## Verdict B — Code-quality

**Status: HELD**

- [x] 🟠 **P1 #B1 — Resolved** `src/app/main.tsx` L112 — locale 切换已改为同一 React root 内的 `renderDocument(physicalDoc, activeLocale)`，显式把内存 locale 传给文档选择、导航投影和 Preferences bootstrap；`Layout.tsx` L184–187 不再以持久化成功作为切换条件。浏览器回归让 Storage 的 `getItem` / `setItem` 抛错后，仍断言 `lang=zh-CN`、中文物理变体可见且 `?doc=` 指向 `README.zh-CN.mdx`。
- [x] 🟠 **P1 #B2 — Resolved** `src/app/local-document-links.mjs` L27 — 已提取跨平台纯解析器，兼容 POSIX 与 drive-letter Windows 路径；`test/local-document-links.test.mjs` L12 直接验证 `C:\docs\guide\links.mdx` 的父目录解析，Layout 使用规范化结果做 family 选择。
- [x] 🟠 **P1 #B6 — Resolved** `src/app/main.tsx` L117 — `renderDocument` 先在 try/catch 内完成目标物理 MDX import，成功后才于 L128–140提交 preferences、URL 和 React content；失败时 L123–125 使用 `activeLocale` 调用 `renderLocalizedError`，切换回调 L134–136 也显式承接其余 rejection。S4 的 malformed `zh-CN` variant 回归断言中文错误、旧正文消失、URL不指向损坏变体且 `pageerror=[]`，聚焦复跑通过。

## Tracked (P2 / P3 — may remain past merge)

- [x] 🟡 **P2 #B3 — Resolved** `src/app/local-document-links.mjs` L47 — `buildLocalizedDocumentUrl` 现保留目标 query 和 fragment，再设置本地化 `doc`；纯函数测试及 S8 浏览器测试分别断言 `?view=...#...`。
- [x] 🟡 **P2 #B4 — Resolved** `openspec/changes/localized-document-variants/tdd-evidence.md` L9 — S1–S12 映射、link-routing red/green、31-test scoped 与 61-test full 结果均已刷新；`tasks.md` L8 已标记 Playwright 完成并指向 manifest。
- [x] 🟡 **P2 #B5 — Resolved** `demo/index.zh-CN.mdx` L20 — 中文 counterpart 的导出与源码路径均已改为 `demo/index.zh-CN.mdx`；双语 demo 结构仍完整。
- [x] 🟡 **P2 #B7 — Resolved** `openspec/changes/localized-document-variants/e2e-report.md` L11 — execution evidence 与 L42 regression summary 均已刷新为 Node 61 pass / 0 fail / 0 skipped，并与 `tdd-evidence.md` 一致。

---
**Merge gate**: HELD only when BOTH verdicts are HELD and `Commit` equals merge-candidate HEAD. Currently: **NOT HELD — both verdicts are HELD, but no Git HEAD exists for the required freshness match**
**Progress**: 3 / 3 P0+P1 resolved
