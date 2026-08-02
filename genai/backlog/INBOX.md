# INBOX (agent observations)

Facts an agent observed while working. **`unconfirmed` by default, and never entering the
SPRINT candidate pool.** Read only at an explicit pay-down-the-debt moment. Every row must
carry `file:line` + a re-verifiable criterion — that is the precondition for auto-resolution.

| id | title | type | severity | source | status | footprint | relations | evidence |
|---|---|---|---|---|---|---|---|---|
| probe-wrapped-list-vs-repo-vite-surface | test/fixtures/vite-call-probe/hooks.mjs — WRAPPED 清单与仓库真实 vite 入口面没有任何东西钉住，将来引入新入口探针会静默变窄 | debt | P2 | agent | unconfirmed | — | — | test/fixtures/vite-call-probe/hooks.mjs:6 · WRAPPED=["build","createServer"] 今天完备（仅 bin/mdxx.mjs:9 与 bin/mdxv.mjs:12 两处），但 vite 6.4.3 还导出 createBuilder / preview / optimizeDeps。可再验证判据：写一条断言，grep bin/ 与 src/ 里所有 from "vite" 的具名导入，要求每个都在 WRAPPED 里；今天应绿，引入未覆盖入口时应红 |
