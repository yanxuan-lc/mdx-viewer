# INBOX (agent observations)

Facts an agent observed while working. **`unconfirmed` by default, and never entering the
SPRINT candidate pool.** Read only at an explicit pay-down-the-debt moment. Every row must
carry `file:line` + a re-verifiable criterion — that is the precondition for auto-resolution.

| id | title | type | severity | source | status | footprint | relations | evidence |
|---|---|---|---|---|---|---|---|---|
| s12-probe-escape-env-scrub-and-cjs | test/fixtures/vite-call-probe — 两条反常但真实的探针逃逸路径:派生时显式洗掉 env 里的 NODE_OPTIONS,以及从 CJS 侧 createRequire("vite") | debt | P3 | agent | unconfirmed | — | — | test/compile-check.no-build.test.mjs:29 · code-review #B9 实测 6 种入口:本进程/一层 fork/两层孙进程/worker_threads 全部记录得到;仅「子进程显式传不含 NODE_OPTIONS 的 env」与「createRequire() 走 CJS 取 vite」逃得掉(loader 钩子只管 ESM 图)。两条都要求 --check 写成反常样子,本仓纯 ESM 且无洗 env 的理由,故不阻断。可再验证判据:给 S12 各加一条变异,用上述两种写法进构建,当前应绿(=逃逸),修复后应红 |
| test-lane-invariant-unguarded | 三条测试车道的依赖表面不变式无人守卫 —— L1 混进 spawn / L2 混进构建时不会红,正是本次错标能潜伏数月的原因 | debt | P2 | agent | unconfirmed | — | — | package.json:test:unit/test:cli/test:build · **判据有两维:构建 与 spawn**。code-review #A1 实证:首版只测了构建维度、spawn 维度只声明未测量,结果 compile-check.test.mjs 经 runMdxv 间接 spawn 四次却挂在「零 spawn」的 L1 里——错标在消灭错标的那个提交里当场复发。现状(修复后)实测 L1 build=0/server=0/spawn=0、L2 build=0/server=4/spawn=39、L3 build=11/spawn=6。可再验证判据:两个 loader 探针分别注入(合用会互相干扰,实测 vite 探针会失效),断言 test:unit 的 build/createServer/spawn 三项全为 0(spawn 一项要按**传递闭包**算——L1 文件自己不 spawn 不够,它 import 的 helper 也不能,`test/helpers/` 存在之后这一跳必须算进来,见 code-review #B12)、test:cli 的 build 为 0;把任一构建断言塞回 L1/L2、或给 L1 加一次 spawn,都应变红 |
