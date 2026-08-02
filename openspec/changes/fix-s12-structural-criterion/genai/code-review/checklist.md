# Code Review Checklist — fix-s12-structural-criterion

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: af1c8710e4b70a3499eaac738a8a49fa11bd96f7
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 2（round 1 审 `530cfcc`；本轮审 delta `git diff 530cfcc af1c871`，状态就地更新）

## 复核证据

Round 2 全部重跑，未复用记录值：

| 命令 | 我实测结果 |
|---|---|
| `npm test` | exit 0 · **247 pass / 0 fail / 0 skipped** |
| `make lint` | exit 0 |

另跑了 10 组独立探针实验（不改仓库，脚本在 scratchpad），直接回答本轮两个问题，结果见
#B1 与 #B9 两条。证据戳：`suite-report.md` 现为 `af1c871` 且显示为一处未提交修改 —— 这是
「先提交、再补戳」的固有顺序（commit-match 类证据只可能在提交存在之后才落戳），不是陈旧证据，
round 1 的 #A2 据此关闭。

## Verdict A — Spec-compliance（code-vs-spec，不评判 spec 本身是否是该做的事）
**Status: HELD**

- [x] 🟡 **P2 #A1** ~~`openspec/specs/compile-check/spec.md`——「Wall-clock figures are recorded
  as a budget for the performance gate」已无任何机制支撑~~ **Resolved**：整句删除，改为
  「Elapsed time SHALL NOT be asserted」，不再声称一个不存在的记录物。
- [x] 🟡 **P2 #A2** ~~`suite-report.md` 戳 `63b83db` ≠ 被审 HEAD~~ **Resolved**：现戳
  `af1c871`，等于被审 HEAD。
- [x] 🔵 **P3 #A3** ~~S12 场景只描述 liveness、未提 coverage 控制项~~ **Resolved**：场景改为
  WHEN / THEN / AND 三段，AND 段同时点名 liveness 与 coverage，且「fails the scenario instead of
  passing it vacuously」现在同时覆盖「探针失效」与「探针静默变窄」两种空洞。

新增的 spec 措辞 `in its own process or in any process it spawns`（L252）与测试实际断言的
范围一致 —— 已实测确认该范围可达（见 #B1 表）。三条断言与场景三段一一对应，无 code-vs-spec 缺口。

## Verdict B — Code-quality
**Status: HELD**

- [x] 🟠 **P1 #B1** ~~探针经 argv `--import` 注入，不被子进程继承~~ **Resolved**。
  `test/compile-check.no-build.test.mjs:32-36` 改经 `NODE_OPTIONS` 注入。我用仓库真实 fixture
  独立复测了继承面（**不是**读你的 mutation 记录，是直接测机制）：

  | 场景 | `build({})` 是否被记录 |
  |---|---|
  | 本进程内调用 | ✅ 记录 |
  | fork 一层子进程 | ✅ 记录（这就是 P1 那条回归路径，已堵上） |
  | 孙进程（fork 两层） | ✅ 记录 |
  | `worker_threads` 里调用 | ✅ 记录 |
  | 子进程显式传了不含 `NODE_OPTIONS` 的 `env` | ❌ 不记录（残留，见 #B9） |
  | `createRequire()("vite")` 走 CJS | ❌ 不记录（残留，见 #B9） |

  另外 `npx vite build` 这类「shell 出去跑构建」也在覆盖内 —— 它终归是个 node 进程，等价于第 2/3 行。

- [x] 🟡 **P2 #B2** ~~liveness 用例无 test 级 timeout、丢弃子进程 stderr、诊断误导~~
  **Resolved**：L67 加了 `{ timeout: 60_000 }`；stderr 改为 `pipe` 并留存；轮询改成
  `Promise.race([exited, sleep])`，先断言 `exitedEarly === undefined` 给出
  「preview exited before it reached Vite (code N): <stderr>」，再断言探针记录 —— 两种失败模式
  现在分得开了。`finally` 里复用同一个 `exited` promise，也不会漏挂 listener。
- [x] 🟡 **P2 #B3** ~~`compile-check.cli.test.mjs:8` 指向已删除的 perf 文件~~ **Resolved**：
  改指 `test/compile-check.no-build.test.mjs`，车道描述同步为「同属快车道」。
- [x] 🔵 **P3 #B5** ~~coverage 用例绕开 `withProbe`、写固定 tmp 路径~~ **Resolved**：改走
  `withProbe`，并多加了一条 `callsIn(out)` 为空的断言 —— 这是白赚的一条保证（「仅仅 import
  被包过的模块，不得被记成一次调用」），比我原来的建议更强。
- [x] 🔵 **P3 #B6** ~~`note()` 在 `MDXV_PROBE_OUT` 缺失时抛不知所云的 `TypeError`~~
  **Resolved**：`hooks.mjs:27-31` 改为具名报错，且**没有**降级成静默 no-op —— 方向是对的，
  静默才会制造空洞。
- [x] 🔵 **P3 #B7** ~~`resolve()` 里不可达的 `includes(MARK)` 分支~~ **Resolved**：已删。
  我复核了删除的安全性：`nextResolve("vite", …)` 永远不可能返回带标记的 URL，合成模块又是用
  绝对 file URL（而非裸 `"vite"`）回引真实模块，因此不存在递归；即便 vite 包内自引 `"vite"`
  也只会多包一层，不会失控。删得对。

## Tracked (P2 / P3 — 可留到合并之后)

- [ ] 🔵 **P3 #B9**（本轮新增）`test/compile-check.no-build.test.mjs:32-36` —
  `NODE_OPTIONS` 继承关掉了所有现实路径，但**不是全封闭**，还剩两条实测可绕过的：
  (a) 子进程派生时显式传了不含 `NODE_OPTIONS` 的 `env`；(b) 从 CJS 侧
  `createRequire(...)("vite")` 取 vite —— loader 钩子只管 ESM 图，Node 24 的 require(esm)
  从旁边过去了（实测 exit 0、零记录、无报错）。两条都要求 `--check` 被写成相当反常的样子
  （本仓是纯 ESM，且没有理由在派生时洗掉 env），所以**不阻断合并**；记着即可。
  另需明确一句边界：判据是「不进 vite」，不是「不做构建」—— 换成直接调 rollup/esbuild
  的构建不在 S12 射程内，这是场景定义本身的取舍，不是缺陷。
- [ ] 🔵 **P3 #B8**（round 1 遗留，未修，未归档）`test/compile-check.no-build.test.mjs:53-61` —
  最后一丝空洞仍可零成本堵上：让钩子把「wrapper 模块已求值」写进另一个文件，S12 同时断言
  它非空、调用记录为空。我两轮都是用这个办法独立确认「`--check` 现场探针确实在位」的，
  可直接落进测试。当前靠 liveness 用例间接覆盖，够用但不是同一进程的直接证据。
- [ ] 🟡 **P2** `probe-wrapped-list-vs-repo-vite-surface` — round 1 的 #B4，已按你的判断
  **归档进 `genai/backlog/INBOX.md` 而非本次修**。**我同意这个拆分**：它今天确实完备
  （我两轮都核过，仓库只有 `bin/mdxx.mjs:9` 的 `build` 与 `bin/mdxv.mjs:12` 的 `createServer`），
  守的是未来维护而不是当下断言里的活缺口，本来就是我给的 P2 非阻断项；而且入库条目带了
  `hooks.mjs:6` 与可复验判据，满足 INBOX 表头自己要求的「file:line + 可再验证判据」前置条件。
  不再在本 checklist 里计数。

### 已核查、非问题（供作者对照）

- **`probeEnv` 的 `NODE_OPTIONS` 组合是安全的**，三个面都实测过：
  - **路径带空格**：`pathToFileURL(...).href` 会把空格转义成 `%20`，实测可加载；作为反证，
    手写 `file://${path}` 的朴素写法在同一路径下直接 exit 1（`ERR_INVALID_MODULE_SPECIFIER`）。
    用 `pathToFileURL` 而不是字符串拼接，正是这里唯一正确的选择。
  - **环境里已有 `--import`**：追加而非覆盖，实测两个 loader 都执行（既拿到探针记录，也看到
    另一个 loader 的副作用）。
  - **环境里已有非 import 旗标**（如 `--max-old-space-size`）：保留且探针照常工作。
  - `.filter(Boolean)` 也正确处理了 `NODE_OPTIONS` 未设 / 为空串两种情形。
- mutation battery 的 M2（fork 子进程跑 `build`）我没有复跑（我对产品码只读），但用仓库真实
  fixture 在机制层验证了等价事实：经 `NODE_OPTIONS` 注入后，fork 出去的子进程里的 `build`
  **确实会被记录**。M2 声称的红→绿因此站得住。
- 探针命名空间语义未因本轮改动退化：`export *` 与显式导出的遮蔽关系、`__mdxvProbedExports`
  与 `WRAPPED` 同源不可漂移，round 1 已实测，本轮 diff 未触及。
- **无 scope creep**：产品代码仍是零改动；delta 全部落在测试、fixture、spec、证据与 INBOX。

---
<!-- genai:code-review.verdict blocking-open=0 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **HELD**
**Progress**: 1 / 1 resolved
