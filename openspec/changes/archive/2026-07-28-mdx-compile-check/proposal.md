## Why

`mdxv` 启动成功不代表文档能编译。MDX 编译是**懒的**：只在浏览器 `import("/@fs" + abs)` 那一刻
才发生（`src/app/main.tsx`）。所以对一份编译不过的文档，`mdxv` 依然打印一片绿的 `✓ Preview ready`
面板、进程常驻、退出码正常；破损只在浏览器请求 `/@fs/…` 拿到 500 时才暴露。

产文档的 agent 因此拿到一个「看起来健康」的 URL 就交付。本次触发案例是一份流程产出的 `.mdx`：
硬折行把 `<global|tenant|workspace>` 顶到行首 → MDX 按 flow JSX 解析 →
`Unexpected character \`|\` (U+007C) in name`。

现有替代手段 `mdxx <file> <out.html>` 确实能挡（破损 exit 1），但代价是跑一整轮 Vite 生产构建
（实测 `examples/demo.mdx` 3.77 s），且错误被 `CliOutputError` 吞成一句 `Export failed`，
拿不到 `line:column`（`bin/mdxx.mjs:80-83`）。

## What Changes

- 新增 `mdxv --check <file|dir|demo>` 模式：只做编译合法性校验，不起 server、不写产物、不开浏览器。
- 新增 `src/cli/compile-check.mjs`：用**项目自己的** `mdxOptions()`（`src/mdx/plugins.mjs`）
  逐篇 `compile({ path, value }, mdxOptions())` —— 传 `path` 让库按扩展名推导 `format`，与
  `@mdx-js/rollup` 的行为一致（`.md` 不过 MDX 解析器，否则 `README.md` 会被假失败），
  再把失败归一成 `{line, column, reason}`。
- 扩展 `src/cli/output.mjs`：逐条报告行、汇总行、路径显示、`--check` 的 help 行与边界说明。
- 扩展 `src/i18n/messages.mjs`：新增 `cli.*` 双语键。
- `bin/mdxv.mjs` 只做薄接线：注册 `--check` 布尔选项，在建 Vite server 之前分流。
- 新增 `test/compile-check.test.mjs`（快车道：纯逻辑 + 子进程 CLI，登记进 `package.json` 的
  `test:unit` 显式清单）与 `test/compile-check-perf.test.mjs`（慢车道：要跑真实 `mdxx` 对比，
  **不进** `test:unit`）。

## Impact

**新增**：`src/cli/compile-check.mjs`、`test/compile-check.test.mjs`、
`test/compile-check-perf.test.mjs`、`test/fixtures/compile-check/`（通过 / 破损 / 无位置 /
不可读 / 两档边界 / `.md`-vs-`.mdx` 同源样例）。

**修改**：`bin/mdxv.mjs`、`src/cli/output.mjs`、`src/i18n/messages.mjs`、`package.json`
（`test:unit` 清单）、`Makefile`（`check-mdx` 目标 + `.PHONY` + help 分组 grep）、
`AGENTS.md` / `README*.md`（命令表 + 术语表 + 测试表）。

**明确不动**（CLAUDE.md 硬约束：`plugins.mjs` / `vite-config.mjs` 由 view 与 export 共用）：
`src/mdx/plugins.mjs`、`src/cli/vite-config.mjs`、`src/cli/resolve.mjs`、`bin/mdxx.mjs`、
`src/app/**`。`mdxv` 既有预览路径与 `mdxx` 导出路径行为不变。

无数据库、无 HTTP 接口、无导出格式变化。

## Cross-repo contract

`plugin-infra` 的 `mdx-artifact` skill（`/Users/yanxuan.lc/yanxuan-lc/excalivibe`）将在交付前调用
本命令作为门禁：过了才起预览、才把 URL 交给用户。**flag 名、退出码语义与流分工一旦被它硬编码即成
跨仓库契约**，故本变更把这三项写成规范要求而非实现细节。该 skill 的修改走 skill-creator 轨道，
不属于本变更。
