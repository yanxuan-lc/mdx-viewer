# INBOX (agent observations)

Facts an agent observed while working. **`unconfirmed` by default, and never entering the
SPRINT candidate pool.** Read only at an explicit pay-down-the-debt moment. Every row must
carry `file:line` + a re-verifiable criterion — that is the precondition for auto-resolution.

| id | title | type | severity | source | status | footprint | relations | evidence |
|---|---|---|---|---|---|---|---|---|
| probe-wrapped-list-vs-repo-vite-surface | test/fixtures/vite-call-probe/hooks.mjs — WRAPPED 清单与仓库真实 vite 入口面没有任何东西钉住，将来引入新入口探针会静默变窄 | debt | P2 | agent | unconfirmed | — | — | test/fixtures/vite-call-probe/hooks.mjs:6 · WRAPPED=["build","createServer"] 今天完备（仅 bin/mdxx.mjs:9 与 bin/mdxv.mjs:12 两处），但 vite 6.4.3 还导出 createBuilder / preview / optimizeDeps。可再验证判据：写一条断言，grep bin/ 与 src/ 里所有 from "vite" 的具名导入，要求每个都在 WRAPPED 里；今天应绿，引入未覆盖入口时应红 |
| s12-probe-escape-env-scrub-and-cjs | test/fixtures/vite-call-probe — 两条反常但真实的探针逃逸路径:派生时显式洗掉 env 里的 NODE_OPTIONS,以及从 CJS 侧 createRequire("vite") | debt | P3 | agent | unconfirmed | — | — | test/compile-check.no-build.test.mjs:29 · code-review #B9 实测 6 种入口:本进程/一层 fork/两层孙进程/worker_threads 全部记录得到;仅「子进程显式传不含 NODE_OPTIONS 的 env」与「createRequire() 走 CJS 取 vite」逃得掉(loader 钩子只管 ESM 图)。两条都要求 --check 写成反常样子,本仓纯 ESM 且无洗 env 的理由,故不阻断。可再验证判据:给 S12 各加一条变异,用上述两种写法进构建,当前应绿(=逃逸),修复后应红 |
